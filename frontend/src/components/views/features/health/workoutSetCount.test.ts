import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '@/types';
import { plannedSetCount, buildSetsFromPrevCount } from './workoutSetCount';

describe('workoutSetCount', () => {
  it('uses today workout set count when present', () => {
    const workouts: Workout[] = [{
      id: 'w1',
      block_id: 'b1',
      exercise_blocks: { id: 'b1', name: 'Squat', type: 'strength', tags: [] },
      sets: [{ type: 'strength', set: 1, kg: '', reps: '', done: false }, { type: 'strength', set: 2, kg: '', reps: '', done: false }],
    }];
    expect(plannedSetCount('b1', workouts, {})).toBe(2);
  });

  it('falls back to previous session count', () => {
    const prev: WorkoutSet[] = [
      { type: 'strength', set: 1, kg: '100', reps: '5', done: true },
      { type: 'strength', set: 2, kg: '100', reps: '5', done: true },
      { type: 'strength', set: 3, kg: '100', reps: '5', done: true },
    ];
    expect(plannedSetCount('b1', [], { b1: { prev_sets: prev } })).toBe(3);
  });

  it('builds fresh sets matching previous count', () => {
    const prev: WorkoutSet[] = [
      { type: 'strength', set: 1, kg: '100', reps: '5', done: true },
      { type: 'strength', set: 2, kg: '100', reps: '5', done: true },
    ];
    const sets = buildSetsFromPrevCount('strength', prev);
    expect(sets).toHaveLength(2);
    expect(sets[0]?.kg).toBe('');
  });
});
