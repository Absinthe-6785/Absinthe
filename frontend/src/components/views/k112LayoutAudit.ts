/** K-112 — Desktop layout density audit. */
export const K112_LAYOUT_ZONES = [
  'workspace-zone-header',
  'workspace-zone-primary',
  'workspace-zone-secondary',
] as const;

export const K112_LAYOUT_HOOKS = [
  'data-workspace',
  'data-k110-recipe-studio',
  'data-k109-archive-unified',
  'data-k111-search-workspace',
] as const;

export const K112_DENSITY_IMPROVEMENTS = [
  'k110-compact-recipe-cards',
  'k109-collapsible-archive-sections',
  'k111-search-grouped-results',
] as const;

export function auditLayout(): readonly string[] {
  return [...K112_LAYOUT_ZONES, ...K112_LAYOUT_HOOKS, ...K112_DENSITY_IMPROVEMENTS];
}
