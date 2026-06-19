import { SEARCH_DOMAIN_ORDER } from './features/search/searchProjectionModels';

/** K-111 — Cross-domain search grouping audit. */
export const K111_SEARCH_DOMAINS = SEARCH_DOMAIN_ORDER;

export const K111_GROUPING_HOOKS = [
  'data-k111-search-grouped',
  'data-k111-search-section',
  'data-k111-section-toggle',
  'data-k111-section-body',
  'data-k111-collapsed',
] as const;

export const K111_SECTION_PREFS_KEY = 'absinthe-search-sections';

export function auditSearchGrouping(): readonly string[] {
  return [...K111_SEARCH_DOMAINS, ...K111_GROUPING_HOOKS, K111_SECTION_PREFS_KEY];
}
