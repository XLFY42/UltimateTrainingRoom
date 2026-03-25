/**
 * viewport.js — 画布视口管理：pan/zoom 状态、坐标变换、网格绘制、自动布局
 */
import { treeData } from './tree-model.js';
import { NODE_TYPES } from './node-registry.js';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3.0;
const GRID_SIZE = 40;

let bus = null;
let $canvasArea = null;
let $gridCanvas = null;
let $connCanvas = null;
let $nodeContainer = null;

export const viewState = {
  panX: 0,
  panY: 0,
  zoom: 1,
};

export { ZOOM_MIN, ZOOM_MAX, GRID_SIZE };

export function initViewport(eventBus, refs) {
  bus = eventBus;
  $canvasArea = refs.$canvasArea;
  $gridCanvas = refs.$gridCanvas;
  $connCanvas = refs.$connCanvas;
  $nodeContainer = refs.$nodeContainer;

  window.addEventListener('resize', () => {
    resizeCanvases();
    refreshCanvas();
    bus.emit('canvas:resized');
  });
}

/* ============================================================
   Canvas 尺寸管理
   ============================================================ */
export function resizeCanvases() {
  const rect = $canvasArea.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  const dpr = window.devicePixelRatio || 1;

  for (const cvs of [$gridCanvas, $connCanvas]) {
    cvs.width = w * dpr;
    cvs.height = h * dpr;
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    cvs.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

/* ============================================================
   背景网格绘制
   ============================================================ */
export function drawGrid() {
  const ctx = $gridCanvas.getContext('2d');
  const rect = $canvasArea.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  ctx.clearRect(0, 0, w, h);

  const zoom = viewState.zoom;
  const ox = viewState.panX;
  const oy = viewState.panY;

  // 小格 40px
  const smallStep = 40 * zoom;
  if (smallStep > 4) {
    ctx.beginPath();
    ctx.strokeStyle = '#222240';
    ctx.lineWidth = 1;
    const startX = (ox % smallStep + smallStep) % smallStep;
    for (let x = startX; x < w; x += smallStep) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    const startY = (oy % smallStep + smallStep) % smallStep;
    for (let y = startY; y < h; y += smallStep) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }

  // 大格 200px
  const largeStep = 200 * zoom;
  if (largeStep > 10) {
    ctx.beginPath();
    ctx.strokeStyle = '#2a2a45';
    ctx.lineWidth = 1;
    const startX2 = (ox % largeStep + largeStep) % largeStep;
    for (let x = startX2; x < w; x += largeStep) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    const startY2 = (oy % largeStep + largeStep) % largeStep;
    for (let y = startY2; y < h; y += largeStep) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }
}

/* ============================================================
   节点容器 transform 同步
   ============================================================ */
export function syncNodeContainerTransform() {
  $nodeContainer.style.transform =
    `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`;
}

/* ============================================================
   统一刷新
   ============================================================ */
export function refreshCanvas() {
  drawGrid();
  syncNodeContainerTransform();
  bus?.emit('viewport:changed');
}

/* ============================================================
   坐标变换
   ============================================================ */
export function getCanvasPoint(clientX, clientY) {
  const rect = $canvasArea.getBoundingClientRect();
  return {
    x: (clientX - rect.left - viewState.panX) / viewState.zoom,
    y: (clientY - rect.top - viewState.panY) / viewState.zoom,
  };
}

export function getCanvasLocalPoint(clientX, clientY) {
  const rect = $canvasArea.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function getCanvasAreaRect() {
  return $canvasArea.getBoundingClientRect();
}

/* ============================================================
   Zoom
   ============================================================ */
export function applyZoom(clientX, clientY, delta) {
  const oldZoom = viewState.zoom;
  let newZoom = oldZoom * (1 + delta);
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));

  const rect = $canvasArea.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;

  viewState.panX = mx - (mx - viewState.panX) * (newZoom / oldZoom);
  viewState.panY = my - (my - viewState.panY) * (newZoom / oldZoom);
  viewState.zoom = newZoom;

  refreshCanvas();
}

/* ============================================================
   适应视图
   ============================================================ */
export function fitViewToNodes() {
  const nodes = Object.values(treeData.nodes);
  if (!nodes.length) {
    viewState.panX = 0;
    viewState.panY = 0;
    viewState.zoom = 1;
    refreshCanvas();
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const height = node.display.collapsed === false ? 120 : 60;
    minX = Math.min(minX, node.display.x);
    minY = Math.min(minY, node.display.y);
    maxX = Math.max(maxX, node.display.x + 160);
    maxY = Math.max(maxY, node.display.y + height);
  }
  const rect = $canvasArea.getBoundingClientRect();
  const contentW = Math.max(1, maxX - minX + 80);
  const contentH = Math.max(1, maxY - minY + 80);
  const zoomX = rect.width / contentW;
  const zoomY = rect.height / contentH;
  viewState.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(zoomX, zoomY)));
  viewState.panX = rect.width / 2 - ((minX + maxX) / 2) * viewState.zoom;
  viewState.panY = rect.height / 2 - ((minY + maxY) / 2) * viewState.zoom;
  refreshCanvas();
}

/* ============================================================
   自动布局
   ============================================================ */
export function autoLayoutTree() {
  const rootId = treeData.root;
  const root = treeData.nodes[rootId];
  if (!root) return false;

  const levelHeight = 160;
  const siblingGap = 80;
  const nodeWidth = 160;
  const visited = new Set();

  function measureSubtree(nodeId) {
    const node = treeData.nodes[nodeId];
    if (!node || visited.has(nodeId)) return nodeWidth;
    visited.add(nodeId);
    const childIds = node.children.filter(id => treeData.nodes[id]);
    if (!childIds.length) return nodeWidth;
    let total = 0;
    childIds.forEach((childId, index) => {
      total += measureSubtree(childId);
      if (index < childIds.length - 1) total += siblingGap;
    });
    return Math.max(nodeWidth, total);
  }

  const subtreeWidths = {};
  Object.keys(treeData.nodes).forEach(nodeId => {
    visited.clear();
    subtreeWidths[nodeId] = measureSubtree(nodeId);
  });

  function layoutNode(nodeId, centerX, y) {
    const node = treeData.nodes[nodeId];
    if (!node) return;
    node.display.x = Math.round(centerX - nodeWidth / 2);
    node.display.y = Math.round(y);
    const childIds = node.children.filter(id => treeData.nodes[id]);
    if (!childIds.length) return;

    const totalWidth = childIds.reduce((sum, childId, index) => {
      return sum + subtreeWidths[childId] + (index < childIds.length - 1 ? siblingGap : 0);
    }, 0);

    let cursorX = centerX - totalWidth / 2;
    childIds.forEach(childId => {
      const childCenterX = cursorX + subtreeWidths[childId] / 2;
      layoutNode(childId, childCenterX, y + levelHeight);
      cursorX += subtreeWidths[childId] + siblingGap;
    });
  }

  layoutNode(rootId, 0, 0);
  return true;
}

/* ============================================================
   吸附
   ============================================================ */
export let snapEnabled = true;

export function setSnapEnabled(value) {
  snapEnabled = value;
}

export function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}
