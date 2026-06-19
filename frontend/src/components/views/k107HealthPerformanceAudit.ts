/**
 * K-107 — Health render performance audit.
 */
import {
  buildHealthProjection,
  synthesizeRangeWorkouts,
} from './features/health/buildHealthProjection';
import {
  computeWorkoutPrBadgeMap,
} from './features/health/computeWorkoutPrBadge';
import { buildMonthCellDecorations } from './features/health/WorkoutMonthCalendar';
import { buildCalendarDays } from '@/lib/calendarUtils';

export const K107_HEALTH_RECORD_SCALES = [100, 300, 1000, 3000, 10000] as const;

export interface K107HealthPerfRow {
  recordCount: number;
  projectionMs: number;
  prBadgeMapMs: number;
  calendarMs: number;
  passesBudget: boolean;
}

export const K107_HEALTH_HOTSPOTS = [
  'health-view-pr-badge-iife',
  'block-library-tag-group-rebuild',
  'month-calendar-cell-decorations',
  'supporting-panels-initial-mount',
  'analytics-range-fetch',
] as const;

const PROJECTION_BUDGET_MS: Record<number, number> = {
  100: 5,
  300: 10,
  1000: 25,
  3000: 60,
  10000: 150,
};

export function measureHealthProjectionBuild(recordCount: number): number {
  const rows = synthesizeRangeWorkouts(recordCount);
  const start = performance.now();
  buildHealthProjection({ rangeWorkouts: rows, selectedDateKey: '2026-06-18' });
  return performance.now() - start;
}

export function measurePrBadgeMap(recordCount: number): number {
  const workouts = synthesizeRangeWorkouts(Math.min(recordCount, 40)).map((r, i) => ({
    id: `w-${i}`,
    block_id: `b-${i % 20}`,
    exercise_blocks: r.exercise_blocks,
    sets: r.sets,
  }));
  const prevData: Record<string, { prev_sets: typeof workouts[0]['sets']; prev_date: string | null; pr_kg: number | null }> = {};
  for (let i = 0; i < 20; i += 1) {
    prevData[`b-${i}`] = { prev_sets: [], prev_date: '2026-06-01', pr_kg: 40 };
  }
  const start = performance.now();
  computeWorkoutPrBadgeMap(
    workouts as never,
    prevData,
    kg => kg,
    () => 'kg',
  );
  return performance.now() - start;
}

export function measureCalendarDecoration(recordCount: number): number {
  const rows = synthesizeRangeWorkouts(recordCount);
  const projection = buildHealthProjection({ rangeWorkouts: rows, selectedDateKey: '2026-06-18' });
  const year = 2026;
  const month = 5;
  const calendarDays = buildCalendarDays(year, month);
  const mobileDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const start = performance.now();
  buildMonthCellDecorations(year, month, calendarDays, mobileDays, projection.workoutDates);
  return performance.now() - start;
}

export function runK107HealthPerformanceMatrix(): K107HealthPerfRow[] {
  return K107_HEALTH_RECORD_SCALES.map(recordCount => {
    const projectionMs = measureHealthProjectionBuild(recordCount);
    const prBadgeMapMs = measurePrBadgeMap(recordCount);
    const calendarMs = measureCalendarDecoration(recordCount);
    const budget = PROJECTION_BUDGET_MS[recordCount] ?? 200;
    return {
      recordCount,
      projectionMs,
      prBadgeMapMs,
      calendarMs,
      passesBudget: projectionMs <= budget,
    };
  });
}

export function formatK107HealthPerformanceReport(rows: readonly K107HealthPerfRow[]): string {
  const lines = ['K-107 Health performance audit', ''];
  for (const row of rows) {
    lines.push(
      `n=${row.recordCount} projection=${row.projectionMs.toFixed(2)}ms prMap=${row.prBadgeMapMs.toFixed(2)}ms calendar=${row.calendarMs.toFixed(2)}ms ok=${row.passesBudget}`,
    );
  }
  lines.push('', 'Hotspots addressed:', ...K107_HEALTH_HOTSPOTS.map(h => `- ${h}`));
  return lines.join('\n');
}

export function auditHealthPerformanceHooks(): readonly string[] {
  return [
    'data-k107-health-block-library',
    'data-k107-health-analytics',
    'data-k107-health-supporting-panels',
    'data-k107-workout-pr-badge',
    'data-k107-calendar-month-key',
    'data-k107-health-virtual-list',
  ];
}
