# Web Editor Refactor Notes

本文档用于记录 `reframework/data/UltimateTrainingRoom/editor/v2.html` 的重构背景、已确认方向、风险点与实施原则。

## 1. 背景结论

当前 `v2.html` 已经实现了大量功能，但整体结构属于“单文件持续叠加”的结果，主要问题如下：

- 单文件过大：HTML / CSS / I18N / 数据模型 / 渲染 / 交互 / 弹层 / 工具逻辑全部混在一起。
- 副作用分散：很多操作会手动触发 `undo`、`validation`、`autosave`、`drawConnections`、`renderInspector` 等，容易遗漏。
- 输入交互耦合严重：节点拖拽、连线拖拽、框选、右键拖动画布、左侧拖出节点、子节点拖动排序等都堆在全局鼠标事件上。
- 右侧面板复杂度过高：树编辑、单选、多选、子节点列表、属性控件等逻辑都集中在少数大函数中。
- 后续继续加功能的风险很高：容易出现行为冲突、刷新遗漏、undo 不完整、验证不实时等问题。

结论：需要进行多文件重构，而不是继续在 `v2.html` 上堆叠。

## 2. 已确认的总体方向

### 2.1 总体策略

- 拆成多文件。
- 优先重构右侧面板。
- 第一轮重构先整理结构，不新增功能，不改视觉方向。
- 第一轮允许顺手修右侧面板内部明显无争议的小问题。
- 第一轮右侧面板各子模块自己绑定事件，不强行做统一事件总线。
- 后续所有“改数据”的操作，最终要统一收敛到 command 层。

### 2.2 推荐的未来架构方向

- `core/`：`i18n`、常量、节点定义、基础 state
- `commands/`：统一的变更入口
- `renderers/`：节点、连线、右侧面板、菜单、弹层
- `controllers/`：鼠标/键盘/拖拽输入控制
- `services/`：undo、autosave、validation、clipboard

### 2.3 变更入口方向

未来应采用统一的命令入口，例如：

```js
executeCommand(name, payload, options)
```

命令层统一负责：

- 数据修改
- undo 接入
- autosave 调度
- validation 调度
- render dirty flags

本次第一轮右侧面板重构不强行落地完整 command 系统，但代码组织需要朝这个方向靠拢。

## 3. 第一轮重构范围：右侧面板

### 3.1 目标

保持现有功能与视觉基本不变，只整理结构，降低后续维护成本。

### 3.2 现有右侧面板需要覆盖的功能

- 树区域常驻顶部
- 无选中状态占位
- 单选节点编辑
- 多选同类型编辑
- 多选不同类型占位与批量状态/删除
- 单节点状态开关
- 子节点列表、排序、断开
- 删除节点 / 设为 Root

### 3.3 第一轮建议拆分的模块

- `inspector/index`
- `inspector/tree-section`
- `inspector/single-selection`
- `inspector/multi-selection-same-type`
- `inspector/multi-selection-mixed-type`
- `inspector/children-list`
- `inspector/control-factory`

### 3.4 第一轮保留不动的旧逻辑

为了降低风险，第一轮应尽量复用现有成熟逻辑，不同步重做底层系统。可保留：

- `setNodeEnabled`
- `setNodesEnabled`
- `applyPropertyToNodes`
- `deleteNode`
- `deleteSelectedNodes`
- `setNodeRoot`
- `moveChildNode`
- `reorderChildNode`
- 子节点拖动排序现有逻辑
- 现有 undo / autosave / validation 接法

### 3.5 第一轮不做的事

- 不重做视觉样式
- 不新增功能
- 不重写 command system
- 不重写 undo / autosave / validation 机制
- 不改左侧面板、节点渲染、连线渲染
- 不处理 JSON 导入导出

### 3.6 第一轮验收标准

- 树区域始终存在
- 单选、多选、无选中切换正常
- 单选属性编辑不回归
- 多选同类型 / 多选不同类型逻辑不回归
- 子节点列表与排序不回归
- Root / enabled / children / properties 的逻辑不回归
- 右侧面板相关代码显著更清晰

## 4. 重构顺序建议

### 阶段 1

先重构右侧面板：

- 建立统一入口 `renderInspector()`
- 树区域独立
- 单选、多选拆分
- 控件工厂抽离
- 子节点列表独立

### 阶段 2

再建立 command / state / render 基础骨架：

- 统一变更入口
- 统一 dirty flags
- 统一 render 调度

### 阶段 3

再重构：

- 节点渲染
- 连线渲染
- 交互控制器

### 阶段 4

最后回头处理：

- Step 15（JSON 导入 / 导出）
- 其它结构收尾

## 5. 当前 `v2.html` 已识别的重要问题

### 5.1 架构问题

- 单文件 4500+ 行，耦合严重
- `selectedNodeId` 和 `selectedNodeIds` 并存，靠约定维持一致
- 很多操作直接在事件回调里改 `treeData`
- 刷新逻辑靠手动散点调用

### 5.2 交互问题

- 交互状态机没有正式建模
- 多种拖拽行为共用全局鼠标事件，后续扩展风险高
- `Escape` 已经承担大量“清场”行为，后续容易继续膨胀

### 5.3 右侧面板问题

- 逻辑集中在大函数里
- 单选、多选、树区域、控件工厂没有明确分层
- 子节点列表和属性区耦合重

### 5.4 其他系统问题

- validation 刷新依然依赖很多地方手动触发
- autosave 当前较特殊，后续需要单独梳理
- overlay / panel / menu 没有统一管理

## 6. 特殊说明

- Step 15（JSON 导入 / 导出）暂时跳过，后面在拿到更多上下文后单独处理。
- Step 14（autosave）属于特殊系统，当前先“能用即保留”，不在第一轮重构中深入改造。

## 7. 后续执行原则

- 第一轮重构优先追求“行为不变、结构清晰”。
- 不因为重构而顺手扩大需求范围。
- 任何新增需求，后续都应同步写入对应设计文档。
