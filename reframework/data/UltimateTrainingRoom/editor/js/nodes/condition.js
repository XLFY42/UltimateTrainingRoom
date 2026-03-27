import { I18N } from '../i18n.js';

const VALUE_TYPE_OPTIONS = [
  { value: 'number', label: I18N.valueTypeNumber },
  { value: 'boolean', label: I18N.valueTypeBoolean },
  { value: 'string', label: I18N.valueTypeString },
];

export const CONDITION_NODE_DEFS = [
  {
    type: 'CheckValue',
    displayName: I18N.nodeCheckValue,
    category: 'condition',
    hasOutput: false,
    description: I18N.descCheckValue,
    props: [
      {
        key: 'source',
        label: I18N.propSource,
        type: 'select',
        options: [
          { value: 'game_state', label: I18N.sourceGameState },
          { value: 'bb', label: I18N.sourceBb },
        ],
        default: 'game_state',
      },
      { key: 'path', label: I18N.propPath, type: 'text', default: 'p2.vital_new' },
      { key: 'op', label: I18N.propOp, type: 'select', options: ['==', '!=', '<', '<=', '>', '>='], default: '==' },
      { key: 'value_type', label: I18N.propValueType, type: 'select', options: VALUE_TYPE_OPTIONS, default: 'number' },
      { key: 'value', label: I18N.propValue, type: 'text', default: '5000' },
    ],
    summary: (n) => {
      const source = n.properties?.source || 'game_state';
      const path = n.properties?.path || '';
      const op = n.properties?.op || '==';
      const value = n.properties?.value || '';
      return `${source}.${path} ${op} ${value}`;
    },
  },
];
