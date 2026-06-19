/** UI-only recipe activity — not part of API schema (K-110). */

export const RECIPE_VIEW_RECENTS_KEY = 'absinthe-recipe-view-recents';
export const RECIPE_COOK_HISTORY_KEY = 'absinthe-recipe-cook-history';
export const RECIPE_EDIT_RECENTS_KEY = 'absinthe-recipe-edit-recents';

const MAX_ENTRIES = 48;

export interface RecipeActivityEntry {
  recipeId: string;
  at: number;
  title?: string;
}

function readEntries(key: string): RecipeActivityEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecipeActivityEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => typeof e.recipeId === 'string' && typeof e.at === 'number');
  } catch {
    return [];
  }
}

function writeEntries(key: string, entries: RecipeActivityEntry[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* ignore */ }
}

function pushEntry(key: string, recipeId: string, at = Date.now()): void {
  const next = [{ recipeId, at }, ...readEntries(key).filter(e => e.recipeId !== recipeId)];
  writeEntries(key, next);
}

export function readRecipeViewRecents(): RecipeActivityEntry[] {
  return readEntries(RECIPE_VIEW_RECENTS_KEY);
}

export function readRecipeCookHistory(): RecipeActivityEntry[] {
  return readEntries(RECIPE_COOK_HISTORY_KEY);
}

export function readRecipeEditRecents(): RecipeActivityEntry[] {
  return readEntries(RECIPE_EDIT_RECENTS_KEY);
}

export function recordRecipeView(recipeId: string, title?: string): void {
  const next = [{ recipeId, at: Date.now(), title }, ...readEntries(RECIPE_VIEW_RECENTS_KEY).filter(e => e.recipeId !== recipeId)];
  writeEntries(RECIPE_VIEW_RECENTS_KEY, next);
}

export function recordRecipeCook(recipeId: string): void {
  pushEntry(RECIPE_COOK_HISTORY_KEY, recipeId);
}

export function recordRecipeEdit(recipeId: string): void {
  pushEntry(RECIPE_EDIT_RECENTS_KEY, recipeId);
}

export function clearRecipeActivityForTest(): void {
  try {
    localStorage.removeItem(RECIPE_VIEW_RECENTS_KEY);
    localStorage.removeItem(RECIPE_COOK_HISTORY_KEY);
    localStorage.removeItem(RECIPE_EDIT_RECENTS_KEY);
  } catch { /* ignore */ }
}
