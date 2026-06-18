import { describe, expect, it } from 'vitest';
import { auditEmptyVault, formatK101EmptyVaultReport } from './k101EmptyVaultAudit';

describe('k101EmptyVaultAudit', () => {
  it('vault empty state has three CTAs', () => {
    const [row] = auditEmptyVault();
    expect(row?.hasCreate).toBe(true);
    expect(row?.hasTodaysNote).toBe(true);
    expect(row?.hasImport).toBe(true);
  });

  it('prints empty vault report', () => {
    const report = formatK101EmptyVaultReport(auditEmptyVault());
    console.log('\n' + report);
    expect(report).toContain('K-101 empty vault audit');
  });
});
