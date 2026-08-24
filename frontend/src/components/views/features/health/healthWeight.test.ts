import { describe, expect, it } from 'vitest';
import type { StrengthSet } from '../../../../types';
import {
  canonicalWeightKg,
  editableWeightValue,
  formatSavedWeight,
  normalizeStrengthSetForSave,
  roundWeightSource,
} from './healthWeight';

const strength = (overrides: Partial<StrengthSet> = {}): StrengthSet => ({
  type: 'strength', set: 1, kg: '', reps: '8', done: true, ...overrides,
});

describe('Health weight source precision', () => {
  it('rounds saved source values numerically to two decimals', () => {
    expect(roundWeightSource(100)).toBe(100);
    expect(roundWeightSource(100.1)).toBe(100.1);
    expect(roundWeightSource(100.124)).toBe(100.12);
    expect(roundWeightSource(100.125)).toBe(100.13);
    expect(roundWeightSource(100.129)).toBe(100.13);
  });

  it('normalizes kg saves without restricting active input precision', () => {
    const editing = strength({ kg: '102.34567', weight_input_raw: '102.34567', weight_input_unit: 'kg' });
    expect(editing.weight_input_raw).toBe('102.34567');
    expect(normalizeStrengthSetForSave(editing, 'kg', true)).toMatchObject({
      kg: 102.35, weight_source_value: 102.35, weight_source_unit: 'kg',
    });
  });

  it('normalizes lbs saves and derives stable canonical kg', () => {
    const saved = normalizeStrengthSetForSave(
      strength({ kg: '102.365821', weight_input_raw: '225.678', weight_input_unit: 'lbs' }),
      'lbs',
      true,
    );
    expect(saved).toMatchObject({ weight_source_value: 225.68, weight_source_unit: 'lbs' });
    expect(saved.kg).toBe(canonicalWeightKg(225.68, 'lbs'));
  });

  it('uses source values for alternate display and does not drift on toggles', () => {
    const saved = normalizeStrengthSetForSave(
      strength({ kg: '102.365821', weight_input_raw: '225.678', weight_input_unit: 'lbs' }),
      'lbs',
      true,
    );
    expect(formatSavedWeight(saved, 'lbs')).toBe('225.68');
    expect(formatSavedWeight(saved, 'kg')).toBe('102.4');
    expect(formatSavedWeight(saved, 'lbs')).toBe('225.68');
  });

  it('rounds kg to one decimal when displayed as lbs', () => {
    const saved = normalizeStrengthSetForSave(
      strength({ kg: '100', weight_input_raw: '100', weight_input_unit: 'kg' }),
      'kg',
      true,
    );
    expect(formatSavedWeight(saved, 'lbs')).toBe('220.5');
  });

  it('cleans legacy long-decimal kg display without fabricating source metadata', () => {
    const legacy = strength({ kg: 102.365821 });
    expect(formatSavedWeight(legacy, 'kg')).toBe('102.4');
    expect(formatSavedWeight(legacy, 'lbs')).toBe('225.7');
    expect(normalizeStrengthSetForSave(legacy, 'kg')).toEqual(legacy);
  });

  it('preserves raw draft input while editing', () => {
    const draft = strength({ kg: '102.34567', weight_input_raw: '102.34567', weight_input_unit: 'kg' });
    expect(editableWeightValue(draft, 'kg')).toBe('102.34567');
    expect(normalizeStrengthSetForSave(draft, 'kg')).toMatchObject({ weight_source_value: 102.35 });
  });

  it('keeps an untouched source when only the display unit changes', () => {
    const saved = strength({ kg: 102.37, weight_source_value: 225.68, weight_source_unit: 'lbs' });
    expect(normalizeStrengthSetForSave(saved, 'kg')).toEqual(saved);
    expect(formatSavedWeight(saved, 'kg')).toBe('102.4');
    expect(formatSavedWeight(saved, 'lbs')).toBe('225.68');
  });

  it('clears source metadata when an edited weight is intentionally emptied', () => {
    const cleared = normalizeStrengthSetForSave(
      strength({ kg: '', weight_source_value: 225.68, weight_source_unit: 'lbs', weight_input_raw: '', weight_input_unit: 'lbs' }),
      'lbs',
      true,
    );
    expect(cleared).not.toHaveProperty('weight_source_value');
    expect(cleared).not.toHaveProperty('weight_source_unit');
    expect(cleared.kg).toBe('');
  });

  it('does not invent or discard bodyweight source semantics', () => {
    const bodyweight = strength({ type: 'bodyweight', kg: '', reps: 8 });
    expect(normalizeStrengthSetForSave(bodyweight, 'kg', true)).toEqual(bodyweight);
    const existing = strength({ type: 'bodyweight', kg: 80, reps: 8, weight_source_value: 176.37, weight_source_unit: 'lbs' });
    expect(normalizeStrengthSetForSave(existing, 'kg', false)).toEqual(existing);
  });
});
