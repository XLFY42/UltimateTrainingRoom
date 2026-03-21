-- ============================================================
-- 测试脚本: ActiveCount 比值与速度关系
-- 验证 ActiveCount / NextActiveCount 是否控制速度比率
-- ============================================================

local TF_OTHER_SETTING_INDEX = 10

local function get_game_data()
    local tm = sdk.get_managed_singleton("app.training.TrainingManager")
    if not tm then return nil end
    local tf = tm._tfFuncs._entries[TF_OTHER_SETTING_INDEX].value
    if not tf then return nil end
    return tf:get_field("_GameData")
end

local force_enabled = false
local force_game = 5
local force_active = 5
local force_next = 5

re.on_draw_ui(function()
    if imgui.tree_node("测试: ActiveCount 比值") then
        local gd = get_game_data()
        if gd then
            -- 显示当前值
            imgui.text("--- 当前值 (只读) ---")
            imgui.text("GameCount: " .. tostring(gd.GameCount))
            imgui.text("GameLimitCount: " .. tostring(gd.GameLimitCount))
            imgui.text("ActiveCount: " .. tostring(gd.ActiveCount))
            imgui.text("NextActiveCount: " .. tostring(gd.NextActiveCount))
            imgui.text("NextNextActiveCount: " .. tostring(gd.NextNextActiveCount))
            imgui.text("PrevDelayFrame: " .. tostring(gd.PrevDelayFrame))

            imgui.separator()
            imgui.text("--- 强制写入 ---")
            local changed
            changed, force_enabled = imgui.checkbox("启用强制写入", force_enabled)
            changed, force_game = imgui.slider_int("GameCount", force_game, 0, 20)
            changed, force_active = imgui.slider_int("ActiveCount", force_active, 0, 20)
            changed, force_next = imgui.slider_int("NextActiveCount", force_next, 0, 20)

            if force_enabled then
                imgui.text("比值: " .. force_game .. " / " .. force_active .. " / " .. force_next)
            end
        else
            imgui.text("未在训练模式中...")
        end
        imgui.tree_pop()
    end
end)

-- 每帧强制写入
re.on_pre_application_entry("UpdateBehavior", function()
    if not force_enabled then return end
    local gd = get_game_data()
    if not gd then return end
    gd.GameCount = force_game
    gd.ActiveCount = force_active
    gd.NextActiveCount = force_next
end)
