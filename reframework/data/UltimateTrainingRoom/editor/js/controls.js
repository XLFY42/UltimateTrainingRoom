/**
 * controls.js — 共享表单控件：text input、custom select、checkbox、property row、属性同步
 */
import { treeData } from './tree-model.js';

let bus = null;
let _getNodeDomMap = () => ({});
let _getRightPanelBody = () => null;
let _getSelectedNodeId = () => null;
let _getIsRestoringHistory = () => false;

export function initControls(eventBus, accessors) {
  bus = eventBus;
  if (accessors.getNodeDomMap) _getNodeDomMap = accessors.getNodeDomMap;
  if (accessors.getRightPanelBody) _getRightPanelBody = accessors.getRightPanelBody;
  if (accessors.getSelectedNodeId) _getSelectedNodeId = accessors.getSelectedNodeId;
  if (accessors.getIsRestoringHistory) _getIsRestoringHistory = accessors.getIsRestoringHistory;
}

/* ============================================================
   History helpers（连续编辑场景：首次修改 → blur）
   ============================================================ */
export function beginPropertyHistory(control) {
  if (_getIsRestoringHistory()) return;
  if (control.dataset.historyPrimed === '1') return;
  bus.emit('history:push');
  control.dataset.historyPrimed = '1';
}

export function endPropertyHistory(control) {
  delete control.dataset.historyPrimed;
}

/* ============================================================
   Custom select 工具函数
   ============================================================ */
export function closeAllCustomSelects(exceptControl) {
  document.querySelectorAll('.bt-node-prop-select.open').forEach(el => {
    if (el !== exceptControl) el.classList.remove('open');
  });
}

function getSelectOptionValue(option) {
  return option && typeof option === 'object' ? option.value : option;
}

function getSelectOptionLabel(option) {
  return option && typeof option === 'object' ? option.label : option;
}

function getSelectLabelByValue(options, value) {
  for (const option of (options || [])) {
    if (getSelectOptionValue(option) == value) {
      return getSelectOptionLabel(option) ?? '';
    }
  }
  return value ?? '';
}

export function updateCustomSelectControl(control, value) {
  if (!control) return;
  const button = control.querySelector('.bt-node-prop-select-btn');
  let selectedLabel = value ?? '';
  control.querySelectorAll('.bt-node-prop-select-option').forEach(option => {
    const active = option.dataset.optionValue == value;
    option.classList.toggle('active', active);
    if (active) selectedLabel = option.textContent ?? '';
  });
  if (button) button.textContent = selectedLabel;
  control.dataset.selectedValue = value ?? '';
}

/* ============================================================
   Inspector 文本 / 选择控件（右面板树信息等用）
   ============================================================ */
export function createInspectorTextControl(value, options = {}) {
  const control = options.multiline ? document.createElement('textarea') : document.createElement('input');
  control.className = 'bt-node-prop-input' + (options.multiline ? ' inspector-textarea' : '');
  if (!options.multiline) control.type = 'text';
  control.value = value ?? '';
  control.addEventListener('input', () => {
    beginPropertyHistory(control);
    options.onInput?.(control.value);
  });
  control.addEventListener('blur', () => endPropertyHistory(control));
  return control;
}

export function createInspectorSelectControl(value, selectOptions, onChange) {
  const control = document.createElement('div');
  control.className = 'bt-node-prop-select';
  control.dataset.controlType = 'custom-select';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'bt-node-prop-select-btn';
  button.textContent = getSelectLabelByValue(selectOptions, value);

  const menu = document.createElement('div');
  menu.className = 'bt-node-prop-select-menu';

  for (const opt of selectOptions) {
    const optionValue = getSelectOptionValue(opt);
    const optionLabel = getSelectOptionLabel(opt);
    const optionBtn = document.createElement('button');
    optionBtn.type = 'button';
    optionBtn.className = 'bt-node-prop-select-option';
    optionBtn.textContent = optionLabel ?? '';
    optionBtn.dataset.optionValue = optionValue ?? '';
    if (value == optionValue) optionBtn.classList.add('active');
    optionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ((control.dataset.selectedValue ?? '') != (optionValue ?? '')) bus.emit('history:push');
      updateCustomSelectControl(control, optionValue);
      onChange(optionValue);
      control.classList.remove('open');
    });
    menu.appendChild(optionBtn);
  }

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = !control.classList.contains('open');
    closeAllCustomSelects(control);
    control.classList.toggle('open', willOpen);
  });

  control.appendChild(button);
  control.appendChild(menu);
  updateCustomSelectControl(control, value);
  return control;
}

/* ============================================================
   多选属性控件行（右面板多选）
   ============================================================ */
export function createMultiPropertyControlRow(propDef, values, options = {}) {
  const allSame = values.every(value => value === values[0]);
  const multipleValuesLabel = options.multipleValuesLabel || '';

  const row = document.createElement('div');
  row.className = 'inspector-prop-row';

  const label = document.createElement('span');
  label.className = 'inspector-prop-label';
  label.textContent = `${propDef.label}:`;
  row.appendChild(label);

  let control;
  if (propDef.type === 'select') {
    control = createInspectorSelectControl(
      allSame ? values[0] : multipleValuesLabel,
      propDef.options || [],
      (value) => options.onApply?.(value),
    );
    if (!allSame) updateCustomSelectControl(control, multipleValuesLabel);
  } else if (propDef.type === 'checkbox') {
    control = document.createElement('input');
    control.type = 'checkbox';
    control.className = 'bt-node-prop-checkbox';
    control.checked = allSame ? !!values[0] : false;
    control.indeterminate = !allSame;
    control.addEventListener('change', () => {
      control.indeterminate = false;
      options.onApply?.(control.checked);
    });
  } else {
    control = document.createElement('input');
    control.className = 'bt-node-prop-input';
    control.type = propDef.type === 'number' ? 'number' : 'text';
    control.value = allSame ? (values[0] ?? '') : '';
    if (!allSame) control.placeholder = multipleValuesLabel;
    control.addEventListener('input', () => beginPropertyHistory(control));
    control.addEventListener('blur', () => {
      endPropertyHistory(control);
      if (control.value === '' && !allSame && propDef.type === 'number') return;
      const nextValue = propDef.type === 'number' ? Number(control.value) : control.value;
      if (control.value !== '') options.onApply?.(nextValue);
    });
  }

  row.appendChild(control);
  return row;
}

/* ============================================================
   属性控件行（节点内嵌 + 右面板共用）
   ============================================================ */
export function createPropertyControlRow(nodeData, propDef, scope) {
  const row = document.createElement('div');
  row.className = scope === 'panel' ? 'inspector-prop-row' : 'bt-node-prop-row';

  const label = document.createElement('span');
  label.className = scope === 'panel' ? 'inspector-prop-label' : 'bt-node-prop-label';
  label.textContent = propDef.label + ':';
  row.appendChild(label);

  let control;
  if (propDef.type === 'select') {
    control = document.createElement('div');
    control.className = 'bt-node-prop-select';
    control.dataset.controlType = 'custom-select';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bt-node-prop-select-btn';
    button.textContent = getSelectLabelByValue(propDef.options || [], nodeData.properties[propDef.key]);
    control.appendChild(button);

    const menu = document.createElement('div');
    menu.className = 'bt-node-prop-select-menu';

    for (const opt of (propDef.options || [])) {
      const optionValue = getSelectOptionValue(opt);
      const optionLabel = getSelectOptionLabel(opt);
      const optionBtn = document.createElement('button');
      optionBtn.type = 'button';
      optionBtn.className = 'bt-node-prop-select-option';
      optionBtn.textContent = optionLabel ?? '';
      optionBtn.dataset.optionValue = optionValue ?? '';
      if (nodeData.properties[propDef.key] == optionValue) optionBtn.classList.add('active');
      optionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if ((control.dataset.selectedValue ?? '') != (optionValue ?? '')) bus.emit('history:push');
        nodeData.properties[propDef.key] = optionValue;
        updateCustomSelectControl(control, optionValue);
        bus.emit('node:property-changed', { nodeId: nodeData.id, key: propDef.key, scope });
        control.classList.remove('open');
      });
      menu.appendChild(optionBtn);
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !control.classList.contains('open');
      closeAllCustomSelects(control);
      control.classList.toggle('open', willOpen);
    });

    control.appendChild(menu);
    updateCustomSelectControl(control, nodeData.properties[propDef.key]);
  } else if (propDef.type === 'checkbox') {
    control = document.createElement('input');
    control.type = 'checkbox';
    control.className = 'bt-node-prop-checkbox';
    control.checked = !!nodeData.properties[propDef.key];
    control.addEventListener('change', () => {
      bus.emit('history:push');
      nodeData.properties[propDef.key] = control.checked;
      bus.emit('node:property-changed', { nodeId: nodeData.id, key: propDef.key, scope });
    });
  } else {
    control = document.createElement('input');
    control.className = 'bt-node-prop-input';
    control.type = propDef.type === 'number' ? 'number' : 'text';
    control.value = nodeData.properties[propDef.key] ?? '';
    if (propDef.placeholder && propDef.type !== 'number') {
      control.placeholder = propDef.placeholder;
    }
    control.addEventListener('input', () => {
      beginPropertyHistory(control);
      const v = propDef.type === 'number' ? Number(control.value) : control.value;
      nodeData.properties[propDef.key] = v;
      bus.emit('node:property-changed', { nodeId: nodeData.id, key: propDef.key, scope });
    });
    control.addEventListener('blur', () => endPropertyHistory(control));
  }

  control.dataset.propKey = propDef.key;
  control.dataset.scope = scope;
  row.appendChild(control);
  return row;
}

/* ============================================================
   属性控件同步（节点 DOM ↔ 右面板双向同步）
   ============================================================ */
export function syncPropertyControls(nodeId, propKey, sourceScope) {
  const node = treeData.nodes[nodeId];
  if (!node) return;
  const value = node.properties[propKey];

  const nodeDomMap = _getNodeDomMap();
  const nodeEl = nodeDomMap[nodeId];
  if (nodeEl && sourceScope !== 'node') {
    const control = nodeEl.querySelector(`[data-prop-key="${propKey}"]`);
    if (control) {
      if (control.dataset.controlType === 'custom-select') updateCustomSelectControl(control, value);
      else if (control.type === 'checkbox') control.checked = !!value;
      else control.value = value ?? '';
    }
  }

  const selectedId = _getSelectedNodeId();
  if (selectedId === nodeId && sourceScope !== 'panel') {
    const $rightPanelBody = _getRightPanelBody();
    if ($rightPanelBody) {
      const panelControl = $rightPanelBody.querySelector(`[data-prop-key="${propKey}"]`);
      if (panelControl) {
        if (panelControl.dataset.controlType === 'custom-select') updateCustomSelectControl(panelControl, value);
        else if (panelControl.type === 'checkbox') panelControl.checked = !!value;
        else panelControl.value = value ?? '';
      }
    }
  }
}
