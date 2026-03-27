/**
 * serialization.js — 编辑器树数据 <-> 运行时 JSON 数据转换
 */
import { NODE_TYPES } from './node-registry.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toRuntimeOnComplete(value) {
  return value === 'stop' ? 'stop' : 'loop';
}

function toEditorOnComplete(value) {
  return value === 'stop' ? 'stop' : 'loop';
}

function normalizeInputsToArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function normalizeInputsToText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return '';
}

export function normalizeNodePropertiesForExport(type, properties) {
  const next = clone(properties || {});
  if (type === 'InjectInput') {
    next.inputs = normalizeInputsToArray(next.inputs);
  }
  return next;
}

export function normalizeNodePropertiesFromImport(type, properties) {
  const next = clone(properties || {});
  if (type === 'InjectInput') {
    next.inputs = normalizeInputsToText(next.inputs);
  }
  return next;
}

export function serializeTreeForExport(treeData) {
  const nodes = {};

  for (const [id, node] of Object.entries(treeData.nodes || {})) {
    const reg = NODE_TYPES[node.type];
    const children = Array.isArray(node.children) ? [...node.children] : [];
    const entry = {
      id,
      name: node.type,
      category: node.category || reg?.category || 'action',
      enabled: node.enabled !== false,
      properties: normalizeNodePropertiesForExport(node.type, node.properties),
      display: {
        x: Math.round(node.display?.x || 0),
        y: Math.round(node.display?.y || 0),
      },
    };

    if (children.length > 0) {
      entry.children = children;
    }

    if ((reg?.maxChildren === 1 || node.category === 'decorator') && children.length === 1) {
      entry.child = children[0];
    }

    nodes[id] = entry;
  }

  return {
    name: treeData.name || 'unnamed',
    description: treeData.description || '',
    properties: {
      onComplete: toRuntimeOnComplete(treeData.onComplete),
    },
    root: treeData.root || null,
    nodes,
  };
}

export function deserializeTreeFromImport(data) {
  const source = data?.trees?.[0] ? data.trees[0] : data;
  if (!source || typeof source !== 'object') return null;

  const sourceNodes = source.nodes || {};
  const entries = Object.entries(sourceNodes);
  const nodes = {};
  let index = 0;

  for (const [id, rawNode] of entries) {
    const type = rawNode?.name || rawNode?.type;
    if (!type) continue;
    const reg = NODE_TYPES[type];

    const children = Array.isArray(rawNode.children)
      ? [...rawNode.children]
      : (rawNode.child ? [rawNode.child] : []);

    const fallbackX = 200 + (index % 5) * 180;
    const fallbackY = 80 + Math.floor(index / 5) * 100;

    nodes[id] = {
      id,
      type,
      category: rawNode.category || reg?.category || 'action',
      enabled: rawNode.enabled !== false,
      properties: normalizeNodePropertiesFromImport(type, rawNode.properties),
      children,
      display: {
        x: Number.isFinite(rawNode.display?.x) ? rawNode.display.x : fallbackX,
        y: Number.isFinite(rawNode.display?.y) ? rawNode.display.y : fallbackY,
        collapsed: rawNode.display?.collapsed !== false,
      },
    };

    index += 1;
  }

  let nextNodeId = 1;
  for (const id of Object.keys(nodes)) {
    const m = String(id).match(/(\d+)$/);
    if (m) nextNodeId = Math.max(nextNodeId, Number(m[1]) + 1);
  }

  return {
    treeData: {
      name: source.name || source.title || 'unnamed',
      description: source.description || '',
      root: source.root || null,
      nodes,
      onComplete: toEditorOnComplete(source.properties?.onComplete),
    },
    nextNodeId,
  };
}
