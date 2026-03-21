-- ============================================================
-- Ultimate Training Room - Game Speed Control
-- 通过 tf_OtherSetting.ApplyGameSpeed() 即时调整游戏速度
-- ============================================================

local M = {}

-- GameSpeed 枚举: 0=50%, 1=60%, ..., 5=100%, ..., 10=150%
local speed_labels = {
    [0]  = "50%",  [1]  = "60%",  [2]  = "70%",
    [3]  = "80%",  [4]  = "90%",  [5]  = "100%",
    [6]  = "110%", [7]  = "120%", [8]  = "130%",
    [9]  = "140%", [10] = "150%",
}

local TF_OTHER_SETTING_INDEX = 10

local function get_training_manager()
    return sdk.get_managed_singleton("app.training.TrainingManager")
end

local function get_other_setting()
    local tm = get_training_manager()
    if not tm then return nil, nil end
    local tData = tm._tData
    if not tData then return nil, nil end
    return tData.OtherSetting, tm
end

local function apply_game_speed(tm)
    local tf = tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value
    tf:call("ApplyGameSpeed")
end

-- ========== UI ==========
function M.draw_ui()
    if imgui.tree_node("Game Speed") then
        local os_setting, tm = get_other_setting()
        if os_setting and tm then
            local speed = os_setting.OS_Game_Speed
            local enabled = os_setting.Is_Speed_Setting

            local changed_en, new_enabled = imgui.checkbox("Active", enabled)
            if changed_en then
                os_setting.Is_Speed_Setting = new_enabled
                if not new_enabled then
                    os_setting.OS_Game_Speed = 5
                end
                apply_game_speed(tm)
            end

            imgui.text("Speed: " .. (speed_labels[speed] or ("? (" .. speed .. ")")))

            local changed, new_speed = imgui.slider_int("Speed", speed, 0, 10)
            if changed then
                os_setting.OS_Game_Speed = new_speed
                os_setting.Is_Speed_Setting = true
                apply_game_speed(tm)
            end

            imgui.separator()
            if imgui.button("Reset Speed") then
                os_setting.Is_Speed_Setting = false
                os_setting.OS_Game_Speed = 5
                apply_game_speed(tm)
            end
        else
            imgui.text("Not in training mode...")
        end
        imgui.tree_pop()
    end
end

return M
