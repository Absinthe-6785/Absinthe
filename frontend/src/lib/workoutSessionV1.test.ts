import { describe, expect, it } from 'vitest';
import { canonicalPayloadJson } from './localDatabase/canonicalPayload';
import {
  WORKOUT_SESSION_V1_MAX_BYTES,
  normalizeAssistedRepetitionsInput,
  normalizeCardioDurationInput,
  normalizeDecimalInput,
  normalizeKilometersToMeters,
  normalizeRepetitionInput,
  normalizeWeightInput,
  normalizeWorkoutCardioMode,
  validateWorkoutSessionV1,
  type WorkoutSessionV1,
} from './workoutSessionV1';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const ENTRY_ID = '22222222-2222-4222-8222-222222222222';
const SET_ID = '33333333-3333-4333-8333-333333333333';
const SET_ID_2 = '44444444-4444-4444-8444-444444444444';

function strengthSet(overrides: Record<string, unknown> = {}) {
  return {
    id: SET_ID,
    ordinal: 1,
    kind: 'strength',
    loadKind: 'external_weight',
    weightKg: '10.5',
    sourceValue: '10.5',
    sourceUnit: 'kg',
    reps: 8,
    assistedReps: null,
    dropset: false,
    done: true,
    ...overrides,
  };
}

function session(overrides: Partial<WorkoutSessionV1> = {}): WorkoutSessionV1 {
  return {
    version: 1,
    id: SESSION_ID,
    localDate: '2026-09-23',
    entries: [{
      id: ENTRY_ID,
      exercise: { id: 'catalog-squat', name: 'Squat', type: 'strength', tags: ['LEGS'], cardioMode: null },
      sets: [strengthSet() as WorkoutSessionV1['entries'][number]['sets'][number]],
    }],
    ...overrides,
  };
}

describe('WorkoutSessionV1 canonical model', () => {
  it('accepts canonical decimals and validates decimal scale and spelling', () => {
    for (const value of ['0', '0.01', '0.05', '0.5', '1', '1.25', '10.5', '99999.99']) {
      validateWorkoutSessionV1(session({ entries: [{
        id: ENTRY_ID,
        exercise: { id: null, name: '', type: 'strength', tags: [], cardioMode: null },
        sets: [strengthSet({ weightKg: value, sourceValue: value }) as WorkoutSessionV1['entries'][number]['sets'][number]],
      }] }));
    }
    for (const value of ['00', '00.5', '01.5', '1.', '1.0', '1.20', '0.0', '-0', '-1', '+1', '1e3', '1E3', '.5', 'NaN', 'Infinity']) {
      expect(() => validateWorkoutSessionV1(session({ entries: [{
        id: ENTRY_ID,
        exercise: { id: null, name: '', type: 'strength', tags: [], cardioMode: null },
        sets: [strengthSet({ weightKg: value, sourceValue: value }) as WorkoutSessionV1['entries'][number]['sets'][number]],
      }] }))).toThrow('workout_session_invalid');
    }
    expect(() => validateWorkoutSessionV1(session({ entries: [{
      id: ENTRY_ID,
      exercise: { id: null, name: '', type: 'strength', tags: [], cardioMode: null },
      sets: [strengthSet({ weightKg: 1.25, sourceValue: 1.25 }) as WorkoutSessionV1['entries'][number]['sets'][number]],
    }] }))).toThrow('workout_session_invalid');
  });

  it('normalizes decimal input without floating-point authority', () => {
    const accepted: Array<[string, string]> = [
      ['0.0', '0'], ['1.0', '1'], ['01.50', '1.5'], ['0.50', '0.5'], ['-0', '0'],
      ['1.234', '1.23'], ['1.235', '1.24'],
    ];
    for (const [input, expected] of accepted) expect(normalizeDecimalInput(input, 2)).toBe(expected);
    for (const rejected of ['-0.01', '+1', '1e3', '1,25', ' 1', '1 ']) {
      expect(() => normalizeDecimalInput(rejected, 2)).toThrow('workout_session_invalid');
    }
  });

  it('converts lbs to kg with exact HALF_UP behavior at and around ties', () => {
    expect(normalizeWeightInput('500000.00', 'lbs')).toEqual({
      sourceValue: '500000', sourceUnit: 'lbs', weightKg: '226796.19',
    });
    expect(normalizeWeightInput('499999.99', 'lbs').weightKg).toBe('226796.18');
    expect(normalizeWeightInput('500000.01', 'lbs').weightKg).toBe('226796.19');
    expect(normalizeWeightInput('01.50', 'kg')).toEqual({ sourceValue: '1.5', sourceUnit: 'kg', weightKg: '1.5' });
    expect(normalizeWeightInput('', 'lbs')).toEqual({ sourceValue: null, sourceUnit: null, weightKg: null });
    expect(() => normalizeWeightInput('-1', 'kg')).toThrow('workout_session_invalid');
  });

  it('converts km to meters by exact decimal shift and rejects excess meter precision', () => {
    expect(normalizeKilometersToMeters('0.5')).toBe('500');
    expect(normalizeKilometersToMeters('0.000001')).toBe('0.001');
    expect(normalizeKilometersToMeters('1.2500')).toBe('1250');
    expect(() => normalizeKilometersToMeters('0.0000001')).toThrow('workout_session_invalid');
    expect(() => normalizeKilometersToMeters('-0.1')).toThrow('workout_session_invalid');
  });

  it('normalizes repetitions, assisted repetitions, and cardio time using safe integers', () => {
    expect(normalizeRepetitionInput('0008')).toBe(8);
    expect(normalizeRepetitionInput('')).toBeNull();
    expect(normalizeRepetitionInput('-0')).toBe(0);
    expect(normalizeRepetitionInput(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => normalizeRepetitionInput(String(BigInt(Number.MAX_SAFE_INTEGER) + 1n))).toThrow('workout_session_invalid');
    expect(normalizeAssistedRepetitionsInput('0', 8)).toBeNull();
    expect(normalizeAssistedRepetitionsInput('4', 8)).toBe(4);
    expect(() => normalizeAssistedRepetitionsInput('9', 8)).toThrow('workout_session_invalid');

    expect(normalizeCardioDurationInput('5')).toBe(300);
    expect(normalizeCardioDurationInput('130')).toBe(90);
    expect(normalizeCardioDurationInput('10000')).toBe(3600);
    expect(normalizeCardioDurationInput('1:30')).toBe(90);
    expect(normalizeCardioDurationInput('1:30:45')).toBe(5445);
    expect(normalizeCardioDurationInput('')).toBeNull();
    expect(() => normalizeCardioDurationInput('1:60')).toThrow('workout_session_invalid');
  });

  it('strictly validates IDs, order, snapshots, and load-kind shapes', () => {
    expect(() => validateWorkoutSessionV1(session({ localDate: '2026-02-30' }))).toThrow('workout_session_invalid');
    expect(() => validateWorkoutSessionV1(session({ entries: [{
      id: ENTRY_ID,
      exercise: { id: null, name: 'Bike', type: 'cardio', tags: [], cardioMode: null },
      sets: [],
    }] }))).toThrow('workout_session_invalid');
    expect(() => validateWorkoutSessionV1(session({ entries: [{
      id: ENTRY_ID,
      exercise: { id: null, name: 'Pull-up', type: 'bodyweight', tags: [], cardioMode: null },
      sets: [{
        id: SET_ID, ordinal: 1, kind: 'bodyweight', loadKind: 'bodyweight', reps: 8,
        assistedReps: 2, dropset: false, done: true, weightKg: '5',
      }] as never,
    }] }))).toThrow('workout_session_invalid');
    expect(() => validateWorkoutSessionV1(session({ entries: [{
      id: ENTRY_ID,
      exercise: { id: null, name: 'Squat', type: 'strength', tags: [], cardioMode: null },
      sets: [strengthSet({ ordinal: 2 }) as WorkoutSessionV1['entries'][number]['sets'][number]],
    }] }))).toThrow('workout_session_invalid');
    expect(() => validateWorkoutSessionV1(session({ entries: [{
      id: ENTRY_ID,
      exercise: { id: null, name: 'Squat', type: 'strength', tags: [], cardioMode: null },
      sets: [strengthSet({ sourceValue: null, sourceUnit: null, weightKg: '1' }) as WorkoutSessionV1['entries'][number]['sets'][number]],
    }] }))).toThrow('workout_session_invalid');
    expect(normalizeWorkoutCardioMode('cardio', undefined)).toBe('both');
    expect(normalizeWorkoutCardioMode('strength', 'both')).toBeNull();
  });

  it('allows IDs and order to remain stable while values and array order change', () => {
    const before = session();
    const firstSet = before.entries[0]!.sets[0]!;
    const secondSet = { ...firstSet, id: SET_ID_2, ordinal: 2 };
    const secondEntry = {
      id: '55555555-5555-4555-8555-555555555555',
      exercise: { id: null, name: 'Pull-up', type: 'bodyweight' as const, tags: [], cardioMode: null },
      sets: [{
        id: '66666666-6666-4666-8666-666666666666', ordinal: 1, kind: 'bodyweight' as const,
        loadKind: 'bodyweight' as const, reps: 4, assistedReps: null, dropset: false, done: true,
      }],
    };
    const changed: WorkoutSessionV1 = {
      ...before,
      entries: [secondEntry, { ...before.entries[0]!, sets: [
        { ...secondSet, ordinal: 1 },
        { ...firstSet, done: false, ordinal: 2 },
      ] }],
    };
    validateWorkoutSessionV1(changed);
    expect(changed.id).toBe(before.id);
    expect(changed.entries[0]!.id).toBe(secondEntry.id);
    expect(changed.entries[1]!.id).toBe(before.entries[0]!.id);
    expect(changed.entries[1]!.sets.map(set => set.id)).toEqual([SET_ID_2, SET_ID]);
  });

  it('enforces the canonical payload UTF-8 byte limit rather than JS string length', () => {
    const emptyName = session({ entries: [{
      id: ENTRY_ID,
      exercise: { id: null, name: '', type: 'strength', tags: [], cardioMode: null },
      sets: [],
    }] });
    const baseBytes = new TextEncoder().encode(canonicalPayloadJson(emptyName)).byteLength;
    const exact = {
      ...emptyName,
      entries: [{ ...emptyName.entries[0]!, exercise: {
        ...emptyName.entries[0]!.exercise,
        name: 'x'.repeat(WORKOUT_SESSION_V1_MAX_BYTES - baseBytes),
      } }],
    };
    validateWorkoutSessionV1(exact);
    expect(new TextEncoder().encode(canonicalPayloadJson(exact)).byteLength).toBe(WORKOUT_SESSION_V1_MAX_BYTES);
    const tooLarge = {
      ...exact,
      entries: [{ ...exact.entries[0]!, exercise: { ...exact.entries[0]!.exercise, name: `${exact.entries[0]!.exercise.name}한` } }],
    };
    expect(() => validateWorkoutSessionV1(tooLarge)).toThrow('workout_session_invalid');
  });
});
