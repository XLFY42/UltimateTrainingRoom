/**
 * node-renderer.js — 节点 DOM 渲染、位置/摘要/状态更新、DOM 管理
 */
import { treeData, isNodeEnabled } from './tree-model.js';
import { NODE_TYPES, CATEGORIES, getNodeDisplayName } from './node-registry.js';
import { I18N } from './i18n.js';
import { createPropertyControlRow } from './controls.js';

let bus = null;
let $nodeContainer = null;
let $canvasArea = null;

export const nodeDomMap = {};

export function initNodeRenderer(eventBus, refs) {
  bus = eventBus;
  $nodeContainer = refs.$nodeContainer;
  $canvasArea = refs.$canvasArea;
}

/* ============================================================
   Click 抑制（拖拽结束后防止误触发 click）
   ============================================================ */
let suppressClickNodeId = null;

export function suppressNextNodeClick(nodeId) {
  suppressClickNodeId = nodeId;
}

/* ============================================================
   节点 DOM 渲染
   ============================================================ */
export function renderNode(nodeData) {
  const reg = NODE_TYPES[nodeData.type];
  if (!reg) return null;
  const catColor = CATEGORIES[reg.category]?.color || '#888';

  // 容器
  const el = document.createElement('div');
  el.className = 'bt-node';
  if (nodeData.display.collapsed === false && reg.expandable) {
    el.classList.add('expanded');
  }
  if (treeData.root === nodeData.id) {
    el.classList.add('is-root');
  }
  if (!isNodeEnabled(nodeData)) {
    el.classList.add('disabled');
  }
  el.style.setProperty('--node-cat-color', catColor);
  el.style.left = nodeData.display.x + 'px';
  el.style.top = nodeData.display.y + 'px';
  el.dataset.nodeId = nodeData.id;

  // 输入端口
  const portIn = document.createElement('div');
  portIn.className = 'bt-port bt-port-in';
  portIn.dataset.portType = 'in';
  portIn.dataset.nodeId = nodeData.id;
  el.appendChild(portIn);

  // 标题栏
  const titleBar = document.createElement('div');
  titleBar.className = 'bt-node-title';

  const rootMark = document.createElement('span');
  rootMark.className = 'bt-node-root-mark';
  rootMark.textContent = '\u2605';
  titleBar.appendChild(rootMark);

  const icon = document.createElement('span');
  icon.className = 'bt-node-icon';
  icon.title = isNodeEnabled(nodeData) ? I18N.enabledOn : I18N.enabledOff;
  titleBar.appendChild(icon);

  const nameSpan = document.createElement('span');
  nameSpan.className = 'bt-node-name';
  nameSpan.textContent = reg.displayName;
  titleBar.appendChild(nameSpan);

  const toggle = document.createElement('span');
  toggle.className = 'bt-node-toggle' + (reg.expandable ? '' : ' hidden');
  toggle.textContent = (nodeData.display.collapsed !== false) ? '\u25B6' : '\u25BC';
  titleBar.appendChild(toggle);

  el.appendChild(titleBar);

  // 摘要区
  const summary = document.createElement('div');
  summary.className = 'bt-node-summary';
  summary.textContent = reg.summary(nodeData);
  el.appendChild(summary);

  // 属性编辑区
  if (reg.expandable && reg.props.length > 0) {
    const propsDiv = document.createElement('div');
    propsDiv.className = 'bt-node-props';

    for (const propDef of reg.props) {
      const row = createPropertyControlRow(nodeData, propDef, 'node');
      propsDiv.appendChild(row);
    }
    el.appendChild(propsDiv);
  }

  // 输出端口（仅 composite / decorator）
  if (reg.hasOutput) {
    const portOut = document.createElement('div');
    portOut.className = 'bt-port bt-port-out';
    portOut.dataset.portType = 'out';
    portOut.dataset.nodeId = nodeData.id;
    el.appendChild(portOut);
  }

  // 注册到 DOM
  $nodeContainer.appendChild(el);
  nodeDomMap[nodeData.id] = el;

  bindNodeEvents(nodeData.id, el, icon, toggle);

  return el;
}

/* ============================================================
   节点事件绑定
   ============================================================ */
function bindNodeEvents(id, el, icon, toggle) {
  // 节点点击 → 选择
  el.addEventListener('click', (e) => {
    if (e.target.closest('.bt-port')) return;
    if (e.target.closest('.bt-node-icon')) return;
    if (e.target.closest('.bt-node-toggle')) return;
    if (suppressClickNodeId === id) {
      suppressClickNodeId = null;
      return;
    }
    bus.emit('node:click', { id, shiftKey: e.shiftKey });
  });

  // 图标点击 → 启用/禁用
  icon.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  icon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    bus.emit('node:toggle-enabled', { id });
  });

  // 折叠按钮点击 → 展开/折叠
  toggle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleNodeExpand(id);
  });
}

/* ============================================================
   位置更新
   ============================================================ */
export function updateNodePosition(id) {
  const node = treeData.nodes[id];
  const el = nodeDomMap[id];
  if (!node || !el) return;
  el.style.left = node.display.x + 'px';
  el.style.top = node.display.y + 'px';
}

/* ============================================================
   摘要更新
   ============================================================ */
export function updateNodeSummary(id) {
  const node = treeData.nodes[id];
  const el = nodeDomMap[id];
  if (!node || !el) return;
  const reg = NODE_TYPES[node.type];
  if (!reg) return;
  const summaryEl = el.querySelector('.bt-node-summary');
  if (summaryEl) summaryEl.textContent = reg.summary(node);
}

/* ============================================================
   启用状态更新
   ============================================================ */
export function updateNodeEnabledState(id) {
  const node = treeData.nodes[id];
  const el = nodeDomMap[id];
  if (!node || !el) return;
  const enabled = isNodeEnabled(node);
  el.classList.toggle('disabled', !enabled);
  const iconEl = el.querySelector('.bt-node-icon');
  if (iconEl) iconEl.title = enabled ? I18N.enabledOn : I18N.enabledOff;
}

/* ============================================================
   DOM 移除
   ============================================================ */
export function removeNodeDom(id) {
  const el = nodeDomMap[id];
  if (el) {
    el.remove();
    delete nodeDomMap[id];
  }
}

/* ============================================================
   展开/折叠
   ============================================================ */
export function toggleNodeExpand(id) {
  const node = treeData.nodes[id];
  const el = nodeDomMap[id];
  const reg = NODE_TYPES[node?.type];
  if (!node || !el || !reg?.expandable) return;

  const wasCollapsed = node.display.collapsed !== false;
  node.display.collapsed = wasCollapsed ? false : true;

  if (node.display.collapsed) {
    el.classList.remove('expanded');
  } else {
    el.classList.add('expanded');
  }

  const toggleEl = el.querySelector('.bt-node-toggle');
  if (toggleEl) toggleEl.textContent = node.display.collapsed ? '\u25B6' : '\u25BC';

  bus.emit('node:expanded', { id });
}

/* ============================================================
   选中状态 CSS
   ============================================================ */
export function setNodeSelected(id, selected) {
  const el = nodeDomMap[id];
  if (!el) return;
  if (selected) el.classList.add('selected');
  else el.classList.remove('selected');
}

export function setNodeMultiSelected(id, selected) {
  const el = nodeDomMap[id];
  if (!el) return;
  el.classList.toggle('multi-selected', selected);
}

/* ============================================================
   Root 标记
   ============================================================ */
export function setNodeRootClass(id, isRoot) {
  const el = nodeDomMap[id];
  if (!el) return;
  el.classList.toggle('is-root', isRoot);
}

/* ============================================================
   节点矩形（框选用）
   ============================================================ */
export function getNodeRectInCanvas(nodeId) {
  const el = nodeDomMap[nodeId];
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const canvasRect = $canvasArea.getBoundingClientRect();
  return {
    left: rect.left - canvasRect.left,
    top: rect.top - canvasRect.top,
    right: rect.right - canvasRect.left,
    bottom: rect.bottom - canvasRect.top,
  };
}

export function rectsIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
