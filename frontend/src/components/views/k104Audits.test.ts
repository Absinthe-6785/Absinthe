import { describe, expect, it } from 'vitest';
import { auditPopoverSurfaces, formatK104PopoverReport } from './k104PopoverAudit';
import { auditKnowledgeContextTabs, formatK104KnowledgeContextReport } from './k104KnowledgeContextAudit';
import { auditHealthMobileLayout } from './k104HealthMobileAudit';
import { auditMobileToolbar } from './k104MobileToolbarAudit';
import { auditClipboardSupport } from './k104ClipboardAudit';
import { auditScheduleCrud } from './k104ScheduleAudit';
import { auditPlannerLayout } from './k104PlannerLayoutAudit';
import { auditSidebarDensity } from './k104SidebarDensityAudit';
import { auditMobileTopbar, formatK104TopbarReport } from './k104TopbarAudit';

describe('k104 audits', () => {
  it('popover sort menu', () => {
    expect(auditPopoverSurfaces().some(r => r.feature === 'sort-menu-portal')).toBe(true);
    console.log('\n' + formatK104PopoverReport(auditPopoverSurfaces()));
  });

  it('knowledge context tabs', () => {
    expect(auditKnowledgeContextTabs().primary).toContain('overview');
    console.log('\n' + formatK104KnowledgeContextReport(auditKnowledgeContextTabs()));
  });

  it('health mobile hooks', () => {
    expect(auditHealthMobileLayout().length).toBeGreaterThan(0);
  });

  it('mobile toolbar', () => {
    expect(auditMobileToolbar().visible).toContain('more');
  });

  it('clipboard image/png', () => {
    expect(auditClipboardSupport()).toContain('image/png');
  });

  it('schedule crud features', () => {
    expect(auditScheduleCrud()).toContain('day-schedule-timeline');
  });

  it('planner layout sections', () => {
    expect(auditPlannerLayout()).toContain('planner-today');
  });

  it('sidebar density', () => {
    expect(auditSidebarDensity().always).toContain('trash');
  });

  it('topbar audit', () => {
    console.log('\n' + formatK104TopbarReport(auditMobileTopbar()));
  });
});
