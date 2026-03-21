# Ultimate Training Room - 命令行为树系统 Plan（大纲）

## Context

玩家需要一个可视化的"训练脚本编辑器"：通过拖拽节点构建行为树，定义 P1/P2 的训练序列（如"P2 起身出 DP → P1 练安全跳 → 循环"）。行为树控制的是**命令序列**，不是自主 AI——用 P1 节点操作 P1，用 P2 节点操作 P2。

## 架构三大组件

```
[Web 编辑器 (Behavior3 Editor)] → 导出 JSON → [Lua 运行时 (REFramework)] → 输入注入/游戏状态
                                                  ↑
                                       [ImGui 控制面板: 加载/启停/调试]
```

详细设计见各子 plan：
- [Phase 1: 运行时核心 + 输入注入](phase1_runtime_core.md)
- [Phase 2: 最小可用管线](phase2_minimum_pipeline.md)
- [节点类型详细设计](nodes_design.md)
- [Web 编辑器详细设计](web_editor_design.md)
- [ImGui 控制面板设计](imgui_design.md)

---

## 1. Web 编辑器：Behavior3 Editor

**选型理由**：专门为行为树设计，天然支持树结构（父→子、有序子节点），内置 Composite/Decorator/Action/Condition 分类，JSON 格式开箱即用于 BT。
**基础**：基于 [behavior3editor](https://github.com/behavior3/behavior3editor) 或其社区 fork（如 behavior3-editor-next）。
**分发方式**：打包为离线可用的 HTML 文件，随 mod 一起分发。

**需要的定制**：
- 注册所有自定义节点类型（SF6 专用的 Action/Condition 节点）
- 直接使用 Behavior3 原生 JSON 格式，Lua 端解析扁平节点表
- 内置示例模板

---

## 2. JSON 格式：Behavior3 原生格式

直接使用 Behavior3 Editor 导出的 JSON，不做格式转换。

```json
{
  "name": "DP Anti-Air Drill",
  "description": "P2 跳入，P1 练习 DP 对空",
  "properties": {
    "onComplete": "loop",
    "resetOnStart": true
  },
  "root": "node-uuid-1",
  "nodes": {
    "node-uuid-1": {
      "id": "node-uuid-1",
      "name": "Sequence",
      "category": "composite",
      "children": ["node-uuid-2", "node-uuid-3"],
      "properties": {}
    },
    "node-uuid-2": {
      "id": "node-uuid-2",
      "name": "WaitFrames",
      "category": "action",
      "properties": { "frames": 30 }
    },
    "node-uuid-3": {
      "id": "node-uuid-3",
      "name": "InjectInput",
      "category": "action",
      "properties": { "target": "P2", "inputs": ["FORWARD"], "frames": 20, "relative": true }
    }
  }
}
```

**Lua 端解析**：读取 `root` 找到根节点 ID → 从 `nodes` 表中取节点 → 递归遍历 `children` 构建运行时树。

---

## 3. 节点类型总览

详见 [nodes_design.md](nodes_design.md)

### 3.1 组合节点 (Composite)
Sequence / Selector / Parallel / RandomSelector

### 3.2 装饰器节点 (Decorator)
Repeat / Invert / Cooldown / Timeout / ForceSuccess / ConditionalGate

### 3.3 动作节点 (Action) — 必须指定 `target: "P1" | "P2"`
InjectInput / MotionInput / WaitFrames / WaitUntil / SetHP / SetDrive / SetSuper / SetPosition / ResetPosition / SetGameSpeed / Log

> **后续扩展**：还会补充一系列修改训练房设置的 Action 节点（如木桩行为、防御设置等），具体节点待后续设计。

### 3.4 条件节点 (Condition) — 即时返回 SUCCESS/FAILURE
CheckDistance / CheckHP / CheckDrive / CheckSuper / CheckStance / CheckHitstun⚠️ / CheckBlockstun⚠️ / CheckHitstop⚠️ / CheckFacing / CheckBurnout / CheckFrameCount

---

## 4. Lua 运行时引擎

### 4.1 文件结构
```
reframework/autorun/
  UltimateTrainingRoom.lua                    -- 主入口（ImGui UI + 集成）
  UltimateTrainingRoom/
    bt_runtime.lua     -- BT 引擎：tick()、节点状态管理、树生命周期
    bt_nodes.lua       -- 所有节点类型的 tick 实现
    bt_input.lua       -- 输入注入模块（重构 V13 系统）
    bt_gamestate.lua   -- 游戏状态快照（读取 gBattle 字段）
    bt_motion.lua      -- 搓招输入分解器（numpad → 逐帧方向序列）
    bt_schema.lua      -- JSON 加载、验证、树构建
```

### 4.2 执行模型

**tick 时机**：每**战斗帧**执行 1 次（非渲染帧），驱动自 `pl_input_sub` post-hook。

**执行策略**：默认所有操作直接在 `pl_input_sub` 中执行（0 帧延迟），仅对已知不安全的操作（如 BattleReset）入队到 `re.on_pre_application_entry("UpdateBehavior")` 下一帧执行。如果实际开发中发现某个操作从 `pl_input_sub` 调用会崩溃，再把该操作移到队列。

**关键保证**：tick 在 P1 的 `pl_input_sub` 完成后执行 → 注入值在 `UpdateCommandKey` 之前写入 → 0 帧延迟。

### 4.3 树完成后行为
- **loop**：清空所有节点状态，重新从根节点开始
- **stop**：停止 tick，清空注入和锁定

---

## 5. 实现顺序

### Phase 1: 运行时核心 + 输入注入
详见 [phase1_runtime_core.md](phase1_runtime_core.md)

### Phase 2: 最小可用管线
详见 [phase2_minimum_pipeline.md](phase2_minimum_pipeline.md)

### Phase 3+: 迭代开发（敏捷循环）
每轮迭代：
1. 根据测试反馈增加/修改节点类型
2. 同步更新 Web 编辑器的节点注册
3. 按需增强 ImGui 调试功能
4. 测试 → 收集反馈 → 下一轮

---

## 6. 关键文件引用

| 文件 | 用途 |
|------|------|
| `tests/test_input_injection.lua` | V13 输入注入，重构进 bt_input.lua |
| `legacy/reframework/autorun/UltimateTrainingRoom.lua` | v0.1.1 参考 |
| `SF6_Function_Call_Order.md`（上级目录） | 帧时序参考，确保 0 帧延迟 |
| `SF6Mods-hitboxes-1.2/.../info_display.lua`（上级目录） | 游戏状态字段读取参考 |
| `MMDK-main/.../tables.lua`（上级目录） | 输入位掩码常量 |
