/** K-112 — Visible surface inventory audit. */
export const K112_SURFACES = [
  'notes',
  'health',
  'planner',
  'archive',
  'recipe',
  'search',
  'settings',
  'cosmos',
] as const;

export type K112Surface = (typeof K112_SURFACES)[number];

export const K112_SURFACE_HOOKS: Record<K112Surface, readonly string[]> = {
  notes: ['data-noteview-new-note-btn', 'data-workspace-zone-primary', 'data-k103-timeline-lens'],
  health: ['data-workspace', 'data-k107-health-projection'],
  planner: ['data-k108-planner-shell', 'data-k108-timetable'],
  archive: ['data-k109-archive-unified', 'data-k109-archive-section'],
  recipe: ['data-k110-recipe-studio', 'data-k110-recipe-home'],
  search: ['data-k111-search-workspace', 'data-k111-search-modal'],
  settings: ['data-settings-section', 'data-settings-general'],
  cosmos: ['data-cosmos-view', 'CosmosEmptyStatePanel'],
};

export const K112_REMOVED_SURFACES = [
  'WorkspaceSearchPalette.tsx',
  'components/common/SettingsView.tsx',
] as const;

export const K112_LOW_VALUE_CONTROLS_REMOVED = [
  'dashboard-wsNewNote',
  'dashboard-wsOpenSearch',
  'sidebar-vault-export-toolbar',
  'sidebar-vault-restore-toolbar',
  'mobile-more-settings',
  'editor-more-settings',
  'mobile-more-vault-export',
] as const;

export function auditSurfaceInventory(): {
  surfaces: readonly string[];
  hooks: readonly string[];
  removed: readonly string[];
} {
  const hooks = K112_SURFACES.flatMap(s => K112_SURFACE_HOOKS[s]);
  return {
    surfaces: K112_SURFACES,
    hooks,
    removed: [...K112_REMOVED_SURFACES, ...K112_LOW_VALUE_CONTROLS_REMOVED],
  };
}

export function auditSurfaceCount(): number {
  return K112_SURFACES.length;
}
