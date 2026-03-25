/**
 * palette.js — 左面板：节点类型列表 + 搜索 + 拖拽发起
 */
import { NODE_TYPES, CATEGORIES, getNodeDisplayName } from './node-registry.js';

let bus = null;
let $nodeSearch = null;
let $nodePaletteList = null;

export let paletteDrag = null;
let suppressNextPaletteClick = false;

export function initPalette(eventBus, refs) {
  bus = eventBus;
  $nodeSearch = refs.$nodeSearch;
  $nodePaletteList = refs.$nodePaletteList;

  $nodeSearch.addEventListener('input', renderNodePalette);
}

export function setSuppressNextPaletteClick(val) {
  suppressNextPaletteClick = val;
}

/* ============================================================
   渲染节点面板
   ============================================================ */
export function renderNodePalette() {
  const query = $nodeSearch.value.trim().toLowerCase();
  $nodePaletteList.innerHTML = '';

  for (const [categoryKey, categoryDef] of Object.entries(CATEGORIES)) {
    const types = Object.values(NODE_TYPES)
      .filter(nodeType => nodeType.category === categoryKey)
      .filter(nodeType => {
        if (!query) return true;
        return nodeType.displayName.toLowerCase().includes(query) ||
               nodeType.type.toLowerCase().includes(query) ||
               nodeType.description.toLowerCase().includes(query);
      })
      .sort((a, b) => a.type.localeCompare(b.type));

    if (!types.length) continue;

    const group = document.createElement('div');
    group.className = 'palette-group';
    const title = document.createElement('div');
    title.className = 'palette-group-title';
    title.textContent = categoryDef.label;
    group.appendChild(title);

    for (const nodeType of types) {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.title = nodeType.description || nodeType.type;

      const strip = document.createElement('div');
      strip.className = 'palette-item-strip';
      strip.style.background = categoryDef.color;
      item.appendChild(strip);

      const name = document.createElement('div');
      name.className = 'palette-item-name';
      name.textContent = nodeType.displayName;
      item.appendChild(name);

      item.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        paletteDrag = {
          type: nodeType.type,
          startX: e.clientX,
          startY: e.clientY,
          active: false,
          previewEl: null,
        };
      });

      item.addEventListener('click', () => {
        if (suppressNextPaletteClick) {
          suppressNextPaletteClick = false;
          return;
        }
        bus.emit('action:add-node-at-center', { type: nodeType.type });
      });

      group.appendChild(item);
    }

    $nodePaletteList.appendChild(group);
  }
}

/* ============================================================
   面板拖拽（预览 + 完成/取消）
   ============================================================ */
export function createPaletteDragPreview(type) {
  const reg = NODE_TYPES[type];
  const preview = document.createElement('div');
  preview.className = 'palette-drag-preview';
  const title = document.createElement('div');
  title.className = 'palette-drag-preview-title';
  title.style.background = CATEGORIES[reg.category]?.color || '#888';
  title.textContent = getNodeDisplayName(type);
  preview.appendChild(title);
  document.body.appendChild(preview);
  return preview;
}

export function updatePaletteDragPreview(clientX, clientY) {
  if (!paletteDrag?.previewEl) return;
  paletteDrag.previewEl.style.left = `${clientX - 80}px`;
  paletteDrag.previewEl.style.top = `${clientY - 34}px`;
}

export function cancelPaletteDrag() {
  if (!paletteDrag) return;
  paletteDrag.previewEl?.remove();
  paletteDrag = null;
}

export function finishPaletteDrag(clientX, clientY) {
  if (!paletteDrag) return;
  const drag = paletteDrag;
  const overCanvas = document.elementFromPoint(clientX, clientY)?.closest('#canvas-area');
  if (drag.active && overCanvas) {
    bus.emit('action:add-node-at-point', { type: drag.type, clientX, clientY });
  }
  cancelPaletteDrag();
}
