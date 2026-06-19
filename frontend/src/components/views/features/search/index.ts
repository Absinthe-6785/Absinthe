export { buildSearchProjection, SEARCH_PROJECTION_SLICES } from './buildSearchProjection';
export type {
  SearchProjection,
  SearchProjectionSlice,
  SearchResultItem,
  SearchDomain,
  SearchDomainGroup,
  SearchCounts,
  SearchHighlight,
  SearchRecentGroups,
  SearchRecentItem,
  SearchEmptyFlags,
} from './searchProjectionModels';
export { SEARCH_DOMAIN_ORDER, SEARCH_DOMAIN_LABEL_KEYS } from './searchProjectionModels';
export { useSearchProjection } from './hooks/useSearchProjection';
export { useSearchSectionPrefs } from './hooks/useSearchSectionPrefs';
export {
  loadSearchRecent,
  pushSearchRecent,
  clearSearchRecentHistory,
  clearSearchRecentForTest,
  buildSearchRecentGroups,
  SEARCH_RECENT_STORAGE_KEY,
} from './searchRecentStorage';
export {
  readSearchSectionPrefs,
  writeSearchSectionPrefs,
  SEARCH_SECTION_PREFS_KEY,
} from './searchSectionPrefs';
export {
  buildPlannerSearchResults,
  buildHealthSearchResults,
  buildRecipeSearchResults,
  buildArchiveSearchResults,
} from './buildSearchDomainResults';
export { buildHighlightsForResults, matchQueryRanges } from './searchHighlight';
export { registerSearchNoteHandlers, getSearchNoteHandlers } from './searchNavigation';
export { SEARCH_VIRTUALIZE_THRESHOLD } from './components/SearchVirtualList';
