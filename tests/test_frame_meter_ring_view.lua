-- ============================================================
-- 测试脚本: Frame Meter Ring Buffer 原始视图
-- 目标:
--   1) 从 app.training.TrainingManager 读取 P1/P2 FrameNumDatas
--   2) 不做任何“头指针推断”，直接按原始索引显示环形缓冲内容
--   3) 每行一个 FrameNumData, 每列显示其关键字段
-- ============================================================

local state = {
    show_only_nonzero = false,
    max_rows = 120,
}

local function to_num(v, default)
    local n = tonumber(tostring(v))
    if n == nil then return default or 0 end
    return n
end

local function get_frame_meter_lists()
    local mgr = sdk.get_managed_singleton("app.training.TrainingManager")
    if not mgr then return nil, nil, "TrainingManager not found" end

    local dict = mgr:get_field("_ViewUIWigetDict")
    local entries = dict and dict:get_field("_entries")
    if not entries then return nil, nil, "_ViewUIWigetDict/_entries not found" end

    local widget = nil
    local count = entries:call("get_Count") or 0
    for i = 0, count - 1 do
        local entry = entries:call("get_Item", i)
        if entry and entry:get_field("key") == 5 then
            local value = entry:get_field("value")
            if value then
                widget = value:call("get_Item", 0)
            end
            break
        end
    end

    if not widget then return nil, nil, "Frame meter widget(key=5) not found" end

    local ss = widget:call("get_SSData")
    local meter_datas = ss and ss:get_field("MeterDatas")
    if not meter_datas then return nil, nil, "SSData.MeterDatas not found" end

    local meter_count = meter_datas:call("get_Count") or 0
    if meter_count < 2 then return nil, nil, "MeterDatas count < 2" end

    local p1_data = meter_datas:call("get_Item", 0)
    local p2_data = meter_datas:call("get_Item", 1)

    local p1_list = p1_data and p1_data:get_field("FrameNumDatas")
    local p2_list = p2_data and p2_data:get_field("FrameNumDatas")

    if not p1_list or not p2_list then
        return nil, nil, "FrameNumDatas missing"
    end

    return p1_list, p2_list, nil
end

local function get_item_fields(list, idx)
    local item = list:call("get_Item", idx)
    if not item then
        return nil
    end

    local ft = to_num(item:get_field("FrameType"), 0)
    local ty = to_num(item:get_field("Type"), 0)
    local fr = to_num(item:get_field("Frame"), 0)
    local sf = to_num(item:get_field("StartFrame"), 0)
    local ef = to_num(item:get_field("EndFrame"), 0)
    local mg = to_num(item:get_field("MainGauge"), 0)

    return {
        frame_type = ft,
        status_type = ty,
        frame = fr,
        start_frame = sf,
        end_frame = ef,
        main_gauge = mg,
        active = (ft ~= 0 or ty ~= 0 or fr ~= 0 or sf ~= 0 or ef ~= 0 or mg ~= 0),
    }
end

local function draw_player_ring_table(title, list)
    local count = list:call("get_Count") or 0
    if count <= 0 then
        imgui.text(title .. ": FrameNumDatas empty")
        return
    end

    local rows_to_show = math.min(state.max_rows, count)

    imgui.text(string.format("%s | count=%d", title, count))
    imgui.text("idx   FT   TY   FR    SF    EF    MG   ACT")

    -- 按原始索引显示，不做任何头指针推断
    for idx = 0, rows_to_show - 1 do
        local item = get_item_fields(list, idx)
        if item then
            if (not state.show_only_nonzero) or item.active then
                local act = item.active and 1 or 0
                imgui.text(string.format(
                    "%3d  %3d  %3d  %4d  %4d  %4d  %4d   %d",
                    idx,
                    item.frame_type,
                    item.status_type,
                    item.frame,
                    item.start_frame,
                    item.end_frame,
                    item.main_gauge,
                    act
                ))
            end
        end
    end
end

re.on_draw_ui(function()
    if imgui.tree_node("测试: Frame Meter Ring View") then
        local changed

        changed, state.show_only_nonzero = imgui.checkbox("只显示非零/活跃项", state.show_only_nonzero)
        changed, state.max_rows = imgui.slider_int("最多显示行数", state.max_rows, 10, 400)

        imgui.separator()

        local p1_list, p2_list, err = get_frame_meter_lists()
        if err then
            imgui.text("读取失败: " .. tostring(err))
            imgui.tree_pop()
            return
        end

        draw_player_ring_table("P1 FrameNumDatas", p1_list)
        imgui.separator()
        draw_player_ring_table("P2 FrameNumDatas", p2_list)

        imgui.tree_pop()
    end
end)
