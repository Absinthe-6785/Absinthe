import { describe, expect, it } from 'vitest';
import { auditReadingErgonomics, formatK103ReadingReport } from './k103ReadingAudit';

describe('k103ReadingAudit', () => {
  it('covers reading hooks', () => {
    expect(auditReadingErgonomics().some(r => r.feature === 'max-width')).toBe(true);
  });

  it('prints reading report', () => {
    const report = formatK103ReadingReport(auditReadingErgonomics());
    console.log('\n' + report);
    expect(report).toContain('K-103 reading audit');
  });
});
