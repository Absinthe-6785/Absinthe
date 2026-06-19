import { RECIPE_SECTION_PREFS_KEY } from './features/recipe';

/** K-110 — Recipe collections audit. */
export const K110_COLLECTION_HOOKS = [
  'data-k110-collection-list',
  'data-k110-collection',
  'data-k110-collection-row',
] as const;

export const K110_COLLECTION_LABEL_KEYS = [
  'k110ColJapanese',
  'k110ColFrench',
  'k110ColDessert',
  'k110ColHighProtein',
  'k110ColMealPrep',
  'k110ColComfort',
] as const;

export function auditRecipeCollection(): readonly string[] {
  return [...K110_COLLECTION_HOOKS, ...K110_COLLECTION_LABEL_KEYS, RECIPE_SECTION_PREFS_KEY];
}
