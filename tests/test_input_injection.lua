-- ============================================================
-- 测试脚本: 输入注入 V13 - 玩家区分 (地址比较)
-- 每帧从 gBattle.Player.mcPlayer 获取 P1/P2 引用
-- 在 hook 中比较 args[2] 地址来判断是哪个玩家
-- ============================================================

local MASK_UP    = 1
local MASK_DOWN  = 2
local MASK_BACK  = 4
local MASK_FWD   = 8
local MASK_LP    = 16
local MASK_MP    = 32
local MASK_HP    = 64
local MASK_LK    = 128
local MASK_MK    = 256
local MASK_HK    = 512

local test_inject_enabled = false
local test_inject_fwd = false
local test_inject_lp = false
local test_inject_lr = false
local test_inject_ud = false
local inject_target = 0  -- 0=P1, 1=P2

-- 玩家引用缓存（在 hook 内部每帧刷新一次）
local p1_ref = nil
local p2_ref = nil
local p1_addr = 0   -- P1 的内存地址（整数），用于 hook 中快速比较
local p2_addr = 0   -- P2 的内存地址（整数）
local refs_valid = false

-- hook 中 pre→post 传递的玩家标记（-1=跳过, 0=P1, 1=P2）
local current_hook_player = -1
-- 每帧在 hook 内部只刷新一次引用的控制变量
local last_refresh_hook_count = -1

local debug_hook_calls = 0
local debug_inject_count = 0
local debug_last_original = "N/A"
local debug_last_written = "N/A"

local rate_last_time = os.clock()
local rate_last_calls = 0
local rate_last_inject = 0
local display_calls_per_sec = 0
local display_inject_per_sec = 0

local hooks_initialized = false

-- 刷新玩家引用
local function refresh_player_refs()
    local gBattle_type = sdk.find_type_definition("gBattle")
    if not gBattle_type then
        refs_valid = false
        return
    end
    local sPlayer = gBattle_type:get_field("Player"):get_data(nil)
    if not sPlayer then
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

local function init_hooks()
    if hooks_initialized then return end

    local cplayer_type = sdk.find_type_definition("nBattle.cPlayer")
    if not cplayer_type then return end

    local method = cplayer_type:get_method("pl_input_sub")
    if not method then return end

    sdk.hook(
        method,
        function(args)
            debug_hook_calls = debug_hook_calls + 1
            current_hook_player = -1

            if not test_inject_enabled then return end

            -- 每帧第一次 hook 调用时刷新玩家引用（每帧2次调用，只刷新1次）
            if debug_hook_calls ~= last_refresh_hook_count then
                last_refresh_hook_count = debug_hook_calls
                refresh_player_refs()
            end

            if not refs_valid then return end

            local hook_addr = sdk.to_int64(args[2])

            if hook_addr == p1_addr then
                current_hook_player = 0
            elseif hook_addr == p2_addr then
                current_hook_player = 1
            end
        end,
        function(retval)
            if current_hook_player == inject_target then
                local target_ref = (inject_target == 0) and p1_ref or p2_ref

                local current_mask = 0
                if test_inject_fwd then current_mask = current_mask | MASK_FWD end
                if test_inject_lp then current_mask = current_mask | MASK_LP end
                if test_inject_lr then current_mask = current_mask | MASK_FWD | MASK_BACK end
                if test_inject_ud then current_mask = current_mask | MASK_UP | MASK_DOWN end

                if current_mask > 0 then
                    local original = target_ref:get_field("pl_input_new")
                    if type(original) == "number" then
                        local new_val = original | current_mask
                        target_ref:set_field("pl_input_new", new_val)

                        debug_last_original = string.format("0x%X", original)
                        debug_last_written = string.format("0x%X", new_val)
                        debug_inject_count = debug_inject_count + 1
                    end
                end
            end

            current_hook_player = -1
            return retval
        end
    )

    print("[V13] Hook on pl_input_sub 初始化成功!")
    hooks_initialized = true
end

init_hooks()

re.on_draw_ui(function()
    if imgui.tree_node("测试: 输入注入 V13 (玩家区分)") then
        changed, test_inject_enabled = imgui.checkbox("启用注入", test_inject_enabled)

        if test_inject_enabled then
            changed, test_inject_fwd = imgui.checkbox("注入右走 (RIGHT=8)", test_inject_fwd)
            changed, test_inject_lp = imgui.checkbox("注入轻拳 (LP=16)", test_inject_lp)
            changed, test_inject_lr = imgui.checkbox("注入左+右 (L+R=12) SOCD不可能值", test_inject_lr)
            changed, test_inject_ud = imgui.checkbox("注入上+下 (U+D=3) SOCD不可能值", test_inject_ud)
            changed, inject_target = imgui.slider_int("注入目标 (0=P1, 1=P2)", inject_target, 0, 1)
        end

        if imgui.tree_node("调试信息") then
            local now = os.clock()
            local dt = now - rate_last_time
            if dt >= 1.0 then
                display_calls_per_sec = math.floor((debug_hook_calls - rate_last_calls) / dt + 0.5)
                display_inject_per_sec = math.floor((debug_inject_count - rate_last_inject) / dt + 0.5)
                rate_last_calls = debug_hook_calls
                rate_last_inject = debug_inject_count
                rate_last_time = now
            end

            imgui.text("Hooks 已初始化: " .. tostring(hooks_initialized))
            imgui.text("玩家引用有效: " .. tostring(refs_valid))
            imgui.text("pl_input_sub 总调用: " .. tostring(debug_hook_calls))
            imgui.text("成功注入总次数: " .. tostring(debug_inject_count))
            imgui.text("--- 速率监控 (每秒) ---")
            imgui.text("Hook 调用/秒: " .. tostring(display_calls_per_sec) .. " (60fps时预期120)")
            imgui.text("注入成功/秒: " .. tostring(display_inject_per_sec) .. " (单玩家预期60)")
            imgui.text("--- 值 ---")
            imgui.text("最近原始值: " .. debug_last_original)
            imgui.text("最近写入值: " .. debug_last_written)
            imgui.tree_pop()
        end

        imgui.tree_pop()
    end
end)
