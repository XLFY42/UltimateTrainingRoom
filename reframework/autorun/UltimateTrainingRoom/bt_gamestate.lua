-- ============================================================
-- bt_gamestate.lua - 游戏状态快照
-- 每帧 tick 开始时从 gBattle 读取 P1/P2 状态
-- ============================================================

local M = {}

-- 缓存类型定义（只查找一次）
local gBattle_type = sdk.find_type_definition("gBattle")

-- ========== Frame Meter 实时感知缓存 ==========
local frameMeterHooksInitialized = false

local frameMeterState = {
    p1 = {
        lastFrameType = 0,
        isEnd = false,
    },
    p2 = {
        lastFrameType = 0,
        isEnd = false,
    },
}

local DEFAULT_FRAME_TYPE = 0
local DEFAULT_IS_END = false

local frameMeterCalledSinceRefresh = {
    p1 = false,
    p2 = false,
}

local function toNum(v, default)
    local n = tonumber(tostring(v))
    if n == nil then return default or 0 end
    return n
end

local function updateFrameMeterPlayerFromArgs(calledKey, playerState, args)
    local frameType = toNum(sdk.to_int64(args[4]), 0)
    local endRaw = 0
    if args[5] ~= nil then
        endRaw = toNum(sdk.to_int64(args[5]), 0)
    end
    local isEnd = (endRaw & 1) == 1

    -- 该玩家本帧确实被回调过（用于 refresh 阶段决定是否回填默认值）
    frameMeterCalledSinceRefresh[calledKey] = true

    -- 空调用不覆盖已有有效值
    if frameType == 0 and not isEnd then
        return
    end

    playerState.lastFrameType = frameType
    playerState.isEnd = isEnd
end

function M.initFrameMeterHooks()
    if frameMeterHooksInitialized then return true end

    local t_fm = sdk.find_type_definition("app.training.UIWidget_TMFrameMeter")
    if not t_fm then return false end

    local m_setup = t_fm:get_method("SetUpFrame")
    if m_setup then
        sdk.hook(
            m_setup,
            function(args)
                updateFrameMeterPlayerFromArgs("p1", frameMeterState.p1, args)
            end,
            function(retval)
                return retval
            end
        )
    end

    local m_setdown = t_fm:get_method("SetDownFrame")
    if m_setdown then
        sdk.hook(
            m_setdown,
            function(args)
                updateFrameMeterPlayerFromArgs("p2", frameMeterState.p2, args)
            end,
            function(retval)
                return retval
            end
        )
    end

    if not m_setup and not m_setdown then
        return false
    end

    frameMeterHooksInitialized = true
    return true
end

function M.refresh(ctx)
    -- 仅在上一帧已结束且本帧未收到 SetUpFrame 时，回填 P1 默认值
    if not frameMeterCalledSinceRefresh.p1 and frameMeterState.p1.isEnd then
        frameMeterState.p1.lastFrameType = DEFAULT_FRAME_TYPE
        frameMeterState.p1.isEnd = DEFAULT_IS_END
    end

    -- 仅在上一帧已结束且本帧未收到 SetDownFrame 时，回填 P2 默认值
    if not frameMeterCalledSinceRefresh.p2 and frameMeterState.p2.isEnd then
        frameMeterState.p2.lastFrameType = DEFAULT_FRAME_TYPE
        frameMeterState.p2.isEnd = DEFAULT_IS_END
    end

    -- 开启新一帧统计窗口
    frameMeterCalledSinceRefresh.p1 = false
    frameMeterCalledSinceRefresh.p2 = false

    ctx.game_state = ctx.game_state or {}
    ctx.game_state.in_battle = false

    if not gBattle_type then
        gBattle_type = sdk.find_type_definition("gBattle")
        if not gBattle_type then return end
    end

    local ok, sPlayer = pcall(function()
        return gBattle_type:get_field("Player"):get_data(nil)
    end)
    if not ok or not sPlayer then return end

    local mc = sPlayer.mcPlayer
    if not mc then return end

    local p1 = mc[0]
    local p2 = mc[1]
    if not p1 or not p2 then return end

    -- Team 数据（Super 在 Team 层）
    local ok2, sTeam = pcall(function()
        return gBattle_type:get_field("Team"):get_data(nil)
    end)
    local teams = nil
    if ok2 and sTeam then
        teams = sTeam.mcTeam
    end

    ctx.game_state.in_battle = true

    -- P1 快照
    ctx.game_state.p1 = {
        hp          = p1.vital_new,
        hp_max      = p1.vital_max,
        drive       = p1.focus_new,
        drive_wait  = p1.focus_wait,
        super       = teams and teams[0] and teams[0].mSuperGauge or 0,
        stance      = p1.pose_st,          -- 0=stand, 1=crouch, 2=air
        hitstun     = p1.damage_time,
        blockstun   = p1.guard_time,
        hitstop     = p1.hit_stop,
        invuln      = p1.muteki_time,
        facing_left = p1:call("get_IsLeft"),
        cmd_dir     = p1.cmd_dir,          -- 指令方向（输入解释用）
        cmd_side    = p1.cmd_side,         -- 角色相对位置侧
        pos_x       = p1.pos.x.v / 6553600.0,
        pos_y       = p1.pos.y.v / 6553600.0,
        input       = p1.pl_input_new,
        ref         = p1,                  -- 直接引用，供 bt_input 使用
    }

    -- P2 快照
    ctx.game_state.p2 = {
        hp          = p2.vital_new,
        hp_max      = p2.vital_max,
        drive       = p2.focus_new,
        drive_wait  = p2.focus_wait,
        super       = teams and teams[1] and teams[1].mSuperGauge or 0,
        stance      = p2.pose_st,
        hitstun     = p2.damage_time,
        blockstun   = p2.guard_time,
        hitstop     = p2.hit_stop,
        invuln      = p2.muteki_time,
        facing_left = p2:call("get_IsLeft"),
        cmd_dir     = p2.cmd_dir,
        cmd_side    = p2.cmd_side,
        pos_x       = p2.pos.x.v / 6553600.0,
        pos_y       = p2.pos.y.v / 6553600.0,
        input       = p2.pl_input_new,
        ref         = p2,
    }

    -- 距离
    ctx.game_state.distance = math.abs(
        ctx.game_state.p1.pos_x - ctx.game_state.p2.pos_x
    )

    -- Frame Meter 最小感知快照（参数直读，主循环只读取）
    ctx.game_state.p1.frameMeter = {
        lastFrameType = frameMeterState.p1.lastFrameType,
        isEnd = frameMeterState.p1.isEnd,
    }

    ctx.game_state.p2.frameMeter = {
        lastFrameType = frameMeterState.p2.lastFrameType,
        isEnd = frameMeterState.p2.isEnd,
    }
end

return M
