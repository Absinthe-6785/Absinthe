// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRoutinePlannedSetCount,
  saveRoutinePlannedSetsForDay,
  showsPlannedSetCount,
} from './routinePlannedSets';

describe('routinePlannedSets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores planned set count per routine day', () => {
    saveRoutinePlannedSetsForDay('Day 1', ['a', 'b'], { a: 4, b: 3 });
    expect(getRoutinePlannedSetCount('Day 1', 'a', 'strength')).toBe(4);
    expect(getRoutinePlannedSetCount('Day 1', 'b', 'bodyweight')).toBe(3);
  });

  it('never shows sets for cardio', () => {
    expect(showsPlannedSetCount('cardio')).toBe(false);
    expect(getRoutinePlannedSetCount('Day 1', 'run', 'cardio')).toBe(1);
  });

  it('falls back to previous session count then default', () => {
    const prev = [{ type: 'strength' as const, set: 1, kg: '', reps: '', done: false }];
    expect(getRoutinePlannedSetCount('Day 2', 'x', 'strength', prev)).toBe(1);
    expect(getRoutinePlannedSetCount('Day 2', 'y', 'strength')).toBe(3);
  });
});
