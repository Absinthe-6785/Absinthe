import type { Recipe } from './recipeTypes';

/** Derive a display ingredient name from a free-text line (no schema changes). */
export function normalizeIngredientLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const withoutQty = trimmed
    .replace(/^[\d./]+\s*(g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|cloves?|pcs?)?\s*/i, '')
    .replace(/^[\d./]+\s*/i, '')
    .trim();
  const token = (withoutQty || trimmed).split(/[\s,]+/)[0];
  if (!token || token.length < 2) return null;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function extractIngredientNames(recipe: Recipe): string[] {
  const lines = (recipe.ingredients ?? '').split('\n');
  const names = new Set<string>();
  for (const line of lines) {
    const name = normalizeIngredientLine(line);
    if (name) names.add(name);
  }
  return [...names];
}

export interface IngredientGroupDerived {
  name: string;
  recipeIds: string[];
}

export function buildIngredientGroups(recipes: readonly Recipe[]): IngredientGroupDerived[] {
  const map = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    for (const name of extractIngredientNames(recipe)) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name)!.add(recipe.id);
    }
  }
  return [...map.entries()]
    .map(([name, ids]) => ({ name, recipeIds: [...ids] }))
    .sort((a, b) => b.recipeIds.length - a.recipeIds.length || a.name.localeCompare(b.name));
}
