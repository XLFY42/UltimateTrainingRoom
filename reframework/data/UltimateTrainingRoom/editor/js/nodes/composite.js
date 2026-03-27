import { I18N } from '../i18n.js';

export const COMPOSITE_NODE_DEFS = [
  {
    type: 'Sequence',
    displayName: I18N.nodeSequence,
    category: 'composite',
    expandable: false,
    description: I18N.descSequence,
    summary: (n) => `${(n.children || []).length} ${I18N.nodeChildCountSuffix}`,
  },
  {
    type: 'Selector',
    displayName: I18N.nodeSelector,
    category: 'composite',
    expandable: false,
    description: I18N.descSelector,
    summary: (n) => `${(n.children || []).length} ${I18N.nodeChildCountSuffix}`,
  },
  {
    type: 'Parallel',
    displayName: I18N.nodeParallel,
    category: 'composite',
    expandable: false,
    description: I18N.descParallel,
    summary: (n) => `${(n.children || []).length} ${I18N.nodeChildCountSuffix}`,
  },
  {
    type: 'RandomSelector',
    displayName: I18N.nodeRandomSelector,
    category: 'composite',
    expandable: false,
    description: I18N.descRandomSelector,
    summary: (n) => `${(n.children || []).length} ${I18N.nodeChildCountRandomSuffix}`,
  },
];
