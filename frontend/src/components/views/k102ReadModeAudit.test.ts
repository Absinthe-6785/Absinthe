import { describe, expect, it } from 'vitest';
import { auditReadModeFeatures, formatK102ReadModeReport } from './k102ReadModeAudit';

describe('k102ReadModeAudit', () => {
  it('covers read mode hooks', () => {
    expect(auditReadModeFeatures().some(r => r.feature === 'ctrl-f-focus')).toBe(true);
  });

  it('prints read mode report', () => {
    const report = formatK102ReadModeReport(auditReadModeFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-102 read mode audit');
  });
});
