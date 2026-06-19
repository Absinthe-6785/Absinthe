/** K-110 — Recipe layout audit. */
export const K110_LAYOUT_ZONES = [
  'workspace-zone-header',
  'workspace-zone-secondary',
  'workspace-zone-primary',
] as const;

export const K110_LAYOUT_HOOKS = [
  'data-workspace',
  'data-k110-recipe-header',
  'data-k110-recipe-sidebar',
  'data-k110-recipe-primary',
  'data-k110-recipe-card',
] as const;

export function auditRecipeLayout(): readonly string[] {
  return [...K110_LAYOUT_ZONES, ...K110_LAYOUT_HOOKS, 'split'];
}
