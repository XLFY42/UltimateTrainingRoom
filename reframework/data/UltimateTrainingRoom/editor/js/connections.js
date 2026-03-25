/**
 * connections.js — Bezier 连线绘制、碰撞检测、端口位置查询、视觉反馈
 */
import { treeData, findParentNodeId, canConnectNodes } from './tree-model.js';
import { CATEGORIES } from './node-registry.js';

let bus = null;
let $connCanvas = null;
let $canvasArea = null;
let nodeDomMapRef = null;

/* 连线视觉状态（由 input-manager 设置） */
export const connState = {
  hoveredConnection: null,
  hoveredPort: null,
  connectionDrag: null,
  hoveredConnectionNodeId: null,
};

export function initConnections(eventBus, refs, nodeDomMap) {
  bus = eventBus;
  $connCanvas = refs.$connCanvas;
  $canvasArea = refs.$canvasArea;
  nodeDomMapRef = nodeDomMap;
}

export function setHoveredConnection(val) { connState.hoveredConnection = val; }
export function setHoveredPort(val) { connState.hoveredPort = val; }
export function setConnectionDrag(val) { connState.connectionDrag = val; }

/* ============================================================
   Bezier 数学
   ============================================================ */
export function getBezierControlPoints(from, to) {
  const dy = Math.max(60, Math.abs(to.y - from.y) * 0.5);
  return { cp1x: from.x, cp1y: from.y + dy, cp2x: to.x, cp2y: to.y - dy };
}

export function getBezierPoint(from, to, t) {
  const { cp1x, cp1y, cp2x, cp2y } = getBezierControlPoints(from, to);
  return {
    x: Math.pow(1 - t, 3) * from.x + 3 * Math.pow(1 - t, 2) * t * cp1x +
       3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * to.x,
    y: Math.pow(1 - t, 3) * from.y + 3 * Math.pow(1 - t, 2) * t * cp1y +
       3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * to.y,
  };
}

export function drawBezier(ctx, from, to, options = {}) {
  const { cp1x, cp1y, cp2x, cp2y } = getBezierControlPoints(from, to);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
  ctx.lineWidth = options.lineWidth || 2;
  ctx.strokeStyle = options.color || '#3a3a55';
  ctx.shadowColor = options.shadowColor || 'transparent';
  ctx.shadowBlur = options.shadowBlur || 0;
  if (options.dashed) ctx.setLineDash([8, 6]);
  else ctx.setLineDash([]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/* ============================================================
   端口位置
   ============================================================ */
export function getPortScreenPosition(portEl) {
  if (!portEl) return null;
  const portRect = portEl.getBoundingClientRect();
  const canvasRect = $canvasArea.getBoundingClientRect();
  return {
    x: portRect.left + portRect.width / 2 - canvasRect.left,
    y: portRect.top + portRect.height / 2 - canvasRect.top,
  };
}

export function getNodePortPosition(nodeId, portType) {
  const el = nodeDomMapRef[nodeId];
  if (!el) return null;
  const portEl = el.querySelector(`.bt-port-${portType}`);
  return getPortScreenPosition(portEl);
}

export function getConnectionStrokeColor(node) {
  const cat = CATEGORIES[node?.category];
  return cat?.color || '#3a3a55';
}

/* ============================================================
   连线记录
   ============================================================ */
export function getConnectionRecords() {
  const records = [];
  for (const node of Object.values(treeData.nodes)) {
    const from = getNodePortPosition(node.id, 'out');
    if (!from) continue;
    node.children.forEach((childId, index) => {
      const to = getNodePortPosition(childId, 'in');
      if (!to) return;
      records.push({
        sourceId: node.id, targetId: childId, index,
        siblingCount: node.children.length, from, to,
        color: getConnectionStrokeColor(node),
      });
    });
  }
  return records;
}

export function isSameConnection(a, b) {
  return !!a && !!b && a.sourceId === b.sourceId && a.targetId === b.targetId;
}

export function getConnectionsForPort(nodeId, portType) {
  if (portType === 'out') {
    const node = treeData.nodes[nodeId];
    if (!node) return [];
    return node.children.map(childId => ({ sourceId: nodeId, targetId: childId }));
  }
  if (portType === 'in') {
    const parentId = findParentNodeId(nodeId);
    return parentId ? [{ sourceId: parentId, targetId: nodeId }] : [];
  }
  return [];
}

export function isConnectionInList(connection, list) {
  return list.some(item => isSameConnection(connection, item));
}

/* ============================================================
   碰撞检测
   ============================================================ */
function distanceToSegmentSquared(point, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = point.x - a.x, apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (!abLenSq) return apx * apx + apy * apy;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const projX = a.x + abx * t, projY = a.y + aby * t;
  const dx = point.x - projX, dy = point.y - projY;
  return dx * dx + dy * dy;
}

export function hitTestConnections(localPoint) {
  const records = getConnectionRecords();
  let best = null;
  let bestDistSq = 100;

  for (const record of records) {
    let prev = getBezierPoint(record.from, record.to, 0);
    for (let i = 1; i <= 24; i++) {
      const next = getBezierPoint(record.from, record.to, i / 24);
      const distSq = distanceToSegmentSquared(localPoint, prev, next);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = { sourceId: record.sourceId, targetId: record.targetId };
      }
      prev = next;
    }
  }

  return best;
}

/* ============================================================
   连线绘制
   ============================================================ */
function drawConnectionLabel(ctx, from, to, index) {
  const pt = getBezierPoint(from, to, 0.5);
  ctx.fillStyle = '#6c6c8a';
  ctx.font = '18px Segoe UI';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), pt.x, pt.y - 14);
}

function drawConnectionFlow(ctx, from, to, color) {
  const t = (performance.now() % 2000) / 2000;
  const point = getBezierPoint(from, to, t);
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawConnections() {
  const ctx = $connCanvas.getContext('2d');
  const rect = $canvasArea.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  ctx.clearRect(0, 0, w, h);

  const hovered = connState.hoveredConnection;
  const hoveredPortConnections = connState.hoveredPort
    ? getConnectionsForPort(connState.hoveredPort.nodeId, connState.hoveredPort.portType)
    : [];

  for (const record of getConnectionRecords()) {
    const isHovered = isSameConnection(record, hovered);
    const isPortHovered = isConnectionInList(record, hoveredPortConnections);
    const isSibling = hovered && hovered.sourceId === record.sourceId && !isHovered;
    const color = isHovered
      ? record.color
      : (isPortHovered ? `${record.color}b3` : (isSibling ? `${record.color}80` : '#3a3a55'));
    const lineWidth = isHovered ? 7 : (isPortHovered ? 6 : 5);

    drawBezier(ctx, record.from, record.to, {
      color, lineWidth,
      shadowColor: isHovered ? `${record.color}cc` : (isPortHovered ? `${record.color}55` : 'transparent'),
      shadowBlur: isHovered ? 12 : (isPortHovered ? 6 : 0),
    });
    if (record.siblingCount > 1) drawConnectionLabel(ctx, record.from, record.to, record.index);
    if (isHovered) drawConnectionFlow(ctx, record.from, record.to, `${record.color}80`);
  }

  if (connState.connectionDrag) {
    const drag = connState.connectionDrag;
    if (drag.mode === 'from-output') {
      const from = getNodePortPosition(drag.sourceNodeId, 'out');
      if (from) {
        drawBezier(ctx, from, drag.currentPoint, {
          color: drag.color, lineWidth: 3, dashed: true,
        });
      }
    } else if (drag.mode === 'from-input') {
      const to = getNodePortPosition(drag.targetNodeId, 'in');
      if (to) {
        drawBezier(ctx, drag.currentPoint, to, {
          color: drag.color, lineWidth: 3, dashed: true,
        });
      }
    }
  }
}

/* ============================================================
   有效连接目标高亮
   ============================================================ */
export function clearValidConnectionTargets() {
  document.querySelectorAll('.bt-port.connection-valid').forEach(el =>
    el.classList.remove('connection-valid')
  );
  document.querySelectorAll('.bt-node.connection-valid-node').forEach(el =>
    el.classList.remove('connection-valid-node')
  );
  connState.hoveredConnectionNodeId = null;
}

export function updateValidConnectionTargets(sourceId) {
  clearValidConnectionTargets();
  for (const [nodeId, el] of Object.entries(nodeDomMapRef)) {
    if (!canConnectNodes(sourceId, nodeId)) continue;
    const portIn = el.querySelector('.bt-port-in');
    if (portIn) portIn.classList.add('connection-valid');
  }
}

export function updateValidConnectionSources(targetId) {
  clearValidConnectionTargets();
  for (const [nodeId, el] of Object.entries(nodeDomMapRef)) {
    if (!canConnectNodes(nodeId, targetId)) continue;
    const portOut = el.querySelector('.bt-port-out');
    if (portOut) portOut.classList.add('connection-valid');
  }
}

export function updateHoveredConnectionNode(clientX, clientY) {
  document.querySelectorAll('.bt-node.connection-valid-node').forEach(el =>
    el.classList.remove('connection-valid-node')
  );
  connState.hoveredConnectionNodeId = null;
  if (!connState.connectionDrag) return;

  const nodeEl = document.elementFromPoint(clientX, clientY)?.closest('.bt-node');
  const nodeId = nodeEl?.dataset.nodeId || null;
  if (!nodeId) return;

  const valid = connState.connectionDrag.mode === 'from-output'
    ? canConnectNodes(connState.connectionDrag.sourceNodeId, nodeId)
    : canConnectNodes(nodeId, connState.connectionDrag.targetNodeId);
  if (!valid) return;

  nodeEl.classList.add('connection-valid-node');
  connState.hoveredConnectionNodeId = nodeId;
}

/* ============================================================
   连线端口批量操作
   ============================================================ */
export function removeConnectionsForPort(nodeId, portType, removeFn) {
  const connections = getConnectionsForPort(nodeId, portType);
  let removedAny = false;
  for (const conn of connections) {
    removedAny = removeFn(conn.sourceId, conn.targetId, { skipHistory: true }) || removedAny;
  }
  return { connections, removedAny };
}
