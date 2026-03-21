-- ============================================================
-- bt_runtime.lua - 行为树引擎核心
-- 管理树的加载、tick、节点状态、生命周期
-- ============================================================

local M = {}

-- ========== 节点状态枚举 ==========
M.STATUS = {
    FRESH   = 0,  -- 未执行过，或已重置
    RUNNING = 1,  -- 执行中（跨帧）
    SUCCESS = 2,  -- 本次执行成功
    FAILURE = 3,  -- 本次执行失败
}

-- ========== 节点状态存储 ==========
-- node_states[node_id] = { status, frame_counter, current_child, ... }
local node_states = {}

function M.get_state(node_id)
    if not node_states[node_id] then
        node_states[node_id] = { status = M.STATUS.FRESH }
    end
    return node_states[node_id]
end

function M.reset_state(node_id)
    node_states[node_id] = nil
end

function M.reset_all_states()
    node_states = {}
end

-- ========== 树上下文 ==========
-- 每帧 tick 时传递给所有节点的共享数据
local context = {
    frame_count = 0,
    p1_inject_mask = 0,
    p2_inject_mask = 0,
    game_state = {},       -- 由 bt_gamestate 填充
    deferred_actions = {}, -- 延迟执行的操作（如 BattleReset）
}

function M.get_context()
    return context
end

-- ========== 节点处理器注册 ==========
-- node_handlers[type_name] = function(node, context) -> status
local node_handlers = {}

function M.register_handler(type_name, handler_fn)
    node_handlers[type_name] = handler_fn
end

-- ========== 核心 tick ==========
-- 根据节点类型分发到对应处理器
function M.tick_node(node, ctx)
    if not node then return M.STATUS.FAILURE end
    local handler = node_handlers[node.name]
    if not handler then
        print("[BT] Unknown node type: " .. tostring(node.name))
        return M.STATUS.FAILURE
    end
    return handler(node, ctx)
end

-- ========== 树定义 ==========
local tree_def = nil      -- 加载的树（包含 root, nodes 等）
local root_node = nil     -- 根节点引用
local running = false
local paused = false
local loop_count = 0

-- 从 Behavior3 扁平节点表构建运行时节点引用
-- 将 children ID 列表解析为直接节点引用
local function build_node_refs(tree)
    local nodes = tree.nodes
    if not nodes then return nil end

    for id, node in pairs(nodes) do
        node.id = id
        -- 将 children ID 列表转为节点引用列表
        if node.children then
            local child_refs = {}
            for i, child_id in ipairs(node.children) do
                child_refs[i] = nodes[child_id]
            end
            node.child_refs = child_refs
        end
        -- 装饰器的单 child
        if node.child then
            node.child_ref = nodes[node.child]
        end
    end

    return nodes[tree.root]
end

function M.load_tree(tree)
    M.stop()
    tree_def = tree
    root_node = build_node_refs(tree)
    if not root_node then
        print("[BT] Failed to build tree: root node not found")
        return false
    end
    print("[BT] Tree loaded: " .. (tree.name or "unnamed"))
    return true
end

function M.unload_tree()
    M.stop()
    tree_def = nil
    root_node = nil
end

-- ========== 生命周期控制 ==========
function M.start()
    if not root_node then
        print("[BT] No tree loaded")
        return
    end
    M.reset_all_states()
    context.frame_count = 0
    context.p1_inject_mask = 0
    context.p2_inject_mask = 0
    context.deferred_actions = {}
    running = true
    paused = false
    loop_count = 0
    print("[BT] Tree started")
end

function M.stop()
    running = false
    paused = false
    context.p1_inject_mask = 0
    context.p2_inject_mask = 0
    context.deferred_actions = {}
    M.reset_all_states()
end

function M.pause()
    paused = not paused
end

function M.is_running()
    return running
end

function M.is_paused()
    return paused
end

function M.is_loaded()
    return root_node ~= nil
end

-- ========== 每帧 tick（由 UpdateFrameMain pre-hook 驱动） ==========
function M.tick()
    if not running or paused or not root_node then return end

    -- 清空本帧注入
    context.p1_inject_mask = 0
    context.p2_inject_mask = 0

    -- tick 整棵树
    local result = M.tick_node(root_node, context)

    -- 递增帧计数
    context.frame_count = context.frame_count + 1

    -- 树完成判定
    if result == M.STATUS.SUCCESS or result == M.STATUS.FAILURE then
        local on_complete = "loop"
        if tree_def and tree_def.properties then
            on_complete = tree_def.properties.onComplete or "loop"
        end

        if on_complete == "loop" then
            M.reset_all_states()
            loop_count = loop_count + 1
            context.frame_count = 0
        else -- "stop"
            M.stop()
            print("[BT] Tree finished (stop)")
        end
    end
end

-- ========== 状态查询（用于 ImGui 显示） ==========
function M.get_p1_mask()
    return context.p1_inject_mask
end

function M.get_p2_mask()
    return context.p2_inject_mask
end

function M.get_frame_count()
    return context.frame_count
end

function M.get_loop_count()
    return loop_count
end

function M.get_deferred_actions()
    return context.deferred_actions
end

function M.clear_deferred_actions()
    context.deferred_actions = {}
end

return M
