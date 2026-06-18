import { describe, expect, it } from 'vitest';
import { auditPlannerFeatures, formatK101PlannerReport } from './k101PlannerAudit';

describe('k101PlannerAudit', () => {
  it('covers upcoming and timetable hooks', () => {
    const rows = auditPlannerFeatures();
    expect(rows.some(r => r.feature === 'upcoming-jump-to-day')).toBe(true);
    expect(rows.some(r => r.feature === 'timetable-duplicate-day-indicator')).toBe(true);
  });

  it('prints planner report', () => {
    const report = formatK101PlannerReport(auditPlannerFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-101 planner audit');
  });
});
