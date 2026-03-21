-- ============================================================
-- 调试脚本: 探索 ShortcutSetting 快捷键系统
-- ============================================================

local ss_type = sdk.find_type_definition("app.ShortcutSetting")
if not ss_type then
    print("[DEBUG] 找不到 app.ShortcutSetting 类型")
    return
end

-- 遍历所有方法，找 keyCheck / buttonCheck 相关
local keycheck_method = nil
local all_methods = ss_type:get_methods()
for _, m in ipairs(all_methods) do
    local name = m:get_name()
    if name:find("keyCheck") or name:find("58_2") then
        print("[DEBUG] 找到方法: " .. name)
        keycheck_method = m
    end
    if name:find("buttonCheck") or name:find("58_1") then
        print("[DEBUG] 找到方法: " .. name)
    end
    if name:find("58_0") then
        print("[DEBUG] 找到方法: " .. name)
    end
end

-- 存储抓到的实例
_G.ss_instance = nil
_G.ss_closure = nil
_G.ss_func_item = nil

-- Hook onShortcutUpdate 抓 ShortcutSetting 实例
local update_method = ss_type:get_method("onShortcutUpdate")
if update_method then
    sdk.hook(update_method,
        function(args)
            if not _G.ss_instance then
                _G.ss_instance = sdk.to_managed_object(args[2])
                print("[DEBUG] 抓到 ShortcutSetting 实例: " .. tostring(_G.ss_instance))
            end
        end,
        function(retval) return retval end
    )
    print("[DEBUG] 已 hook onShortcutUpdate (按住任意快捷键来抓取实例)")
end

-- Hook keyCheck 抓闭包
if keycheck_method then
    local log_count = 0
    sdk.hook(keycheck_method,
        function(args)
            if log_count < 5 then
                log_count = log_count + 1
                print("[keyCheck] === 调用 #" .. log_count .. " ===")

                -- 尝试读取 item (args[3])
                local ok1, item = pcall(sdk.to_managed_object, args[3])
                if ok1 and item then
                    local ok_type, stype = pcall(item.get_field, item, "ShortCutType")
                    local ok_func, is_func = pcall(item.get_field, item, "IsFunc")
                    local ok_btn, btn = pcall(item.get_field, item, "Button")
                    local ok_key, key = pcall(item.get_field, item, "Key")
                    print("  item.ShortCutType = " .. tostring(stype))
                    print("  item.IsFunc = " .. tostring(is_func))
                    print("  item.Button = " .. tostring(btn))
                    print("  item.Key = " .. tostring(key))
                end

                -- 尝试读取 closure (args[4])
                local ok2, closure = pcall(sdk.to_managed_object, args[4])
                if ok2 and closure then
                    _G.ss_closure = closure
                    print("  closure 类型: " .. tostring(closure:get_type_definition():get_full_name()))

                    local ok_ci, ci = pcall(closure.get_field, closure, "convertInput")
                    print("  closure.convertInput = " .. tostring(ci))

                    local ok_fi, fi = pcall(closure.get_field, closure, "funcItem")
                    if ok_fi and fi then
                        _G.ss_func_item = fi
                        local ok_fb, fb = pcall(fi.get_field, fi, "Button")
                        local ok_fk, fk = pcall(fi.get_field, fi, "Key")
                        print("  closure.funcItem.Button = " .. tostring(fb))
                        print("  closure.funcItem.Key = " .. tostring(fk))
                    end
                else
                    -- args 索引探测
                    for idx = 3, 6 do
                        local ok, obj = pcall(sdk.to_managed_object, args[idx])
                        if ok and obj then
                            local ok_tn, tn = pcall(function() return obj:get_type_definition():get_full_name() end)
                            print("  args[" .. idx .. "] 类型: " .. tostring(tn))
                        else
                            print("  args[" .. idx .. "] = " .. tostring(args[idx]) .. " (非对象)")
                        end
                    end
                end
            end
        end,
        function(retval) return retval end
    )
    print("[DEBUG] 已 hook keyCheck (按任意快捷键来触发)")
else
    print("[DEBUG] 未找到 keyCheck 方法，列出所有方法名:")
    for _, m in ipairs(all_methods) do
        print("  " .. m:get_name())
    end
end

print("[DEBUG] ShortcutSetting 调试脚本已启动")
