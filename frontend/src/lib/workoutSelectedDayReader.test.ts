import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository,
} from './localDatabase';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID,
  HEALTH_ROUTINE_PROJECT_REF } from './healthRoutineSync';
import { WorkoutSessionRepository } from './workoutSessionRepository';
import { WorkoutSelectedDayReader, readEstablishedWorkoutDeviceId } from './workoutSelectedDayReader';
import type { WorkoutSessionV1 } from './workoutSessionV1';

const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const accountId = 'reader-account';
const storage = new Map<string, string>();
const storageAdapter = { getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); } } as Storage;
const opened: LocalDatabaseRepository[] = [];

function session(id: string, localDate: string): WorkoutSessionV1 {
  return { version: 1, id, localDate, entries: [{
    id: '33333333-3333-4333-8333-333333333333',
    exercise: { id: 'old-squat', name: 'Frozen Squat', type: 'strength', tags: ['OLD'], cardioMode: null },
    sets: [{ id: '44444444-4444-4444-8444-444444444444', ordinal: 1, kind: 'strength',
      loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8,
      assistedReps: null, dropset: false, done: true }],
  }] };
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  storage.clear();
  storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
});
afterEach(() => {
  opened.splice(0).forEach(closeLocalDatabase);
  vi.unstubAllGlobals();
});

describe('selected-day canonical local reader', () => {
  it('does not rewrite a malformed established device identity', () => {
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, 'malformed');
    expect(() => readEstablishedWorkoutDeviceId(storageAdapter)).toThrow('workout_selected_day_device_id_invalid');
    expect(storage.get(HEALTH_ROUTINE_DEVICE_ID_KEY)).toBe('malformed');
  });

  it('opens actual K323 namespace, returns all active same-day envelopes, excludes tombstones', async () => {
    const db = await openLocalDatabase({ userId: accountId, projectRef: HEALTH_ROUTINE_PROJECT_REF,
      deviceId: DEVICE, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
    { capability: createDormantLocalDatabaseCapability('reader-test') });
    opened.push(db);
    await db.initializeNamespace();
    const writer = new WorkoutSessionRepository(db);
    await writer.createWorkoutSession(session(A, '2026-09-29'));
    await writer.createWorkoutSession(session(B, '2026-09-29'));
    const reader = await WorkoutSelectedDayReader.open(accountId, storageAdapter);
    expect(reader.scope).toMatchObject({ accountId, deviceId: DEVICE,
      namespaceKey: db.namespaceKey, generationId: HEALTH_ROUTINE_GENERATION_ID });
    expect((await reader.read('2026-09-29')).map(row => row.entityId).sort()).toEqual([A, B]);
    expect(await reader.read('2026-09-28')).toEqual([]);
    await writer.deleteWorkoutSession(B, 1);
    expect((await reader.read('2026-09-29')).map(row => row.entityId)).toEqual([A]);
    reader.close();
  });
});
