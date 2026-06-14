import type { WorkoutSet } from '../../../../../types';
import { isStrengthSet } from '../../../../../types';

export interface RangeWorkoutRow {
  date?: string;
  exercise_blocks: { name: string };
  sets: WorkoutSet[];
}

function parseKg(kg: number | string): number | null {
  const n = typeof kg === 'number' ? kg : parseFloat(String(kg));
  return n && !Number.isNaN(n) ? n : null;
}

export function countWeeklySessions(workouts: readonly RangeWorkoutRow[]): number {
  return new Set(workouts.map(w => w.date).filter(Boolean)).size;
}

export function listRecentWorkoutSessions(
  workouts: readonly RangeWorkoutRow[],
  limit = 3,
): { date: string; exercises: string[] }[] {
  const byDate = new Map<string, Set<string>>();
  for (const w of workouts) {
    const date = w.date ?? '';
    if (!date) continue;
    const name = w.exercise_blocks?.name ?? '';
    if (!byDate.has(date)) byDate.set(date, new Set());
    if (name) byDate.get(date)!.add(name);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([date, names]) => ({ date, exercises: [...names] }));
}

export function detectRecentPr(
  workouts: readonly RangeWorkoutRow[],
  dateStr: string,
): { name: string; kg: number } | null {
  const priorMax = new Map<string, number>();
  const todayMax = new Map<string, number>();

  for (const w of workouts) {
    const name = w.exercise_blocks?.name ?? '';
    if (!name) continue;
    const bucket = w.date === dateStr ? todayMax : priorMax;
    for (const set of w.sets ?? []) {
      if (!isStrengthSet(set) || !set.done) continue;
      const kg = parseKg(set.kg);
      if (!kg) continue;
      bucket.set(name, Math.max(bucket.get(name) ?? 0, kg));
    }
  }

  let pr: { name: string; kg: number } | null = null;
  for (const [name, kg] of todayMax) {
    if (kg > (priorMax.get(name) ?? 0) && (!pr || kg > pr.kg)) {
      pr = { name, kg };
    }
  }
  return pr;
}
