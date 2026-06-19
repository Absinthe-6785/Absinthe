import { describe, expect, it } from 'vitest';
import { auditDailyWorkflow } from './k105DailyWorkflowAudit';
import { auditStarPersistence } from './k105StarPersistenceAudit';
import { auditSidebarSimplification } from './k105SidebarSimplificationAudit';
import { auditPlannerToday } from './k105PlannerTodayAudit';
import { auditKeyboardRetained } from './k105KeyboardAudit';
import { auditProductCohesion } from './k105ProductCohesionAudit';
import { mergeNotePair } from './noteUtils';
import { auditSidebarSimplification } from './k105SidebarSimplificationAudit';
import { auditPlannerToday } from './k105PlannerTodayAudit';
import { auditKeyboardRetained } from './k105KeyboardAudit';
import { auditProductCohesion } from './k105ProductCohesionAudit';

describe('k105 audits', () => {
  it('daily workflow hooks', () => {
    expect(auditDailyWorkflow()).toContain('data-k105-planner-todays-note');
  });

  it('star persistence surfaces', () => {
    expect(auditStarPersistence()).toContain('mergeNotePair-star-or');
  });

  it('sidebar simplification', () => {
    const s = auditSidebarSimplification();
    expect(s.always).toEqual(['favorites', 'folders', 'trash']);
    expect(s.collapsed).toContain('timeline-lens');
  });

  it('planner today sections', () => {
    expect(auditPlannerToday()).toContain('upcoming');
  });

  it('keyboard retained shortcuts', () => {
    expect(auditKeyboardRetained().some(r => r.keys === 'Ctrl+Alt+T')).toBe(true);
    expect(auditKeyboardRetained().some(r => r.keys === 'Ctrl+Shift+F')).toBe(true);
    expect(auditKeyboardRetained().some(r => r.keys === 'Alt+1')).toBe(true);
  });

  it('product cohesion matrix', () => {
    expect(auditProductCohesion().find(r => r.id === 'daily-note')?.disposition).toBe('planner');
  });
});
