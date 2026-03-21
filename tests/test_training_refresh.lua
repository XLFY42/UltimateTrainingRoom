-- ============================================================
-- 测试脚本: 训练模式刷新控制
-- 通过 app.ShortcutSetting.onShortcutTrigger(2) 走游戏原生快捷键路径
-- ============================================================

local function get_training_manager()
    return sdk.get_managed_singleton("app.training.TrainingManager")
end

-- 通过游戏原生快捷键路径触发 Position Reset
local function request_restart()
    local sc = sdk.get_managed_singleton("app.ShortcutSetting")
    if sc then
        sc:call("onShortcutTrigger", 2)
        sc:call("onShortcutRelease", 2)
    end
end

-- 修改设置并触发重启
local function apply_and_refresh(changes)
    local tm = get_training_manager()
    if not tm then return end

    local tData = tm._tData
    if not tData then return end

    local sel = tData.SelectMenu
    if sel then
        if changes.Is_Side_Flip ~= nil then
            sel.Is_Side_Flip = changes.Is_Side_Flip
        end
        if changes.StartLocation ~= nil then
            sel.StartLocation = changes.StartLocation
        end
    end

    request_restart()
end

-- 读取当前设置值用于显示
local function get_current_settings()
    local tm = get_training_manager()
    if not tm then return nil end
    local tData = tm._tData
    if not tData then return nil end
    local sel = tData.SelectMenu
    if not sel then return nil end
    return {
        Is_Side_Flip = sel.Is_Side_Flip,
        StartLocation = sel.StartLocation,
    }
end

re.on_draw_ui(function()
    if imgui.tree_node("测试: 训练模式刷新控制") then
        local settings = get_current_settings()
        if settings then
            imgui.separator()
            imgui.text("--- 当前值 ---")
            imgui.text("Is_Side_Flip: " .. tostring(settings.Is_Side_Flip))
            imgui.text("StartLocation: " .. tostring(settings.StartLocation))

            imgui.separator()
            imgui.text("--- SelectMenu 操作 ---")

            -- Side Flip 切换
            if imgui.button("切换 Side Flip") then
                apply_and_refresh({ Is_Side_Flip = not settings.Is_Side_Flip })
            end

            -- StartLocation 选择
            imgui.text("StartLocation:")
            imgui.same_line()
            if imgui.button("0") then
                apply_and_refresh({ StartLocation = 0 })
            end
            imgui.same_line()
            if imgui.button("1") then
                apply_and_refresh({ StartLocation = 1 })
            end
            imgui.same_line()
            if imgui.button("2") then
                apply_and_refresh({ StartLocation = 2 })
            end

            imgui.separator()
            if imgui.button("仅重启 (不修改设置)") then
                request_restart()
            end
        else
            imgui.text("未在训练模式中...")
        end

        imgui.tree_pop()
    end
end)
