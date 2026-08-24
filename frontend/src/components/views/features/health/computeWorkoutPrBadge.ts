import type { Workout, WorkoutSet } from '../../../../types';
import { isStrengthSet, type StrengthSet } from '../../../../types';

export interface WorkoutPrBadgeData {
  isPR: boolean;
  diff: number;
  prevMax: number;
  showDiff: boolean;
  unit: 'kg' | 'lbs';
}

export interface PrevBlockData {
  prev_sets: WorkoutSet[];
  prev_date: string | null;
  pr_kg: number | null;
}

export function computeWorkoutPrBadge(
  w: Workout,
  pd: PrevBlockData | undefined,
  toDisplay: (kg: number, blockId: string) => number,
  unit: 'kg' | 'lbs',
): WorkoutPrBadgeData | null {
  if (!pd || w.exercise_blocks?.type === 'cardio') return null;

  const curMaxKg = Math.max(
    0,
    ...w.sets
      .filter(s => isStrengthSet(s) && s.done && (s as StrengthSet).kg !== '')
      .map(s => parseKg((s as StrengthSet).kg)),
  );
  const prevMaxKg = pd.prev_sets
    .filter(s => isStrengthSet(s) && s.done && (s as StrengthSet).kg !== '')
    .reduce((m, s) => Math.max(m, parseKg((s as StrengthSet).kg)), 0);
  const curMax = toDisplay(curMaxKg, w.block_id);
  const prevMax = toDisplay(prevMaxKg, w.block_id);
  const isPR = pd.pr_kg !== null && curMaxKg > 0 && curMaxKg > pd.pr_kg;
  const diff = curMax > 0 && prevMax > 0 ? parseFloat((curMax - prevMax).toFixed(1)) : 0;

  return {
    isPR,
    diff,
    prevMax,
    showDiff: prevMax > 0 && !isPR,
    unit,
  };
}

function parseKg(kg: number | string): number {
  const value = typeof kg === 'number' ? kg : Number(kg);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function computeWorkoutPrBadgeMap(
  workouts: readonly Workout[],
  prevData: Record<string, PrevBlockData>,
  toDisplay: (kg: number, blockId: string) => number,
  getUnit: (blockId: string) => 'kg' | 'lbs',
): Record<string, WorkoutPrBadgeData | null> {
  const map: Record<string, WorkoutPrBadgeData | null> = {};
  for (const w of workouts) {
    if (w.block_id === '__session__') continue;
    map[w.block_id] = computeWorkoutPrBadge(w, prevData[w.block_id], toDisplay, getUnit(w.block_id));
  }
  return map;
}
