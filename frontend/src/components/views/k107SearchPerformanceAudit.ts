/**
 * K-107 — Search responsiveness audit.
 */
export const K107_SEARCH_MEMO_RULES = [
  'sidebarSearchQuery-useMemo-filteredNotes',
  'filterNotesForSidebarList-single-pass',
  'traceSidebarCounts-memoized',
  'knowledgeQueryInfo-deferred',
] as const;

export function auditSearchPerformance(): readonly string[] {
  return K107_SEARCH_MEMO_RULES;
}

export function auditSearchLazyProjection(): boolean {
  return K107_SEARCH_MEMO_RULES.some(r => r.includes('useMemo') || r.includes('single-pass'));
}
