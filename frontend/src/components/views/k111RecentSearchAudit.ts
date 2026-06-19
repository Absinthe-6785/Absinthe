import { SEARCH_RECENT_STORAGE_KEY } from './features/search/searchRecentStorage';

/** K-111 — Recent searches audit. */
export const K111_RECENT_BUCKETS = ['today', 'earlier'] as const;

export const K111_RECENT_HOOKS = [
  'data-k111-search-recent',
  'data-k111-recent-bucket',
  'data-k111-recent-row',
  'data-k111-clear-recent',
] as const;

export function auditRecentSearch(): readonly string[] {
  return [...K111_RECENT_BUCKETS, ...K111_RECENT_HOOKS, SEARCH_RECENT_STORAGE_KEY, 'clearSearchRecentHistory'];
}
