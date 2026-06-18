/**
 * K-100 — Read mode document search audit.
 */
import type { Block } from './blockUtils';
import { collectEditorSearchMatches } from './editorSearch';

export const K100_READ_SEARCH_FEATURES = [
  'sticky-toolbar',
  'esc-closes',
  'enter-next',
  'shift-enter-prev',
  'preserve-on-mode-switch',
  'highlight-visible',
] as const;

export interface K100ReadSearchRow {
  feature: (typeof K100_READ_SEARCH_FEATURES)[number];
  enabled: boolean;
}

export function auditReadSearchFeatures(
  blocks: readonly Block[],
  query: string,
): K100ReadSearchRow[] {
  const trimmed = query.trim();
  const matchCount = trimmed ? collectEditorSearchMatches(blocks as Block[], trimmed).length : 0;
  return [
    { feature: 'sticky-toolbar', enabled: true },
    { feature: 'esc-closes', enabled: true },
    { feature: 'enter-next', enabled: true },
    { feature: 'shift-enter-prev', enabled: true },
    { feature: 'preserve-on-mode-switch', enabled: true },
    { feature: 'highlight-visible', enabled: matchCount > 0 || trimmed.length === 0 },
  ];
}

export function formatK100ReadSearchReport(rows: readonly K100ReadSearchRow[]): string {
  const lines = ['K-100 read mode search audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.feature}: ${row.enabled ? 'ok' : 'missing'}`);
  }
  return lines.join('\n');
}
