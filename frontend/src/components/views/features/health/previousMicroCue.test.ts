import { describe, expect, it } from 'vitest';
import type { CardioSet, StrengthSet, WorkoutSet } from '../../../../types';
import { formatPreviousMicroCue, selectPreviousMicroCueSet } from './previousMicroCue';

const strength = (overrides: Partial<StrengthSet> = {}): StrengthSet => ({
  type: 'strength', set: 1, kg: '', reps: '', done: true, ...overrides,
});

const cardio: CardioSet = {
  type: 'cardio', set: 1, time: '10:00', distance: '', pace: '', done: true,
};

describe('Health previous workout micro cue', () => {
  it('selects the first completed usable strength set in historical order', () => {
    const first = strength({ kg: 80, reps: 8 });
    const second = strength({ set: 2, kg: 100, reps: 6 });
    expect(selectPreviousMicroCueSet([first, second], 'strength')).toBe(first);
  });

  it('skips an empty leading set and an incomplete set without switching to max semantics', () => {
    const empty = strength({ kg: '', reps: '' });
    const incomplete = strength({ set: 2, kg: 120, reps: 5, done: false });
    const chosen = strength({ set: 3, kg: 100, reps: 8 });
    expect(selectPreviousMicroCueSet([empty, incomplete, chosen], 'strength')).toBe(chosen);
  });

  it('ignores cardio rows while selecting a strength cue', () => {
    const chosen = strength({ kg: 100, reps: 8 });
    expect(selectPreviousMicroCueSet([cardio, chosen], 'strength')).toBe(chosen);
  });

  it('uses the bodyweight type and never exposes a zero-kg weight', () => {
    expect(formatPreviousMicroCue([
      strength({ type: 'bodyweight', kg: '', reps: 12 }),
    ], 'kg', 'bodyweight')).toEqual({ kind: 'bodyweight', reps: '12' });
  });

  it.each([
    ['kg source / kg display', strength({ kg: 100, reps: 8, weight_source_value: 100, weight_source_unit: 'kg' }), 'kg', '100 kg × 8'],
    ['kg source / lbs display', strength({ kg: 45.36, reps: 8, weight_source_value: 100, weight_source_unit: 'kg' }), 'lbs', '220.5 lbs × 8'],
    ['lbs source / lbs display', strength({ kg: 102.37, reps: 8, weight_source_value: 225.68, weight_source_unit: 'lbs' }), 'lbs', '225.68 lbs × 8'],
    ['lbs source / kg display', strength({ kg: 102.37, reps: 8, weight_source_value: 225.68, weight_source_unit: 'lbs' }), 'kg', '102.4 kg × 8'],
  ])('%s formats one compact source-aware cue', (_label, set, unit, expected) => {
    expect(formatPreviousMicroCue([set as StrengthSet], unit as 'kg' | 'lbs')).toEqual({
      kind: 'weighted',
      weight: expected.split(' ')[0],
      unit,
      reps: '8',
    });
    const rendered = formatPreviousMicroCue([set as StrengthSet], unit as 'kg' | 'lbs');
    expect(rendered && rendered.kind === 'weighted'
      ? `${rendered.weight} ${rendered.unit} × ${rendered.reps}`
      : '').toBe(expected);
  });

  it('cleans legacy long-decimal kg-only records in either display unit', () => {
    const legacy = strength({ kg: 102.05828325, reps: 8 });
    expect(formatPreviousMicroCue([legacy], 'kg')).toMatchObject({ weight: '102.1', unit: 'kg' });
    expect(formatPreviousMicroCue([legacy], 'lbs')).toMatchObject({ weight: '225', unit: 'lbs' });
    expect(JSON.stringify(formatPreviousMicroCue([legacy], 'lbs'))).not.toMatch(/\d+\.\d{5,}/);
  });

  it('omits unsafe missing values instead of rendering placeholders', () => {
    expect(formatPreviousMicroCue([], 'kg')).toBeNull();
    expect(formatPreviousMicroCue([strength({ kg: '', reps: 8 })], 'kg')).toBeNull();
    expect(formatPreviousMicroCue([strength({ kg: 100, reps: '' })], 'kg')).toEqual({
      kind: 'weighted', weight: '100', unit: 'kg', reps: null,
    });
    expect(formatPreviousMicroCue([strength({ kg: '', reps: 8 })], 'kg')).toBeNull();
  });

  it('updates only the display projection when the block unit toggles', () => {
    const historical = strength({ kg: 102.37, reps: 8, weight_source_value: 225.68, weight_source_unit: 'lbs' });
    const before = structuredClone(historical);
    expect(formatPreviousMicroCue([historical], 'lbs')).toMatchObject({ weight: '225.68', unit: 'lbs' });
    expect(formatPreviousMicroCue([historical], 'kg')).toMatchObject({ weight: '102.4', unit: 'kg' });
    expect(historical).toEqual(before);
  });
});
