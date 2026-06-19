import { describe, expect, it } from 'vitest';
import { auditPlannerIa, auditPlannerIaHooks } from './k108PlannerIaAudit';
import { auditTimetableCohesion } from './k108TimetableAudit';
import { auditUpcomingTiers, auditUpcomingRelativeLabels } from './k108UpcomingAudit';
import { auditCalendarInteractionFlow, auditCalendarEmptyHover } from './k108CalendarAudit';
import {
  auditPlannerLazySections,
  auditPlannerProjectionFields,
  runK108PlannerPerformanceMatrix,
} from './k108PlannerPerformanceAudit';
import { auditPlannerMobile, auditPlannerMobileTouchTargets } from './k108PlannerMobileAudit';
import { buildUpcomingTierGroups } from './features/planner/calendar-ui/agenda/buildUpcomingTierGroups';
import { buildPlannerProjection } from './features/planner/calendar/buildPlannerProjection';
import { buildPlannerCalendarProjection } from './features/planner/calendar';
import { DateTime } from 'luxon';

describe('k108PlannerIaAudit', () => {
  it('lists today-centric sections', () => {
    expect(auditPlannerIa()).toContain('routine-today');
    expect(auditPlannerIaHooks()).toContain('data-k108-planner-layout');
  });
});

describe('k108 upcoming tiers', () => {
  it('groups into today tomorrow later', () => {
    const groups = [
      { dateKey: '2026-06-18', dateLabel: 'Jun 18', items: [{ key: 'a', kind: 'block' as const, sort: '09:00', title: 'A' }] },
      { dateKey: '2026-06-19', dateLabel: 'Jun 19', items: [{ key: 'b', kind: 'block' as const, sort: '09:00', title: 'B' }] },
      { dateKey: '2026-06-22', dateLabel: 'Jun 22', items: [{ key: 'c', kind: 'block' as const, sort: '09:00', title: 'C' }] },
    ];
    const tiers = buildUpcomingTierGroups(groups, '2026-06-18', k => k, 'Later');
    expect(tiers.map(t => t.tier)).toEqual(['today', 'tomorrow', 'later']);
    expect(auditUpcomingTiers()).toEqual(['today', 'tomorrow', 'later']);
    expect(auditUpcomingRelativeLabels()).toContain('k108InDays');
  });
});

describe('k108 planner performance', () => {
  it('builds projection with all fields', () => {
    const calendar = buildPlannerCalendarProjection({
      notes: [],
      scheduleBlocks: [],
      weeklySchedules: [{ id: 'w1', day: 3, title: 'Study', start_time: '13:00', end_time: '14:00', color: 'bg-blue-500' }],
      todos: [],
      routines: [],
      anchorDate: '2026-06-18',
      viewMode: 'month',
      now: DateTime.fromISO('2026-06-18T12:00:00'),
    });
    const p = buildPlannerProjection({
      calendarProjection: calendar,
      presentation: { labels: { agendaDateHeaders: new Map() } } as never,
      todayKey: '2026-06-18',
      isReviewed: () => false,
      relativeLabel: () => 'Today',
      laterTierLabel: 'Later',
    });
    for (const field of auditPlannerProjectionFields()) {
      expect(field in p).toBe(true);
    }
  });

  it('runs performance matrix', () => {
    const rows = runK108PlannerPerformanceMatrix();
    expect(rows).toHaveLength(5);
    expect(rows.every(r => r.projectionMs >= 0)).toBe(true);
  });

  it('lazy section hooks', () => {
    expect(auditPlannerLazySections().length).toBeGreaterThan(0);
  });
});

describe('k108 calendar and mobile audits', () => {
  it('calendar flow', () => {
    expect(auditCalendarInteractionFlow().length).toBeGreaterThan(0);
    expect(auditCalendarEmptyHover()).toContain('data-k108-month-cell-empty');
  });

  it('timetable cohesion', () => {
    expect(auditTimetableCohesion()).toContain('data-k108-planner-routine-today');
  });

  it('mobile widths', () => {
    expect(auditPlannerMobile()).toEqual([320, 375, 768]);
    expect(auditPlannerMobileTouchTargets()).toBe(true);
  });
});
