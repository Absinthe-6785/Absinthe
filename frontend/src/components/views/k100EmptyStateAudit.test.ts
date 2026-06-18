import { describe, expect, it } from 'vitest';
import { auditK100EmptyStates, formatK100EmptyStateReport } from './k100EmptyStateAudit';

describe('k100EmptyStateAudit', () => {
  it('catalog entries have descriptions where expected', () => {
    const rows = auditK100EmptyStates();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter(r => r.hasPrimaryCta).length).toBeGreaterThan(0);
  });

  it('prints empty state report', () => {
    const report = formatK100EmptyStateReport(auditK100EmptyStates());
    console.log('\n' + report);
    expect(report).toContain('K-100 empty state audit');
  });
});
