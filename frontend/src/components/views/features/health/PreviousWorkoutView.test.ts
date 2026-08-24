import { describe, expect, it } from 'vitest';
import type { StrengthSet } from '../../../../types';
import { formatPreviousStrengthWeight } from './PreviousWorkoutView';

const formatWeight = (value: number | string): string => {
  if (value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '';
};

function strength(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return { type: 'strength', set: 1, kg: 100, reps: 8, done: true, ...overrides };
}

describe('Previous Workout strength/bodyweight display', () => {
  it('renders a stored strength value with kg', () => {
    expect(formatPreviousStrengthWeight(strength(), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('100 kg');
  });

  it('renders a converted strength value with lbs instead of kg', () => {
    expect(formatPreviousStrengthWeight(strength(), 'press', 'strength', () => '220.5', 'lbs', 'Bodyweight'))
      .toBe('220.5 lbs');
    expect(formatPreviousStrengthWeight(strength(), 'press', 'strength', () => '220.5', 'lbs', 'Bodyweight'))
      .not.toBe('220.5 kg');
  });

  it('uses the saved per-set source value for Previous display round trips', () => {
    const saved = strength({ kg: 102.37, weight_source_value: 225.68, weight_source_unit: 'lbs' });
    expect(formatPreviousStrengthWeight(saved, 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('102.4 kg');
    expect(formatPreviousStrengthWeight(saved, 'press', 'strength', formatWeight, 'lbs', 'Bodyweight'))
      .toBe('225.68 lbs');
  });

  it('uses the canonical bodyweight type instead of missing weight', () => {
    expect(formatPreviousStrengthWeight(strength({ type: 'bodyweight', kg: '' }), 'pull-up', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('Bodyweight');
  });

  it('renders missing strength weight as a dash, not bodyweight', () => {
    expect(formatPreviousStrengthWeight(strength({ kg: '' }), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('—');
    expect(formatPreviousStrengthWeight(strength({ kg: '' }), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .not.toBe('Bodyweight');
  });

  it('keeps a numeric zero strength weight numeric', () => {
    expect(formatPreviousStrengthWeight(strength({ kg: 0 }), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('0 kg');
  });
});
