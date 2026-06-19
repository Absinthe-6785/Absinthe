/** K-112 — Terminology normalization audit. */
export const K112_TERMINOLOGY_MAP = {
  'k109SectionHistory': 'Recent activity',
  'k101TimeLens': 'Timeline lens',
  'k111SearchTitle': 'Search',
  'k81WorkspaceSearchHint': 'Search (Ctrl+Shift+F)',
  'nvSearchShortcutHint': 'Ctrl+Shift+F opens search',
  'nvWorkspaceSearchBtn': 'Search',
  'k110HomeRecentlyViewed': 'Recently viewed',
  'k110HomeRecentlyCooked': 'Recently cooked',
  'k109SectionRestoreTools': 'Restore tools',
  'k110SectionCollections': 'Collections',
} as const;

export const K112_DEPRECATED_LABELS = [
  'Workspace search',
  'Search workspace',
  'Time lens',
  'Recent history',
] as const;

export function auditTerminology(): readonly string[] {
  return [...Object.keys(K112_TERMINOLOGY_MAP), ...K112_DEPRECATED_LABELS];
}

export function auditTerminologyNormalizedKeys(): number {
  return Object.keys(K112_TERMINOLOGY_MAP).length;
}
