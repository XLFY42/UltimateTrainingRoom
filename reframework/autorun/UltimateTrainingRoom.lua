-- ============================================================
-- Ultimate Training Room v0.3.0
-- 命令行为树系统 - Phase 2
-- ============================================================

-- ========== 加载模块 ==========
local runtime = require("UltimateTrainingRoom.bt_runtime")
local nodes = require("UltimateTrainingRoom.bt_nodes")
local bt_input = require("UltimateTrainingRoom.bt_input")
local schema = require("UltimateTrainingRoom.bt_schema")
local logger = require("UltimateTrainingRoom.bt_logger")

-- ========== 初始化 ==========
-- 注册所有节点类型
nodes.register_all()

-- 初始化 BT tick 驱动（UpdateFrameMain pre-hook）
bt_input.init_tick_hook()

-- 初始化输入注入（pl_input_sub post-hook）
bt_input.init_input_hooks()

-- 初始化延迟操作执行器
bt_input.init_deferred_executor()

-- ========== ImGui 状态 ==========
local tree_files = {}           -- 可用 JSON 文件列表
local selected_file_idx = 1     -- 当前选中的文件索引
local loaded_tree_name = nil    -- 已加载树的名称
local load_error = nil          -- 加载错误信息

-- 内置测试树（备用）
local test_tree = {
    name = "Built-in: P2 Walk Forward",
    properties = { onComplete = "loop" },
    root = "root",
    nodes = {
        ["root"] = {
            id = "root",
            name = "Sequence",
            category = "composite",
            children = { "wait", "walk" },
            properties = {},
        },
        ["wait"] = {
            id = "wait",
            name = "WaitFrames",
            category = "action",
            properties = { frames = 30 },
        },
        ["walk"] = {
            id = "walk",
            name = "InjectInput",
            category = "action",
            properties = {
                target = "P2",
                inputs = { "6" },
                frames = 60,
                relative = true,
            },
        },
    },
}

-- 初始扫描文件
tree_files = schema.list_tree_files()

-- ========== ImGui ==========
re.on_draw_ui(function()
    if imgui.tree_node("Ultimate Training Room v0.3.0") then

        if imgui.tree_node("Behavior Tree") then

            if not runtime.is_loaded() then
                -- ===== 未加载状态：显示文件选择器 =====

                -- 刷新文件列表
                if imgui.button("Refresh") then
                    tree_files = schema.list_tree_files()
                    load_error = nil
                end

                imgui.separator()

                -- JSON 文件列表
                if #tree_files > 0 then
                    imgui.text("Trees (" .. #tree_files .. "):")
                    for i, filename in ipairs(tree_files) do
                        local prefix = (i == selected_file_idx) and "> " or "  "
                        if imgui.button(prefix .. filename) then
                            selected_file_idx = i
                        end
                    end

                    imgui.spacing()
                    if imgui.button("Load Selected") and tree_files[selected_file_idx] then
                        load_error = nil
                        local ok, err = schema.load_and_run(tree_files[selected_file_idx])
                        if ok then
                            loaded_tree_name = tree_files[selected_file_idx]
                        else
                            load_error = err
                        end
                    end
                else
                    imgui.text("No .json files found in trees/")
                    imgui.text("Place files in: reframework/data/UltimateTrainingRoom/trees/")
                end

                imgui.separator()

                -- 内置测试树
                if imgui.button("Load Built-in Test") then
                    load_error = nil
                    runtime.load_tree(test_tree)
                    loaded_tree_name = test_tree.name
                end

                -- 错误显示
                if load_error then
                    imgui.spacing()
                    imgui.text("ERROR: " .. load_error)
                end

            else
                -- ===== 已加载状态：控制面板 =====
                imgui.text("Tree: " .. (loaded_tree_name or "unnamed"))

                if not runtime.is_running() then
                    if imgui.button("Start") then
                        runtime.start()
                    end
                else
                    if imgui.button("Stop") then
                        runtime.stop()
                    end
                    imgui.same_line()
                    if imgui.button(runtime.is_paused() and "Resume" or "Pause") then
                        runtime.pause()
                    end
                end

                imgui.same_line()
                if imgui.button("Unload") then
                    runtime.unload_tree()
                    loaded_tree_name = nil
                end

                -- 重新加载同一文件
                if loaded_tree_name and loaded_tree_name ~= test_tree.name then
                    imgui.same_line()
                    if imgui.button("Reload") then
                        local was_running = runtime.is_running()
                        load_error = nil
                        -- 找到对应文件名
                        local filename = loaded_tree_name
                        local ok, err = schema.load_and_run(filename)
                        if ok then
                            if was_running then runtime.start() end
                        else
                            load_error = err
                        end
                    end
                end

                imgui.separator()

                -- 状态显示
                imgui.text("Status: " .. (
                    not runtime.is_loaded() and "No tree" or
                    not runtime.is_running() and "Stopped" or
                    runtime.is_paused() and "Paused" or
                    "Running"
                ))
                imgui.text("Frame: " .. runtime.get_frame_count())
                imgui.text("Loops: " .. runtime.get_loop_count())
                imgui.text("P1 Mask: " .. string.format("0x%X", runtime.get_p1_mask()))
                imgui.text("P2 Mask: " .. string.format("0x%X", runtime.get_p2_mask()))

                if load_error then
                    imgui.spacing()
                    imgui.text("ERROR: " .. load_error)
                end
            end

            if imgui.tree_node("Logs") then
                if imgui.button("Clear Logs") then
                    logger.clear()
                end

                local lines = logger.get_lines()
                local start_idx = 1
                if #lines > 40 then
                    start_idx = #lines - 39
                end
                for i = start_idx, #lines do
                    imgui.text(lines[i])
                end

                imgui.tree_pop()
            end

            -- 调试信息（始终显示）
            if imgui.tree_node("Debug") then
                local info = bt_input.get_debug_info()
                imgui.text("Tick hook: " .. tostring(info.tick_hook))
                imgui.text("Input hook: " .. tostring(info.input_hook))
                imgui.text("Refs valid: " .. tostring(info.refs_valid))
                imgui.text("BT ticks: " .. tostring(info.tick_count))
                imgui.text("P1 injects: " .. tostring(info.inject_p1))
                imgui.text("P2 injects: " .. tostring(info.inject_p2))
                imgui.tree_pop()
            end

            imgui.tree_pop()
        end

        imgui.tree_pop()
    end
end)

logger.push("UTR", "Ultimate Training Room v0.3.0 loaded (Phase 2)")
