-- ============================================================
-- bt_logger.lua - UTR 内部日志缓冲
-- 所有日志写入内存缓冲，不输出到 REFramework Console
-- ============================================================

local M = {}

local MAX_LINES = 200
local lines = {}

local function trim_if_needed()
    while #lines > MAX_LINES do
        table.remove(lines, 1)
    end
end

function M.push(tag, message)
    local t = tostring(tag or "INFO")
    local msg = tostring(message or "")
    lines[#lines + 1] = string.format("[%s] %s", t, msg)
    trim_if_needed()
end

function M.get_lines()
    return lines
end

function M.clear()
    lines = {}
end

return M
