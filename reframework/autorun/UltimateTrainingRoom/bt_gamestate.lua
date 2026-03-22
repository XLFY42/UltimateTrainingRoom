-- ============================================================
-- bt_gamestate.lua - 游戏状态快照
-- 每帧 tick 开始时从 gBattle 读取 P1/P2 状态
-- ============================================================

local M = {}

-- 缓存类型定义（只查找一次）
local gBattle_type = sdk.find_type_definition("gBattle")

function M.refresh(ctx)
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
end

return M
