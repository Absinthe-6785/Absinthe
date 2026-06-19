import type { WorkoutSet } from '../../../../types';
import { isStrengthSet } from '../../../../types';
import {
  countWeeklySessions,
  listRecentWorkoutSessions,
  type RangeWorkoutRow,
} from './workout/workoutMetrics';

export interface InbodyHistoryRow {
  date: string;
  weight: number;
  smm: number;
  pbf: number;
}

export interface HealthChartPoint {
  label: string;
  value: number;
}

export interface HealthPrHighlight {
  name: string;
  kg: number;
  date: string;
}

export interface ExerciseHistoryRow {
  name: string;
  sessionCount: number;
  lastDate: string;
}

export interface HealthProjection {
  workoutDates: ReadonlySet<string>;
  recentSessions: ReturnType<typeof listRecentWorkoutSessions>;
  exerciseHistory: ExerciseHistoryRow[];
  weeklySessionCount: number;
  monthlySessionCount: number;
  workoutStreakDays: number;
  weightHistory: { date: string; weight: number }[];
  chartSeries: {
    weeklySessions: HealthChartPoint[];
    weightTrend: HealthChartPoint[];
  };
  prHighlights: HealthPrHighlight[];
}

function buildExerciseHistory(workouts: readonly RangeWorkoutRow[]): ExerciseHistoryRow[] {
  const map = new Map<string, { sessionCount: number; lastDate: string }>();
  for (const w of workouts) {
    const name = w.exercise_blocks?.name ?? '';
    if (!name || !w.date) continue;
    const prev = map.get(name);
    if (!prev) {
      map.set(name, { sessionCount: 1, lastDate: w.date });
    } else {
      map.set(name, {
        sessionCount: prev.sessionCount + 1,
        lastDate: w.date > prev.lastDate ? w.date : prev.lastDate,
      });
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function addDaysKey(dateKey: string, delta: number): string {
  const d = parseDateKey(dateKey);
  if (!d) return dateKey;
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function computeStreak(sortedDateKeys: readonly string[], anchorKey: string): number {
  const set = new Set(sortedDateKeys);
  let streak = 0;
  let cursor = anchorKey;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

function parseKg(kg: number | string): number | null {
  const n = typeof kg === 'number' ? kg : parseFloat(String(kg));
  return n && !Number.isNaN(n) ? n : null;
}

function detectPrHighlights(
  workouts: readonly RangeWorkoutRow[],
  limit = 5,
): HealthPrHighlight[] {
  const bestByName = new Map<string, { kg: number; date: string }>();
  for (const w of workouts) {
    const name = w.exercise_blocks?.name ?? '';
    if (!name) continue;
    for (const set of w.sets ?? []) {
      if (!isStrengthSet(set) || !set.done) continue;
      const kg = parseKg(set.kg);
      if (!kg) continue;
      const prev = bestByName.get(name);
      if (!prev || kg > prev.kg) {
        bestByName.set(name, { kg, date: w.date ?? '' });
      }
    }
  }
  return [...bestByName.entries()]
    .map(([name, { kg, date }]) => ({ name, kg, date }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, limit);
}

function weeklyBuckets(workouts: readonly RangeWorkoutRow[], anchorKey: string): HealthChartPoint[] {
  const sessionsByDate = new Set<string>();
  for (const w of workouts) {
    if (w.date) sessionsByDate.add(w.date);
  }
  const points: HealthChartPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = addDaysKey(anchorKey, -i);
    const label = key.slice(5);
    points.push({ label, value: sessionsByDate.has(key) ? 1 : 0 });
  }
  return points;
}

/** Single-pass health analytics projection — K-107. */
export function buildHealthProjection(input: {
  rangeWorkouts: readonly RangeWorkoutRow[];
  selectedDateKey: string;
  inbodyHistory?: readonly InbodyHistoryRow[];
}): HealthProjection {
  const { rangeWorkouts, selectedDateKey, inbodyHistory = [] } = input;

  const workoutDates = new Set<string>();
  const monthPrefix = selectedDateKey.slice(0, 7);
  let monthlySessions = 0;
  const sessionDates = new Set<string>();

  for (const row of rangeWorkouts) {
    if (!row.date) continue;
    workoutDates.add(row.date);
    sessionDates.add(row.date);
    if (row.date.startsWith(monthPrefix)) monthlySessions += 1;
  }

  const sortedDates = [...sessionDates].sort();
  const weekStart = addDaysKey(selectedDateKey, -6);
  const weekWorkouts = rangeWorkouts.filter(w => w.date && w.date >= weekStart && w.date <= selectedDateKey);

  const weightHistory = [...inbodyHistory]
    .filter(r => r.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ date: r.date, weight: r.weight }));

  return {
    workoutDates,
    recentSessions: listRecentWorkoutSessions(rangeWorkouts, 5),
    exerciseHistory: buildExerciseHistory(rangeWorkouts),
    weeklySessionCount: countWeeklySessions(weekWorkouts),
    monthlySessionCount: monthlySessions,
    workoutStreakDays: computeStreak(sortedDates, selectedDateKey),
    weightHistory,
    chartSeries: {
      weeklySessions: weeklyBuckets(rangeWorkouts, selectedDateKey),
      weightTrend: weightHistory.slice(-7).map(r => ({ label: r.date.slice(5), value: r.weight })),
    },
    prHighlights: detectPrHighlights(rangeWorkouts),
  };
}

/** Synthetic rows for performance benchmarks. */
export function synthesizeRangeWorkouts(count: number, startDate = '2026-01-01'): RangeWorkoutRow[] {
  const rows: RangeWorkoutRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const dayOffset = i % 365;
    const d = parseDateKey(startDate)!;
    d.setDate(d.getDate() + dayOffset);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    rows.push({
      date: dateKey,
      exercise_blocks: { name: `Exercise ${i % 50}` },
      sets: [{ set: 1, kg: 50 + (i % 100), reps: '8', done: true } as WorkoutSet],
    });
  }
  return rows;
}
