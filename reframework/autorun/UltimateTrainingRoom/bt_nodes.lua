-- ============================================================
-- bt_nodes.lua - 基础节点类型实现
-- Phase 1: Sequence, Selector, Parallel, Repeat,
--           WaitFrames, InjectInput, Noop
-- ============================================================

local runtime = require("UltimateTrainingRoom.bt_runtime")
local logger = require("UltimateTrainingRoom.bt_logger")
local STATUS = runtime.STATUS
local M = {}

local function get_by_path(root, path)
    if type(path) ~= "string" or path == "" then return nil end
    local current = root
    for part in string.gmatch(path, "[^%.]+") do
        if type(current) ~= "table" then return nil end
        current = current[part]
    end
    return current
end

local function ensure_parent_for_path(root, path)
    if type(path) ~= "string" or path == "" then return nil, nil end
    local parts = {}
    for part in string.gmatch(path, "[^%.]+") do
        parts[#parts + 1] = part
    end
    if #parts == 0 then return nil, nil end

    local parent = root
    for i = 1, #parts - 1 do
        local key = parts[i]
        local next_val = parent[key]
        if next_val == nil then
            next_val = {}
            parent[key] = next_val
        elseif type(next_val) ~= "table" then
            return nil, nil
        end
        parent = next_val
    end

    return parent, parts[#parts]
end

local function normalize_source(source)
    local s = tostring(source or "game_state")
    if s == "bb" then return "bb" end
    if string.sub(s, 1, 10) == "game_state" then return "game_state" end
    return "game_state"
end

local function normalize_path(path, source)
    local p = tostring(path or "")
    p = p:gsub("^%s+", ""):gsub("%s+$", "")
    if p == "" then return "" end

    if source == "bb" then
        p = p:gsub("^bb%.", "")
    elseif source == "game_state" then
        p = p:gsub("^game_state%.", "")
    end

    return p
end

local function compare_values(left, op, right)
    if op == "==" then return left == right end
    if op == "!=" then return left ~= right end

    if type(left) ~= "number" or type(right) ~= "number" then
        return false
    end

    if op == "<" then return left < right end
    if op == "<=" then return left <= right end
    if op == ">" then return left > right end
    if op == ">=" then return left >= right end
    return false
end

local function parse_typed_value(value_type, raw)
    if value_type == "number" then
        return tonumber(raw)
    elseif value_type == "boolean" then
        if type(raw) == "boolean" then return raw end
        local s = string.lower(tostring(raw or ""))
        return s == "true" or s == "1" or s == "yes"
    elseif value_type == "string" then
        return tostring(raw or "")
    end
    return raw
end

local INPUT_MASKS = {
    UP    = 1,
    DOWN  = 2,
    LEFT  = 4,
    RIGHT = 8,
    LP    = 16,
    MP    = 32,
    HP    = 64,
    LK    = 128,
    MK    = 256,
    HK    = 512,
}

-- 将输入名列表转为位掩码
-- relative=true 时数字方向(1-9) 根据 cmd_dir 转换
-- 同一节点若出现多个方向，按最后一个方向生效（避免同帧叠加多个方向）
local function resolve_input_mask(inputs, target, relative, ctx)
    local button_mask = 0
    local direction_mask = nil
    local cmd_dir = false

    if relative and ctx.game_state then
        if target == "P1" and ctx.game_state.p1 then
            cmd_dir = ctx.game_state.p1.cmd_dir
        elseif target == "P2" and ctx.game_state.p2 then
            cmd_dir = ctx.game_state.p2.cmd_dir
        end
    end

    local function resolve_forward_back(use_forward)
        if cmd_dir then
            return use_forward and INPUT_MASKS.RIGHT or INPUT_MASKS.LEFT
        end
        return use_forward and INPUT_MASKS.LEFT or INPUT_MASKS.RIGHT
    end

    for _, raw_input in ipairs(inputs) do
        local input = tostring(raw_input or "")
        input = input:gsub("^%s+", ""):gsub("%s+$", "")
        local token = string.upper(input)

        if token == "5" then
            direction_mask = 0
        elseif token == "6" then
            direction_mask = relative and resolve_forward_back(true) or INPUT_MASKS.RIGHT
        elseif token == "4" then
            direction_mask = relative and resolve_forward_back(false) or INPUT_MASKS.LEFT
        elseif token == "2" then
            direction_mask = INPUT_MASKS.DOWN
        elseif token == "8" then
            direction_mask = INPUT_MASKS.UP
        elseif token == "3" then
            local forward = relative and resolve_forward_back(true) or INPUT_MASKS.RIGHT
            direction_mask = INPUT_MASKS.DOWN | forward
        elseif token == "1" then
            local back = relative and resolve_forward_back(false) or INPUT_MASKS.LEFT
            direction_mask = INPUT_MASKS.DOWN | back
        elseif token == "9" then
            local forward = relative and resolve_forward_back(true) or INPUT_MASKS.RIGHT
            direction_mask = INPUT_MASKS.UP | forward
        elseif token == "7" then
            local back = relative and resolve_forward_back(false) or INPUT_MASKS.LEFT
            direction_mask = INPUT_MASKS.UP | back
        else
            local val = INPUT_MASKS[token]
            if val and type(val) == "number" then
                button_mask = button_mask | val
            end
        end
    end

    return button_mask | (direction_mask or 0)
end

-- ========== 组合节点 ==========

-- Sequence: 依次执行子节点，任一失败则失败
-- 同帧内连续推进，直到遇到 RUNNING / FAILURE / 全部 SUCCESS
local function tick_sequence(node, ctx)
    local state = runtime.get_state(node.id)
    local children = node.child_refs
    if not children or #children == 0 then return STATUS.SUCCESS end

    local idx = state.current_child or 1

    while idx <= #children do
        local result = runtime.tick_node(children[idx], ctx)

        if result == STATUS.RUNNING then
            state.current_child = idx
            return STATUS.RUNNING
        elseif result == STATUS.FAILURE then
            runtime.reset_state(node.id)
            return STATUS.FAILURE
        end

        idx = idx + 1
    end

    runtime.reset_state(node.id)
    return STATUS.SUCCESS
end

-- Selector: 依次尝试子节点，任一成功则成功
local function tick_selector(node, ctx)
    local state = runtime.get_state(node.id)
    local children = node.child_refs
    if not children or #children == 0 then return STATUS.FAILURE end

    local start_idx = state.current_child or 1
    for i = start_idx, #children do
        local result = runtime.tick_node(children[i], ctx)
        if result == STATUS.RUNNING then
            state.current_child = i
            return STATUS.RUNNING
        elseif result == STATUS.SUCCESS then
            runtime.reset_state(node.id)
            return STATUS.SUCCESS
        end
        -- FAILURE: 继续尝试下一个子节点
    end
    runtime.reset_state(node.id)
    return STATUS.FAILURE
end

-- Parallel: 同时执行所有子节点
-- 全部 SUCCESS → SUCCESS, 任一 FAILURE → FAILURE, 否则 RUNNING
local function tick_parallel(node, ctx)
    local children = node.child_refs
    if not children or #children == 0 then return STATUS.SUCCESS end

    local all_success = true
    local any_failure = false
    for _, child in ipairs(children) do
        local result = runtime.tick_node(child, ctx)
        if result == STATUS.FAILURE then any_failure = true end
        if result ~= STATUS.SUCCESS then all_success = false end
    end

    if any_failure then
        -- 重置所有子节点状态
        for _, child in ipairs(children) do
            runtime.reset_state(child.id)
        end
        return STATUS.FAILURE
    end
    if all_success then return STATUS.SUCCESS end
    return STATUS.RUNNING
end

-- RandomSelector: 随机选一个子节点执行
local function tick_random_selector(node, ctx)
    local state = runtime.get_state(node.id)
    local children = node.child_refs
    if not children or #children == 0 then return STATUS.FAILURE end

    -- 首次 tick 时随机选择
    if not state.chosen then
        state.chosen = math.random(1, #children)
    end

    local result = runtime.tick_node(children[state.chosen], ctx)
    if result == STATUS.RUNNING then
        return STATUS.RUNNING
    end
    runtime.reset_state(node.id)
    return result
end

-- ========== 装饰器节点 ==========

-- Repeat: 总执行子节点 N 次（count=1 表示无额外重复）
-- properties: { count = number }
local function tick_repeat(node, ctx)
    local state = runtime.get_state(node.id)
    local child = node.child_ref
    if not child then return STATUS.FAILURE end

    local props = node.properties or {}
    local total_count = tonumber(props.count) or 2
    if total_count < 1 then total_count = 1 end

    if not state.iteration then
        state.iteration = 0
    end

    local result = runtime.tick_node(child, ctx)

    if result == STATUS.RUNNING then
        return STATUS.RUNNING
    elseif result == STATUS.FAILURE then
        runtime.reset_state(node.id)
        return STATUS.FAILURE
    end

    -- SUCCESS: 子节点完成一次
    runtime.reset_state(child.id) -- 重置子节点以便重新执行
    state.iteration = state.iteration + 1

    if state.iteration >= total_count then
        runtime.reset_state(node.id)
        return STATUS.SUCCESS
    end

    return STATUS.RUNNING
end

-- ========== 条件节点 ==========

-- CheckValue: 检查黑板值（只读 game_state + 可读 bb）
-- properties: { source = "game_state"|"bb", path = string, op = string, value_type = string, value = any }
local function tick_check_value(node, ctx)
    local props = node.properties or {}
    local source = normalize_source(props.source)
    local path = normalize_path(props.path, source)
    local op = props.op or "=="
    local value_type = props.value_type or "number"

    local root = nil
    if source == "game_state" then
        root = ctx.game_state
    elseif source == "bb" then
        ctx.bb = ctx.bb or {}
        root = ctx.bb
    else
        return STATUS.FAILURE
    end

    local left = get_by_path(root, path)
    local right = parse_typed_value(value_type, props.value)
    if value_type == "number" and right == nil then
        return STATUS.FAILURE
    end

    if compare_values(left, op, right) then
        return STATUS.SUCCESS
    end
    return STATUS.FAILURE
end

-- SetValue: 写入用户黑板（只允许 bb.*）
-- properties: { path = string, value_type = string, value = any }
local function tick_set_value(node, ctx)
    local props = node.properties or {}
    local path = normalize_path(props.path, "bb")
    if path == "" then return STATUS.FAILURE end

    ctx.bb = ctx.bb or {}
    local parent, key = ensure_parent_for_path(ctx.bb, path)
    if not parent or not key then return STATUS.FAILURE end

    local value_type = props.value_type or "number"
    local parsed = parse_typed_value(value_type, props.value)
    if value_type == "number" and parsed == nil then
        return STATUS.FAILURE
    end

    parent[key] = parsed
    return STATUS.SUCCESS
end

-- ========== 动作节点 ==========

-- WaitFrames（持续型动作）: 等待 N 战斗帧
-- properties: { frames = number }
local function tick_wait_frames(node, ctx)
    local state = runtime.get_state(node.id)
    local props = node.properties or {}

    if not state.initialized then
        local frames = tonumber(props.frames) or 1
        if frames < 0 then frames = 0 end
        state.remaining_frames = frames
        state.initialized = true
        runtime.register_settle(node.id, function(s)
            if s.remaining_frames and s.remaining_frames > 0 then
                s.remaining_frames = s.remaining_frames - 1
            end
        end)
    end

    if (state.remaining_frames or 0) <= 0 then
        runtime.reset_state(node.id)
        return STATUS.SUCCESS
    end

    return STATUS.RUNNING
end

-- InjectInput（持续型动作）: 注入按键 N 帧
-- properties: { target = "P1"|"P2", inputs = string[], frames = number, relative = bool }
local function tick_inject_input(node, ctx)
    local state = runtime.get_state(node.id)
    local props = node.properties or {}
    local target = props.target or "P2"

    -- 首次 tick 解析输入掩码
    if not state.initialized then
        local frames = tonumber(props.frames) or 1
        if frames < 0 then frames = 0 end
        state.mask = resolve_input_mask(
            props.inputs or {},
            target,
            props.relative ~= false, -- 默认 true
            ctx
        )
        state.remaining_frames = frames
        state.initialized = true
        runtime.register_settle(node.id, function(s)
            if s.remaining_frames and s.remaining_frames > 0 then
                s.remaining_frames = s.remaining_frames - 1
            end
        end)
    end

    if (state.remaining_frames or 0) <= 0 then
        runtime.reset_state(node.id)
        return STATUS.SUCCESS
    end

    -- 累加到对应玩家的注入掩码
    if target == "P1" then
        ctx.p1_inject_mask = ctx.p1_inject_mask | state.mask
    else
        ctx.p2_inject_mask = ctx.p2_inject_mask | state.mask
    end

    return STATUS.RUNNING
end

-- Log（立即型动作）: 输出调试日志
-- properties:
--   { mode = "string"|"ref", message = string }
--   ref 模式：{ source = "game_state"|"bb", path = string }
local function tick_log(node, ctx)
    local props = node.properties or {}
    local mode = tostring(props.mode or "string")

    if mode == "ref" then
        local source = normalize_source(props.source)
        local path = normalize_path(props.path, source)

        local root = nil
        if source == "bb" then
            ctx.bb = ctx.bb or {}
            root = ctx.bb
        else
            root = ctx.game_state
        end

        local value = get_by_path(root, path)
        logger.push("BT Log", string.format("%s.%s = %s", source, path, tostring(value)))
        return STATUS.SUCCESS
    end

    local msg = tostring(props.message or "")
    logger.push("BT Log", msg)
    return STATUS.SUCCESS
end

-- Noop（立即型动作）: 空操作，立即成功
local function tick_noop(node, ctx)
    return STATUS.SUCCESS
end

-- ========== 注册所有节点类型 ==========
function M.register_all()
    -- 组合节点
    runtime.register_handler("Sequence", tick_sequence)
    runtime.register_handler("Selector", tick_selector)
    runtime.register_handler("Parallel", tick_parallel)
    runtime.register_handler("RandomSelector", tick_random_selector)

    -- 装饰器
    runtime.register_handler("Repeat", tick_repeat)

    -- 条件节点
    runtime.register_handler("CheckValue", tick_check_value)

    -- 动作节点
    runtime.register_handler("SetValue", tick_set_value)
    runtime.register_handler("WaitFrames", tick_wait_frames)
    runtime.register_handler("InjectInput", tick_inject_input)
    runtime.register_handler("Log", tick_log)
    runtime.register_handler("Noop", tick_noop)
end

-- 导出常量供其他模块使用
M.INPUT_MASKS = INPUT_MASKS
M.resolve_input_mask = resolve_input_mask

return M
