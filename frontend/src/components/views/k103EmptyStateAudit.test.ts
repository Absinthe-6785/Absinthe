import { describe, expect, it } from 'vitest';
import { auditEmptyStates, formatK103EmptyStateReport } from './k103EmptyStateAudit';

describe('k103EmptyStateAudit', () => {
  it('covers empty state surfaces', () => {
    expect(auditEmptyStates().some(r => r.surface === 'vault-empty')).toBe(true);
  });

  it('prints empty state report', () => {
    const report = formatK103EmptyStateReport(auditEmptyStates());
    console.log('\n' + report);
    expect(report).toContain('K-103 empty state audit');
  });
});
