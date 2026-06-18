/**
 * K-101 — Search experience audit.
 */
export const K101_SEARCH_FEATURES = [
  'empty-results-copy',
  'loading-state',
  'keyboard-up-down',
  'keyboard-enter',
  'keyboard-escape',
  'persist-query-across-tabs',
] as const;

export interface K101SearchRow {
  feature: (typeof K101_SEARCH_FEATURES)[number];
  dataHook?: string;
}

export function auditSearchFeatures(): K101SearchRow[] {
  return [
    { feature: 'empty-results-copy', dataHook: 'data-ws-search-empty' },
    { feature: 'loading-state', dataHook: 'data-ws-search-loading' },
    { feature: 'keyboard-up-down' },
    { feature: 'keyboard-enter' },
    { feature: 'keyboard-escape' },
    { feature: 'persist-query-across-tabs' },
  ];
}

export function formatK101SearchReport(rows: readonly K101SearchRow[]): string {
  const lines = ['K-101 search audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}${row.dataHook ? `: ${row.dataHook}` : ''}`);
  }
  return lines.join('\n');
}
