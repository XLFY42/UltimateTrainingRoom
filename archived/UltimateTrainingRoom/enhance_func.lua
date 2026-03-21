-- ============================================================
-- Ultimate Training Room - Enhanced Function Button
-- FUNC + 其他键 → 原本的修饰功能
-- FUNC 单独按下松开 → 触发指定的快捷键功能
-- ============================================================

local M = {}

-- ========== 配置 ==========
local tap_shortcut_type = 2  -- tap 触发的功能 (默认: 2 = BattleReset)

-- ========== 硬件输入层 ==========
local kb_singleton = sdk.get_native_singleton("via.hid.Keyboard")
local gp_singleton = sdk.get_native_singleton("via.hid.Gamepad")
local kb_typedef = sdk.find_type_definition("via.hid.Keyboard")
local gp_typedef = sdk.find_type_definition("via.hid.GamePad")

local kb_device = nil
local pad_device = nil

-- ========== 前置声明 ==========
local refresh_func_binding

-- ========== ShortcutSetting 实例 (延迟获取) ==========
local ss_instance = nil

local function get_ss_instance()
    local new_ss = sdk.get_managed_singleton("app.ShortcutSetting")
    if new_ss ~= ss_instance then
        ss_instance = new_ss
        if ss_instance then
            refresh_func_binding()
        end
    end
    return ss_instance
end

-- ========== FUNC 键绑定 (从游戏配置动态读取) ==========
local func_pad_button = 0
local func_kb_key = 0

-- ========== 状态机 ==========
local STATE_IDLE = 0
local STATE_FUNC_DOWN = 1
local STATE_FUNC_USED = 2
local func_state = STATE_IDLE

-- ========== 功能开关 ==========
local enhance_enabled = true

-- ========== PLACEHOLDER_ENHANCE_FUNC_REST ==========

-- ========== 从 SettingSaveData 读取 FUNC 键绑定 ==========
refresh_func_binding = function()
    local ok, save_data = pcall(function()
        return get_ss_instance():get_field("<SettingSaveData>k__BackingField")
    end)
    if not ok or not save_data then return false end

    local ok2, item_list = pcall(function()
        return save_data:get_field("ItemDataList")
    end)
    if not ok2 or not item_list then return false end

    local ok3, func_item = pcall(function()
        return item_list[0]
    end)
    if not ok3 or not func_item then return false end

    local ok4, stype = pcall(func_item.get_field, func_item, "ShortCutType")
    if not ok4 or stype ~= 1 then return false end

    local ok5, btn = pcall(func_item.get_field, func_item, "Button")
    if ok5 then func_pad_button = btn end

    local ok6, key = pcall(func_item.get_field, func_item, "Key")
    if ok6 then func_kb_key = key end

    return true
end

-- ========== 硬件层检测 FUNC 按键状态 ==========
local function is_func_pressed()
    if kb_device and func_kb_key ~= 0 then
        local ok, down = pcall(kb_device.call, kb_device, "isDown", func_kb_key)
        if ok and down then return true end
    end
    if pad_device and func_pad_button ~= 0 then
        local ok, down = pcall(pad_device.call, pad_device, "get_Button")
        if ok and down then
            if (down | func_pad_button) == down then return true end
        end
    end
    return false
end

local function is_func_just_released()
    if kb_device and func_kb_key ~= 0 then
        local ok, rel = pcall(kb_device.call, kb_device, "isRelease", func_kb_key)
        if ok and rel then return true end
    end
    if pad_device and func_pad_button ~= 0 then
        local ok, up = pcall(pad_device.call, pad_device, "get_ButtonUp")
        if ok and up then
            if (up | func_pad_button) == up then return true end
        end
    end
    return false
end

-- ========== PLACEHOLDER_ENHANCE_FUNC_HOOKS ==========

-- ========== Hook onShortcutTrigger ==========
local ss_type = sdk.find_type_definition("app.ShortcutSetting")
if ss_type then
    local trigger_method = ss_type:get_method("onShortcutTrigger")
    if trigger_method then
        sdk.hook(trigger_method,
            function(args)
                if func_state == STATE_FUNC_DOWN then
                    func_state = STATE_FUNC_USED
                end
            end,
            function(retval) return retval end
        )
    end
end

-- ========== 每帧更新: 硬件输入刷新 + 状态机 ==========
re.on_pre_application_entry("UpdateHID", function()
    if kb_singleton and kb_typedef then
        kb_device = sdk.call_native_func(kb_singleton, kb_typedef, "get_Device")
    end
    if gp_singleton and gp_typedef then
        pad_device = sdk.call_native_func(gp_singleton, gp_typedef, "getMergedDevice", 0)
    end

    if not enhance_enabled then
        func_state = STATE_IDLE
        return
    end

    if func_state == STATE_IDLE then
        if is_func_pressed() then
            func_state = STATE_FUNC_DOWN
        end
    elseif func_state == STATE_FUNC_DOWN then
        if is_func_just_released() then
            local ss = get_ss_instance()
            if ss then
                pcall(ss.call, ss, "onShortcutTrigger", tap_shortcut_type)
            end
            func_state = STATE_IDLE
        elseif not is_func_pressed() then
            func_state = STATE_IDLE
        end
    elseif func_state == STATE_FUNC_USED then
        if not is_func_pressed() then
            func_state = STATE_IDLE
        end
    end
end)

-- ========== 定期刷新 FUNC 绑定 ==========
local refresh_timer = 0
re.on_frame(function()
    refresh_timer = refresh_timer + 1
    if refresh_timer >= 300 then
        refresh_timer = 0
        refresh_func_binding()
    end
end)

-- ========== EShortcutType 枚举 ==========
local shortcut_names = {
    [0]  = "None",
    [1]  = "Function",
    [2]  = "BattleReset",
    [3]  = "Example(ComboTrials)",
    [4]  = "CommandList(ComboTrials)",
    [5]  = "Preview(ComboTrials)",
    [6]  = "PositionReset(NotWork)",
    [7]  = "ChangeStance",
    [8]  = "ChangeStatus(NotPublic)",
    [9]  = "CounterSetting",
    [10] = "RecordSetting",
    [11] = "PlaySetting",
    [12] = "ChangeRecordSlot",
    [13] = "SnapShotSave",
    [14] = "SnapShotLoad",
    [15] = "ChangeSnapShotSlot",
    [16] = "OpenShortCutMenu",
    [17] = "StandSetting",
    [18] = "GuardSetting",
    [19] = "Pause",
    [20] = "Step(NotPublic)",
    [21] = "ReversalSettingSwitch",
    [22] = "ViewFrameMeter",
    [23] = "BattleSetting",
    [24] = "DummyControl",
    [25] = "DummyControlRightStick",
}

local function get_shortcut_name(t)
    return shortcut_names[t] or ("Type " .. t)
end

-- ========== UI ==========
local state_names = { [0] = "IDLE", [1] = "FUNC_DOWN", [2] = "FUNC_USED" }

function M.draw_ui()
    if imgui.tree_node("Enhanced Function Button") then
        local changed
        changed, enhance_enabled = imgui.checkbox("Enable Tap-Hold", enhance_enabled)

        imgui.separator()
        imgui.text("Tap Action: " .. get_shortcut_name(tap_shortcut_type) .. " (" .. tap_shortcut_type .. ")")
        changed, tap_shortcut_type = imgui.slider_int("Tap Type", tap_shortcut_type, 2, 25)

        if imgui.tree_node("Debug Info") then
            imgui.text("FUNC Binding:")
            imgui.text("  Pad Button: " .. tostring(func_pad_button))
            imgui.text("  KB Key: " .. tostring(func_kb_key))
            imgui.text("  ShortcutSetting: " .. (get_ss_instance() and "OK" or "Waiting..."))

            if imgui.button("Refresh Binding") then
                refresh_func_binding()
            end

            imgui.separator()
            imgui.text("State: " .. (state_names[func_state] or "?"))
            imgui.text("FUNC Pressed: " .. tostring(is_func_pressed()))
            imgui.tree_pop()
        end

        imgui.tree_pop()
    end
end

return M
