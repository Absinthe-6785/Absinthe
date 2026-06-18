import { describe, expect, it } from 'vitest';
import { auditPlannerFeatures, formatK100PlannerReport } from './k100PlannerAudit';

describe('k100PlannerAudit', () => {
  it('lists planner cohesion features', () => {
    expect(auditPlannerFeatures().length).toBeGreaterThanOrEqual(5);
  });

  it('prints planner report', () => {
    const report = formatK100PlannerReport(auditPlannerFeatures());
    console.log('\n' + report);
    expect(report).toContain('K-100 planner audit');
  });
});
