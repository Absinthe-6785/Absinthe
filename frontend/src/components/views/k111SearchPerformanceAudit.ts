import { SEARCH_VIRTUALIZE_THRESHOLD } from './features/search/components/SearchVirtualList';

/** K-111 — Search performance audit. */
export const K111_SEARCH_MEMO_SLICES = [
  'highlights',
  'counts',
  'groupedResults',
] as const;

export const K111_PERFORMANCE_HOOKS = [
  'data-k111-search-virtual-list',
  'SearchProjection',
] as const;

export function auditSearchPerformance(): readonly string[] {
  return [...K111_SEARCH_MEMO_SLICES, ...K111_PERFORMANCE_HOOKS, String(SEARCH_VIRTUALIZE_THRESHOLD)];
}
