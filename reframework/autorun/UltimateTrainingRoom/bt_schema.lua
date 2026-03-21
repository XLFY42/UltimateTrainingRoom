-- ============================================================
-- bt_schema.lua - JSON 加载与树构建
-- 加载 Behavior3 原生 JSON，解析为运行时树
-- ============================================================

local runtime = require("UltimateTrainingRoom.bt_runtime")

local M = {}

-- ========== 路径常量 ==========
-- fs.glob 和 json.load_file 路径均相对于 reframework/data/
local TREES_DIR = [[UltimateTrainingRoom\trees]]
local GLOB_PATTERN = [[UltimateTrainingRoom\\trees\\.*\.json$]]

-- ========== 列出可用树文件 ==========
-- 返回 { "example_anti_air.json", ... }
function M.list_tree_files()
    local files = {}
    local ok, results = pcall(fs.glob, GLOB_PATTERN)
    if ok and results then
        for _, path in ipairs(results) do
            -- 提取文件名（去掉目录前缀）
            local name = path:match("([^/\\]+)$")
            if name then
                table.insert(files, name)
            end
        end
    end
    -- 排序
    table.sort(files)
    return files
end

-- ========== 加载 JSON 树文件 ==========
-- filename: 仅文件名，如 "example_walk.json"
-- 返回 tree_def 或 nil, error_msg
function M.load_tree_file(filename)
    local filepath = TREES_DIR .. "\\" .. filename
    local data = json.load_file(filepath)
    if not data then
        return nil, "Failed to load JSON: " .. filepath
    end

    -- 验证基本结构
    local err = M.validate(data)
    if err then
        return nil, err
    end

    -- 提取树定义（Behavior3 Editor 导出格式可能有外层包装）
    local tree = M.extract_tree(data)
    if not tree then
        return nil, "Failed to extract tree from JSON"
    end

    return tree
end

-- ========== 验证 JSON 结构 ==========
function M.validate(data)
    if type(data) ~= "table" then
        return "JSON root is not a table"
    end

    -- Behavior3 Editor 导出格式有两种：
    -- 1. 直接是树: { root, nodes, ... }
    -- 2. 项目文件: { trees: [...], ... }
    -- 两种都支持

    if data.trees then
        -- 项目文件格式
        if type(data.trees) ~= "table" or #data.trees == 0 then
            return "Project file has no trees"
        end
        -- 检查第一棵树
        local tree = data.trees[1]
        return M.validate_single_tree(tree)
    else
        -- 直接树格式
        return M.validate_single_tree(data)
    end
end

function M.validate_single_tree(tree)
    if not tree.root then
        return "Tree missing 'root' field"
    end
    if not tree.nodes or type(tree.nodes) ~= "table" then
        return "Tree missing 'nodes' table"
    end
    -- 检查根节点是否存在
    if not tree.nodes[tree.root] then
        return "Root node '" .. tostring(tree.root) .. "' not found in nodes"
    end
    return nil -- 验证通过
end

-- ========== 提取树定义 ==========
-- 处理 Behavior3 Editor 的项目文件格式
function M.extract_tree(data)
    if data.trees then
        -- 项目文件：取第一棵树
        local tree = data.trees[1]
        if not tree then return nil end
        return {
            name = tree.title or tree.name or "unnamed",
            description = tree.description or "",
            properties = tree.properties or {},
            root = tree.root,
            nodes = tree.nodes,
        }
    else
        -- 直接树格式
        return {
            name = data.title or data.name or "unnamed",
            description = data.description or "",
            properties = data.properties or {},
            root = data.root,
            nodes = data.nodes,
        }
    end
end

-- ========== 加载并构建运行时树 ==========
-- 一步完成：加载 JSON → 验证 → 构建 → 加载到 runtime
-- 返回 true 或 false, error_msg
function M.load_and_run(filename)
    local tree, err = M.load_tree_file(filename)
    if not tree then
        return false, err
    end

    local ok = runtime.load_tree(tree)
    if not ok then
        return false, "Failed to build runtime tree"
    end

    return true
end

return M
