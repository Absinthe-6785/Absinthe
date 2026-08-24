import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../../types';
import {
  buildPreviousWorkoutHistoryProjection,
  type PreviousWorkoutHistoryProjectionInput,
} from './previousWorkoutProjection';
import type { PreviousWorkoutHistoryRow } from './previousWorkoutSession';

const set = (kg: number): WorkoutSet => ({ type: 'strength', set: 1, kg, reps: 8, done: true });

function row(date: string, blockId: string, sortOrder = 0): PreviousWorkoutHistoryRow {
  return {
    date,
    blockId,
    exerciseBlock: { id: blockId, name: blockId, type: 'strength', tags: [] },
    sets: [set(50)],
    sortOrder,
    rowId: `${date}-${blockId}`,
  };
}

function project(overrides: Partial<PreviousWorkoutHistoryProjectionInput> = {}) {
  return buildPreviousWorkoutHistoryProjection({
    rows: [row('2026-08-17', 'monday'), row('2026-08-21', 'friday')],
    referenceDate: '2026-08-24',
    selectedDate: null,
    ...overrides,
  });
}

describe('previous workout history projection', () => {
  it('returns an empty projection for empty history', () => {
    expect(project({ rows: [] })).toEqual({
      sessions: [],
      automaticDate: null,
      effectiveDate: null,
      session: null,
    });
  });

  it('projects one eligible prior date as one coherent session', () => {
    const result = project({ rows: [row('2026-08-21', 'friday')] });
    expect(result.sessions.map(session => session.date)).toEqual(['2026-08-21']);
    expect(result.automaticDate).toBe('2026-08-21');
    expect(result.effectiveDate).toBe('2026-08-21');
    expect(result.session?.rows.map(item => item.blockId)).toEqual(['friday']);
  });

  it('keeps multiple historical dates newest first', () => {
    const result = project({ rows: [row('2026-08-18', 'older'), row('2026-08-21', 'newer')] });
    expect(result.sessions.map(session => session.date)).toEqual(['2026-08-21', '2026-08-18']);
  });

  it('prefers the prior same-weekday recommendation', () => {
    expect(project().automaticDate).toBe('2026-08-17');
  });

  it('falls back to the most recent eligible date without a same-weekday match', () => {
    expect(project({ rows: [row('2026-08-18', 'tuesday'), row('2026-08-21', 'friday')] }).automaticDate)
      .toBe('2026-08-21');
  });

  it('lets a valid manual selection override the automatic date', () => {
    const result = project({ selectedDate: '2026-08-21' });
    expect(result.effectiveDate).toBe('2026-08-21');
    expect(result.session?.date).toBe('2026-08-21');
  });

  it('falls back when the manual selection is not in the eligible history', () => {
    const result = project({ selectedDate: '2026-08-10' });
    expect(result.effectiveDate).toBe('2026-08-17');
    expect(result.session?.date).toBe('2026-08-17');
  });

  it('excludes current and future rows through the existing session helper', () => {
    const result = project({
      rows: [row('2026-08-23', 'prior'), row('2026-08-24', 'current'), row('2026-08-25', 'future')],
    });
    expect(result.sessions.map(session => session.date)).toEqual(['2026-08-23']);
  });

  it('is deterministic for identical inputs', () => {
    const input: PreviousWorkoutHistoryProjectionInput = {
      rows: [row('2026-08-17', 'a', 1), row('2026-08-17', 'b', 0)],
      referenceDate: '2026-08-24',
      selectedDate: null,
    };
    expect(buildPreviousWorkoutHistoryProjection(input)).toEqual(buildPreviousWorkoutHistoryProjection(input));
  });

  it('returns a session belonging to exactly the effective date', () => {
    const result = project({ selectedDate: '2026-08-21' });
    expect(result.session?.rows.every(row => row.date === result.effectiveDate)).toBe(true);
  });
});
