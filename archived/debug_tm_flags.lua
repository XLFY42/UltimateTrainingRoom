-- ============================================================
-- 调试脚本: 监控 TrainingManager 状态标志变化
-- 同时监控 _TrainingState, _MenuState 等枚举字段
-- ============================================================

local tm_type = sdk.find_type_definition("app.training.TrainingManager")
if not tm_type then
    print("[DEBUG] 找不到 TrainingManager 类型")
    return
end

local update_method = tm_type:get_method("doUpdate")
if not update_method then
    print("[DEBUG] 找不到 doUpdate 方法")
    return
end

local bool_fields = {
    "_IsInit", "_IsSetuped", "_IsSetCpuLevel",
    "_IsReqRestart", "_IsReqRefresh", "_IsReqFade", "_IsReqTrans",
    "_IsLoaded", "_IsSaved", "_IsLoadReq", "_IsSaveReq",
    "_IsStartPlay", "_IsReqMatching", "_IsReqRelease",
    "_IsRequestFlow", "_IsReqCloseMenu", "_IsSkipScene"
}

local extra_fields = {
    "_TrainingState", "_MenuState", "_MenuPrevState", "_MenuPrevPrevState",
    "_ActiveMenuType", "_PlayerSide"
}

local prev_values = {}

sdk.hook(
    update_method,
    function(args)
        local tm = sdk.get_managed_singleton("app.training.TrainingManager")
        if not tm then return end

        for _, name in ipairs(bool_fields) do
            local ok, val = pcall(function() return tm[name] end)
            if ok and val ~= prev_values[name] then
                print("[FLAG] " .. name .. ": " .. tostring(prev_values[name]) .. " -> " .. tostring(val))
                prev_values[name] = val
            end
        end

        for _, name in ipairs(extra_fields) do
            local ok, val = pcall(function() return tm[name] end)
            if ok then
                local str_val = tostring(val)
                if str_val ~= prev_values[name] then
                    print("[STATE] " .. name .. ": " .. tostring(prev_values[name]) .. " -> " .. str_val)
                    prev_values[name] = str_val
                end
            end
        end
    end,
    function(retval) return retval end
)

print("[DEBUG] TrainingManager 状态监控已启动 (含枚举字段)")
