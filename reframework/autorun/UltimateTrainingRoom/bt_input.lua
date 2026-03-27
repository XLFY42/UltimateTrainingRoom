-- ============================================================
-- bt_input.lua - 双 Hook 模块
-- Hook 1: UpdateFrameMain pre → BT tick 驱动（每战斗帧 1 次）
-- Hook 2: pl_input_sub post → 输入注入（每玩家每帧 1 次）
-- Hook 3: UIWidget_TMFrameMeter SetUp/SetDown post → 帧数条实时感知更新
-- ============================================================

local runtime = require("UltimateTrainingRoom.bt_runtime")
local gamestate = require("UltimateTrainingRoom.bt_gamestate")
local logger = require("UltimateTrainingRoom.bt_logger")

local M = {}

-- ========== 玩家引用（用于输入注入） ==========
local p1_ref = nil
local p2_ref = nil
local p1_addr = 0
local p2_addr = 0
local refs_valid = false

-- hook 内 pre→post 传递（使用栈以支持嵌套调用）
local p_id_stack = {}

-- 每帧只刷新一次 refs 的控制
local refs_refreshed_this_frame = false

-- 是否已初始化
local tick_hook_initialized = false
local input_hook_initialized = false

-- ========== 调试计数 ==========
local debug_tick_count = 0
local debug_inject_p1 = 0
local debug_inject_p2 = 0

-- ========== 刷新玩家引用 ==========
local function refresh_player_refs()
    local gBattle_type = sdk.find_type_definition("gBattle")
    if not gBattle_type then
        refs_valid = false
        return
    end
    local ok, sPlayer = pcall(function()
        return gBattle_type:get_field("Player"):get_data(nil)
    end)
    if not ok or not sPlayer then
        refs_valid = false
        return
    end
    local mc = sPlayer.mcPlayer
    if not mc then
        refs_valid = false
        return
    end
    p1_ref = mc[0]
    p2_ref = mc[1]
    if p1_ref and p2_ref then
        p1_addr = p1_ref:get_address()
        p2_addr = p2_ref:get_address()
        refs_valid = true
    else
        refs_valid = false
    end
end

-- ========== Hook 1: BT Tick 驱动 ==========
-- hook app.BattleFlow.UpdateFrameMain pre-function
-- 每战斗帧执行 1 次，在所有玩家处理之前
function M.init_tick_hook()
    if tick_hook_initialized then return true end

    local bf_type = sdk.find_type_definition("app.BattleFlow")
    if not bf_type then
        logger.push("BT Input", "ERROR: app.BattleFlow not found")
        return false
    end

    local method = bf_type:get_method("UpdateFrameMain")
    if not method then
        logger.push("BT Input", "ERROR: UpdateFrameMain not found")
        return false
    end

    sdk.hook(
        method,
        -- pre_function: tick BT before player processing
        function(args)
            -- 安全机制：清空堆栈以防止跨帧泄漏
            p_id_stack = {}

            -- 标记新帧开始，refs 需要在 pl_input_sub 中刷新
            refs_refreshed_this_frame = false

            -- 刷新游戏状态
            local ctx = runtime.get_context()
            gamestate.refresh(ctx)

            -- tick 行为树
            if runtime.is_running() then
                runtime.tick()
                debug_tick_count = debug_tick_count + 1
            end
        end,
        -- post_function: nothing needed
        function(retval)
            return retval
        end
    )

    -- 初始化 Frame Meter 实时感知 hooks
    local fmOk = gamestate.initFrameMeterHooks()
    if fmOk then
        logger.push("BT Input", "Frame meter hooks initialized")
    else
        logger.push("BT Input", "WARN: Frame meter hooks not found")
    end

    tick_hook_initialized = true
    logger.push("BT Input", "Tick hook on UpdateFrameMain initialized")
    return true
end

-- ========== Hook 2: 输入注入 ==========
-- hook nBattle.cPlayer.pl_input_sub post-function
-- 仅负责将预计算的 inject_mask 写入 pl_input_new
function M.init_input_hooks()
    if input_hook_initialized then return true end

    local cplayer_type = sdk.find_type_definition("nBattle.cPlayer")
    if not cplayer_type then return false end

    local method = cplayer_type:get_method("pl_input_sub")
    if not method then return false end

    sdk.hook(
        method,
        -- pre_function: 识别玩家并入栈（支持嵌套调用）
        function(args)
            -- 每帧第一次 pl_input_sub 调用时刷新玩家引用
            -- （在 pl_input_sub 内刷新比在 UpdateFrameMain 更可靠）
            if not refs_refreshed_this_frame then
                refresh_player_refs()
                refs_refreshed_this_frame = true
            end

            local p_id = -1
            if refs_valid then
                local hook_addr = sdk.to_int64(args[2])
                if hook_addr == p1_addr then
                    p_id = 0
                elseif hook_addr == p2_addr then
                    p_id = 1
                end
            end

            -- 压栈，确保 post 阶段与本次 pre 一一对应
            table.insert(p_id_stack, p_id)
        end,
        -- post_function: 仅应用注入掩码
        function(retval)
            local p_id = table.remove(p_id_stack) or -1

            if p_id == 0 then
                local p1_mask = runtime.get_p1_mask()
                if p1_mask > 0 and p1_ref then
                    local original = p1_ref:get_field("pl_input_new")
                    if type(original) == "number" then
                        p1_ref:set_field("pl_input_new", original | p1_mask)
                        debug_inject_p1 = debug_inject_p1 + 1
                    end
                end
            elseif p_id == 1 then
                local p2_mask = runtime.get_p2_mask()
                if p2_mask > 0 and p2_ref then
                    local original = p2_ref:get_field("pl_input_new")
                    if type(original) == "number" then
                        p2_ref:set_field("pl_input_new", original | p2_mask)
                        debug_inject_p2 = debug_inject_p2 + 1
                    end
                end
            end

            return retval
        end
    )

    input_hook_initialized = true
    logger.push("BT Input", "Input injection hook on pl_input_sub initialized")
    return true
end

-- ========== 延迟操作执行（UpdateBehavior 前） ==========
function M.init_deferred_executor()
    re.on_pre_application_entry("UpdateBehavior", function()
        local actions = runtime.get_deferred_actions()
        if #actions > 0 then
            for _, action in ipairs(actions) do
                local ok, err = pcall(action)
                if not ok then
                    logger.push("BT", "Deferred action error: " .. tostring(err))
                end
            end
            runtime.clear_deferred_actions()
        end
    end)
end

-- ========== 调试信息 ==========
function M.get_debug_info()
    return {
        tick_hook = tick_hook_initialized,
        input_hook = input_hook_initialized,
        refs_valid = refs_valid,
        tick_count = debug_tick_count,
        inject_p1 = debug_inject_p1,
        inject_p2 = debug_inject_p2,
    }
end

return M
