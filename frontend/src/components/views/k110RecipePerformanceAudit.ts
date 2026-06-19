/** K-110 — Recipe performance audit. */
export const K110_LAZY_SECTIONS = ['ingredients', 'history', 'collections'] as const;

export const K110_PERFORMANCE_HOOKS = [
  'data-k110-lazy-section',
  'data-k110-recipe-virtual-list',
] as const;

export const RECIPE_VIRTUALIZE_THRESHOLD = 40;

export function auditRecipePerformance(): readonly string[] {
  return [...K110_LAZY_SECTIONS, ...K110_PERFORMANCE_HOOKS, 'RecipeProjection', String(RECIPE_VIRTUALIZE_THRESHOLD)];
}
