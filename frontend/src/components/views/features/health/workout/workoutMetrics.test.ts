import { describe, expect, it } from 'vitest';
import { countWeeklySessions, detectRecentPr, listRecentWorkoutSessions } from './workoutMetrics';

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
});
