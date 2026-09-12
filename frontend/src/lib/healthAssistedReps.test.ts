import { describe, expect, it } from 'vitest';
import type { StrengthSet } from '../types';
import {
  ASSISTED_REPS_VALIDATION_ERROR,
  fillAssistedRepsTemplate,
  formatWorkoutSummaryStrengthSetLine,
  getAssistedRepsBreakdown,
  hasValidDurableAssistedReps,
  normalizeAssistedRepsForSave,
  supportsAssistedReps,
  unassistedRepsForComparison,
} from './healthAssistedReps';

const strength = (overrides: Partial<StrengthSet> = {}): StrengthSet => ({
  type: 'strength', set: 1, kg: 100, reps: 12, done: true, ...overrides,
});

describe('Health assisted repetitions', () => {
  it('is absent by default and excludes cardio from eligibility', () => {
    expect(getAssistedRepsBreakdown(strength())).toBeNull();
    expect(normalizeAssistedRepsForSave(strength())).not.toHaveProperty('assisted_reps');
    expect(supportsAssistedReps(strength())).toBe(true);
    expect(supportsAssistedReps({ type: 'cardio', set: 1, time: '', distance: '', pace: '', done: false })).toBe(false);
  });

  it('derives valid and all-assisted breakdowns without changing total reps', () => {
    expect(getAssistedRepsBreakdown(strength({ assisted_reps: 4 })))
      .toEqual({ total: 12, assisted: 4, unassisted: 8 });
    expect(getAssistedRepsBreakdown(strength({ reps: 4, assisted_reps: 4 })))
      .toEqual({ total: 4, assisted: 4, unassisted: 0 });
  });

  it('omits empty and zero draft values', () => {
    expect(normalizeAssistedRepsForSave(strength({ assisted_reps: '' }))).not.toHaveProperty('assisted_reps');
    expect(normalizeAssistedRepsForSave(strength({ assisted_reps: '0' }))).not.toHaveProperty('assisted_reps');
  });

  it.each([
    { assisted_reps: -1 },
    { assisted_reps: 1.5 },
    { reps: 4, assisted_reps: 5 },
    { reps: 'invalid', assisted_reps: 1 },
  ])('rejects an invalid durable relationship: %o', values => {
    expect(() => normalizeAssistedRepsForSave(strength(values)))
      .toThrow(ASSISTED_REPS_VALIDATION_ERROR);
  });

  it('canonicalizes a valid draft string to a durable number', () => {
    expect(normalizeAssistedRepsForSave(strength({ assisted_reps: '4' })))
      .toMatchObject({ reps: 12, assisted_reps: 4 });
  });

  it('requires a numeric durable assisted field', () => {
    expect(hasValidDurableAssistedReps(strength({ assisted_reps: 4 }))).toBe(true);
    expect(hasValidDurableAssistedReps(strength({ assisted_reps: '4' }))).toBe(false);
    expect(hasValidDurableAssistedReps(strength())).toBe(true);
  });

  it('orders assisted sets by derived unassisted reps and legacy sets by total reps', () => {
    expect(unassistedRepsForComparison(strength({ reps: 10, assisted_reps: 4 }))).toBe(6);
    expect(unassistedRepsForComparison(strength({ reps: 8 }))).toBe(8);
  });

  it('formats localized breakdown primitives', () => {
    expect(fillAssistedRepsTemplate('{unassisted} + {assisted} assisted', { unassisted: 8, assisted: 4 }))
      .toBe('8 + 4 assisted');
  });

  it('keeps an ordinary summary unchanged and formats an assisted bodyweight split', () => {
    expect(formatWorkoutSummaryStrengthSetLine({
      set: strength({ reps: 8 }), weight: '100kg', bodyweightLabel: 'BW',
      assistedTemplate: '{unassisted} + {assisted}A',
    })).toBe('   Set 1  100kg × 8reps');
    expect(formatWorkoutSummaryStrengthSetLine({
      set: strength({ type: 'bodyweight', kg: '', assisted_reps: 4 }), weight: '-', bodyweightLabel: 'BW',
      assistedTemplate: '{unassisted} + {assisted}A',
    })).toBe('   Set 1  BW × 8 + 4A');
  });
});
