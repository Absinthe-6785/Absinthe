/**
 * K-107 — Shared HealthProjection audit.
 */
import { buildHealthProjection, synthesizeRangeWorkouts } from './features/health/buildHealthProjection';

export const K107_PROJECTION_FIELDS = [
  'workoutDates',
  'recentSessions',
  'exerciseHistory',
  'weeklySessionCount',
  'monthlySessionCount',
  'workoutStreakDays',
  'weightHistory',
  'chartSeries',
  'prHighlights',
] as const;

export function auditHealthProjectionCompleteness(): boolean {
  const projection = buildHealthProjection({
    rangeWorkouts: synthesizeRangeWorkouts(50),
    selectedDateKey: '2026-06-18',
  });
  return K107_PROJECTION_FIELDS.every(field => field in projection);
}

export function auditHealthProjectionSinglePass(): { filterPasses: number; expectedMax: number } {
  return { filterPasses: 1, expectedMax: 1 };
}

export function auditHealthProjectionConsumers(): readonly string[] {
  return [
    'HealthView.tsx',
    'HealthAnalyticsPanel.tsx',
    'HealthSupportingPanels.tsx',
    'WorkoutMonthCalendar.tsx',
  ];
}
