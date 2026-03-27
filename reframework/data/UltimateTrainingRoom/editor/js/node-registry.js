/**
 * node-registry.js — 节点类别 & 类型注册表
 */
import { I18N } from './i18n.js';
import { COMPOSITE_NODE_DEFS } from './nodes/composite.js';
import { DECORATOR_NODE_DEFS } from './nodes/decorator.js';
import { ACTION_NODE_DEFS } from './nodes/action.js';
import { CONDITION_NODE_DEFS } from './nodes/condition.js';

export const CATEGORIES = {
  composite:  { color: '#3a7ebf', label: I18N.catComposite },
  decorator:  { color: '#4a9a6a', label: I18N.catDecorator },
  action:     { color: '#c07838', label: I18N.catAction },
  condition:  { color: '#b89a30', label: I18N.catCondition },
};

export const NODE_TYPES = {};

export function registerNodeType(type, def) {
  NODE_TYPES[type] = {
    type,
    displayName: def.displayName || type,
    category: def.category,
    expandable: def.expandable !== false,
    hasOutput: def.hasOutput !== false,
    maxChildren: def.maxChildren ?? null,
    props: def.props || [],
    summary: def.summary || (() => ''),
    description: def.description || '',
  };
}

export function getNodeDisplayName(type) {
  return NODE_TYPES[type]?.displayName || type;
}

const ALL_NODE_DEFS = [
  ...COMPOSITE_NODE_DEFS,
  ...DECORATOR_NODE_DEFS,
  ...ACTION_NODE_DEFS,
  ...CONDITION_NODE_DEFS,
];

for (const def of ALL_NODE_DEFS) {
  registerNodeType(def.type, def);
}
