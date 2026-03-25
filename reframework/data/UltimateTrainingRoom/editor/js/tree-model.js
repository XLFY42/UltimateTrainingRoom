/**
 * tree-model.js — 树数据模型、节点 CRUD、undo/redo、clipboard、autosave、validation
 */
import { NODE_TYPES } from './node-registry.js';
import { I18N } from './i18n.js';

const UNDO_LIMIT = 50;
const AUTOSAVE_KEY = 'utr_editor_autosave_v1';

let bus = null;
let nextNodeId = 1;
let isRestoringHistory = false;
let autosaveTimer = null;

const undoStack = [];
const redoStack = [];

export const treeData = {
  name: I18N.treeDefaultName,
  description: '',
  root: null,
  nodes: {},
  onComplete: 'restart',
};

export let nodeClipboard = null;

/* ============================================================
   初始化
   ============================================================ */
export function initTreeModel(eventBus) {
  bus = eventBus;
}

/* ============================================================
   ID 生成
   ============================================================ */
export function generateId() {
  return 'node_' + (nextNodeId++);
}

/* ============================================================
   快照 / Undo / Redo
   ============================================================ */
export function createSnapshot(state) {
  return JSON.parse(JSON.stringify({
    treeData,
    nextNodeId,
    viewport: state ? {
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom,
      selectedNodeIds: state.selectedNodeIds,
    } : { panX: 0, panY: 0, zoom: 1, selectedNodeIds: [] },
  }));
}

export function pushUndoSnapshot(snapshot) {
  if (isRestoringHistory) return;
  if (!snapshot) throw new Error('pushUndoSnapshot requires a snapshot');
  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack.length = 0;
  bus?.emit('history:changed', { canUndo: undoStack.length > 0, canRedo: false });
  scheduleAutosave();
}

export function undo(currentState) {
  if (!undoStack.length) return null;
  redoStack.push(createSnapshot(currentState));
  const snapshot = undoStack.pop();
  bus?.emit('history:changed', { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  return snapshot;
}

export function redo(currentState) {
  if (!redoStack.length) return null;
  undoStack.push(createSnapshot(currentState));
  const snapshot = redoStack.pop();
  bus?.emit('history:changed', { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  return snapshot;
}

export function getHistoryState() {
  return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}

export function setRestoringHistory(value) {
  isRestoringHistory = value;
}

export function getIsRestoringHistory() {
  return isRestoringHistory;
}

/* ============================================================
   Autosave
   ============================================================ */
function buildAutosavePayload(state) {
  return {
    treeData: JSON.parse(JSON.stringify(treeData)),
    nextNodeId,
    viewport: state ? {
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom,
      selectedNodeIds: state.selectedNodeIds,
    } : { panX: 0, panY: 0, zoom: 1, selectedNodeIds: [] },
    savedAt: Date.now(),
  };
}

export function writeAutosaveNow(state) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildAutosavePayload(state)));
  } catch {}
}

function scheduleAutosave() {
  if (isRestoringHistory) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => bus?.emit('autosave:write'), 500);
}

export function clearAutosave() {
  clearTimeout(autosaveTimer);
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {}
}

export function loadAutosave() {
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/* ============================================================
   快照应用（undo/redo/autosave 恢复时调用）
   ============================================================ */
export function applySnapshotData(snapshot) {
  for (const key of Object.keys(treeData)) delete treeData[key];
  Object.assign(treeData, JSON.parse(JSON.stringify(snapshot.treeData)));
  nextNodeId = snapshot.nextNodeId;
}

/* ============================================================
   节点 CRUD
   ============================================================ */
export function createNodeData(type, x, y) {
  const reg = NODE_TYPES[type];
  if (!reg) return null;

  const id = generateId();
  const properties = {};
  for (const p of reg.props) {
    properties[p.key] = p.default;
  }

  const node = {
    id,
    type,
    category: reg.category,
    enabled: true,
    properties,
    children: [],
    display: { x, y, collapsed: true },
  };

  treeData.nodes[id] = node;
  return node;
}

export function deleteNodeData(id) {
  for (const n of Object.values(treeData.nodes)) {
    const idx = n.children.indexOf(id);
    if (idx !== -1) n.children.splice(idx, 1);
  }
  if (treeData.root === id) treeData.root = null;
  delete treeData.nodes[id];
}

export function isNodeEnabled(nodeData) {
  return !!nodeData && nodeData.enabled !== false;
}

/* ============================================================
   连接操作（数据层）
   ============================================================ */
export function findParentNodeId(nodeId) {
  for (const node of Object.values(treeData.nodes)) {
    if (node.children.includes(nodeId)) return node.id;
  }
  return null;
}

export function isDescendantNode(rootId, targetId) {
  const root = treeData.nodes[rootId];
  if (!root) return false;
  const stack = [...root.children];
  while (stack.length) {
    const id = stack.pop();
    if (id === targetId) return true;
    const node = treeData.nodes[id];
    if (node) stack.push(...node.children);
  }
  return false;
}

export function canConnectNodes(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  const source = treeData.nodes[sourceId];
  const target = treeData.nodes[targetId];
  if (!source || !target) return false;
  if (!NODE_TYPES[source.type]?.hasOutput) return false;
  if (treeData.root === targetId) return false;
  if (isDescendantNode(targetId, sourceId)) return false;
  return true;
}

export function connectNodesData(sourceId, targetId) {
  if (!canConnectNodes(sourceId, targetId)) return false;
  const source = treeData.nodes[sourceId];
  const sourceReg = NODE_TYPES[source.type];
  const maxChildren = sourceReg?.maxChildren ?? null;

  if (!source.children.includes(targetId)) {
    const oldParentId = findParentNodeId(targetId);
    if (oldParentId && oldParentId !== sourceId) {
      const oldParent = treeData.nodes[oldParentId];
      if (oldParent) {
        oldParent.children = oldParent.children.filter(id => id !== targetId);
      }
    }

    if (typeof maxChildren === 'number' && maxChildren > 0 && source.children.length >= maxChildren) {
      source.children = source.children.slice(0, maxChildren - 1);
    }

    source.children.push(targetId);
  }
  return true;
}

export function removeConnectionData(sourceId, targetId) {
  const source = treeData.nodes[sourceId];
  if (!source) return false;
  const before = source.children.length;
  source.children = source.children.filter(id => id !== targetId);
  return source.children.length !== before;
}

export function moveChildNode(parentId, fromIndex, toIndex) {
  const parent = treeData.nodes[parentId];
  if (!parent) return false;
  if (fromIndex === toIndex) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= parent.children.length || toIndex >= parent.children.length) return false;
  const [childId] = parent.children.splice(fromIndex, 1);
  parent.children.splice(toIndex, 0, childId);
  return true;
}

/* ============================================================
   Clipboard
   ============================================================ */
export function serializeNodesForClipboard(nodeIds) {
  const ids = [...new Set(nodeIds)].filter(id => treeData.nodes[id]);
  if (!ids.length) return null;
  return ids.map(id => JSON.parse(JSON.stringify(treeData.nodes[id])));
}

export function setClipboard(data) {
  nodeClipboard = data;
}

export function getClipboard() {
  return nodeClipboard;
}

/* ============================================================
   树属性
   ============================================================ */
export function updateTreeField(key, value) {
  if (treeData[key] === value) return false;
  treeData[key] = value;
  return true;
}

/* ============================================================
   验证（纯数据）
   ============================================================ */
export function isMissingRequiredProperty(node, propDef) {
  const value = node.properties?.[propDef.key];
  if (propDef.type === 'checkbox') return false;
  if (propDef.type === 'number') return value == null || Number.isNaN(value);
  return value == null || value === '';
}

export function validateTree() {
  const issues = [];
  const reachable = new Set();

  function dfs(nodeId, path = new Set()) {
    if (!treeData.nodes[nodeId]) return;
    if (path.has(nodeId)) {
      issues.push({ type: 'error', nodeId, message: I18N.validationCycleRef });
      return;
    }
    path.add(nodeId);
    reachable.add(nodeId);
    const node = treeData.nodes[nodeId];
    node.children.forEach(childId => dfs(childId, new Set(path)));
  }

  if (treeData.root) dfs(treeData.root);

  reachable.forEach(nodeId => {
    const node = treeData.nodes[nodeId];
    if (!node) return;
    const reg = NODE_TYPES[node.type];
    if (reg?.maxChildren === 1 && node.children.length === 0) {
      issues.push({ type: 'warning', nodeId: node.id, message: I18N.validationDecoratorMissingChild });
    }
    (reg?.props || []).forEach(propDef => {
      if (isMissingRequiredProperty(node, propDef)) {
        issues.push({ type: 'warning', nodeId: node.id, message: `${I18N.validationMissingRequiredPrefix}${propDef.label}` });
      }
    });
  });

  return issues;
}
