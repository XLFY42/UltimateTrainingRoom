-- ============================================================
-- 测试脚本: 战斗帧时间分析 (Frame Meter 风格)
-- Hook UpdateFrameMain，记录每次调用的时间间隔和 GC/AC/NAC
-- 60 格循环显示，类似 SF6 Frame Meter
-- ============================================================

local TF_OTHER_SETTING_INDEX = 10

local gBattle_type = sdk.find_type_definition("gBattle")
local game_field = gBattle_type:get_field("Game")

local function get_game_data()
    local tm = sdk.get_managed_singleton("app.training.TrainingManager")
    if not tm then return nil end
    local tf = tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value
    if not tf then return nil end
    return tf:get_field("_GameData")
end

local function get_sGame()
    return game_field:get_data(nil)
end

-- 60 格循环缓冲区
local BUFFER_SIZE = 60
local buffer = {}
for i = 1, BUFFER_SIZE do
    buffer[i] = { dt = 0, gc = 0, ac = 0, nac = 0, st = 0 }
end
local write_index = 1
local last_time = nil
local last_stage_timer = nil
local active = false

-- Hook UpdateFrameMain
local bf_type = sdk.find_type_definition("app.BattleFlow")
if bf_type then
    local method = bf_type:get_method("UpdateFrameMain")
    if method then
        sdk.hook(method,
            function(args)
                if not active then return end

                local now = os.clock()
                local dt = 0
                if last_time then
                    dt = (now - last_time) * 1000
                end
                last_time = now

                local gc, ac, nac = 0, 0, 0
                local gd = get_game_data()
                if gd then
                    gc = gd.GameCount
                    ac = gd.ActiveCount
                    nac = gd.NextActiveCount
                end

                local st_delta = 0
                local sGame = get_sGame()
                if sGame then
                    local st = sGame.stage_timer
                    if last_stage_timer then
                        st_delta = st - last_stage_timer
                    end
                    last_stage_timer = st
                end

                buffer[write_index] = { dt = dt, gc = gc, ac = ac, nac = nac, st = st_delta }
                write_index = write_index % BUFFER_SIZE + 1
            end,
            function(retval) return retval end
        )
    end
end

re.on_draw_ui(function()
    if imgui.tree_node("测试: 帧时间 Frame Meter") then
        local changed
        changed, active = imgui.checkbox("启用记录", active)
        if not active then
            last_time = nil
            last_stage_timer = nil
        end

        imgui.separator()

        -- 从 write_index 开始往回读，显示从旧到新
        for i = 0, BUFFER_SIZE - 1 do
            local idx = (write_index - 1 - i) % BUFFER_SIZE + 1
            -- 但我们要从上到下 = 从旧到新，所以反过来
        end

        -- 从旧到新显示
        for i = 0, BUFFER_SIZE - 1 do
            local idx = (write_index + i) % BUFFER_SIZE + 1
            local f = buffer[idx]
            imgui.text(string.format("%2d | %5.1f ms | ST=%d GC=%2d AC=%2d NAC=%2d",
                i + 1, f.dt, f.st, f.gc, f.ac, f.nac))
        end

        imgui.tree_pop()
    end
end)
