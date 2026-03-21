-- ============================================================
-- 测试脚本: 游戏速度调整
-- 通过修改 _tData.OtherSetting 并调用 tf_OtherSetting.ApplyGameSpeed()
-- 使用 tf_ 子模块直接应用方案，绕过 Apply/闪退
-- ============================================================

-- GameSpeed 枚举: 0=50%, 1=60%, 2=70%, 3=80%, 4=90%, 5=100%, 6=110%, 7=120%, 8=130%, 9=140%, 10=150%
local speed_labels = {
    [0]  = "50%  (SPEED_50)",
    [1]  = "60%  (SPEED_60)",
    [2]  = "70%  (SPEED_70)",
    [3]  = "80%  (SPEED_80)",
    [4]  = "90%  (SPEED_90)",
    [5]  = "100% (SPEED_100)",
    [6]  = "110% (SPEED_110)",
    [7]  = "120% (SPEED_120)",
    [8]  = "130% (SPEED_130)",
    [9]  = "140% (SPEED_140)",
    [10] = "150% (SPEED_150)",
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

re.on_draw_ui(function()
    if imgui.tree_node("测试: 游戏速度调整") then
        local os_setting, tm = get_other_setting()
        if os_setting and tm then
            local speed = os_setting.OS_Game_Speed
            local enabled = os_setting.Is_Speed_Setting

            imgui.text("Is_Speed_Setting: " .. tostring(enabled))
            imgui.text("当前速度: " .. (speed_labels[speed] or ("未知 (" .. speed .. ")")))

            imgui.separator()
            local changed, new_speed = imgui.slider_int("速度", speed, 0, 10)
            if changed then
                os_setting.OS_Game_Speed = new_speed
                os_setting.Is_Speed_Setting = true
                apply_game_speed(tm)
            end

            -- 快捷按钮
            imgui.text("快捷:")
            imgui.same_line()
            if imgui.button("50%") then
                os_setting.OS_Game_Speed = 0
                os_setting.Is_Speed_Setting = true
                apply_game_speed(tm)
            end
            imgui.same_line()
            if imgui.button("100%") then
                os_setting.OS_Game_Speed = 5
                os_setting.Is_Speed_Setting = true
                apply_game_speed(tm)
            end
            imgui.same_line()
            if imgui.button("150%") then
                os_setting.OS_Game_Speed = 10
                os_setting.Is_Speed_Setting = true
                apply_game_speed(tm)
            end

            imgui.separator()
            if imgui.button("关闭速度调整") then
                os_setting.Is_Speed_Setting = false
                os_setting.OS_Game_Speed = 5
                apply_game_speed(tm)
            end
        else
            imgui.text("未在训练模式中...")
        end

        imgui.tree_pop()
    end
end)
