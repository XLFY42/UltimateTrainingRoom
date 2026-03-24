# 节点类型详细设计

待各节点在迭代中实现时逐步完善。

## 组合节点 (Composite)
| 类型 | 行为 |
|------|------|
| **Sequence** | 依次执行子节点，任一失败则失败 |
| **Selector** | 依次尝试子节点，任一成功则成功 |
| **Parallel** | 同时执行所有子节点（P1 + P2 同步的核心机制） |
| **RandomSelector** | 随机选一个子节点执行（可加权重） |

## 装饰器节点 (Decorator)
| 类型 | 参数 | 行为 |
|------|------|------|
| **Repeat** | count / "forever" | 重复子节点 N 次或永远 |
| **Invert** | - | 反转子节点结果 |
| **Cooldown** | frames | 子节点完成后冷却 N 帧 |
| **Timeout** | frames | 超时强制返回失败 |
| **ForceSuccess** | - | 无论子节点结果都返回成功 |
| **ConditionalGate** | 内嵌条件 | 条件为真才执行子节点 |

## 动作节点 (Action) — 必须指定 `target: "P1" | "P2"`
| 类型 | 参数 | 行为 |
|------|------|------|
| **InjectInput** | inputs[], frames, relative | 注入按键 N 帧。relative=true 时 FORWARD/BACK 根据朝向自动转换 |
| **MotionInput** | motion(numpad), button, chargeFrames | 搓招输入（如 "236"+HP = QCF+重拳）。自动分解为逐帧方向序列 |
| **WaitFrames** | frames | 等待 N 战斗帧（中性输入） |
| **WaitUntil** | condition, timeout | 等待条件成立，超时则失败 |
| **SetHP** | value, lock | 设置 HP。lock=true 持续锁定 |
| **SetDrive** | value, lock | 设置 Drive |
| **SetSuper** | value, lock | 设置 Super（写 cTeam[].mSuperGauge） |
| **SetPosition** | x, y | 传送角色（写 start_pos） |
| **ResetPosition** | - | 触发 BattleReset（onShortcutTrigger(2) + Release） |
| **SetGameSpeed** | speed(0-10) | 设置游戏速度 |
| **Log** | message | 调试输出 |

> **后续扩展**：还会补充一系列修改训练房设置的 Action 节点（如木桩行为、防御设置等），具体节点待后续设计。

## 条件节点 (Condition) — 即时返回 SUCCESS/FAILURE
| 类型 | 参数 | 检查内容 |
|------|------|---------|
| **CheckDistance** | op, value | P1-P2 水平距离 |
| **CheckHP** | target, op, value | vital_new |
| **CheckDrive** | target, op, value | focus_new |
| **CheckSuper** | target, op, value | mSuperGauge |
| **CheckStance** | target, stance | pose_st (stand/crouch/air) |
| **CheckHitstun** | target | damage_time > 0 ⚠️ 待验证游戏数据 |
| **CheckBlockstun** | target | guard_time > 0 ⚠️ 待验证游戏数据 |
| **CheckHitstop** | target | hit_stop > 0 ⚠️ 待验证游戏数据 |
| **CheckFacing** | target, facing | get_IsLeft() |
| **CheckBurnout** | target | focus_wait > 0 |
| **CheckFrameCount** | op, value | 树全局帧计数器 |

---

## Web 编辑器相关（待各节点设计时补充）

### 折叠摘要文案

每个节点在编辑器画布上折叠时需显示摘要信息。设计各节点时需定义其摘要格式。

临时参考（最终以各节点设计为准）：

| 节点类型 | 折叠摘要示例 |
|---------|-------------|
| Sequence / Selector / Parallel | `N children` |
| RandomSelector | `N children (random)` |
| Repeat | `×N` 或 `forever` |
| WaitFrames | `30f` |
| InjectInput | `P2: FWD+LP 60f` |
| Noop | (无摘要，仅标题) |
| 其他节点 | **待定义** |

### 节点验证标记

验证结果是节点自身视觉状态的一部分，显示在节点右上角：

- 警告：黄色三角
- 错误：红色三角

该标记由编辑器验证系统驱动，但在节点设计层面需要预留其视觉位置与状态含义。

### 节点右键菜单

在编辑器画布上右键点击节点时弹出的上下文菜单。通用菜单项如下，各节点可在设计时追加特有选项：

**通用项**：
- Set as Root
- Duplicate
- Expand / Collapse（仅可展开节点显示）
- Delete
- Disconnect All

**节点特有项**：待各节点设计时定义（例如：Composite 节点可能有 "Sort Children"、"Reverse Order" 等）
