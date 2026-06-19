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

  const curMax = Math.max(
    0,
    ...w.sets
      .filter(s => isStrengthSet(s) && s.done && (s as StrengthSet).kg !== '')
      .map(s => toDisplay(parseFloat(String((s as StrengthSet).kg)), w.block_id)),
  );
  const prevMax = pd.prev_sets
    .filter(s => isStrengthSet(s) && s.done && (s as StrengthSet).kg !== '')
    .reduce((m, s) => Math.max(m, toDisplay(parseFloat(String((s as StrengthSet).kg)), w.block_id)), 0);
  const prKgDisplay = pd.pr_kg !== null ? toDisplay(pd.pr_kg, w.block_id) : null;
  const isPR = prKgDisplay !== null && curMax > 0 && curMax > prKgDisplay;
  const diff = curMax > 0 && prevMax > 0 ? parseFloat((curMax - prevMax).toFixed(1)) : 0;

  return {
    isPR,
    diff,
    prevMax,
    showDiff: prevMax > 0 && !isPR,
    unit,
  };
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
