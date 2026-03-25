/**
 * node-registry.js — 节点类别 & 类型注册表
 */
import { I18N } from './i18n.js';

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

/* ============================================================
   Composite
   ============================================================ */
registerNodeType('Sequence', {
  displayName: I18N.nodeSequence,
  category: 'composite',
  expandable: false,
  description: I18N.descSequence,
  summary: (n) => `${(n.children||[]).length} ${I18N.nodeChildCountSuffix}`,
});
registerNodeType('Selector', {
  displayName: I18N.nodeSelector,
  category: 'composite',
  expandable: false,
  description: I18N.descSelector,
  summary: (n) => `${(n.children||[]).length} ${I18N.nodeChildCountSuffix}`,
});
registerNodeType('Parallel', {
  displayName: I18N.nodeParallel,
  category: 'composite',
  expandable: false,
  description: I18N.descParallel,
  summary: (n) => `${(n.children||[]).length} ${I18N.nodeChildCountSuffix}`,
});
registerNodeType('RandomSelector', {
  displayName: I18N.nodeRandomSelector,
  category: 'composite',
  expandable: false,
  description: I18N.descRandomSelector,
  summary: (n) => `${(n.children||[]).length} ${I18N.nodeChildCountRandomSuffix}`,
});

/* ============================================================
   Decorator
   ============================================================ */
registerNodeType('Repeat', {
  displayName: I18N.nodeRepeat,
  category: 'decorator',
  maxChildren: 1,
  description: I18N.descRepeat,
  props: [
    { key: 'count', label: I18N.propCount, type: 'text', default: 'forever' },
  ],
  summary: (n) => {
    const c = n.properties?.count;
    return (!c || c === 'forever') ? I18N.summaryForever : `×${c}`;
  },
});
registerNodeType('Invert', {
  displayName: I18N.nodeInvert,
  category: 'decorator',
  maxChildren: 1,
  expandable: false,
  description: I18N.descInvert,
  summary: () => I18N.summaryInvert,
});

/* ============================================================
   Action
   ============================================================ */
registerNodeType('InjectInput', {
  displayName: I18N.nodeInjectInput,
  category: 'action',
  hasOutput: false,
  description: I18N.descInjectInput,
  props: [
    { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
    { key: 'inputs', label: I18N.propInputs, type: 'text', default: 'FORWARD' },
    { key: 'frames', label: I18N.propFrames, type: 'number', default: 60 },
    { key: 'relative', label: I18N.propRelative, type: 'checkbox', default: true },
  ],
  summary: (n) => {
    const p = n.properties || {};
    const inputs = p.inputs || 'FORWARD';
    const short = typeof inputs === 'string' ? inputs : (Array.isArray(inputs) ? inputs.join('+') : '');
    return `${p.target||'P2'}: ${short} ${p.frames||60}f`;
  },
});
registerNodeType('WaitFrames', {
  displayName: I18N.nodeWaitFrames,
  category: 'action',
  hasOutput: false,
  description: I18N.descWaitFrames,
  props: [
    { key: 'frames', label: I18N.propFrames, type: 'number', default: 30 },
  ],
  summary: (n) => `${n.properties?.frames || 30}f`,
});
registerNodeType('WaitUntil', {
  displayName: I18N.nodeWaitUntil,
  category: 'action',
  hasOutput: false,
  description: I18N.descWaitUntil,
  props: [
    { key: 'condition', label: I18N.propCondition, type: 'text', default: '' },
    { key: 'timeout', label: I18N.propTimeout, type: 'number', default: 300 },
  ],
  summary: (n) => n.properties?.condition || I18N.summaryWait,
});
registerNodeType('Noop', {
  displayName: I18N.nodeNoop,
  category: 'action',
  hasOutput: false,
  expandable: false,
  description: I18N.descNoop,
  summary: () => '',
});
registerNodeType('SetHP', {
  displayName: I18N.nodeSetHP,
  category: 'action',
  hasOutput: false,
  description: I18N.descSetHP,
  props: [
    { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
    { key: 'value', label: I18N.propValue, type: 'number', default: 10000 },
    { key: 'lock', label: I18N.propLock, type: 'checkbox', default: false },
  ],
  summary: (n) => `${n.properties?.target||'P2'} ${I18N.summaryHp}=${n.properties?.value||10000}`,
});
registerNodeType('SetDrive', {
  displayName: I18N.nodeSetDrive,
  category: 'action',
  hasOutput: false,
  description: I18N.descSetDrive,
  props: [
    { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
    { key: 'value', label: I18N.propValue, type: 'number', default: 10000 },
    { key: 'lock', label: I18N.propLock, type: 'checkbox', default: false },
  ],
  summary: (n) => `${n.properties?.target||'P2'} Drive=${n.properties?.value||10000}`,
});
registerNodeType('SetPosition', {
  displayName: I18N.nodeSetPosition,
  category: 'action',
  hasOutput: false,
  description: I18N.descSetPosition,
  props: [
    { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
    { key: 'x', label: I18N.propX, type: 'number', default: 0 },
    { key: 'y', label: I18N.propY, type: 'number', default: 0 },
  ],
  summary: (n) => `${n.properties?.target||'P2'} (${n.properties?.x||0}, ${n.properties?.y||0})`,
});
registerNodeType('Log', {
  displayName: I18N.nodeLog,
  category: 'action',
  hasOutput: false,
  description: I18N.descLog,
  props: [
    { key: 'message', label: I18N.propMessage, type: 'text', default: '' },
  ],
  summary: (n) => n.properties?.message || '',
});

/* ============================================================
   Condition
   ============================================================ */
registerNodeType('CheckDistance', {
  displayName: I18N.nodeCheckDistance,
  category: 'condition',
  hasOutput: false,
  description: I18N.descCheckDistance,
  props: [
    { key: 'op', label: I18N.propOp, type: 'select', options: ['<', '<=', '>', '>=', '=='], default: '<' },
    { key: 'value', label: I18N.propValue, type: 'number', default: 1 },
  ],
  summary: (n) => `${I18N.summaryDistance} ${n.properties?.op||'<'} ${n.properties?.value||1}`,
});
registerNodeType('CheckHP', {
  displayName: I18N.nodeCheckHP,
  category: 'condition',
  hasOutput: false,
  description: I18N.descCheckHP,
  props: [
    { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
    { key: 'op', label: I18N.propOp, type: 'select', options: ['<', '<=', '>', '>=', '=='], default: '<' },
    { key: 'value', label: I18N.propValue, type: 'number', default: 5000 },
  ],
  summary: (n) => `${n.properties?.target||'P2'} ${I18N.summaryHp} ${n.properties?.op||'<'} ${n.properties?.value||5000}`,
});
registerNodeType('CheckStance', {
  displayName: I18N.nodeCheckStance,
  category: 'condition',
  hasOutput: false,
  description: I18N.descCheckStance,
  props: [
    {
      key: 'target',
      label: I18N.propTarget,
      type: 'select',
      options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }],
      default: 'P2',
    },
    {
      key: 'stance',
      label: I18N.propStance,
      type: 'select',
      options: [
        { value: 'stand', label: I18N.stanceStand },
        { value: 'crouch', label: I18N.stanceCrouch },
        { value: 'air', label: I18N.stanceAir },
      ],
      default: 'stand',
    },
  ],
  summary: (n) => {
    const stanceValue = n.properties?.stance || 'stand';
    const stanceLabel = stanceValue === 'crouch'
      ? I18N.stanceCrouch
      : (stanceValue === 'air' ? I18N.stanceAir : I18N.stanceStand);
    return `${n.properties?.target||'P2'} ${stanceLabel}`;
  },
});
