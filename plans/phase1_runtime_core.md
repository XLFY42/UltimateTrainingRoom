# Phase 1: 运行时核心 + 输入注入

## 目标
实现 BT 引擎核心 + 输入注入集成，用手写 Lua 树验证可行性。

## 涉及文件
- `reframework/autorun/UltimateTrainingRoom.lua` — 主入口
- `reframework/autorun/UltimateTrainingRoom/bt_runtime.lua` — BT 引擎核心
- `reframework/autorun/UltimateTrainingRoom/bt_nodes.lua` — 节点实现
- `reframework/autorun/UltimateTrainingRoom/bt_input.lua` — 输入注入（重构 V13）
- `reframework/autorun/UltimateTrainingRoom/bt_gamestate.lua` — 游戏状态快照

## 具体任务
- [ ] STATUS 枚举、node_states 管理（get_state / reset_state / reset_all）
- [ ] tick_node 分发器（类型名 → 处理函数的查表调用）
- [ ] 重构 V13 hook → bt_input.lua（集成 BT tick 驱动）
- [ ] 游戏状态快照（位置/HP/状态等）
- [ ] 方向解析（FORWARD/BACK → LEFT/RIGHT，根据 get_IsLeft()）
- [ ] 基础组合节点：Sequence / Selector / Parallel
- [ ] 基础装饰器：Repeat
- [ ] 基础动作节点：WaitFrames / InjectInput / Noop
- [ ] 树上下文管理（frame_count, p1/p2_inject_mask, game_state）

## 验证
手写 Lua 树：Sequence → WaitFrames(30) → InjectInput(P2, FORWARD, 60)
预期效果：P2 等待 0.5 秒后前走 1 秒

## 参考
- `tests/test_input_injection.lua` — V13 hook 模式
- `SF6_Function_Call_Order.md` — 帧时序
