/**
 * main.js — 入口：获取 DOM 引用、初始化各模块、注册 EventBus 订阅、创建测试节点
 */
import { EventBus } from './event-bus.js';
import { I18N } from './i18n.js';
import { NODE_TYPES, CATEGORIES, getNodeDisplayName } from './node-registry.js';
import {
  treeData, initTreeModel, createNodeData, deleteNodeData,
  createSnapshot, pushUndoSnapshot, undo, redo,
  applySnapshotData, setRestoringHistory, getIsRestoringHistory, getHistoryState,
  isNodeEnabled, findParentNodeId, canConnectNodes, connectNodesData, removeConnectionData, moveChildNode,
  serializeNodesForClipboard, setClipboard, getClipboard,
  updateTreeField, writeAutosaveNow, clearAutosave, loadAutosave, validateTree,
} from './tree-model.js';
import {
  viewState, initViewport, resizeCanvases, refreshCanvas, drawGrid,
  syncNodeContainerTransform, getCanvasPoint, applyZoom, fitViewToNodes,
  autoLayoutTree, snapEnabled, setSnapEnabled, snapToGrid,
} from './viewport.js';
import {
  initConnections, drawConnections, connState,
  setHoveredConnection, setHoveredPort, setConnectionDrag, clearValidConnectionTargets,
  getConnectionsForPort, hitTestConnections,
} from './connections.js';
import {
  initControls, syncPropertyControls, closeAllCustomSelects,
} from './controls.js';
import {
  nodeDomMap, initNodeRenderer, renderNode, updateNodePosition,
  updateNodeSummary, updateNodeEnabledState, removeNodeDom,
  setNodeSelected, setNodeMultiSelected, setNodeRootClass, toggleNodeExpand,
} from './node-renderer.js';
import {
  initInspector, selectedNodeId, selectedNodeIds, getSelectedNodeId, getSelectedNodeIds,
  setSelectedNodes, selectNode, toggleNodeInSelection,
  renderRightPanelPlaceholder, renderRightPanelSelection, renderMultiSelectionPanel, refreshInspector,
} from './inspector.js';
import { initPalette, renderNodePalette } from './palette.js';
import { initContextMenu, openContextMenu, closeContextMenu } from './context-menu.js';
import {
  initToolbar, updateHistoryButtons, updateSnapButton,
  scheduleValidationRefresh, applyValidationMarkersToDom,
  showRecoveryBanner, closeHelpOverlay,
} from './toolbar.js';
import {
  initInputManager, startNodeDrag, startConnectionDragFromOutput, startConnectionDragFromInput,
  getPasteAnchorPoint,
} from './input-manager.js';

/* ============================================================
   DOM 引用
   ============================================================ */
const $ = (id) => document.getElementById(id);

const domRefs = {
  $app:              $('app'),
  $leftPanel:        $('left-panel'),
  $rightPanel:       $('right-panel'),
  $leftDivider:      $('left-divider'),
  $rightDivider:     $('right-divider'),
  $canvasArea:       $('canvas-area'),
  $gridCanvas:       $('grid-canvas'),
  $connCanvas:       $('connection-canvas'),
  $nodeContainer:    $('node-container'),
  $rightPanelBody:   $('right-panel-body'),
  $nodeSearch:       $('node-search'),
  $nodePaletteList:  $('node-palette-list'),
  $selectionRect:    $('selection-rect'),
  $contextMenu:      $('context-menu'),
  $recoveryBanner:   $('recovery-banner'),
  $btnRecoverTree:   $('btn-recover-tree'),
  $btnDiscardRecovery: $('btn-discard-recovery'),
  $btnLayout:        $('btn-layout'),
  $btnValidate:      $('btn-validate'),
  $validationPanel:  $('validation-panel'),
  $validationPanelList: $('validation-panel-list'),
  $btnCloseValidation: $('btn-close-validation'),
  $helpOverlay:      $('help-overlay'),
  $btnCloseHelp:     $('btn-close-help'),
  $btnSnap:          $('btn-snap'),
  $btnHelp:          $('btn-help'),
  $btnUndo:          $('btn-undo'),
  $btnRedo:          $('btn-redo'),
};

function applyStaticI18n() {
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  const setAttr = (id, attr, value) => {
    const el = $(id);
    if (el) el.setAttribute(attr, value);
  };

  setText('left-panel-title', I18N.nodePalette);
  setText('right-panel-title', I18N.propertiesEditor);
  setText('right-panel-placeholder', I18N.clickToEdit);
  setAttr('node-search', 'placeholder', I18N.searchPlaceholder);

  setText('btn-new', I18N.btnNew);
  setText('btn-load', I18N.btnLoad);
  setText('btn-save', I18N.btnSave);
  setText('btn-undo', I18N.btnUndo);
  setText('btn-redo', I18N.btnRedo);
  setText('btn-layout', I18N.btnLayout);
  setText('btn-snap', I18N.btnSnap);
  setText('btn-validate', I18N.btnValidate);
  setText('btn-help', I18N.btnHelp);

  setAttr('left-expand-btn', 'title', I18N.expandPanel);
  setAttr('left-collapse-btn', 'title', I18N.collapsePanel);
  setAttr('right-expand-btn', 'title', I18N.expandPanel);
  setAttr('right-collapse-btn', 'title', I18N.collapsePanel);
  setAttr('btn-close-validation', 'title', I18N.close);
  setAttr('btn-close-help', 'title', I18N.close);

  setText('validation-title', I18N.validationIssuesTitle);
  setText('help-title', I18N.helpTitle);
  setText('help-desc-fit', I18N.shortcutFitViewDesc);
  setText('help-desc-root', I18N.shortcutSetRootDesc);
  setText('help-desc-escape', I18N.shortcutEscapeDesc);
  setText('help-desc-delete', I18N.shortcutDeleteDesc);
  setText('help-desc-undo', I18N.shortcutUndoDesc);
  setText('help-desc-redo', I18N.shortcutRedoDesc);
  setText('help-desc-copy', I18N.shortcutCopyPasteCutDesc);
  setText('help-desc-shift-drag', I18N.shortcutShiftDragDesc);
  setText('btn-recover-tree', I18N.recover);
  setText('btn-discard-recovery', I18N.discard);
  setText('recovery-banner-text', I18N.unsavedTree);
  document.title = I18N.appTitle;
}

const bus = new EventBus();
applyStaticI18n();

initTreeModel(bus);
initViewport(bus, domRefs);
initConnections(bus, domRefs, nodeDomMap);
initControls(bus, {
  getNodeDomMap: () => nodeDomMap,
  getRightPanelBody: () => domRefs.$rightPanelBody,
  getSelectedNodeId: () => selectedNodeId,
  getIsRestoringHistory: () => getIsRestoringHistory(),
});
initNodeRenderer(bus, domRefs);
initInspector(bus, domRefs);
initPalette(bus, domRefs);
initContextMenu(domRefs);
initToolbar(bus, domRefs);
initInputManager(bus, domRefs);

/* ============================================================
   恢复的 autosave 数据
   ============================================================ */
let recoveredAutosave = null;

/* ============================================================
   EventBus 订阅 — 跨模块协调
   ============================================================ */

/* --- history:push（控件在编辑属性时请求推入 undo 快照）--- */
bus.on('history:push', () => {
  const snapshot = createSnapshot({
    panX: viewState.panX,
    panY: viewState.panY,
    zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
});

/* --- history:changed（更新工具栏按钮灰度）--- */
bus.on('history:changed', ({ canUndo, canRedo }) => {
  updateHistoryButtons(canUndo, canRedo);
});

/* --- node:property-changed（属性控件同步 + 摘要 + 验证）--- */
bus.on('node:property-changed', ({ nodeId, key, scope }) => {
  updateNodeSummary(nodeId);
  syncPropertyControls(nodeId, key, scope);
  scheduleValidationRefresh();
});

/* --- node:click（选择）--- */
bus.on('node:click', ({ id, shiftKey }) => {
  if (shiftKey) toggleNodeInSelection(id);
  else selectNode(id);
});

/* --- node:toggle-enabled --- */
bus.on('node:toggle-enabled', ({ id }) => {
  const node = treeData.nodes[id];
  if (!node || treeData.root === id) return;
  setNodeEnabled(id, !isNodeEnabled(node));
});

/* --- node:expanded --- */
bus.on('node:expanded', () => {
  scheduleValidationRefresh();
  drawConnections();
});

/* --- viewport:changed --- */
bus.on('viewport:changed', () => {
  drawConnections();
});

/* --- canvas:resized --- */
bus.on('canvas:resized', () => {
  drawConnections();
});

/* --- panels:resized --- */
bus.on('panels:resized', () => {
  resizeCanvases();
  refreshCanvas();
  drawConnections();
});

/* --- autosave:write --- */
bus.on('autosave:write', () => {
  writeAutosaveNow({
    panX: viewState.panX,
    panY: viewState.panY,
    zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
});

/* --- validation:markers --- */
bus.on('validation:markers', () => {
  applyValidationMarkersToDom(nodeDomMap);
});

/* ============================================================
   Action 事件 — 高层操作（含副作用协调）
   ============================================================ */

bus.on('action:undo', () => {
  const currentState = {
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  };
  const snapshot = undo(currentState);
  if (snapshot) applyFullSnapshot(snapshot);
});

bus.on('action:redo', () => {
  const currentState = {
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  };
  const snapshot = redo(currentState);
  if (snapshot) applyFullSnapshot(snapshot);
});

bus.on('action:zoom', ({ clientX, clientY, delta }) => {
  applyZoom(clientX, clientY, delta);
  drawConnections();
});

bus.on('action:fit-view', () => {
  fitViewToNodes();
  drawConnections();
});

bus.on('action:auto-layout', () => {
  const snapshot = createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
  if (autoLayoutTree()) {
    Object.keys(treeData.nodes).forEach(nid => updateNodePosition(nid));
    fitViewToNodes();
    drawConnections();
  }
});

bus.on('action:toggle-snap', () => {
  setSnapEnabled(!snapEnabled);
  updateSnapButton(snapEnabled);
});

bus.on('action:delete-node', ({ id }) => {
  if (!treeData.nodes[id]) return;
  const snapshot = createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
  deleteNode(id, { skipHistory: true });
});

bus.on('action:delete-selected-nodes', () => {
  const ids = getSelectedNodeIds().filter(id => treeData.nodes[id]);
  if (!ids.length) return;
  const snapshot = createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
  ids.forEach(id => deleteNode(id, { skipHistory: true }));
  setSelectedNodes([]);
});

bus.on('action:set-node-enabled', ({ id, enabled }) => {
  setNodeEnabled(id, enabled);
});

bus.on('action:set-nodes-enabled', ({ ids, enabled }) => {
  setNodesEnabled(ids, enabled);
});

bus.on('action:set-node-root', ({ id }) => {
  setNodeRoot(id);
});

bus.on('action:connect-nodes', ({ sourceId, targetId }) => {
  connectNodes(sourceId, targetId);
});

bus.on('action:remove-connection', ({ sourceId, targetId }) => {
  removeConnection(sourceId, targetId);
});

bus.on('action:delete-port-connections', ({ nodeId, portType }) => {
  const conns = getConnectionsForPort(nodeId, portType);
  if (!conns.length) return;
  const snapshot = createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
  conns.forEach(c => removeConnection(c.sourceId, c.targetId, { skipHistory: true }));
});

bus.on('action:move-child', ({ parentId, fromIndex, toIndex }) => {
  const snapshot = createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
  if (moveChildNode(parentId, fromIndex, toIndex)) {
    drawConnections();
    if (selectedNodeId === parentId) renderRightPanelSelection(parentId);
  }
});

bus.on('action:reorder-child', ({ parentId, fromIndex, toIndex }) => {
  const snapshot = createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
  pushUndoSnapshot(snapshot);
  if (moveChildNode(parentId, fromIndex, toIndex)) {
    drawConnections();
    if (selectedNodeId === parentId) renderRightPanelSelection(parentId);
  }
});

bus.on('action:update-tree-field', ({ key, value }) => {
  if (!updateTreeField(key, value)) return;
});

bus.on('action:add-node-at-center', ({ type }) => {
  addNodeAtViewportCenter(type);
});

bus.on('action:add-node-at-point', ({ type, clientX, clientY }) => {
  const point = getCanvasPoint(clientX, clientY);
  addNodeToCanvas(type, Math.round(point.x - 80), Math.round(point.y - 20));
});

bus.on('action:node-drag-end', ({ beforeSnapshot }) => {
  pushUndoSnapshot(beforeSnapshot);
});

bus.on('action:copy', () => {
  copySelectionToClipboard();
});

bus.on('action:paste', () => {
  pasteNodeFromClipboard();
});

bus.on('action:cut', () => {
  if (copySelectionToClipboard()) {
    const ids = getSelectedNodeIds();
    if (ids.length > 1) {
      bus.emit('action:delete-selected-nodes');
    } else if (ids.length === 1) {
      bus.emit('action:delete-node', { id: ids[0] });
    }
  }
});

bus.on('action:apply-property-to-nodes', ({ ids, key, value }) => {
  applyPropertyToNodes(ids, key, value);
});

bus.on('action:context-menu', ({ clientX, clientY, target }) => {
  handleContextMenu(clientX, clientY, target);
});

bus.on('action:recover-autosave', () => {
  if (!recoveredAutosave) return;
  applyFullSnapshot({
    treeData: recoveredAutosave.treeData,
    nextNodeId: recoveredAutosave.nextNodeId,
    viewport: recoveredAutosave.viewport,
  });
  recoveredAutosave = null;
});

bus.on('action:discard-autosave', () => {
  recoveredAutosave = null;
  clearAutosave();
});

bus.on('action:write-autosave', () => {
  writeAutosaveNow({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
});

bus.on('action:focus-node', ({ nodeId }) => {
  const target = treeData.nodes[nodeId];
  if (!target) return;
  selectNode(nodeId);
  const rect = domRefs.$canvasArea.getBoundingClientRect();
  viewState.panX = rect.width / 2 - (target.display.x + 80) * viewState.zoom;
  viewState.panY = rect.height / 2 - (target.display.y + 30) * viewState.zoom;
  refreshCanvas();
  drawConnections();
});

/* ============================================================
   高层操作函数（编排多模块调用）
   ============================================================ */

function makeSnapshot() {
  return createSnapshot({
    panX: viewState.panX, panY: viewState.panY, zoom: viewState.zoom,
    selectedNodeIds: getSelectedNodeIds(),
  });
}

function deleteNode(id, options = {}) {
  if (!treeData.nodes[id]) return false;
  if (!options.skipHistory) pushUndoSnapshot(makeSnapshot());
  deleteNodeData(id);
  removeNodeDom(id);
  setHoveredConnection(null);
  setHoveredPort(null);
  drawConnections();
  scheduleValidationRefresh();
  return true;
}

function setNodeEnabled(id, enabled, options = {}) {
  const node = treeData.nodes[id];
  if (!node) return;
  if (!options.skipHistory && isNodeEnabled(node) !== !!enabled && !(treeData.root === id && enabled === false)) {
    pushUndoSnapshot(makeSnapshot());
  }
  if (treeData.root === id) {
    node.enabled = true;
  } else {
    node.enabled = !!enabled;
  }
  updateNodeEnabledState(id);
  if (selectedNodeId === id) renderRightPanelSelection(id);
  scheduleValidationRefresh();
}

function setNodesEnabled(ids, enabled) {
  const targets = ids.map(id => treeData.nodes[id]).filter(Boolean);
  const effectiveTargets = targets.filter(node => treeData.root !== node.id);
  if (!effectiveTargets.length) return false;
  const changed = effectiveTargets.some(node => isNodeEnabled(node) !== !!enabled);
  if (!changed) return false;
  pushUndoSnapshot(makeSnapshot());
  effectiveTargets.forEach(node => {
    node.enabled = !!enabled;
    updateNodeEnabledState(node.id);
  });
  setSelectedNodes(ids);
  scheduleValidationRefresh();
  return true;
}

function setNodeRoot(id, options = {}) {
  const node = treeData.nodes[id];
  if (!node) return;
  if (!options.skipHistory && treeData.root !== id) pushUndoSnapshot(makeSnapshot());
  if (treeData.root && nodeDomMap[treeData.root]) {
    setNodeRootClass(treeData.root, false);
  }
  node.enabled = true;
  treeData.root = id;
  setNodeRootClass(id, true);
  updateNodeEnabledState(id);
  if (selectedNodeId === id) renderRightPanelSelection(id);
  scheduleValidationRefresh();
}

function connectNodes(sourceId, targetId, options = {}) {
  if (!canConnectNodes(sourceId, targetId)) return false;
  if (!options.skipHistory) pushUndoSnapshot(makeSnapshot());
  connectNodesData(sourceId, targetId);
  drawConnections();
  if (selectedNodeId === sourceId || selectedNodeId === targetId) {
    renderRightPanelSelection(selectedNodeId);
  }
  scheduleValidationRefresh();
  return true;
}

function removeConnection(sourceId, targetId, options = {}) {
  const source = treeData.nodes[sourceId];
  if (!source) return false;
  if (!source.children.includes(targetId)) return false;
  if (!options.skipHistory) pushUndoSnapshot(makeSnapshot());
  removeConnectionData(sourceId, targetId);
  if (connState.hoveredConnection &&
      connState.hoveredConnection.sourceId === sourceId &&
      connState.hoveredConnection.targetId === targetId) {
    setHoveredConnection(null);
  }
  drawConnections();
  if (selectedNodeId === sourceId || selectedNodeId === targetId) {
    renderRightPanelSelection(selectedNodeId);
  }
  scheduleValidationRefresh();
  return true;
}

function addNodeToCanvas(type, x, y, options = {}) {
  if (!options.skipHistory) pushUndoSnapshot(makeSnapshot());
  const nodeData = createNodeData(type, x, y);
  if (!nodeData) return null;
  renderNode(nodeData);
  if (Object.keys(treeData.nodes).length === 1) {
    setNodeRoot(nodeData.id, { skipHistory: true });
  }
  scheduleValidationRefresh();
  return nodeData;
}

function addNodeAtViewportCenter(type) {
  const rect = domRefs.$canvasArea.getBoundingClientRect();
  const point = getCanvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return addNodeToCanvas(type, Math.round(point.x - 80), Math.round(point.y - 20));
}

function duplicateNode(id, x = null, y = null) {
  const source = treeData.nodes[id];
  if (!source) return null;
  pushUndoSnapshot(makeSnapshot());
  const offsetX = x !== null ? x : source.display.x + 40;
  const offsetY = y !== null ? y : source.display.y + 40;
  const node = addNodeToCanvas(source.type, offsetX, offsetY, { skipHistory: true });
  if (!node) return null;
  node.enabled = source.enabled !== false;
  node.properties = JSON.parse(JSON.stringify(source.properties));
  node.display.collapsed = source.display?.collapsed ?? true;
  updateNodeEnabledState(node.id);
  updateNodeSummary(node.id);
  const el = nodeDomMap[node.id];
  if (el && node.display.collapsed === false) el.classList.add('expanded');
  if (el) {
    const toggle = el.querySelector('.bt-node-toggle');
    if (toggle) toggle.textContent = node.display.collapsed ? '\u25B6' : '\u25BC';
  }
  return node;
}

function copySelectionToClipboard() {
  const ids = getSelectedNodeIds();
  if (!ids.length) return false;
  const data = serializeNodesForClipboard(ids);
  if (!data) return false;
  setClipboard(data);
  return true;
}

function pasteNodeFromClipboard(clientX, clientY) {
  const clipboard = getClipboard();
  if (!clipboard?.length) return false;
  const point = getPasteAnchorPoint();
  const createdIds = [];
  const baseX = Math.round(point.x - 80);
  const baseY = Math.round(point.y - 20);
  const sourceMinX = Math.min(...clipboard.map(node => node.display.x));
  const sourceMinY = Math.min(...clipboard.map(node => node.display.y));

  pushUndoSnapshot(makeSnapshot());
  clipboard.forEach(source => {
    const x = baseX + (source.display.x - sourceMinX);
    const y = baseY + (source.display.y - sourceMinY);
    const node = addNodeToCanvas(source.type, x, y, { skipHistory: true });
    if (!node) return;
    node.enabled = source.enabled !== false;
    node.properties = JSON.parse(JSON.stringify(source.properties));
    node.display.collapsed = source.display?.collapsed ?? true;
    updateNodeEnabledState(node.id);
    updateNodeSummary(node.id);
    const el = nodeDomMap[node.id];
    if (el && node.display.collapsed === false) el.classList.add('expanded');
    if (el) {
      const toggle = el.querySelector('.bt-node-toggle');
      if (toggle) toggle.textContent = node.display.collapsed ? '\u25B6' : '\u25BC';
    }
    createdIds.push(node.id);
  });
  setSelectedNodes(createdIds);
  return createdIds.length > 0;
}

function applyPropertyToNodes(ids, key, value) {
  const nodes = ids.map(id => treeData.nodes[id]).filter(Boolean);
  if (!nodes.length) return false;
  const changed = nodes.some(node => node.properties[key] !== value);
  if (!changed) return false;
  pushUndoSnapshot(makeSnapshot());
  nodes.forEach(node => {
    node.properties[key] = value;
    updateNodeSummary(node.id);
    syncPropertyControls(node.id, key, 'panel');
  });
  setSelectedNodes(ids);
  scheduleValidationRefresh();
  return true;
}

function disconnectAllForNode(nodeId) {
  const node = treeData.nodes[nodeId];
  if (!node) return false;
  const parentId = findParentNodeId(nodeId);
  const childIds = [...node.children];
  if (!parentId && !childIds.length) return false;
  pushUndoSnapshot(makeSnapshot());
  if (parentId) removeConnection(parentId, nodeId, { skipHistory: true });
  for (const childId of childIds) {
    removeConnection(nodeId, childId, { skipHistory: true });
  }
  if (selectedNodeId === nodeId) renderRightPanelSelection(nodeId);
  return true;
}

function applyNodePropertiesFromClipboard(nodeId) {
  const node = treeData.nodes[nodeId];
  const clipboard = getClipboard();
  if (!node || !clipboard || clipboard.length !== 1 || clipboard[0].type !== node.type) return false;
  const source = clipboard[0];
  pushUndoSnapshot(makeSnapshot());
  node.properties = JSON.parse(JSON.stringify(source.properties));
  if (treeData.root !== nodeId) node.enabled = source.enabled !== false;
  updateNodeEnabledState(nodeId);
  updateNodeSummary(nodeId);
  if (selectedNodeId === nodeId) renderRightPanelSelection(nodeId);
  scheduleValidationRefresh();
  return true;
}

/* ============================================================
   完整快照恢复（undo/redo/autosave）
   ============================================================ */
function applyFullSnapshot(snapshot) {
  setRestoringHistory(true);
  const preservedSelectedId = selectedNodeId;

  for (const id of Object.keys(nodeDomMap)) removeNodeDom(id);
  applySnapshotData(snapshot);

  viewState.panX = snapshot.viewport.panX;
  viewState.panY = snapshot.viewport.panY;
  viewState.zoom = snapshot.viewport.zoom;

  setConnectionDrag(null);
  setHoveredConnection(null);
  setHoveredPort(null);

  for (const node of Object.values(treeData.nodes)) {
    renderNode(node);
  }

  resizeCanvases();
  refreshCanvas();
  drawConnections();

  const restoredSelectedIds = (snapshot.viewport.selectedNodeIds || []).filter(id => treeData.nodes[id]);
  if (restoredSelectedIds.length) setSelectedNodes(restoredSelectedIds);
  else if (preservedSelectedId && treeData.nodes[preservedSelectedId]) selectNode(preservedSelectedId);
  else renderRightPanelPlaceholder();

  const histState = getHistoryState();
  updateHistoryButtons(histState.canUndo, histState.canRedo);
  setRestoringHistory(false);
}

/* ============================================================
   右键菜单
   ============================================================ */
function getAddNodeSubmenu(clientX, clientY) {
  return Object.entries(CATEGORIES).map(([categoryKey, categoryDef]) => ({
    label: categoryDef.label,
    submenu: Object.values(NODE_TYPES)
      .filter(nodeType => nodeType.category === categoryKey)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(nodeType => ({
        label: nodeType.displayName,
        onClick: () => {
          const point = getCanvasPoint(clientX, clientY);
          addNodeToCanvas(nodeType.type, Math.round(point.x - 80), Math.round(point.y - 20));
        },
      })),
  }));
}

function handleContextMenu(clientX, clientY, target) {
  const nodeEl = target.closest('.bt-node');
  const localPoint = { x: clientX - domRefs.$canvasArea.getBoundingClientRect().left, y: clientY - domRefs.$canvasArea.getBoundingClientRect().top };

  if (nodeEl) {
    const nodeId = nodeEl.dataset.nodeId;
    selectNode(nodeId);
    const node = treeData.nodes[nodeId];
    const reg = NODE_TYPES[node?.type];
    const clipboard = getClipboard();
    openContextMenu(clientX, clientY, [
      { label: treeData.root === nodeId ? I18N.rootNode : I18N.setAsRoot, disabled: treeData.root === nodeId, onClick: () => setNodeRoot(nodeId) },
      { label: I18N.duplicate, onClick: () => { const dup = duplicateNode(nodeId); if (dup) selectNode(dup.id); } },
      { label: I18N.copyToClipboard, onClick: () => { setClipboard(serializeNodesForClipboard([nodeId])); } },
      { label: I18N.cut, onClick: () => { setClipboard(serializeNodesForClipboard([nodeId])); deleteNode(nodeId); } },
      { label: I18N.expandCollapse, disabled: !reg?.expandable, onClick: () => toggleNodeExpand(nodeId) },
      { label: I18N.pasteProps, disabled: !clipboard || clipboard.length !== 1 || clipboard[0].type !== node?.type, onClick: () => applyNodePropertiesFromClipboard(nodeId) },
      { separator: true },
      { label: I18N.disconnectAll, onClick: () => disconnectAllForNode(nodeId) },
      { label: I18N.delete_, onClick: () => deleteNode(nodeId) },
    ]);
  } else {
    // 尝试命中连线
    const connection = hitTestConnections(localPoint);
    if (connection) {
      setHoveredConnection(connection);
      drawConnections();
      openContextMenu(clientX, clientY, [
        { label: I18N.deleteConnection, onClick: () => removeConnection(connection.sourceId, connection.targetId) },
      ]);
    } else {
      const clipboard = getClipboard();
      openContextMenu(clientX, clientY, [
        { label: getNodeDisplayName('Sequence'), onClick: () => { const p = getCanvasPoint(clientX, clientY); addNodeToCanvas('Sequence', Math.round(p.x - 80), Math.round(p.y - 20)); } },
        { label: getNodeDisplayName('Repeat'), onClick: () => { const p = getCanvasPoint(clientX, clientY); addNodeToCanvas('Repeat', Math.round(p.x - 80), Math.round(p.y - 20)); } },
        { label: getNodeDisplayName('InjectInput'), onClick: () => { const p = getCanvasPoint(clientX, clientY); addNodeToCanvas('InjectInput', Math.round(p.x - 80), Math.round(p.y - 20)); } },
        { label: getNodeDisplayName('CheckHP'), onClick: () => { const p = getCanvasPoint(clientX, clientY); addNodeToCanvas('CheckHP', Math.round(p.x - 80), Math.round(p.y - 20)); } },
        { separator: true },
        { label: I18N.addNode, submenu: getAddNodeSubmenu(clientX, clientY) },
        { label: I18N.paste, disabled: !clipboard, onClick: () => pasteNodeFromClipboard(clientX, clientY) },
        { label: I18N.fitView, onClick: () => fitViewToNodes() },
      ]);
    }
  }
}

/* ============================================================
   节点交互绑定（由 node-renderer 通过 bus 通知需要处理 mousedown）
   需要在 initNodeRenderer 之后追加端口和拖拽事件
   ============================================================ */
domRefs.$nodeContainer.addEventListener('mousedown', (e) => {
  const portEl = e.target.closest('.bt-port');
  if (portEl) {
    const nodeId = portEl.dataset.nodeId;
    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      if (portEl.classList.contains('bt-port-out')) {
        startConnectionDragFromOutput(nodeId, portEl);
      } else if (portEl.classList.contains('bt-port-in')) {
        startConnectionDragFromInput(nodeId, portEl);
      }
    }
    return;
  }

  const nodeEl = e.target.closest('.bt-node');
  if (!nodeEl || e.button !== 0) return;
  if (e.target.closest('.bt-node-toggle, .bt-node-icon, input, select, textarea, button, label')) return;

  e.preventDefault();
  e.stopPropagation();
  const nodeId = nodeEl.dataset.nodeId;

  if (e.shiftKey && !getSelectedNodeIds().includes(nodeId)) {
    return;
  }

  startNodeDrag(nodeId, e);
});

/* 端口 hover */
domRefs.$nodeContainer.addEventListener('mouseenter', (e) => {
  const portEl = e.target.closest('.bt-port');
  if (!portEl) return;
  const nodeId = portEl.dataset.nodeId;
  const portType = portEl.classList.contains('bt-port-in') ? 'in' : 'out';
  setHoveredPort({ nodeId, portType });
  setHoveredConnection(null);
  drawConnections();
}, true);

domRefs.$nodeContainer.addEventListener('mouseleave', (e) => {
  const portEl = e.target.closest('.bt-port');
  if (!portEl) return;
  const nodeId = portEl.dataset.nodeId;
  const portType = portEl.classList.contains('bt-port-in') ? 'in' : 'out';
  if (!connState.hoveredPort || connState.hoveredPort.nodeId !== nodeId || connState.hoveredPort.portType !== portType) return;
  setHoveredPort(null);
  drawConnections();
}, true);

/* 节点标题双击展开 */
let lastTitleClickAt = 0;
let lastTitleClickX = 0;
let lastTitleClickY = 0;
const NODE_TITLE_DOUBLE_CLICK_MS = 280;

domRefs.$nodeContainer.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  const titleBar = e.target.closest('.bt-node-title');
  if (!titleBar) return;
  if (e.target.closest('.bt-node-icon, .bt-node-toggle')) return;
  const nodeEl = titleBar.closest('.bt-node');
  if (!nodeEl) return;

  const now = performance.now();
  const dx = Math.abs(e.clientX - lastTitleClickX);
  const dy = Math.abs(e.clientY - lastTitleClickY);
  const isDoubleClick = now - lastTitleClickAt <= NODE_TITLE_DOUBLE_CLICK_MS && dx <= 6 && dy <= 6;

  if (isDoubleClick) {
    e.preventDefault();
    e.stopPropagation();
    lastTitleClickAt = 0;
    toggleNodeExpand(nodeEl.dataset.nodeId);
    return;
  }

  lastTitleClickAt = now;
  lastTitleClickX = e.clientX;
  lastTitleClickY = e.clientY;
});

/* ============================================================
   初始化
   ============================================================ */
resizeCanvases();
refreshCanvas();
drawConnections();
renderNodePalette();
renderRightPanelPlaceholder();
updateHistoryButtons(false, false);

// 添加测试节点
addNodeToCanvas('Sequence', 100, 50, { skipHistory: true });
addNodeToCanvas('InjectInput', 40, 180, { skipHistory: true });
addNodeToCanvas('WaitFrames', 200, 180, { skipHistory: true });
addNodeToCanvas('CheckHP', 360, 50, { skipHistory: true });
addNodeToCanvas('Repeat', 360, 180, { skipHistory: true });

// Autosave 恢复
try {
  const saved = loadAutosave();
  if (saved) {
    recoveredAutosave = saved;
    showRecoveryBanner(true);
  }
} catch {}

scheduleValidationRefresh();
