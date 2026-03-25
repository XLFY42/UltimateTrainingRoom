/**
 * toolbar.js — 工具栏按钮、验证面板、帮助弹窗、恢复横幅、面板折叠、分隔条
 */
import { treeData, validateTree } from './tree-model.js';
import { getNodeDisplayName } from './node-registry.js';

let bus = null;
let refs = {};
let validationIssues = [];
let validationRefreshTimer = null;

export function initToolbar(eventBus, domRefs) {
  bus = eventBus;
  refs = domRefs;

  // Undo/Redo
  refs.$btnUndo.addEventListener('click', () => bus.emit('action:undo'));
  refs.$btnRedo.addEventListener('click', () => bus.emit('action:redo'));

  // Snap
  refs.$btnSnap.addEventListener('click', () => bus.emit('action:toggle-snap'));

  // Layout
  refs.$btnLayout.addEventListener('click', () => bus.emit('action:auto-layout'));

  // Validation
  refs.$btnValidate.addEventListener('click', () => openValidationPanel());
  refs.$btnCloseValidation.addEventListener('click', () => closeValidationPanel());

  // Help
  refs.$btnHelp.addEventListener('click', () => openHelpOverlay());
  refs.$btnCloseHelp.addEventListener('click', () => closeHelpOverlay());
  refs.$helpOverlay.addEventListener('mousedown', (e) => {
    if (e.target === refs.$helpOverlay) closeHelpOverlay();
  });

  // Recovery
  refs.$btnRecoverTree.addEventListener('click', () => {
    bus.emit('action:recover-autosave');
    showRecoveryBanner(false);
  });
  refs.$btnDiscardRecovery.addEventListener('click', () => {
    bus.emit('action:discard-autosave');
    showRecoveryBanner(false);
  });

  // 面板折叠
  initPanelCollapse();
  initDivider(refs.$leftDivider, refs.$leftPanel, 'left');
  initDivider(refs.$rightDivider, refs.$rightPanel, 'right');
}

/* ============================================================
   History 按钮灰度同步
   ============================================================ */
export function updateHistoryButtons(canUndo, canRedo) {
  refs.$btnUndo.classList.toggle('disabled', !canUndo);
  refs.$btnRedo.classList.toggle('disabled', !canRedo);
  refs.$btnUndo.disabled = !canUndo;
  refs.$btnRedo.disabled = !canRedo;
}

/* ============================================================
   Snap 按钮同步
   ============================================================ */
export function updateSnapButton(enabled) {
  refs.$btnSnap.classList.toggle('disabled', !enabled);
}

/* ============================================================
   验证面板
   ============================================================ */
export function scheduleValidationRefresh() {
  clearTimeout(validationRefreshTimer);
  validationRefreshTimer = setTimeout(() => {
    validationIssues = validateTree();
    applyValidationMarkers();
    if (refs.$validationPanel.classList.contains('open')) {
      renderValidationPanelList();
    }
  }, 0);
}

function openValidationPanel() {
  validationIssues = validateTree();
  applyValidationMarkers();
  renderValidationPanelList();
  refs.$validationPanel.classList.add('open');
}

function closeValidationPanel() {
  refs.$validationPanel.classList.remove('open');
}

function renderValidationPanelList() {
  refs.$validationPanelList.innerHTML = '';
  validationIssues.forEach(issue => {
    const item = document.createElement('div');
    item.className = `validation-item ${issue.type}`;
    const node = treeData.nodes[issue.nodeId];
    item.innerHTML = `
      <div class="validation-item-title">${issue.message}</div>
      <div class="validation-item-meta">${node ? getNodeDisplayName(node.type) : issue.nodeId} \u00B7 ${issue.nodeId}</div>
    `;
    item.addEventListener('click', () => {
      bus.emit('action:focus-node', { nodeId: issue.nodeId });
    });
    refs.$validationPanelList.appendChild(item);
  });
}

function applyValidationMarkers() {
  bus.emit('validation:markers', { issues: validationIssues });
}

export function applyValidationMarkersToDom(nodeDomMap) {
  Object.keys(nodeDomMap).forEach(nodeId => {
    const el = nodeDomMap[nodeId];
    if (!el) return;
    el.classList.remove('has-validation');
    const marker = el.querySelector('.bt-node-validation');
    if (marker) marker.remove();
  });

  const grouped = {};
  validationIssues.forEach(issue => {
    grouped[issue.nodeId] ||= [];
    grouped[issue.nodeId].push(issue);
  });

  Object.entries(grouped).forEach(([nodeId, issues]) => {
    const el = nodeDomMap[nodeId];
    if (!el) return;
    const marker = document.createElement('div');
    marker.className = 'bt-node-validation ' + (issues.some(i => i.type === 'error') ? 'error' : 'warning');
    el.appendChild(marker);
    el.classList.add('has-validation');
  });
}

/* ============================================================
   帮助弹窗
   ============================================================ */
export function openHelpOverlay() {
  refs.$helpOverlay.classList.add('open');
}

export function closeHelpOverlay() {
  refs.$helpOverlay.classList.remove('open');
}

/* ============================================================
   恢复横幅
   ============================================================ */
export function showRecoveryBanner(show) {
  refs.$recoveryBanner.classList.toggle('open', show);
}

/* ============================================================
   面板折叠
   ============================================================ */
const panelState = {
  leftPanelWidth: 200,
  rightPanelWidth: 260,
  leftCollapsed: false,
  rightCollapsed: false,
};

export function getPanelState() { return panelState; }

function initPanelCollapse() {
  document.getElementById('left-collapse-btn').addEventListener('click', toggleLeftPanel);
  document.getElementById('left-expand-btn').addEventListener('click', toggleLeftPanel);
  document.getElementById('right-collapse-btn').addEventListener('click', toggleRightPanel);
  document.getElementById('right-expand-btn').addEventListener('click', toggleRightPanel);
}

function toggleLeftPanel() {
  panelState.leftCollapsed = !panelState.leftCollapsed;
  if (panelState.leftCollapsed) {
    refs.$leftPanel.classList.add('collapsed');
    refs.$leftPanel.style.width = '0';
  } else {
    refs.$leftPanel.classList.remove('collapsed');
    refs.$leftPanel.style.width = panelState.leftPanelWidth + 'px';
  }
  bus.emit('panels:resized');
}

function toggleRightPanel() {
  panelState.rightCollapsed = !panelState.rightCollapsed;
  if (panelState.rightCollapsed) {
    refs.$rightPanel.classList.add('collapsed');
    refs.$rightPanel.style.width = '0';
  } else {
    refs.$rightPanel.classList.remove('collapsed');
    refs.$rightPanel.style.width = panelState.rightPanelWidth + 'px';
  }
  bus.emit('panels:resized');
}

/* ============================================================
   分隔条拖拽调宽
   ============================================================ */
function initDivider(dividerEl, panel, side) {
  let dragging = false;
  let startX = 0;
  let startW = 0;
  const MIN = side === 'left' ? 150 : 200;
  const MAX = 600;

  dividerEl.addEventListener('mousedown', (e) => {
    if (side === 'left' && panelState.leftCollapsed) return;
    if (side === 'right' && panelState.rightCollapsed) return;
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    dividerEl.classList.add('active');
    document.body.style.cursor = 'col-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dx = side === 'left' ? (e.clientX - startX) : (startX - e.clientX);
    let newW = Math.round(startW + dx);
    newW = Math.max(MIN, Math.min(MAX, newW));
    panel.style.width = newW + 'px';

    if (side === 'left') panelState.leftPanelWidth = newW;
    else panelState.rightPanelWidth = newW;

    bus.emit('panels:resized');
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    dividerEl.classList.remove('active');
    document.body.style.cursor = '';
  });
}
