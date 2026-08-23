import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../../types';
import {
  normalizePreviousWorkoutRows,
  previousWorkoutRange,
  resolvePreviousWorkoutSession,
  type PreviousWorkoutHistoryRow,
} from './previousWorkoutSession';

const set = (kg: number): WorkoutSet => ({ type: 'strength', set: 1, kg, reps: 8, done: true });

function row(date: string, blockId: string, sortOrder: number, kg = 50): PreviousWorkoutHistoryRow {
  return {
    date,
    blockId,
    exerciseBlock: { id: blockId, name: blockId, type: 'strength', tags: [] },
    sets: [set(kg)],
    sortOrder,
    rowId: `${date}-${blockId}`,
  };
}

describe('previous workout session resolution', () => {
  it('requires the previous session to be strictly earlier than the reference date', () => {
    const session = resolvePreviousWorkoutSession([
      row('2026-08-24', 'today', 0),
      row('2026-08-31', 'future', 0),
    ], '2026-08-24');

    expect(session).toBeNull();
  });

  it('selects the most recent earlier matching weekday across skipped weeks', () => {
    const session = resolvePreviousWorkoutSession([
      row('2026-08-03', 'old-monday', 0),
      row('2026-08-17', 'recent-monday', 0),
      row('2026-08-23', 'sunday', 0),
    ], '2026-08-24');

    expect(session?.date).toBe('2026-08-17');
    expect(session?.matchStrategy).toBe('weekday');
  });

  it('keeps one coherent date and never combines per-exercise dates', () => {
    const session = resolvePreviousWorkoutSession([
      row('2026-08-17', 'first', 1),
      row('2026-08-17', 'second', 0),
      row('2026-08-10', 'different-date', 0),
    ], '2026-08-24');

    expect(session?.rows.map(item => item.blockId)).toEqual(['second', 'first']);
    expect(new Set(session?.rows.map(item => item.date))).toEqual(new Set(['2026-08-17']));
  });

  it('preserves stored exercise order and historical set values', () => {
    const session = resolvePreviousWorkoutSession([
      { ...row('2026-08-17', 'press', 1, 70), sets: [set(70), { ...set(65), set: 2 }] },
      row('2026-08-17', 'squat', 0, 100),
    ], '2026-08-24');

    expect(session?.rows[0]?.blockId).toBe('squat');
    expect(session?.rows[1]?.sets.map(item => item.kg)).toEqual([70, 65]);
  });

  it('returns an empty result instead of synthesizing unrelated history', () => {
    expect(resolvePreviousWorkoutSession([
      row('2026-08-17', 'monday', 0),
    ], '2026-08-25')).toBeNull();
  });

  it('normalizes the existing remote range response with historical block fallback', () => {
    const rows = normalizePreviousWorkoutRows([
      {
        id: 'remote-1',
        date: '2026-08-17',
        block_id: 'renamed-block',
        sort_order: 2,
        sets: [{ type: 'cardio', set: 1, time: '20:00', distance: '3', pace: '6:40', done: true }],
        exercise_blocks: null,
        exercise_name: 'Old Rowing Name',
      },
      { date: 'not-a-date', block_id: 'ignored', sets: [] },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-08-17',
      blockId: 'renamed-block',
      sortOrder: 2,
      exerciseBlock: { name: 'Old Rowing Name' },
    });
  });

  it('provides a bounded range ending yesterday without a seven-day assumption', () => {
    expect(previousWorkoutRange('2026-08-24')).toEqual({
      startDate: '2025-08-24',
      endDate: '2026-08-23',
    });
  });
});
