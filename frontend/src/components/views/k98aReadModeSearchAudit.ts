/**
 * K-98A — Read mode document search audit.
 */
import type { Block } from './blockUtils';
import { collectEditorSearchMatches } from './editorSearch';

export const K98A_READ_SEARCH_SCOPES = ['block', 'document', 'all'] as const;

export interface K98ReadModeSearchRow {
  query: string;
  scope: (typeof K98A_READ_SEARCH_SCOPES)[number];
  matchCount: number;
  supportsPrevNext: boolean;
  highlightsInReadMode: boolean;
}

export function auditReadModeSearch(
  blocks: readonly Block[],
  query: string,
  scope: (typeof K98A_READ_SEARCH_SCOPES)[number],
): K98ReadModeSearchRow {
  const trimmed = query.trim();
  const effectiveQuery = scope === 'all' ? '' : trimmed;
  const matchCount = effectiveQuery ? collectEditorSearchMatches(blocks as Block[], effectiveQuery).length : 0;
  return {
    query: trimmed,
    scope,
    matchCount,
    supportsPrevNext: scope !== 'all' && matchCount > 0,
    highlightsInReadMode: scope !== 'all' && Boolean(trimmed),
  };
}

export function formatK98ReadModeSearchReport(rows: readonly K98ReadModeSearchRow[]): string {
  const lines = ['K-98A read mode search audit', ''];
  for (const row of rows) {
    lines.push(
      `scope=${row.scope} query="${row.query}" matches=${row.matchCount} `
      + `prevNext=${row.supportsPrevNext} readHighlight=${row.highlightsInReadMode}`,
    );
  }
  return lines.join('\n');
}
