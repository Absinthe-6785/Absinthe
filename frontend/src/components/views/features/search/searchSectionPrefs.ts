export const SEARCH_SECTION_PREFS_KEY = 'absinthe-search-sections';

export interface SearchSectionPrefs {
  notesCollapsed: boolean;
  plannerCollapsed: boolean;
  healthCollapsed: boolean;
  recipeCollapsed: boolean;
  archiveCollapsed: boolean;
}

export const DEFAULT_SEARCH_SECTION_PREFS: SearchSectionPrefs = {
  notesCollapsed: false,
  plannerCollapsed: false,
  healthCollapsed: true,
  recipeCollapsed: true,
  archiveCollapsed: true,
};

export type SearchSectionPrefKey = keyof SearchSectionPrefs;

export function readSearchSectionPrefs(): SearchSectionPrefs {
  try {
    const raw = localStorage.getItem(SEARCH_SECTION_PREFS_KEY);
    if (!raw) return DEFAULT_SEARCH_SECTION_PREFS;
    const parsed = JSON.parse(raw) as Partial<SearchSectionPrefs>;
    return {
      notesCollapsed: parsed.notesCollapsed ?? DEFAULT_SEARCH_SECTION_PREFS.notesCollapsed,
      plannerCollapsed: parsed.plannerCollapsed ?? DEFAULT_SEARCH_SECTION_PREFS.plannerCollapsed,
      healthCollapsed: parsed.healthCollapsed ?? DEFAULT_SEARCH_SECTION_PREFS.healthCollapsed,
      recipeCollapsed: parsed.recipeCollapsed ?? DEFAULT_SEARCH_SECTION_PREFS.recipeCollapsed,
      archiveCollapsed: parsed.archiveCollapsed ?? DEFAULT_SEARCH_SECTION_PREFS.archiveCollapsed,
    };
  } catch {
    return DEFAULT_SEARCH_SECTION_PREFS;
  }
}

export function writeSearchSectionPrefs(prefs: SearchSectionPrefs): void {
  try {
    localStorage.setItem(SEARCH_SECTION_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
