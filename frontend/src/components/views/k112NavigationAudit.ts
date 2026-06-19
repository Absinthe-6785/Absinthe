/** K-112 — Navigation tab role audit. */
export const K112_MAIN_TABS = [
  { id: 'note', role: 'knowledge', labelKey: 'note', unique: true },
  { id: 'health', role: 'body', labelKey: 'health', unique: true },
  { id: 'planner', role: 'time', labelKey: 'planner', unique: true },
  { id: 'analytics', role: 'history', labelKey: 'archiveHomeTitle', unique: true },
  { id: 'recipe', role: 'cookbook', labelKey: 'k110StudioTitle', unique: true },
  { id: 'settings', role: 'utility', labelKey: 'settings', unique: true },
] as const;

export const K112_SUBVIEW_ROLES = [
  { id: 'cosmos', parent: 'note', role: 'visualization', labelKey: 'nvGraphMode' },
  { id: 'search', parent: 'global', role: 'navigation', labelKey: 'k111SearchTitle' },
] as const;

export const K112_DOMAIN_PHILOSOPHY = {
  notes: 'knowledge',
  health: 'body',
  planner: 'time',
  archive: 'history',
  recipe: 'cookbook',
  search: 'navigation',
  cosmos: 'visualization',
} as const;

export function auditNavigation(): readonly string[] {
  return [
    ...K112_MAIN_TABS.map(t => t.id),
    ...K112_SUBVIEW_ROLES.map(s => s.id),
    ...Object.keys(K112_DOMAIN_PHILOSOPHY),
  ];
}

export function auditTabJustification(): boolean {
  return K112_MAIN_TABS.every(t => t.unique);
}
