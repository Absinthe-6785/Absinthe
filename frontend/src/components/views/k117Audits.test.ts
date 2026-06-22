import { describe, expect, it } from 'vitest';
import { auditScheduleRc } from './k117ScheduleAudit';
import { auditTimetableRc } from './k117TimetableAudit';
import { auditPlannerActionRc } from './k117PlannerActionAudit';
import { auditEventCrudRc } from './k117EventCrudAudit';
import { auditArchiveLayoutRc } from './k117ArchiveLayoutAudit';
import { auditNewNoteRc } from './k117NewNoteAudit';
import { auditDensityRc } from './k117DensityAudit';
import { auditResponsiveRc, K117_RESPONSIVE_WIDTHS } from './k117ResponsiveAudit';
import { SCHEDULE_SECTIONS } from './features/planner/ScheduleSectionNav';

describe('k117 schedule layout cleanup audits', () => {
  it('A — unified Schedule workspace', () => {
    expect(auditScheduleRc()).toBe(true);
    expect(SCHEDULE_SECTIONS.map(s => s.id)).toEqual([
      'routine', 'today', 'timetable', 'calendar', 'upcoming',
    ]);
  });

  it('A — timetable inline section', () => {
    expect(auditTimetableRc()).toBe(true);
  });

  it('B — single planner add action', () => {
    expect(auditPlannerActionRc()).toBe(true);
  });

  it('C — event CRUD', () => {
    expect(auditEventCrudRc()).toBe(true);
  });

  it('D — archive layout', () => {
    expect(auditArchiveLayoutRc()).toBe(true);
  });

  it('E — new note top placement', () => {
    expect(auditNewNoteRc()).toBe(true);
  });

  it('F — planner density', () => {
    expect(auditDensityRc()).toBe(true);
  });

  it('G — responsive surfaces', () => {
    expect(auditResponsiveRc()).toBe(true);
    expect(K117_RESPONSIVE_WIDTHS).toEqual([320, 375, 768, 1440]);
  });
});
