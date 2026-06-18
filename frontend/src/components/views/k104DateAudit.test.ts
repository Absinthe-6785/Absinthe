import { describe, expect, it } from 'vitest';
import { auditDateSurfaces, formatK104DateReport } from './k104DateAudit';

describe('k104DateAudit', () => {
  it('covers date surfaces', () => {
    expect(auditDateSurfaces().some(r => r.surface === 'planner-headers')).toBe(true);
  });

  it('prints date report', () => {
    const report = formatK104DateReport(auditDateSurfaces());
    console.log('\n' + report);
    expect(report).toContain('K-104 date audit');
  });
});
