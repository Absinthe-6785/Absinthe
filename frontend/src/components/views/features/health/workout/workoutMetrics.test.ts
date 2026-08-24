import { describe, expect, it } from 'vitest';
import { countWeeklySessions, detectRecentPr, listRecentWorkoutSessions } from './workoutMetrics';
import { computeWorkoutPrBadge } from '../computeWorkoutPrBadge';

describe('workoutMetrics', () => {
  it('counts unique workout dates', () => {
    expect(countWeeklySessions([
      { date: '2026-06-10', exercise_blocks: { name: 'Squat' }, sets: [] },
      { date: '2026-06-12', exercise_blocks: { name: 'Deadlift' }, sets: [] },
    ])).toBe(2);
  });

  it('lists recent sessions with exercises', () => {
    const sessions = listRecentWorkoutSessions([
      { date: '2026-06-10', exercise_blocks: { name: 'Squat' }, sets: [] },
      { date: '2026-06-12', exercise_blocks: { name: 'Bench' }, sets: [] },
    ]);
    expect(sessions[0].date).toBe('2026-06-12');
    expect(sessions[0].exercises).toContain('Bench');
  });

  it('detects PR when today exceeds prior week max', () => {
    const pr = detectRecentPr([
      {
        date: '2026-06-10',
        exercise_blocks: { name: 'Squat' },
        sets: [{ type: 'strength', set: 1, kg: 100, reps: 5, done: true }],
      },
      {
        date: '2026-06-14',
        exercise_blocks: { name: 'Squat' },
        sets: [{ type: 'strength', set: 1, kg: 105, reps: 3, done: true }],
      },
    ], '2026-06-14');
    expect(pr).toEqual({ name: 'Squat', kg: 105 });
  });

  it('compares mixed-unit source records through canonical kg', () => {
    const pr = detectRecentPr([
      {
        date: '2026-06-10',
        exercise_blocks: { name: 'Squat' },
        sets: [{
          type: 'strength', set: 1, kg: 102.37, reps: 5, done: true,
          weight_source_value: 225.68, weight_source_unit: 'lbs',
        }],
      },
      {
        date: '2026-06-14',
        exercise_blocks: { name: 'Squat' },
        sets: [{
          type: 'strength', set: 1, kg: 102.4, reps: 5, done: true,
          weight_source_value: 102.4, weight_source_unit: 'kg',
        }],
      },
    ], '2026-06-14');
    expect(pr).toEqual({ name: 'Squat', kg: 102.4 });
  });

  it('keeps PR badge comparisons canonical when display units are rounded', () => {
    const badge = computeWorkoutPrBadge(
      {
        id: 'today', block_id: 'squat', exercise_blocks: { name: 'Squat', type: 'strength' },
        sets: [{
          type: 'strength', set: 1, kg: 100.04, reps: 5, done: true,
          weight_source_value: 100.04, weight_source_unit: 'kg',
        }],
      },
      {
        prev_sets: [{
          type: 'strength', set: 1, kg: 100, reps: 5, done: true,
          weight_source_value: 220.46, weight_source_unit: 'lbs',
        }],
        prev_date: '2026-06-10',
        pr_kg: 100,
      },
      kg => Math.round(kg * 10) / 10,
      'kg',
    );
    expect(badge?.isPR).toBe(true);
  });
});
