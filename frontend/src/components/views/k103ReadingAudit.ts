/**
 * K-103 — Reading ergonomics audit.
 */
import { K103_READING_MAX_WIDTH_PX } from './k103LayoutConstants';

export const K103_READING_FEATURES = [
  { feature: 'max-width', dataHook: `reading-max-${K103_READING_MAX_WIDTH_PX}` },
  { feature: 'heading-spacing', dataHook: 'be-reading-heading' },
  { feature: 'paragraph-spacing', dataHook: 'be-reading-paragraph' },
  { feature: 'callout-padding', dataHook: 'be-reading-callout' },
  { feature: 'code-margins', dataHook: 'be-reading-code' },
  { feature: 'table-overflow', dataHook: 'be-reading-table' },
  { feature: 'search-esc-clear', dataHook: 'data-document-search-toolbar' },
  { feature: 'search-no-results', dataHook: 'data-k103-search-no-results' },
  { feature: 'match-badge-pulse', dataHook: 'data-document-search-match-count' },
] as const;

export interface K103ReadingRow {
  feature: string;
  dataHook: string;
}

export function auditReadingErgonomics(): K103ReadingRow[] {
  return K103_READING_FEATURES.map(f => ({ feature: f.feature, dataHook: f.dataHook }));
}

export function formatK103ReadingReport(rows: readonly K103ReadingRow[]): string {
  const lines = ['K-103 reading audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}: ${row.dataHook}`);
  }
  return lines.join('\n');
}
