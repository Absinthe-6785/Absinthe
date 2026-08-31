/** UI-only recipe activity — not part of API schema (K-110). */

export const RECIPE_VIEW_RECENTS_KEY = 'absinthe-recipe-view-recents';
export const RECIPE_COOK_HISTORY_KEY = 'absinthe-recipe-cook-history';
export const RECIPE_EDIT_RECENTS_KEY = 'absinthe-recipe-edit-recents';
export const RECIPE_ACTIVITY_ACCOUNT_SEPARATOR = ':account:';

const MAX_ENTRIES = 48;

export interface RecipeActivityEntry {
  recipeId: string;
  at: number;
  title?: string;
}

function accountScopedKey(baseKey: string, accountId?: string): string | null {
  const normalized = accountId?.trim();
  return normalized
    ? `${baseKey}${RECIPE_ACTIVITY_ACCOUNT_SEPARATOR}${encodeURIComponent(normalized)}`
    : null;
}

function readEntries(key: string | null): RecipeActivityEntry[] {
  if (!key) return [];
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

function writeEntries(key: string | null, entries: RecipeActivityEntry[]): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* ignore */ }
}

function pushEntry(baseKey: string, recipeId: string, accountId?: string, at = Date.now()): void {
  const key = accountScopedKey(baseKey, accountId);
  const next = [{ recipeId, at }, ...readEntries(key).filter(e => e.recipeId !== recipeId)];
  writeEntries(key, next);
}

export function readRecipeViewRecents(accountId?: string): RecipeActivityEntry[] {
  return readEntries(accountScopedKey(RECIPE_VIEW_RECENTS_KEY, accountId));
}

export function readRecipeCookHistory(accountId?: string): RecipeActivityEntry[] {
  return readEntries(accountScopedKey(RECIPE_COOK_HISTORY_KEY, accountId));
}

export function readRecipeEditRecents(accountId?: string): RecipeActivityEntry[] {
  return readEntries(accountScopedKey(RECIPE_EDIT_RECENTS_KEY, accountId));
}

export function recordRecipeView(recipeId: string, title?: string, accountId?: string): void {
  const key = accountScopedKey(RECIPE_VIEW_RECENTS_KEY, accountId);
  const next = [{ recipeId, at: Date.now(), title }, ...readEntries(key).filter(e => e.recipeId !== recipeId)];
  writeEntries(key, next);
}

export function recordRecipeCook(recipeId: string, accountId?: string): void {
  pushEntry(RECIPE_COOK_HISTORY_KEY, recipeId, accountId);
}

export function recordRecipeEdit(recipeId: string, accountId?: string): void {
  pushEntry(RECIPE_EDIT_RECENTS_KEY, recipeId, accountId);
}

export function clearRecipeActivityForTest(): void {
  try {
    const baseKeys = [RECIPE_VIEW_RECENTS_KEY, RECIPE_COOK_HISTORY_KEY, RECIPE_EDIT_RECENTS_KEY];
    for (const key of baseKeys) localStorage.removeItem(key);
    const keysToRemove: string[] = [];
    const length = typeof localStorage.length === 'number' ? localStorage.length : 0;
    for (let index = 0; index < length; index += 1) {
      const key = localStorage.key(index);
      if (key && baseKeys.some(base => key.startsWith(`${base}${RECIPE_ACTIVITY_ACCOUNT_SEPARATOR}`))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch { /* ignore */ }
}
