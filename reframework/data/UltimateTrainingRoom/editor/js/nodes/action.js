import { I18N } from '../i18n.js';

const VALUE_TYPE_OPTIONS = [
  { value: 'number', label: I18N.valueTypeNumber },
  { value: 'boolean', label: I18N.valueTypeBoolean },
  { value: 'string', label: I18N.valueTypeString },
];

export const ACTION_NODE_DEFS = [
  {
    type: 'InjectInput',
    displayName: I18N.nodeInjectInput,
    category: 'action',
    hasOutput: false,
    description: I18N.descInjectInput,
    props: [
      { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
      { key: 'inputs', label: I18N.propInputs, type: 'text', default: '6', placeholder: I18N.injectInputPlaceholder },
      { key: 'frames', label: I18N.propFrames, type: 'number', default: 60 },
      { key: 'relative', label: I18N.propRelative, type: 'checkbox', default: true },
    ],
    summary: (n) => {
      const p = n.properties || {};
      const inputs = p.inputs || '6';
      const short = typeof inputs === 'string' ? inputs : (Array.isArray(inputs) ? inputs.join('+') : '');
      return `${p.target || 'P2'}: ${short} ${p.frames || 60}f`;
    },
  },
  {
    type: 'WaitFrames',
    displayName: I18N.nodeWaitFrames,
    category: 'action',
    hasOutput: false,
    description: I18N.descWaitFrames,
    props: [
      { key: 'frames', label: I18N.propFrames, type: 'number', default: 30 },
    ],
    summary: (n) => `${n.properties?.frames || 30}f`,
  },
  {
    type: 'WaitUntil',
    displayName: I18N.nodeWaitUntil,
    category: 'action',
    hasOutput: false,
    description: I18N.descWaitUntil,
    props: [
      { key: 'condition', label: I18N.propCondition, type: 'text', default: '' },
      { key: 'timeout', label: I18N.propTimeout, type: 'number', default: 300 },
    ],
    summary: (n) => n.properties?.condition || I18N.summaryWait,
  },
  {
    type: 'Noop',
    displayName: I18N.nodeNoop,
    category: 'action',
    hasOutput: false,
    expandable: false,
    description: I18N.descNoop,
    summary: () => '',
  },
  {
    type: 'SetValue',
    displayName: I18N.nodeSetValue,
    category: 'action',
    hasOutput: false,
    description: I18N.descSetValue,
    props: [
      { key: 'path', label: I18N.propPath, type: 'text', default: 'flag.ready' },
      { key: 'value_type', label: I18N.propValueType, type: 'select', options: VALUE_TYPE_OPTIONS, default: 'number' },
      { key: 'value', label: I18N.propValue, type: 'text', default: '1' },
    ],
    summary: (n) => {
      const path = n.properties?.path || '';
      const value = n.properties?.value || '';
      return `bb.${path} = ${value}`;
    },
  },
  {
    type: 'SetHP',
    displayName: I18N.nodeSetHP,
    category: 'action',
    hasOutput: false,
    description: I18N.descSetHP,
    props: [
      { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
      { key: 'value', label: I18N.propValue, type: 'number', default: 10000 },
      { key: 'lock', label: I18N.propLock, type: 'checkbox', default: false },
    ],
    summary: (n) => `${n.properties?.target || 'P2'} ${I18N.summaryHp}=${n.properties?.value || 10000}`,
  },
  {
    type: 'SetDrive',
    displayName: I18N.nodeSetDrive,
    category: 'action',
    hasOutput: false,
    description: I18N.descSetDrive,
    props: [
      { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
      { key: 'value', label: I18N.propValue, type: 'number', default: 10000 },
      { key: 'lock', label: I18N.propLock, type: 'checkbox', default: false },
    ],
    summary: (n) => `${n.properties?.target || 'P2'} Drive=${n.properties?.value || 10000}`,
  },
  {
    type: 'SetPosition',
    displayName: I18N.nodeSetPosition,
    category: 'action',
    hasOutput: false,
    description: I18N.descSetPosition,
    props: [
      { key: 'target', label: I18N.propTarget, type: 'select', options: [{ value: 'P1', label: I18N.player1 }, { value: 'P2', label: I18N.player2 }], default: 'P2' },
      { key: 'x', label: I18N.propX, type: 'number', default: 0 },
      { key: 'y', label: I18N.propY, type: 'number', default: 0 },
    ],
    summary: (n) => `${n.properties?.target || 'P2'} (${n.properties?.x || 0}, ${n.properties?.y || 0})`,
  },
  {
    type: 'Log',
    displayName: I18N.nodeLog,
    category: 'action',
    hasOutput: false,
    description: I18N.descLog,
    props: [
      { key: 'mode', label: I18N.propMode, type: 'select', options: [{ value: 'string', label: I18N.logModeString }, { value: 'ref', label: I18N.logModeRef }], default: 'string' },
      { key: 'message', label: I18N.propMessage, type: 'text', default: '' },
      { key: 'source', label: I18N.propSource, type: 'select', options: [{ value: 'game_state', label: I18N.sourceGameState }, { value: 'bb', label: I18N.sourceBb }], default: 'game_state' },
      { key: 'path', label: I18N.propPath, type: 'text', default: '' },
    ],
    summary: (n) => {
      const p = n.properties || {};
      if ((p.mode || 'string') === 'ref') {
        const source = p.source || 'game_state';
        const path = p.path || '';
        if (!path) return 'ref';
        return `${source}.${path}`;
      }
      return p.message || '';
    },
  },
];
