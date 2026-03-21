# Phase 2: 最小可用管线

## 目标
打通完整链路：编辑器画树 → 导出 JSON → mod 加载运行

## 涉及文件
- `reframework/autorun/UltimateTrainingRoom/bt_schema.lua` — JSON 加载
- `reframework/autorun/UltimateTrainingRoom.lua` — ImGui 面板
- `editor/` — Behavior3 Editor 定制

## 具体任务
- [ ] bt_schema.lua: 加载 Behavior3 原生 JSON，解析扁平节点表为运行时树
- [ ] bt_schema.lua: list_tree_files() 列出 trees/ 目录下的 .json 文件
- [ ] 最简 ImGui：文件选择、加载、启动/停止按钮
- [ ] Behavior3 Editor：注册 Phase 1 已有的节点类型
- [ ] Behavior3 Editor：打包为离线可用版本
- [ ] 创建示例 JSON 树文件

## 验证
在编辑器中构建简单树 → 导出 JSON → mod 通过 ImGui 加载并运行 → 效果一致

## 待细化
- Behavior3 Editor 的具体定制方案（见 web_editor_design.md）
- ImGui 面板的具体布局（见 imgui_design.md）
