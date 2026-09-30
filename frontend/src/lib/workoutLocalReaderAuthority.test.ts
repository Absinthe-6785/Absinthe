import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF,
  readEstablishedWorkoutDeviceId, readOrCreateDeviceId,
} from './workoutLocalReaderAuthority';

const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CREATED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function storageWith(deviceId: string | null) {
  const values = new Map<string, string>();
  if (deviceId !== null) values.set(HEALTH_ROUTINE_DEVICE_ID_KEY, deviceId);
  const getItem = vi.fn((key: string) => values.get(key) ?? null);
  const setItem = vi.fn((key: string, value: string) => { values.set(key, value); });
  return { storage: { getItem, setItem } as unknown as Storage, values, setItem };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pure Workout local reader authority', () => {
  it('preserves the existing public constant and helper exports as the same authority', async () => {
    const sync = await import('./healthRoutineSync');
    const selectedDay = await import('./workoutSelectedDayReader');
    expect(sync.HEALTH_ROUTINE_DEVICE_ID_KEY).toBe(HEALTH_ROUTINE_DEVICE_ID_KEY);
    expect(sync.HEALTH_ROUTINE_PROJECT_REF).toBe(HEALTH_ROUTINE_PROJECT_REF);
    expect(sync.HEALTH_ROUTINE_GENERATION_ID).toBe(HEALTH_ROUTINE_GENERATION_ID);
    expect(sync.readOrCreateDeviceId).toBe(readOrCreateDeviceId);
    expect(selectedDay.readEstablishedWorkoutDeviceId).toBe(readEstablishedWorkoutDeviceId);
  });

  it('reuses an established device without writing or generating an identity', () => {
    const randomUUID = vi.fn();
    vi.stubGlobal('crypto', { randomUUID });
    const { storage, setItem } = storageWith(DEVICE);
    expect(readEstablishedWorkoutDeviceId(storage)).toBe(DEVICE);
    expect(readOrCreateDeviceId(storage)).toBe(DEVICE);
    expect(setItem).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it.each(['malformed', ''])('fails closed on existing reader identity %j without rewriting', deviceId => {
    const randomUUID = vi.fn();
    vi.stubGlobal('crypto', { randomUUID });
    const { storage, values, setItem } = storageWith(deviceId);
    expect(() => readEstablishedWorkoutDeviceId(storage)).toThrow('workout_selected_day_device_id_invalid');
    expect(values.get(HEALTH_ROUTINE_DEVICE_ID_KEY)).toBe(deviceId);
    expect(setItem).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('creates a missing identity once and invokes randomUUID with its receiver', () => {
    const cryptoEnvironment = {
      randomUUID: vi.fn(function (this: unknown) {
        expect(this).toBe(cryptoEnvironment);
        return CREATED;
      }),
    };
    vi.stubGlobal('crypto', cryptoEnvironment);
    const { storage, values, setItem } = storageWith(null);
    expect(readEstablishedWorkoutDeviceId(storage)).toBe(CREATED);
    expect(values.get(HEALTH_ROUTINE_DEVICE_ID_KEY)).toBe(CREATED);
    expect(readEstablishedWorkoutDeviceId(storage)).toBe(CREATED);
    expect(cryptoEnvironment.randomUUID).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps the original sync helper repair behavior separate from fail-closed readers', () => {
    const randomUUID = vi.fn(() => CREATED);
    vi.stubGlobal('crypto', { randomUUID });
    const { storage, values } = storageWith('malformed');
    expect(readOrCreateDeviceId(storage)).toBe(CREATED);
    expect(values.get(HEALTH_ROUTINE_DEVICE_ID_KEY)).toBe(CREATED);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
