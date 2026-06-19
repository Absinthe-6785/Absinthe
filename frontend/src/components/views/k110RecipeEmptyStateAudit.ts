/** K-110 — Recipe empty states audit. */
export const K110_EMPTY_STATE_HOOKS = [
  'data-k110-empty-state',
  'data-k110-empty-recipes',
  'data-k110-empty-favorites',
  'data-k110-empty-history',
  'data-k110-empty-ingredients',
  'data-k110-empty-collections',
] as const;

export const K110_EMPTY_MESSAGES = [
  'k110EmptyNoRecipes',
  'k110EmptyNoFavorites',
  'k110EmptyNoHistory',
  'k110EmptyNoIngredients',
  'k110EmptyNoCollections',
] as const;

export function auditRecipeEmptyStates(): readonly string[] {
  return [...K110_EMPTY_STATE_HOOKS, ...K110_EMPTY_MESSAGES, 'ProductEmptyState'];
}
