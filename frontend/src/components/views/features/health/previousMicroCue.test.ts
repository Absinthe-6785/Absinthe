import { describe, expect, it } from 'vitest';
import type { CardioSet, StrengthSet, WorkoutSet } from '../../../../types';
import {
  createPreviousSetReferenceMatcher,
  formatPreviousBestCue,
  formatPreviousSetReference,
  matchPreviousSetReference,
  selectPreviousBestSet,
} from './previousMicroCue';

type MatchWork = { previousSlots: number; currentSlots: number; setReads: number; compatibilityReads: number };

function instrumentMatchInputs(sets: StrengthSet[], work: MatchWork, kind: 'previous' | 'current') {
  const rows = sets.map(set => new Proxy(set, {
    get(target, property, receiver) {
      if (property === 'set') work.setReads += 1;
      if (property === 'type' || property === 'is_dropset') work.compatibilityReads += 1;
      return Reflect.get(target, property, receiver);
    },
  }));
  return new Proxy(rows, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) {
        if (kind === 'previous') work.previousSlots += 1;
        else work.currentSlots += 1;
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function measureMatcher(mode: 'scan' | 'indexed') {
  const work: MatchWork = { previousSlots: 0, currentSlots: 0, setReads: 0, compatibilityReads: 0 };
  const matches: Array<number | null> = [];
  const exerciseCounts = [3, 4, 5, 6, 4, 5, 3, 4];
  for (const count of exerciseCounts) {
    const current = instrumentMatchInputs(Array.from({ length: count }, (_, i) => strength({ set: i + 1 })), work, 'current');
    const previous = instrumentMatchInputs(Array.from({ length: count }, (_, i) => strength({ set: count - i, kg: 40 + i, reps: 8 })), work, 'previous');
    const matcher = mode === 'indexed' ? createPreviousSetReferenceMatcher(previous, current, 'strength') : null;
    for (const row of current) {
      const match = matcher ? matcher.match(row) : matchPreviousSetReference(row, previous, 'strength', current);
      matches.push(match?.set ?? null);
    }
  }
  const count = 64;
  const current = instrumentMatchInputs(Array.from({ length: count }, (_, i) => strength({ set: i + 1 })), work, 'current');
  const previous = instrumentMatchInputs(Array.from({ length: count }, (_, i) => strength({ set: count - i, kg: 40 + i, reps: 8 })), work, 'previous');
  const matcher = mode === 'indexed' ? createPreviousSetReferenceMatcher(previous, current, 'strength') : null;
  for (const row of current) {
    const match = matcher ? matcher.match(row) : matchPreviousSetReference(row, previous, 'strength', current);
    matches.push(match?.set ?? null);
  }
  return { work, matches };
}

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
  it('reduces repeated scan work for multi-exercise and large set groups with identical results', () => {
    const baseline = measureMatcher('scan');
    const optimized = measureMatcher('indexed');
    expect(optimized.matches).toEqual(baseline.matches);
    expect(baseline.work).toEqual({ previousSlots: 4248, currentSlots: 4346, setReads: 32399, compatibilityReads: 42676 });
    expect(optimized.work).toEqual({ previousSlots: 98, currentSlots: 196, setReads: 980, compatibilityReads: 980 });
    expect(optimized.work.previousSlots).toBeLessThan(baseline.work.previousSlots);
    expect(optimized.work.currentSlots).toBeLessThan(baseline.work.currentSlots);
    expect(optimized.work.setReads).toBeLessThan(baseline.work.setReads);
    expect(optimized.work.compatibilityReads).toBeLessThan(baseline.work.compatibilityReads);
  });
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

  it('uses derived unassisted reps for equal-weight and bodyweight ordering', () => {
    const fullyUnassisted = strength({ kg: 100, reps: 8 });
    const assistedTotal = strength({ set: 2, kg: 100, reps: 10, assisted_reps: 4 });
    expect(selectPreviousBestSet([fullyUnassisted, assistedTotal])).toBe(fullyUnassisted);

    const bodyweightUnassisted = bodyweight({ reps: 8 });
    const bodyweightAssisted = bodyweight({ set: 2, reps: 10, assisted_reps: 4 });
    expect(selectPreviousBestSet([bodyweightUnassisted, bodyweightAssisted], 'bodyweight')).toBe(bodyweightUnassisted);
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

  it('keeps indexed matching equivalent to the scan matcher across semantic and fallback boundaries', () => {
    const scenarios: Array<{ current: WorkoutSet[]; previous: WorkoutSet[]; blockType?: string }> = [
      {
        current: [strength({ set: 1 }), strength({ set: 2 }), strength({ set: 3 })],
        previous: [strength({ set: 3, kg: 100, reps: 8 }), strength({ set: 1, kg: 80, reps: 12 }), strength({ set: 2, kg: 90, reps: 10 })],
      },
      {
        current: [strength({ set: 1 }), strength({ set: 1 }), strength({ set: 0 })],
        previous: [strength({ set: 1, kg: 70, reps: 8 }), strength({ set: 1, kg: 80, reps: 9 }), strength({ set: 0, kg: 90, reps: 10 })],
      },
      {
        current: [strength({ set: 1 }), strength({ set: 2 })],
        previous: [strength({ set: 1, kg: 0, reps: 8 }), strength({ set: 2, kg: 90, reps: 10 })],
      },
      {
        current: [strength({ set: 1 }), strength({ set: 2 })],
        previous: [strength({ set: 1, kg: 80, reps: 8, done: false }), strength({ set: 2, kg: 90, reps: 10 })],
      },
      {
        current: [strength({ set: 1 }), strength({ set: 2 }), strength({ set: 3, is_dropset: true }), bodyweight({ set: 1 })],
        previous: [
          strength({ set: 1, kg: 80, reps: 8 }), strength({ set: 2, kg: 0, reps: 10 }),
          strength({ set: 3, kg: 50, reps: 12, is_dropset: true }), bodyweight({ set: 1, reps: 14 }),
        ],
      },
      {
        current: [strength({ set: 1, reps: 10, assisted_reps: 2, weight_source_unit: 'kg' })],
        previous: [strength({ set: 1, kg: 100, reps: 12, assisted_reps: 4, weight_source_unit: 'lbs', weight_source_value: 225 })],
      },
      { current: [cardio], previous: [strength({ set: 1, kg: 80, reps: 8 })] },
    ];

    for (const scenario of scenarios) {
      const matcher = createPreviousSetReferenceMatcher(scenario.previous, scenario.current, scenario.blockType);
      const expected = scenario.current.map(set => matchPreviousSetReference(set, scenario.previous, scenario.blockType, scenario.current));
      expect(scenario.current.map(set => matcher.match(set))).toEqual(expected);
    }
  });

  it('creates fresh indexes when current sets or previous-history sources change', () => {
    const current = [strength({ set: 1 })];
    const firstPrevious = [strength({ set: 1, kg: 80, reps: 8 })];
    const nextPrevious = [strength({ set: 1, kg: 100, reps: 8 })];
    const firstMatcher = createPreviousSetReferenceMatcher(firstPrevious, current, 'strength');
    const nextMatcher = createPreviousSetReferenceMatcher(nextPrevious, current, 'strength');

    expect(firstMatcher.match(current[0])).toBe(firstPrevious[0]);
    expect(nextMatcher.match(current[0])).toBe(nextPrevious[0]);
    expect(createPreviousSetReferenceMatcher(undefined, current, 'strength').match(current[0])).toBeNull();
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

  it('formats assisted history as derived unassisted plus assisted', () => {
    expect(formatPreviousSetReference(strength({ kg: 100, reps: 12, assisted_reps: 4 }), 'kg'))
      .toEqual({ kind: 'weighted', weight: '100', unit: 'kg', reps: '8', assistedReps: '4' });
    expect(formatPreviousBestCue([bodyweight({ reps: 12, assisted_reps: 4 })], 'kg', 'bodyweight'))
      .toEqual({ kind: 'bodyweight', reps: '8', assistedReps: '4' });
  });
});
