/**
 * inspector.js — 右面板：选择状态管理、占位/单选/多选/树信息渲染
 */
import { treeData, isNodeEnabled, findParentNodeId, moveChildNode } from './tree-model.js';
import { NODE_TYPES, CATEGORIES, getNodeDisplayName } from './node-registry.js';
import { I18N } from './i18n.js';
import {
  createPropertyControlRow,
  createMultiPropertyControlRow,
  createInspectorTextControl,
  createInspectorSelectControl,
} from './controls.js';
import {
  nodeDomMap,
  setNodeSelected,
  setNodeMultiSelected,
  updateNodeEnabledState,
} from './node-renderer.js';

let bus = null;
let $rightPanelBody = null;

/* ============================================================
   选择状态
   ============================================================ */
export let selectedNodeId = null;
export let selectedNodeIds = [];

export function getSelectedNodeId() { return selectedNodeId; }
export function getSelectedNodeIds() { return [...selectedNodeIds]; }

export function initInspector(eventBus, refs) {
  bus = eventBus;
  $rightPanelBody = refs.$rightPanelBody;
}

/* ============================================================
   选择操作
   ============================================================ */
export function setSelectedNodes(ids) {
  const uniqueIds = [...new Set(ids.filter(id => treeData.nodes[id]))];
  const prevIds = selectedNodeIds || [];
  prevIds.forEach(id => {
    setNodeSelected(id, false);
    setNodeMultiSelected(id, false);
  });
  selectedNodeIds = uniqueIds;
  selectedNodeId = uniqueIds.length === 1 ? uniqueIds[0] : (uniqueIds[0] || null);

  uniqueIds.forEach(id => {
    if (uniqueIds.length === 1) setNodeSelected(id, true);
    else setNodeMultiSelected(id, true);
  });

  if (uniqueIds.length === 0) renderRightPanelPlaceholder();
  else if (uniqueIds.length === 1) renderRightPanelSelection(uniqueIds[0]);
  else renderMultiSelectionPanel(uniqueIds);

  bus.emit('selection:changed', { ids: uniqueIds });
}

export function selectNode(id) {
  if (selectedNodeIds?.length === 1 && selectedNodeId === id) {
    renderRightPanelSelection(id);
    return;
  }
  setSelectedNodes(id ? [id] : []);
}

export function toggleNodeInSelection(id) {
  const current = new Set(selectedNodeIds || []);
  if (current.has(id)) current.delete(id);
  else current.add(id);
  setSelectedNodes([...current]);
}

/* ============================================================
   树信息区域
   ============================================================ */
function createTreeEditorSection() {
  const treeHost = document.createElement('div');
  treeHost.className = 'inspector-tree';

  // Name
  const nameRow = document.createElement('div');
  nameRow.className = 'inspector-field';
  const nameLabel = document.createElement('div');
  nameLabel.className = 'inspector-prop-label';
  nameLabel.textContent = I18N.treeName;
  const nameInput = createInspectorTextControl(treeData.name, {
    onInput: (value) => bus.emit('action:update-tree-field', { key: 'name', value }),
  });
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  treeHost.appendChild(nameRow);

  // Description
  const descRow = document.createElement('div');
  descRow.className = 'inspector-field';
  const descLabel = document.createElement('div');
  descLabel.className = 'inspector-prop-label';
  descLabel.textContent = I18N.treeDesc;
  const descInput = createInspectorTextControl(treeData.description, {
    multiline: true,
    onInput: (value) => bus.emit('action:update-tree-field', { key: 'description', value }),
  });
  descRow.appendChild(descLabel);
  descRow.appendChild(descInput);
  treeHost.appendChild(descRow);

  // OnComplete
  const completeRow = document.createElement('div');
  completeRow.className = 'inspector-field';
  const completeLabel = document.createElement('div');
  completeLabel.className = 'inspector-prop-label';
  completeLabel.textContent = I18N.onComplete;
  const completeSelect = createInspectorSelectControl(
    treeData.onComplete,
    [
      { value: 'loop', label: I18N.onCompleteLoop },
      { value: 'stop', label: I18N.onCompleteStop },
    ],
    (value) => bus.emit('action:update-tree-field', { key: 'onComplete', value }),
  );
  completeRow.appendChild(completeLabel);
  completeRow.appendChild(completeSelect);
  treeHost.appendChild(completeRow);

  const divider = document.createElement('div');
  divider.className = 'inspector-section-divider';
  treeHost.appendChild(divider);

  return treeHost;
}

/* ============================================================
   占位视图
   ============================================================ */
export function renderRightPanelPlaceholder() {
  $rightPanelBody.innerHTML = '';
  const treeSection = createTreeEditorSection();
  $rightPanelBody.appendChild(treeSection);

  const placeholder = document.createElement('p');
  placeholder.className = 'placeholder-text';
  placeholder.textContent = I18N.clickToEdit;
  $rightPanelBody.appendChild(placeholder);
}

/* ============================================================
   共享节点面板骨架
   ============================================================ */
function createInspectorNodeShell({
  sectionClass,
  titleText,
  metaText,
  categoryLabel,
  categoryColor,
  enabledLabel,
  toggleOn,
  toggleDisabled,
  showChildrenPanel,
  showPropertiesPanel,
  showIdBeforeCategory,
}) {
  const nodeSection = document.createElement('div');
  nodeSection.className = sectionClass;
  nodeSection.insertAdjacentHTML('beforeend', `
    <div class="inspector-top">
      <div class="inspector-meta">
        <span class="inspector-category-bar" style="background:${categoryColor}"></span>
        <div class="inspector-type">${titleText}</div>
        ${showIdBeforeCategory ? `<div class="inspector-id">${metaText}</div><div class="inspector-category">${categoryLabel}</div>` : `<div class="inspector-category">${categoryLabel}</div><div class="inspector-id">${metaText}</div>`}
      </div>
      <div class="inspector-control-stack">
        <div class="inspector-status-line">
          <button type="button" class="inspector-toggle${toggleOn ? ' on' : ''}" ${toggleDisabled ? 'disabled' : ''}><span class="inspector-toggle-label">${enabledLabel}</span></button>
        </div>
        <div class="inspector-node-actions"></div>
      </div>
    </div>
    <div class="inspector-divider"></div>
    ${showChildrenPanel ? `<div class="inspector-section-title">${I18N.childNodes}</div><div class="inspector-children"></div><div class="inspector-divider"></div>` : ''}
    ${showPropertiesPanel ? `<div class="inspector-section-title">${I18N.properties}</div><div class="inspector-props"></div>` : ''}
  `);
  return {
    nodeSection,
    toggleBtn: nodeSection.querySelector('.inspector-toggle'),
    actionsHost: nodeSection.querySelector('.inspector-node-actions'),
    childrenHost: nodeSection.querySelector('.inspector-children'),
    propsHost: nodeSection.querySelector('.inspector-props'),
  };
}

function createInspectorActionColumn({ rootLabel, rootDisabled, onRootClick, onDeleteClick }) {
  const actionCol = document.createElement('div');
  actionCol.className = 'inspector-btn-col';

  const rootBtn = document.createElement('button');
  rootBtn.type = 'button';
  rootBtn.className = 'inspector-btn';
  rootBtn.textContent = rootLabel;
  rootBtn.disabled = !!rootDisabled;
  if (onRootClick) rootBtn.addEventListener('click', onRootClick);
  actionCol.appendChild(rootBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'inspector-btn danger';
  deleteBtn.textContent = I18N.delete_;
  deleteBtn.addEventListener('click', onDeleteClick);
  actionCol.appendChild(deleteBtn);

  return actionCol;
}

/* ============================================================
   单选视图
   ============================================================ */
export function renderRightPanelSelection(id) {
  const node = treeData.nodes[id];
  if (!node) {
    renderRightPanelPlaceholder();
    return;
  }
  const reg = NODE_TYPES[node.type];
  const category = CATEGORIES[node.category];
  const categoryLabel = category?.label || node.category;
  const categoryColor = category?.color || '#888';
  const enabledLabel = isNodeEnabled(node) ? I18N.enabledOn : I18N.enabledOff;
  const rootLocked = treeData.root === id;
  const hasOutput = !!reg?.hasOutput;
  const showChildrenPanel = hasOutput && reg?.maxChildren !== 1;

  $rightPanelBody.innerHTML = '';
  const treeSection = createTreeEditorSection();
  $rightPanelBody.appendChild(treeSection);

  const { nodeSection, toggleBtn, actionsHost, childrenHost, propsHost } = createInspectorNodeShell({
    sectionClass: 'inspector-node-section',
    titleText: getNodeDisplayName(node.type),
    metaText: node.id,
    categoryLabel,
    categoryColor,
    enabledLabel,
    toggleOn: isNodeEnabled(node),
    toggleDisabled: rootLocked,
    showChildrenPanel,
    showPropertiesPanel: true,
    showIdBeforeCategory: false,
  });
  $rightPanelBody.appendChild(nodeSection);

  if (toggleBtn && !rootLocked) {
    toggleBtn.addEventListener('click', () => {
      bus.emit('action:set-node-enabled', { id, enabled: !isNodeEnabled(node) });
    });
  }

  if (actionsHost) {
    actionsHost.appendChild(createInspectorActionColumn({
      rootLabel: rootLocked ? I18N.rootNode : I18N.setAsRoot,
      rootDisabled: rootLocked,
      onRootClick: () => bus.emit('action:set-node-root', { id }),
      onDeleteClick: () => bus.emit('action:delete-node', { id }),
    }));
  }

  if (childrenHost) {
    renderChildrenList(childrenHost, id, node, hasOutput);
  }

  if (propsHost) {
    if (reg?.props?.length) {
      for (const propDef of reg.props) {
        propsHost.appendChild(createPropertyControlRow(node, propDef, 'panel'));
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = I18N.noEditableProps;
      propsHost.appendChild(empty);
    }
  }
}

/* ============================================================
   子节点列表 + 拖拽排序
   ============================================================ */
const CHILD_DRAG_THRESHOLD = 4;
let childReorderDrag = null;

function renderChildrenList(childrenHost, parentId, node, hasOutput) {
  if (hasOutput && node.children.length) {
    const dropLine = document.createElement('div');
    dropLine.className = 'inspector-drop-line';
    childrenHost.appendChild(dropLine);

    node.children.forEach((childId, index) => {
      const child = treeData.nodes[childId];
      if (!child) return;
      const childCat = CATEGORIES[child.category];
      const item = document.createElement('div');
      item.className = 'inspector-child-item';
      item.dataset.childIndex = String(index);

      item.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.inspector-icon-btn')) return;
        e.preventDefault();
        beginChildReorderDrag(parentId, index, item, childrenHost, e.clientY);
      });

      const strip = document.createElement('div');
      strip.className = 'inspector-child-strip';
      strip.style.background = childCat?.color || '#888';
      item.appendChild(strip);

      const main = document.createElement('div');
      main.className = 'inspector-child-main';
      const name = document.createElement('div');
      name.className = 'inspector-child-name';
      name.textContent = getNodeDisplayName(child.type);
      const meta = document.createElement('div');
      meta.className = 'inspector-child-meta';
      meta.textContent = child.id;
      main.appendChild(name);
      main.appendChild(meta);
      item.appendChild(main);

      const actions = document.createElement('div');
      actions.className = 'inspector-child-actions';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'inspector-icon-btn';
      upBtn.textContent = '\u2191';
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => bus.emit('action:move-child', { parentId, fromIndex: index, toIndex: index - 1 }));
      actions.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'inspector-icon-btn';
      downBtn.textContent = '\u2193';
      downBtn.disabled = index === node.children.length - 1;
      downBtn.addEventListener('click', () => bus.emit('action:move-child', { parentId, fromIndex: index, toIndex: index + 1 }));
      actions.appendChild(downBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'inspector-icon-btn';
      removeBtn.textContent = '\u00D7';
      removeBtn.addEventListener('click', () => bus.emit('action:remove-connection', { sourceId: parentId, targetId: childId }));
      actions.appendChild(removeBtn);

      item.appendChild(actions);
      childrenHost.appendChild(item);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'inspector-empty';
    empty.textContent = I18N.noChildren;
    childrenHost.appendChild(empty);
  }
}

/* ============================================================
   子节点拖拽排序
   ============================================================ */
function beginChildReorderDrag(parentId, fromIndex, itemEl, host, clientY) {
  childReorderDrag = {
    parentId, fromIndex, itemEl, host,
    startY: clientY, active: false, placement: null,
  };
}

function getChildDropPlacement(host, clientY) {
  const items = [...host.querySelectorAll('.inspector-child-item')];
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const index = Number(item.dataset.childIndex);
    if (clientY < rect.top + rect.height / 2) return { item, index, before: true };
    if (clientY <= rect.bottom) return { item, index, before: false };
  }
  const lastItem = items[items.length - 1] || null;
  return lastItem ? { item: lastItem, index: Number(lastItem.dataset.childIndex), before: false } : null;
}

function showChildDropIndicator(host, placement) {
  const line = host?.querySelector('.inspector-drop-line');
  if (!host || !line || !placement) return;
  const hostRect = host.getBoundingClientRect();
  const itemRect = placement.item.getBoundingClientRect();
  const gapOffset = 4;
  const top = placement.before
    ? Math.max(0, itemRect.top - hostRect.top - gapOffset)
    : itemRect.bottom - hostRect.top + gapOffset;
  line.style.top = `${Math.round(top)}px`;
  line.style.display = 'block';
}

function clearChildDropIndicators(host) {
  if (!host) return;
  host.querySelectorAll('.inspector-child-item').forEach(el => el.classList.remove('dragging'));
  const line = host.querySelector('.inspector-drop-line');
  if (line) line.style.display = 'none';
}

export function updateChildReorderDrag(clientY) {
  if (!childReorderDrag) return;
  const drag = childReorderDrag;
  if (!drag.active) {
    if (Math.abs(clientY - drag.startY) < CHILD_DRAG_THRESHOLD) return;
    drag.active = true;
    drag.itemEl.classList.add('dragging');
    document.body.classList.add('dragging-children');
  }

  clearChildDropIndicators(drag.host);
  drag.itemEl.classList.add('dragging');
  const placement = getChildDropPlacement(drag.host, clientY);
  if (!placement) {
    drag.placement = null;
    return;
  }

  let toIndex = placement.before ? placement.index : placement.index + 1;
  if (drag.fromIndex < toIndex) toIndex -= 1;
  const maxIndex = drag.host.querySelectorAll('.inspector-child-item').length - 1;
  toIndex = Math.max(0, Math.min(maxIndex, toIndex));

  drag.placement = { ...placement, toIndex };
  if (toIndex !== drag.fromIndex) {
    showChildDropIndicator(drag.host, placement);
  }
}

export function finishChildReorderDrag() {
  if (!childReorderDrag) return;
  const drag = childReorderDrag;
  const placement = drag.placement;
  const shouldReorder = drag.active && placement && placement.toIndex !== drag.fromIndex;
  clearChildDropIndicators(drag.host);
  document.body.classList.remove('dragging-children');
  childReorderDrag = null;
  if (shouldReorder) {
    bus.emit('action:reorder-child', { parentId: drag.parentId, fromIndex: drag.fromIndex, toIndex: placement.toIndex });
  }
}

export function isChildReorderActive() {
  return !!childReorderDrag;
}

/* ============================================================
   多选视图
   ============================================================ */
export function renderMultiSelectionPanel(ids) {
  $rightPanelBody.innerHTML = '';
  const nodes = ids.map(id => treeData.nodes[id]).filter(Boolean);
  if (!nodes.length) {
    renderRightPanelPlaceholder();
    return;
  }

  const sameType = nodes.every(node => node.type === nodes[0].type);
  const treeSection = createTreeEditorSection();
  $rightPanelBody.appendChild(treeSection);

  const enabledValues = nodes.filter(node => treeData.root !== node.id).map(node => isNodeEnabled(node));
  const mixedEnabled = enabledValues.length > 1 && enabledValues.some(v => v !== enabledValues[0]);
  const enabledLabel = enabledValues.length === 0
    ? I18N.rootLocked
    : (mixedEnabled ? I18N.multipleValues : (enabledValues[0] ? I18N.enabledOn : I18N.enabledOff));

  const category = sameType ? CATEGORIES[nodes[0].category] : null;
  const categoryLabel = sameType ? (category?.label || nodes[0].category) : I18N.mixedTypes;
  const categoryColor = category?.color || '#6d7caa';
  const titleText = sameType ? getNodeDisplayName(nodes[0].type) : I18N.multipleNodes;
  const countText = `${nodes.length}${I18N.nodeCountSuffix}`;

  const { nodeSection, toggleBtn, actionsHost } = createInspectorNodeShell({
    sectionClass: 'inspector-node-section inspector-node-section-multi',
    titleText,
    metaText: countText,
    categoryLabel,
    categoryColor,
    enabledLabel,
    toggleOn: !mixedEnabled && enabledValues[0],
    toggleDisabled: enabledValues.length === 0,
    showChildrenPanel: false,
    showPropertiesPanel: false,
    showIdBeforeCategory: true,
  });

  if (toggleBtn && enabledValues.length) {
    toggleBtn.addEventListener('click', () => {
      const nextValue = mixedEnabled ? true : !enabledValues[0];
      bus.emit('action:set-nodes-enabled', { ids, enabled: nextValue });
    });
  }

  if (actionsHost) {
    actionsHost.appendChild(createInspectorActionColumn({
      rootLabel: I18N.setAsRoot,
      rootDisabled: true,
      onDeleteClick: () => bus.emit('action:delete-selected-nodes'),
    }));
  }

  if (sameType) {
    const reg = NODE_TYPES[nodes[0].type];
    const propsLabel = document.createElement('div');
    propsLabel.className = 'inspector-section-title';
    propsLabel.textContent = I18N.properties;
    nodeSection.appendChild(propsLabel);

    const nextPropsHost = document.createElement('div');
    nextPropsHost.className = 'inspector-props';

    (reg?.props || []).forEach(propDef => {
      const values = nodes.map(node => node.properties[propDef.key]);
      nextPropsHost.appendChild(createMultiPropertyControlRow(propDef, values, {
        multipleValuesLabel: I18N.multipleValues,
        onApply: (value) => bus.emit('action:apply-property-to-nodes', { ids, key: propDef.key, value }),
      }));
    });

    if (!(reg?.props || []).length) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = I18N.noEditableProps;
      nextPropsHost.appendChild(empty);
    }
    nodeSection.appendChild(nextPropsHost);
  } else {
    const note = document.createElement('div');
    note.className = 'inspector-empty';
    note.textContent = I18N.noEditableProps;
    nodeSection.appendChild(note);
  }

  $rightPanelBody.appendChild(nodeSection);
}

/* ============================================================
   刷新当前选择视图
   ============================================================ */
export function refreshInspector() {
  if (selectedNodeIds.length === 0) renderRightPanelPlaceholder();
  else if (selectedNodeIds.length === 1) renderRightPanelSelection(selectedNodeIds[0]);
  else renderMultiSelectionPanel(selectedNodeIds);
}
