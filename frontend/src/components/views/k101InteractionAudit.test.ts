import { describe, expect, it } from 'vitest';
import { auditInteractionSurfaces, formatK101InteractionReport } from './k101InteractionAudit';

describe('k101InteractionAudit', () => {
  it('covers sidebar and planner surfaces', () => {
    const rows = auditInteractionSurfaces();
    expect(rows.some(r => r.surface === 'sidebar')).toBe(true);
    expect(rows.some(r => r.surface === 'planner')).toBe(true);
  });

  it('prints interaction report', () => {
    const report = formatK101InteractionReport(auditInteractionSurfaces());
    console.log('\n' + report);
    expect(report).toContain('K-101 interaction audit');
  });
});
