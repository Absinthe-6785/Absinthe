export const RECIPE_SECTION_PREFS_KEY = 'absinthe-recipe-sections';

export interface RecipeSectionPrefs {
  ingredientsCollapsed: boolean;
  historyCollapsed: boolean;
  collectionsCollapsed: boolean;
}

export const DEFAULT_RECIPE_SECTION_PREFS: RecipeSectionPrefs = {
  ingredientsCollapsed: true,
  historyCollapsed: true,
  collectionsCollapsed: false,
};

export type RecipeSectionPrefKey = keyof RecipeSectionPrefs;

export function readRecipeSectionPrefs(): RecipeSectionPrefs {
  try {
    const raw = localStorage.getItem(RECIPE_SECTION_PREFS_KEY);
    if (!raw) return DEFAULT_RECIPE_SECTION_PREFS;
    const parsed = JSON.parse(raw) as Partial<RecipeSectionPrefs>;
    return {
      ingredientsCollapsed: parsed.ingredientsCollapsed !== undefined
        ? Boolean(parsed.ingredientsCollapsed)
        : DEFAULT_RECIPE_SECTION_PREFS.ingredientsCollapsed,
      historyCollapsed: parsed.historyCollapsed !== undefined
        ? Boolean(parsed.historyCollapsed)
        : DEFAULT_RECIPE_SECTION_PREFS.historyCollapsed,
      collectionsCollapsed: parsed.collectionsCollapsed !== undefined
        ? Boolean(parsed.collectionsCollapsed)
        : DEFAULT_RECIPE_SECTION_PREFS.collectionsCollapsed,
    };
  } catch {
    return DEFAULT_RECIPE_SECTION_PREFS;
  }
}

export function writeRecipeSectionPrefs(prefs: RecipeSectionPrefs): void {
  try {
    localStorage.setItem(RECIPE_SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
