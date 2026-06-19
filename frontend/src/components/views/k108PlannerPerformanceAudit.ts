/**
 * K-108 — Planner performance audit.
 */
import { DateTime } from 'luxon';
import {
  buildPlannerCalendarProjection,
  buildPlannerProjection,
  synthesizePlannerScheduleRows,
} from './features/planner/calendar';

export const K108_PLANNER_RECORD_SCALES = [100, 300, 1000, 3000, 10000] as const;

export interface K108PlannerPerfRow {
  recordCount: number;
  projectionMs: number;
  passesBudget: boolean;
}

const BUDGET_MS: Record<number, number> = {
  100: 8,
  300: 15,
  1000: 35,
  3000: 80,
  10000: 200,
};

export function measurePlannerProjectionBuild(recordCount: number): number {
  const rows = synthesizePlannerScheduleRows(recordCount);
  const now = DateTime.fromISO('2026-06-18T12:00:00');
  const start = performance.now();
  const calendar = buildPlannerCalendarProjection({
    notes: [],
    scheduleBlocks: rows.map(r => ({ ...r, is_dday: false, color: 'purple', category: 'Work' })),
    weeklySchedules: [],
    todos: [],
    routines: [],
    anchorDate: '2026-06-18',
    viewMode: 'month',
    now,
  });
  buildPlannerProjection({
    calendarProjection: calendar,
    presentation: { labels: { agendaDateHeaders: new Map() } } as never,
    todayKey: '2026-06-18',
    isReviewed: () => false,
    relativeLabel: k => k,
    laterTierLabel: 'Later',
  });
  return performance.now() - start;
}

export function runK108PlannerPerformanceMatrix(): K108PlannerPerfRow[] {
  return K108_PLANNER_RECORD_SCALES.map(recordCount => {
    const projectionMs = measurePlannerProjectionBuild(recordCount);
    const budget = BUDGET_MS[recordCount] ?? 250;
    return { recordCount, projectionMs, passesBudget: projectionMs <= budget };
  });
}

export function auditPlannerProjectionFields(): readonly string[] {
  return ['todayItems', 'upcomingItems', 'groupedUpcoming', 'timetableToday', 'calendar'];
}

export function auditPlannerLazySections(): readonly string[] {
  return ['data-k108-planner-month-lazy', 'data-k102-upcoming-scroll'];
}
