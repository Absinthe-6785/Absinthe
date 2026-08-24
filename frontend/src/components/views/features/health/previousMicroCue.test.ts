import { describe, expect, it } from 'vitest';
import type { CardioSet, StrengthSet, WorkoutSet } from '../../../../types';
import {
  formatPreviousBestCue,
  formatPreviousSetReference,
  matchPreviousSetReference,
  selectPreviousBestSet,
} from './previousMicroCue';

const strength = (overrides: Partial<StrengthSet> = {}): StrengthSet => ({
  type: 'strength', set: 1, kg: '', reps: '', done: true, ...overrides,
});

const bodyweight = (overrides: Partial<StrengthSet> = {}): StrengthSet => ({
  type: 'bodyweight', set: 1, kg: '', reps: '', done: true, ...overrides,
});

const cardio: CardioSet = {
  type: 'cardio', set: 1, time: '10:00', distance: '', pace: '', done: true,
};

describe('Health previous set references', () => {
  it('selects the heaviest completed weighted set by canonical kg', () => {
    const kg = strength({ kg: 100, reps: 8, weight_source_value: 100, weight_source_unit: 'kg' });
    const lbs = strength({ set: 2, kg: 102.37, reps: 6, weight_source_value: 225.68, weight_source_unit: 'lbs' });
    expect(selectPreviousBestSet([kg, lbs])).toBe(lbs);
  });

  it('uses reps as the equal-weight tie-breaker', () => {
    const lowerReps = strength({ kg: 100, reps: 8 });
    const higherReps = strength({ set: 2, kg: 100, reps: 10 });
    expect(selectPreviousBestSet([lowerReps, higherReps])).toBe(higherReps);
  });

  it('preserves historical order when weight and reps tie', () => {
    const first = strength({ kg: 100, reps: 10 });
    const second = strength({ set: 2, kg: 100, reps: 10 });
    expect(selectPreviousBestSet([first, second])).toBe(first);
  });

  it('excludes incomplete, empty, cardio, and invalid weighted sets', () => {
    const incomplete = strength({ kg: 150, reps: 5, done: false });
    const empty = strength({ set: 2, kg: '', reps: 8 });
    const negative = strength({ set: 3, kg: -1, reps: 8 });
    const chosen = strength({ set: 4, kg: 80, reps: 12 });
    expect(selectPreviousBestSet([incomplete, empty, cardio, negative, chosen])).toBe(chosen);
  });

  it('selects the completed bodyweight set with the most reps', () => {
    const best = bodyweight({ set: 2, reps: 15 });
    expect(selectPreviousBestSet([bodyweight({ reps: 10 }), best, bodyweight({ set: 3, reps: 12 })], 'bodyweight')).toBe(best);
    expect(formatPreviousBestCue([best], 'kg', 'bodyweight')).toEqual({ kind: 'bodyweight', reps: '15' });
  });

  it.each([
    ['kg source / kg display', strength({ kg: 100, reps: 8, weight_source_value: 100, weight_source_unit: 'kg' }), 'kg', '100'],
    ['kg source / lbs display', strength({ kg: 45.36, reps: 8, weight_source_value: 100, weight_source_unit: 'kg' }), 'lbs', '220.5'],
    ['lbs source / lbs display', strength({ kg: 102.37, reps: 8, weight_source_value: 225.68, weight_source_unit: 'lbs' }), 'lbs', '225.68'],
    ['lbs source / kg display', strength({ kg: 102.37, reps: 8, weight_source_value: 225.68, weight_source_unit: 'lbs' }), 'kg', '102.4'],
  ])('%s uses the HEALTH_03 source-aware formatter', (_label, set, unit, expected) => {
    expect(formatPreviousBestCue([set as StrengthSet], unit as 'kg' | 'lbs')).toMatchObject({
      kind: 'weighted', weight: expected, unit, reps: '8',
    });
  });

  it('keeps legacy kg-only values clean and bounded', () => {
    const cue = formatPreviousBestCue([strength({ kg: 102.05828325, reps: 8 })], 'lbs');
    expect(cue).toMatchObject({ kind: 'weighted', weight: '225', unit: 'lbs', reps: '8' });
    expect(JSON.stringify(cue)).not.toMatch(/\d+\.\d{5,}/);
  });

  it('matches normal rows by stable semantic set number even when arrays are reordered', () => {
    const current = [strength({ set: 1 }), strength({ set: 2 }), strength({ set: 3 })];
    const previous = [
      strength({ set: 3, kg: 100, reps: 8 }),
      strength({ set: 1, kg: 80, reps: 12 }),
      strength({ set: 2, kg: 90, reps: 10 }),
    ];
    expect(matchPreviousSetReference(current[0], previous, 'strength', current)?.set).toBe(1);
    expect(matchPreviousSetReference(current[1], previous, 'strength', current)?.set).toBe(2);
    expect(matchPreviousSetReference(current[2], previous, 'strength', current)?.set).toBe(3);
  });

  it('falls back to compatible historical order and skips an incomplete leading set', () => {
    const current = [strength({ set: 0 }), strength({ set: 0 })];
    const previous = [
      strength({ set: 0, kg: 80, reps: 12, done: false }),
      strength({ set: 0, kg: 90, reps: 10 }),
    ];
    expect(matchPreviousSetReference(current[0], previous, 'strength', current)?.kg).toBe(90);
    expect(matchPreviousSetReference(current[1], previous, 'strength', current)).toBeNull();
  });

  it('does not repeat the final previous set for extra current rows', () => {
    const current = [1, 2, 3, 4].map(set => strength({ set }));
    const previous = [1, 2, 3].map(set => strength({ set, kg: set * 10, reps: 8 }));
    expect(matchPreviousSetReference(current[3], previous, 'strength', current)).toBeNull();
  });

  it('ignores extra previous rows when today has fewer rows', () => {
    const current = [strength({ set: 1 }), strength({ set: 2 })];
    const previous = [1, 2, 3].map(set => strength({ set, kg: set * 10, reps: 8 }));
    expect(current.map(set => matchPreviousSetReference(set, previous, 'strength', current)?.set)).toEqual([1, 2]);
  });

  it('keeps normal and drop-set references in separate compatibility groups', () => {
    const current = [
      strength({ set: 1 }),
      strength({ set: 2, is_dropset: true }),
    ];
    const previous = [
      strength({ set: 1, kg: 80, reps: 12 }),
      strength({ set: 2, kg: 50, reps: 15, is_dropset: true }),
    ];
    expect(matchPreviousSetReference(current[0], previous, 'strength', current)?.is_dropset).toBeUndefined();
    expect(matchPreviousSetReference(current[1], previous, 'strength', current)?.is_dropset).toBe(true);
  });

  it('omits an unmatched drop row rather than pairing it with a normal set', () => {
    const current = strength({ set: 1, is_dropset: true });
    const previous = [strength({ set: 1, kg: 80, reps: 12 })];
    expect(matchPreviousSetReference(current, previous)).toBeNull();
  });

  it('formats a matched set without mutating historical data', () => {
    const historical = strength({ kg: 225.68, reps: 8, weight_source_value: 225.68, weight_source_unit: 'lbs' });
    const before = structuredClone(historical);
    expect(formatPreviousSetReference(historical, 'kg')).toEqual({ kind: 'weighted', weight: '102.4', unit: 'kg', reps: '8' });
    expect(historical).toEqual(before);
  });
});
