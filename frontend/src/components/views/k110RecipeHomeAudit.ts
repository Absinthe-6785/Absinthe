/** K-110 — Recipe Home section audit. */

export const K110_HOME_HOOKS = [
  'data-k110-recipe-home',
  'data-k110-home-favorites',
  'data-k110-favorite-row',
] as const;

export const K110_HOME_KEYS = ['k110HomeFavorites'] as const;

export function auditRecipeHome(): readonly string[] {
  return [...K110_HOME_HOOKS, ...K110_HOME_KEYS];
}
