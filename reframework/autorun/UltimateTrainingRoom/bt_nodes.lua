-- ============================================================
-- bt_nodes.lua - 基础节点类型实现
-- Phase 1: Sequence, Selector, Parallel, Repeat,
--           WaitFrames, InjectInput, Noop
-- ============================================================

local runtime = require("UltimateTrainingRoom.bt_runtime")
local STATUS = runtime.STATUS

local M = {}

-- ========== 输入常量 ==========
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
    -- 角色相对方向（运行时根据朝向转换）
    FORWARD = "FORWARD",
    BACK    = "BACK",
    NEUTRAL = 0,
}

-- 将输入名列表转为位掩码
-- relative=true 时 FORWARD/BACK 根据 cmd_dir 转换
local function resolve_input_mask(inputs, target, relative, ctx)
    local mask = 0
    local cmd_dir = false

    if relative and ctx.game_state then
        if target == "P1" and ctx.game_state.p1 then
            cmd_dir = ctx.game_state.p1.cmd_dir
        elseif target == "P2" and ctx.game_state.p2 then
            cmd_dir = ctx.game_state.p2.cmd_dir
        end
    end

    for _, input in ipairs(inputs) do
        if input == "FORWARD" then
            -- cmd_dir=true → 角色在左边 → 面朝右 → FORWARD=RIGHT
            if cmd_dir then
                mask = mask | 8   -- RIGHT
            else
                mask = mask | 4   -- LEFT
            end
        elseif input == "BACK" then
            if cmd_dir then
                mask = mask | 4   -- LEFT
            else
                mask = mask | 8   -- RIGHT
            end
        elseif input == "NEUTRAL" then
            -- 不添加任何位
        else
            local val = INPUT_MASKS[input]
            if val and type(val) == "number" then
                mask = mask | val
            end
        end
    end

    return mask
end

-- ========== 组合节点 ==========

-- Sequence: 依次执行子节点，任一失败则失败
-- 子节点完成后，下一帧才执行下一个子节点
-- 注意：这不会造成"空帧"，因为 SUCCESS 发生在当前子节点的最后一个 tick 内
-- 例：WaitFrames(30) 的第 30 帧返回 SUCCESS，同时 Sequence 推进指针
--     下一帧 InjectInput 开始 → 总共 30 等待 + 60 注入 = 90 帧，无空隙
local function tick_sequence(node, ctx)
    local state = runtime.get_state(node.id)
    local children = node.child_refs
    if not children or #children == 0 then return STATUS.SUCCESS end

    local idx = state.current_child or 1
    local result = runtime.tick_node(children[idx], ctx)

    if result == STATUS.RUNNING then
        state.current_child = idx
        return STATUS.RUNNING
    elseif result == STATUS.FAILURE then
        runtime.reset_state(node.id)
        return STATUS.FAILURE
    end

    -- SUCCESS: 推进到下一个子节点，下一帧执行
    if idx < #children then
        state.current_child = idx + 1
        return STATUS.RUNNING
    end

    -- 所有子节点完成
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

-- Repeat: 重复子节点 N 次或永远
-- properties: { count = number | "forever" }
local function tick_repeat(node, ctx)
    local state = runtime.get_state(node.id)
    local child = node.child_ref
    if not child then return STATUS.FAILURE end

    local props = node.properties or {}
    local max_count = props.count or "forever"

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

    if max_count ~= "forever" and state.iteration >= max_count then
        runtime.reset_state(node.id)
        return STATUS.SUCCESS
    end

    return STATUS.RUNNING
end

-- ========== 动作节点 ==========

-- WaitFrames: 等待 N 战斗帧
-- properties: { frames = number }
local function tick_wait_frames(node, ctx)
    local state = runtime.get_state(node.id)
    local props = node.properties or {}
    local frames = props.frames or 1

    state.counter = (state.counter or 0) + 1
    if state.counter >= frames then
        runtime.reset_state(node.id)
        return STATUS.SUCCESS
    end
    return STATUS.RUNNING
end

-- InjectInput: 注入按键 N 帧
-- properties: { target = "P1"|"P2", inputs = string[], frames = number, relative = bool }
local function tick_inject_input(node, ctx)
    local state = runtime.get_state(node.id)
    local props = node.properties or {}
    local target = props.target or "P2"
    local frames = props.frames or 1

    -- 首次 tick 解析输入掩码
    if not state.initialized then
        state.mask = resolve_input_mask(
            props.inputs or {},
            target,
            props.relative ~= false, -- 默认 true
            ctx
        )
        state.frame_counter = 0
        state.initialized = true
    end

    state.frame_counter = state.frame_counter + 1

    -- 累加到对应玩家的注入掩码
    if target == "P1" then
        ctx.p1_inject_mask = ctx.p1_inject_mask | state.mask
    else
        ctx.p2_inject_mask = ctx.p2_inject_mask | state.mask
    end

    if state.frame_counter >= frames then
        runtime.reset_state(node.id)
        return STATUS.SUCCESS
    end
    return STATUS.RUNNING
end

-- Noop: 空操作，立即成功
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

    -- 动作节点
    runtime.register_handler("WaitFrames", tick_wait_frames)
    runtime.register_handler("InjectInput", tick_inject_input)
    runtime.register_handler("Noop", tick_noop)
end

-- 导出常量供其他模块使用
M.INPUT_MASKS = INPUT_MASKS
M.resolve_input_mask = resolve_input_mask

return M
