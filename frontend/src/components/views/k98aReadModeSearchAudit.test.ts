import { describe, expect, it } from 'vitest';
import {
  auditReadModeSearch,
  formatK98ReadModeSearchReport,
  K98A_READ_SEARCH_SCOPES,
} from './k98aReadModeSearchAudit';

const BLOCKS = [
  { id: 'b1', type: 'paragraph' as const, content: 'alpha beta gamma', children: [] },
  { id: 'b2', type: 'paragraph' as const, content: 'second alpha block', children: [] },
];

describe('k98aReadModeSearchAudit', () => {
  it.each(K98A_READ_SEARCH_SCOPES)('audits scope %s', scope => {
    const row = auditReadModeSearch(BLOCKS, 'alpha', scope);
    if (scope === 'all') {
      expect(row.matchCount).toBe(0);
      expect(row.highlightsInReadMode).toBe(false);
    } else {
      expect(row.matchCount).toBe(2);
      expect(row.supportsPrevNext).toBe(true);
      expect(row.highlightsInReadMode).toBe(true);
    }
  });

  it('prints read mode search report', () => {
    const rows = K98A_READ_SEARCH_SCOPES.map(scope => auditReadModeSearch(BLOCKS, 'alpha', scope));
    const report = formatK98ReadModeSearchReport(rows);
    console.log('\n' + report);
    expect(report).toContain('K-98A read mode search audit');
  });
});
