import { describe, expect, it, vi } from 'vitest';
import type { StrengthSet, Workout, WorkoutSet } from '../../../../types';
import {
  computeWorkoutPrBadge,
  computeWorkoutPrBadgeMap,
  createWorkoutPrBadgeMapCache,
  type PrevBlockData,
} from './computeWorkoutPrBadge';

const strength = (set: number, kg: string): StrengthSet => ({
  type: 'strength', set, kg, reps: '8', done: true,
});

const workout = (id: string, blockId: string, sets: WorkoutSet[]): Workout => ({
  id, block_id: blockId, sets, exercise_blocks: { type: 'strength' },
} as Workout);

describe('Workout PR projection cache', () => {
  it('matches the existing map output and only recalculates changed row dependencies', () => {
    const rows = [
      workout('bench-1', 'bench', [strength(1, '100'), strength(2, '90')]),
      { id: 'session-1', block_id: '__session__', sets: [] } as Workout,
      workout('row-1', 'row', [strength(1, '70')]),
    ];
    const previous: Record<string, PrevBlockData> = {
      bench: { prev_sets: [strength(1, '95')], prev_date: '2026-01-09', pr_kg: 98 },
      row: { prev_sets: [strength(1, '72')], prev_date: '2026-01-09', pr_kg: 72 },
    };
    const toDisplay = (kg: number) => kg;
    const getKg = () => 'kg' as const;
    const compute = vi.fn((w: Workout, pd: PrevBlockData | undefined,
      display: (kg: number, blockId: string) => number, unit: 'kg' | 'lbs') =>
      computeWorkoutPrBadge(w, pd, display, unit));
    const cache = createWorkoutPrBadgeMapCache(compute);

    const initial = cache(rows, previous, toDisplay, getKg);
    expect(initial).toEqual(computeWorkoutPrBadgeMap(rows, previous, toDisplay, getKg));
    expect(compute).toHaveBeenCalledTimes(2);
    expect(cache(rows, previous, toDisplay, getKg)).toEqual(initial);
    expect(compute).toHaveBeenCalledTimes(2);

    const edited = [{ ...rows[0]!, sets: [strength(1, '105'), strength(2, '90')] }, rows[1]!, rows[2]!];
    cache(edited, previous, toDisplay, getKg);
    expect(compute).toHaveBeenCalledTimes(3);

    const replacedPrevious = { ...previous, bench: { ...previous.bench!, pr_kg: 103 } };
    cache(edited, replacedPrevious, toDisplay, getKg);
    expect(compute).toHaveBeenCalledTimes(4);

    const getLbs = () => 'lbs' as const;
    cache(edited, replacedPrevious, toDisplay, getLbs);
    expect(compute).toHaveBeenCalledTimes(6);

    const nextDisplay = (kg: number) => kg * 2.20462;
    cache(edited, replacedPrevious, nextDisplay, getLbs);
    expect(compute).toHaveBeenCalledTimes(8);
  });
});
