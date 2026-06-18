import { describe, expect, it } from 'vitest';
import { auditPlannerWorkflow, formatK103PlannerReport } from './k103PlannerAudit';

describe('k103PlannerAudit', () => {
  it('covers planner hooks', () => {
    expect(auditPlannerWorkflow().some(r => r.feature === 'timetable-presets')).toBe(true);
  });

  it('prints planner report', () => {
    const report = formatK103PlannerReport(auditPlannerWorkflow());
    console.log('\n' + report);
    expect(report).toContain('K-103 planner audit');
  });
});
