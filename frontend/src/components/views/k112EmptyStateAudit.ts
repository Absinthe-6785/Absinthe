/** K-112 — ProductEmptyState consistency audit. */
export const K112_EMPTY_STATE_SURFACES = [
  'notes',
  'health',
  'planner',
  'archive',
  'recipe',
  'search',
] as const;

export const K112_PRODUCT_EMPTY_HOOKS = [
  'data-notes-empty',
  'data-k107-empty',
  'data-k108-empty',
  'data-k109-empty-state',
  'data-k110-empty',
  'data-k111-empty',
] as const;

/** Surfaces still using muted text hints instead of ProductEmptyState (acceptable for collapsible sections). */
export const K112_EMPTY_STATE_GAPS = [
  'archive-collapsible-hint-only',
] as const;

export function auditEmptyStates(): readonly string[] {
  return [...K112_EMPTY_STATE_SURFACES, ...K112_PRODUCT_EMPTY_HOOKS, 'ProductEmptyState'];
}
