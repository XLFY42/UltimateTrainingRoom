-- ============================================================
-- 测试脚本: 超范围速度值测试
-- 尝试传入枚举范围外的整数给 SetGameSpeed
-- ============================================================

local TF_OTHER_SETTING_INDEX = 10

local function get_func_data()
    local tm = sdk.get_managed_singleton("app.training.TrainingManager")
    if not tm then return nil, nil end
    local tf = tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value
    if not tf then return nil, nil end
    local func_data = tf:get_field("FuncList")
    return func_data, tm
end

local test_speed = 5

re.on_draw_ui(function()
    if imgui.tree_node("测试: 超范围速度") then
        local fd, tm = get_func_data()
        if fd then
            imgui.text("当前测试值: " .. test_speed)

            local changed
            changed, test_speed = imgui.slider_int("速度值", test_speed, -5, 20)

            if imgui.button("应用") then
                fd:call("SetActiveGameSpeed", true)
                fd:call("SetGameSpeed", test_speed)
                tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value:call("ApplyGameSpeed")
            end

            imgui.separator()
            imgui.text("快捷测试:")
            if imgui.button("11 (160%?)") then
                fd:call("SetActiveGameSpeed", true)
                fd:call("SetGameSpeed", 11)
                tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value:call("ApplyGameSpeed")
            end
            imgui.same_line()
            if imgui.button("15 (200%?)") then
                fd:call("SetActiveGameSpeed", true)
                fd:call("SetGameSpeed", 15)
                tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value:call("ApplyGameSpeed")
            end
            imgui.same_line()
            if imgui.button("5 (100%)") then
                fd:call("SetActiveGameSpeed", true)
                fd:call("SetGameSpeed", 5)
                tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value:call("ApplyGameSpeed")
            end

            imgui.separator()
            if imgui.button("关闭速度调整") then
                fd:call("SetActiveGameSpeed", false)
                fd:call("SetGameSpeed", 5)
                tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value:call("ApplyGameSpeed")
            end
        else
            imgui.text("未在训练模式中...")
        end
        imgui.tree_pop()
    end
end)
