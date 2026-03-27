import { I18N } from '../i18n.js';

export const DECORATOR_NODE_DEFS = [
  {
    type: 'Repeat',
    displayName: I18N.nodeRepeat,
    category: 'decorator',
    maxChildren: 1,
    description: I18N.descRepeat,
    props: [
      { key: 'count', label: I18N.propCount, type: 'number', default: 2 },
    ],
    summary: (n) => {
      const c = Math.max(1, Number(n.properties?.count) || 2);
      return `×${c}`;
    },
  },
  {
    type: 'Invert',
    displayName: I18N.nodeInvert,
    category: 'decorator',
    maxChildren: 1,
    expandable: false,
    description: I18N.descInvert,
    summary: () => I18N.summaryInvert,
  },
];
