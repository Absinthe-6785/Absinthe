import { describe, expect, it } from 'vitest';
import { auditPlannerFeatures, formatK102PlannerReport } from './k102PlannerAudit';

describe('k102PlannerAudit', () => {
  it('covers planner polish hooks', () => {
    expect(auditPlannerFeatures().some(r => r.feature === 'upcoming-desktop-density')).toBe(true);
  });

  it('prints planner report', () => {
    const report = formatK102PlannerReport(auditPlannerFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-102 planner audit');
  });
});
