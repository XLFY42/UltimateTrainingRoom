-- ============================================================
-- 测试脚本: 修改速度后调用 tf_OtherSetting.ApplyGameSpeed()
-- 验证能否绕过 Apply/闪退，直接调用子模块的应用函数
-- ============================================================

re.on_draw_ui(function()
    if imgui.tree_node("测试: ApplyGameSpeed") then
        local tm = sdk.get_managed_singleton("app.training.TrainingManager")
        if tm then
            local tData = tm._tData
            local os_setting = tData and tData.OtherSetting
            if os_setting then
                local speed = os_setting.OS_Game_Speed
                local enabled = os_setting.Is_Speed_Setting
                imgui.text("Is_Speed_Setting: " .. tostring(enabled))
                imgui.text("当前速度: " .. tostring(speed))

                imgui.separator()
                local changed, new_speed = imgui.slider_int("速度", speed, 0, 10)
                if changed then
                    os_setting.OS_Game_Speed = new_speed
                    os_setting.Is_Speed_Setting = true
                    local tf = tm._tfFuncs._entries[10].value
                    tf:call("ApplyGameSpeed")
                end

                imgui.separator()
                imgui.text("快捷:")
                imgui.same_line()
                if imgui.button("50%") then
                    os_setting.OS_Game_Speed = 0
                    os_setting.Is_Speed_Setting = true
                    tm._tfFuncs._entries[10].value:call("ApplyGameSpeed")
                end
                imgui.same_line()
                if imgui.button("100%") then
                    os_setting.OS_Game_Speed = 5
                    os_setting.Is_Speed_Setting = true
                    tm._tfFuncs._entries[10].value:call("ApplyGameSpeed")
                end
                imgui.same_line()
                if imgui.button("150%") then
                    os_setting.OS_Game_Speed = 10
                    os_setting.Is_Speed_Setting = true
                    tm._tfFuncs._entries[10].value:call("ApplyGameSpeed")
                end

                imgui.separator()
                if imgui.button("关闭速度调整") then
                    os_setting.Is_Speed_Setting = false
                    os_setting.OS_Game_Speed = 5
                    tm._tfFuncs._entries[10].value:call("ApplyGameSpeed")
                end
            else
                imgui.text("无法读取 OtherSetting")
            end
        else
            imgui.text("未在训练模式中...")
        end
        imgui.tree_pop()
    end
end)
