import { describe, expect, it } from 'vitest';
import {
  auditEmptyStateCatalog,
  formatK99EmptyStateReport,
  K99_EMPTY_VIEWS,
} from './k99EmptyStateAudit';

describe('k99EmptyStateAudit', () => {
  it('covers all K-99 empty views', () => {
    const rows = auditEmptyStateCatalog();
    for (const view of K99_EMPTY_VIEWS) {
      expect(rows.some(r => r.view === view)).toBe(true);
    }
  });

  it('every row has a data hook and title key', () => {
    for (const row of auditEmptyStateCatalog()) {
      expect(row.dataHook.length).toBeGreaterThan(0);
      expect(row.titleKey.length).toBeGreaterThan(0);
    }
  });

  it('prints empty state report', () => {
    const report = formatK99EmptyStateReport(auditEmptyStateCatalog());
    console.log('\n' + report);
    expect(report).toContain('K-99 empty state audit');
    expect(report).toContain('notes/no-notes');
  });
});
