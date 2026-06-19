/** K-110 — Ingredient explorer audit. */
export const K110_INGREDIENT_HOOKS = [
  'data-k110-ingredient-explorer',
  'data-k110-ingredient-chip',
  'data-k110-ingredient-recipes',
] as const;

export function auditIngredientExplorer(): readonly string[] {
  return [...K110_INGREDIENT_HOOKS, 'normalizeIngredientLine', 'buildIngredientGroups'];
}
