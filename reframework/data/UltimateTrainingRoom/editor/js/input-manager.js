/**
 * input-manager.js — 统一鼠标/键盘调度，管理所有交互模式
 *
 * 交互模式：
 *   canvasPan    — 中键/右键拖拽平移画布
 *   nodeDrag     — 拖拽节点（含多选批量拖拽、吸附、阈值）
 *   connectionDrag — 从端口拖出连线
 *   marquee      — 画布空白区框选
 *   paletteDrag  — 从左面板拖出节点（状态在 palette.js）
 *   childReorder — 在 inspector 子节点列表拖拽排序（状态在 inspector.js）
 */
import { treeData, createSnapshot, isNodeEnabled } from './tree-model.js';
import { viewState, getCanvasPoint, getCanvasLocalPoint, refreshCanvas, GRID_SIZE, snapEnabled } from './viewport.js';
import {
  connState, drawConnections, hitTestConnections, isSameConnection,
  getPortScreenPosition, getConnectionStrokeColor,
  clearValidConnectionTargets, updateValidConnectionTargets, updateValidConnectionSources,
  updateHoveredConnectionNode, setConnectionDrag, setHoveredConnection, setHoveredPort,
} from './connections.js';
import { nodeDomMap, updateNodePosition, suppressNextNodeClick, getNodeRectInCanvas, rectsIntersect } from './node-renderer.js';
import { CATEGORIES } from './node-registry.js';
import {
  paletteDrag, createPaletteDragPreview, updatePaletteDragPreview,
  cancelPaletteDrag, finishPaletteDrag, setSuppressNextPaletteClick,
} from './palette.js';
import {
  selectedNodeId, selectedNodeIds, setSelectedNodes, selectNode, toggleNodeInSelection,
  updateChildReorderDrag, finishChildReorderDrag, isChildReorderActive,
} from './inspector.js';
import { closeContextMenu, openContextMenu } from './context-menu.js';
import { closeAllCustomSelects } from './controls.js';
import { closeHelpOverlay } from './toolbar.js';

let bus = null;
let $canvasArea = null;
let $selectionRect = null;

/* 画布平移状态 */
let midDragging = false;
let midStartX = 0, midStartY = 0;
let midStartPanX = 0, midStartPanY = 0;

let rightDown = false;
let rightDragging = false;
let rightStartX = 0, rightStartY = 0;
let rightStartPanX = 0, rightStartPanY = 0;
let suppressNextContextMenu = false;

/* 节点拖拽状态 */
let nodeDragState = null;
const NODE_DRAG_THRESHOLD = 6;

/* 框选状态 */
let marquee = null;

/* 鼠标位置 */
let lastMouseClientX = 0;
let lastMouseClientY = 0;

export function getLastMousePosition() {
  return { x: lastMouseClientX, y: lastMouseClientY };
}

export function initInputManager(eventBus, domRefs) {
  bus = eventBus;
  $canvasArea = domRefs.$canvasArea;
  $selectionRect = domRefs.$selectionRect;

  // Canvas events
  $canvasArea.addEventListener('mousedown', onCanvasMouseDown);
  $canvasArea.addEventListener('mousemove', onCanvasMouseMove);
  $canvasArea.addEventListener('mouseleave', onCanvasMouseLeave);
  $canvasArea.addEventListener('contextmenu', (e) => e.preventDefault());
  $canvasArea.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
  $canvasArea.addEventListener('wheel', onCanvasWheel, { passive: false });

  // Global events
  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
  window.addEventListener('keydown', onGlobalKeyDown);
  window.addEventListener('mousedown', onWindowMouseDown, true);
  document.addEventListener('mousedown', onDocumentMouseDown);
  window.addEventListener('beforeunload', onBeforeUnload);
}

/* ============================================================
   Canvas mousedown
   ============================================================ */
function onCanvasMouseDown(e) {
  // 中键 → 平移
  if (e.button === 1) {
    e.preventDefault();
    midDragging = true;
    midStartX = e.clientX;
    midStartY = e.clientY;
    midStartPanX = viewState.panX;
    midStartPanY = viewState.panY;
    $canvasArea.style.cursor = 'grabbing';
    return;
  }

  // 右键 → 可能是平移或右键菜单
  if (e.button === 2) {
    closeContextMenu();
    e.preventDefault();
    rightDown = true;
    rightDragging = false;
    rightStartX = e.clientX;
    rightStartY = e.clientY;
    rightStartPanX = viewState.panX;
    rightStartPanY = viewState.panY;
    return;
  }

  // 左键
  if (e.button === 0) {
    // 取消正在进行的连线拖拽
    if (connState.connectionDrag) {
      setConnectionDrag(null);
      clearValidConnectionTargets();
      setHoveredConnection(null);
      setHoveredPort(null);
      drawConnections();
    }

    // 如果点击在节点上，不处理（由节点自己的事件处理）
    if (e.target.closest('.bt-node')) return;

    // 空白区域 → 开始框选
    const rect = getCanvasLocalPoint(e.clientX, e.clientY);
    marquee = {
      startX: rect.x,
      startY: rect.y,
      additive: e.shiftKey,
      baseIds: e.shiftKey ? [...(selectedNodeIds || [])] : [],
    };
    if (!e.shiftKey) selectNode(null);
  }
}

/* ============================================================
   Canvas mousemove（连线悬停检测）
   ============================================================ */
function onCanvasMouseMove(e) {
  if (connState.connectionDrag || connState.hoveredPort) return;
  const hovered = hitTestConnections(getCanvasLocalPoint(e.clientX, e.clientY));
  const changed = !isSameConnection(hovered, connState.hoveredConnection);
  if (!changed) return;
  setHoveredConnection(hovered);
  $canvasArea.style.cursor = hovered ? 'pointer' : '';
  drawConnections();
}

/* ============================================================
   Canvas mouseleave
   ============================================================ */
function onCanvasMouseLeave() {
  if ((!connState.hoveredConnection && !connState.hoveredPort) || connState.connectionDrag) return;
  setHoveredConnection(null);
  setHoveredPort(null);
  $canvasArea.style.cursor = '';
  drawConnections();
}

/* ============================================================
   Canvas wheel（缩放）
   ============================================================ */
const ZOOM_FACTOR = 0.001;

function onCanvasWheel(e) {
  e.preventDefault();
  const delta = -e.deltaY * ZOOM_FACTOR;
  bus.emit('action:zoom', { clientX: e.clientX, clientY: e.clientY, delta });
}

/* ============================================================
   Global mousemove
   ============================================================ */
function onGlobalMouseMove(e) {
  lastMouseClientX = e.clientX;
  lastMouseClientY = e.clientY;

  // 中键平移
  if (midDragging) {
    viewState.panX = midStartPanX + (e.clientX - midStartX);
    viewState.panY = midStartPanY + (e.clientY - midStartY);
    refreshCanvas();
  }

  // 右键平移
  if (rightDown) {
    const dx = e.clientX - rightStartX;
    const dy = e.clientY - rightStartY;
    if (!rightDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      rightDragging = true;
      $canvasArea.style.cursor = 'grabbing';
    }
    if (rightDragging) {
      viewState.panX = rightStartPanX + dx;
      viewState.panY = rightStartPanY + dy;
      refreshCanvas();
    }
  }

  // 面板拖拽
  if (paletteDrag) {
    if (!paletteDrag.active) {
      const dx = e.clientX - paletteDrag.startX;
      const dy = e.clientY - paletteDrag.startY;
      if (Math.abs(dx) >= 4 || Math.abs(dy) >= 4) {
        paletteDrag.active = true;
        setSuppressNextPaletteClick(true);
        paletteDrag.previewEl = createPaletteDragPreview(paletteDrag.type);
      }
    }
    if (paletteDrag.active) updatePaletteDragPreview(e.clientX, e.clientY);
  }

  // 子节点排序拖拽
  if (isChildReorderActive()) {
    updateChildReorderDrag(e.clientY);
  }

  // 连线拖拽
  if (connState.connectionDrag) {
    connState.connectionDrag.currentPoint = getCanvasLocalPoint(e.clientX, e.clientY);
    updateHoveredConnectionNode(e.clientX, e.clientY);
    drawConnections();
  }

  // 框选
  if (marquee) {
    const current = getCanvasLocalPoint(e.clientX, e.clientY);
    const left = Math.min(marquee.startX, current.x);
    const top = Math.min(marquee.startY, current.y);
    const width = Math.abs(current.x - marquee.startX);
    const height = Math.abs(current.y - marquee.startY);
    updateSelectionRect({ left, top, width, height });
    const selectRect = { left, top, right: left + width, bottom: top + height };
    const hitIds = Object.keys(treeData.nodes).filter(nodeId => {
      const rect = getNodeRectInCanvas(nodeId);
      return rect && rectsIntersect(selectRect, rect);
    });
    const nextIds = marquee.additive
      ? [...new Set([...marquee.baseIds, ...hitIds])]
      : hitIds;
    setSelectedNodes(nextIds);
  }

  // 节点拖拽
  if (nodeDragState) {
    const node = treeData.nodes[nodeDragState.id];
    if (!node) return;
    if (!nodeDragState.active) {
      const dx = e.clientX - nodeDragState.startClientX;
      const dy = e.clientY - nodeDragState.startClientY;
      if (Math.abs(dx) < NODE_DRAG_THRESHOLD && Math.abs(dy) < NODE_DRAG_THRESHOLD) return;
      nodeDragState.active = true;
      $canvasArea.style.cursor = 'grabbing';
    }
    const point = getCanvasPoint(e.clientX, e.clientY);
    const dx = Math.round(point.x - nodeDragState.offsetX - nodeDragState.startPositions[nodeDragState.id].x);
    const dy = Math.round(point.y - nodeDragState.offsetY - nodeDragState.startPositions[nodeDragState.id].y);
    nodeDragState.ids.forEach(nodeId => {
      const start = nodeDragState.startPositions[nodeId];
      treeData.nodes[nodeId].display.x = start.x + dx;
      treeData.nodes[nodeId].display.y = start.y + dy;
      updateNodePosition(nodeId);
    });
    drawConnections();
  }
}

/* ============================================================
   Global mouseup
   ============================================================ */
function onGlobalMouseUp(e) {
  // 中键平移结束
  if (e.button === 1 && midDragging) {
    midDragging = false;
    $canvasArea.style.cursor = '';
  }

  // 右键结束
  if (e.button === 2 && rightDown) {
    rightDown = false;
    if (suppressNextContextMenu) {
      suppressNextContextMenu = false;
      rightDragging = false;
      return;
    }
    if (rightDragging) {
      $canvasArea.style.cursor = '';
    } else {
      // 右键点击 → 打开右键菜单
      bus.emit('action:context-menu', {
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target,
      });
    }
    rightDragging = false;
  }

  if (e.button !== 0) return;

  // 框选结束
  if (marquee) {
    marquee = null;
    hideSelectionRect();
  }

  // 面板拖拽结束
  if (paletteDrag) {
    finishPaletteDrag(e.clientX, e.clientY);
  }

  // 子节点排序拖拽结束
  if (isChildReorderActive()) {
    finishChildReorderDrag();
  }

  // 连线拖拽结束
  if (connState.connectionDrag) {
    const drag = connState.connectionDrag;
    if (drag.mode === 'from-output') {
      const portIn = e.target.closest('.bt-port-in');
      const nodeEl = e.target.closest('.bt-node');
      const targetNodeId = portIn?.dataset.nodeId || nodeEl?.dataset.nodeId || null;
      bus.emit('action:connect-nodes', { sourceId: drag.sourceNodeId, targetId: targetNodeId });
    } else if (drag.mode === 'from-input') {
      const portOut = e.target.closest('.bt-port-out');
      const nodeEl = e.target.closest('.bt-node');
      const sourceNodeId = portOut?.dataset.nodeId || nodeEl?.dataset.nodeId || null;
      bus.emit('action:connect-nodes', { sourceId: sourceNodeId, targetId: drag.targetNodeId });
    }
    setConnectionDrag(null);
    clearValidConnectionTargets();
    setHoveredConnection(null);
    drawConnections();
  }

  // 节点拖拽结束
  if (nodeDragState) {
    if (nodeDragState.active) {
      // 吸附
      if (snapEnabled && !e.shiftKey) {
        nodeDragState.ids.forEach(nodeId => {
          const node = treeData.nodes[nodeId];
          if (!node) return;
          node.display.x = Math.round(node.display.x / GRID_SIZE) * GRID_SIZE;
          node.display.y = Math.round(node.display.y / GRID_SIZE) * GRID_SIZE;
          updateNodePosition(nodeId);
        });
        drawConnections();
      }
      bus.emit('action:node-drag-end', { beforeSnapshot: nodeDragState.beforeSnapshot });
      suppressNextNodeClick(nodeDragState.id);
    }
    nodeDragState = null;
    $canvasArea.style.cursor = '';
  }
}

/* ============================================================
   节点拖拽发起（由节点 mousedown 触发）
   ============================================================ */
export function startNodeDrag(id, e) {
  const ids = selectedNodeIds.includes(id) ? [...selectedNodeIds] : [id];
  if (!selectedNodeIds.includes(id)) selectNode(id);

  const node = treeData.nodes[id];
  const point = getCanvasPoint(e.clientX, e.clientY);
  nodeDragState = {
    id,
    ids: ids.includes(id) ? ids : [id],
    startClientX: e.clientX,
    startClientY: e.clientY,
    offsetX: point.x - node.display.x,
    offsetY: point.y - node.display.y,
    active: false,
    beforeSnapshot: createSnapshot({
      panX: viewState.panX,
      panY: viewState.panY,
      zoom: viewState.zoom,
      selectedNodeIds: selectedNodeIds,
    }),
    startPositions: Object.fromEntries(
      ids.map(nid => [nid, { x: treeData.nodes[nid].display.x, y: treeData.nodes[nid].display.y }])
    ),
  };
}

/* ============================================================
   连线拖拽发起（由端口 mousedown 触发）
   ============================================================ */
export function startConnectionDragFromOutput(nodeId, portEl) {
  const start = getPortScreenPosition(portEl);
  setConnectionDrag({
    mode: 'from-output',
    sourceNodeId: nodeId,
    currentPoint: start,
    color: getConnectionStrokeColor(treeData.nodes[nodeId]),
  });
  updateValidConnectionTargets(nodeId);
  drawConnections();
}

export function startConnectionDragFromInput(nodeId, portEl) {
  const start = getPortScreenPosition(portEl);
  setConnectionDrag({
    mode: 'from-input',
    targetNodeId: nodeId,
    currentPoint: start,
    color: getConnectionStrokeColor(treeData.nodes[nodeId]),
  });
  updateValidConnectionSources(nodeId);
  drawConnections();
}

function onWindowMouseDown(e) {
  if (!e.target.closest('#context-menu')) closeContextMenu();
}

/* ============================================================
   Document mousedown（冒泡阶段，关闭 selects，取消面板拖拽）
   ============================================================ */
function onDocumentMouseDown(e) {
  if (!e.target.closest('#context-menu')) closeContextMenu();
  if (e.button === 2 && paletteDrag) {
    suppressNextContextMenu = true;
    cancelPaletteDrag();
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.target.closest('.bt-node-prop-select')) return;
  closeAllCustomSelects(null);
}

/* ============================================================
   键盘
   ============================================================ */
function onGlobalKeyDown(e) {
  if (e.key === 'Escape') {
    closeContextMenu();
    closeHelpOverlay();
    if (paletteDrag) cancelPaletteDrag();
    if (connState.connectionDrag) {
      setConnectionDrag(null);
      clearValidConnectionTargets();
      drawConnections();
    }
    if (marquee) {
      marquee = null;
      hideSelectionRect();
    }
    if (selectedNodeIds?.length) setSelectedNodes([]);
  }

  const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
  const isRedo = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z';

  if (isUndo) { e.preventDefault(); bus.emit('action:undo'); return; }
  if (isRedo) { e.preventDefault(); bus.emit('action:redo'); return; }

  // 输入框中不处理快捷键
  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

  const isFitView = !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'f';
  const isSetRoot = !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'r';
  const isCopy = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'c';
  const isPaste = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'v';
  const isCut = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'x';

  if (isFitView) { e.preventDefault(); bus.emit('action:fit-view'); return; }
  if (isSetRoot) {
    if (selectedNodeIds?.length === 1 && selectedNodeId) {
      e.preventDefault();
      bus.emit('action:set-node-root', { id: selectedNodeId });
    }
    return;
  }
  if (isCopy) { e.preventDefault(); bus.emit('action:copy'); return; }
  if (isPaste) { e.preventDefault(); bus.emit('action:paste'); return; }
  if (isCut) { e.preventDefault(); bus.emit('action:cut'); return; }

  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (connState.connectionDrag) return;

  e.preventDefault();
  if (connState.hoveredPort) {
    bus.emit('action:delete-port-connections', {
      nodeId: connState.hoveredPort.nodeId,
      portType: connState.hoveredPort.portType,
    });
  } else if (connState.hoveredConnection) {
    bus.emit('action:remove-connection', {
      sourceId: connState.hoveredConnection.sourceId,
      targetId: connState.hoveredConnection.targetId,
    });
  } else if ((selectedNodeIds || []).length > 1) {
    bus.emit('action:delete-selected-nodes');
  } else if (selectedNodeId) {
    bus.emit('action:delete-node', { id: selectedNodeId });
  }
}

/* ============================================================
   beforeunload
   ============================================================ */
function onBeforeUnload(e) {
  bus.emit('action:write-autosave');
  e.preventDefault();
  e.returnValue = '';
}

/* ============================================================
   框选矩形 DOM 操作
   ============================================================ */
function updateSelectionRect(rect) {
  $selectionRect.style.display = 'block';
  $selectionRect.style.left = `${rect.left}px`;
  $selectionRect.style.top = `${rect.top}px`;
  $selectionRect.style.width = `${rect.width}px`;
  $selectionRect.style.height = `${rect.height}px`;
}

function hideSelectionRect() {
  $selectionRect.style.display = 'none';
}

/* ============================================================
   辅助：粘贴锚点
   ============================================================ */
export function getPasteAnchorPoint() {
  const canvasRect = $canvasArea.getBoundingClientRect();
  const insideCanvas =
    lastMouseClientX >= canvasRect.left && lastMouseClientX <= canvasRect.right &&
    lastMouseClientY >= canvasRect.top && lastMouseClientY <= canvasRect.bottom;
  if (insideCanvas) return getCanvasPoint(lastMouseClientX, lastMouseClientY);
  return getCanvasPoint(canvasRect.left + canvasRect.width / 2, canvasRect.top + canvasRect.height / 2);
}
