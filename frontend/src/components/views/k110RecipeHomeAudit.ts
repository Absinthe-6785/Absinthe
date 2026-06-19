/** K-110 — Recipe Home section audit. */
export const K110_HOME_BUCKETS = ['today', 'thisWeek', 'earlier'] as const;

export const K110_HOME_HOOKS = [
  'data-k110-recipe-home',
  'data-k110-home-recent',
  'data-k110-home-favorites',
  'data-k110-home-cooked',
  'data-k110-home-suggestions',
  'data-k110-home-bucket',
  'data-k110-home-row',
  'data-k110-favorite-row',
  'data-k110-cooked-row',
  'data-k110-suggestion-row',
] as const;

export const K110_HOME_KEYS = [
  'k110HomeRecentlyViewed',
  'k110HomeFavorites',
  'k110HomeRecentlyCooked',
  'k110HomeSuggestions',
] as const;

export function auditRecipeHome(): readonly string[] {
  return [...K110_HOME_BUCKETS, ...K110_HOME_HOOKS, ...K110_HOME_KEYS];
}
