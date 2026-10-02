import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  LocalDatabaseError, type LocalDatabaseRepository,
} from './localDatabase';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID,
  HEALTH_ROUTINE_PROJECT_REF } from './healthRoutineSync';
import { WorkoutSessionRepository, WORKOUT_SESSION_DOMAIN } from './workoutSessionRepository';
import { WorkoutRangeReader } from './workoutRangeReader';
import type { WorkoutSessionV1 } from './workoutSessionV1';

const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_DEVICE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const accountId = 'reader-account';
const storage = new Map<string, string>();
const storageAdapter = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
} as Storage;
const opened: LocalDatabaseRepository[] = [];

function session(id: string, localDate: string): WorkoutSessionV1 {
  return { version: 1, id, localDate, entries: [{
    id: '33333333-3333-4333-8333-333333333333',
    exercise: { id: 'old-squat', name: 'Frozen Squat', type: 'strength', tags: [], cardioMode: null },
    sets: [{ id: '44444444-4444-4444-8444-444444444444', ordinal: 1,
      kind: 'strength', loadKind: 'external_weight', weightKg: '10', sourceValue: '10',
      sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false, done: true }],
  }] };
}

async function seed(): Promise<LocalDatabaseRepository> {
  const db = await openLocalDatabase({ userId: accountId, projectRef: HEALTH_ROUTINE_PROJECT_REF,
    deviceId: DEVICE, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
  { capability: createDormantLocalDatabaseCapability('range-reader-test') });
  opened.push(db);
  await db.initializeNamespace();
  return db;
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  storage.clear();
  storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
});
afterEach(() => {
  opened.splice(0).forEach(closeLocalDatabase);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('dormant Workout range reader', () => {
  it('scans one active domain once, keeps both same-day sessions and excludes tombstones', async () => {
    const db = await seed();
    const writer = new WorkoutSessionRepository(db);
    await writer.createWorkoutSession(session(A, '2026-09-29'));
    await writer.createWorkoutSession(session(B, '2026-09-29'));
    await writer.deleteWorkoutSession(B, 1);
    const list = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const query = vi.spyOn(WorkoutSessionRepository.prototype, 'queryWorkoutSessionsByLocalDate');
    const reader = await WorkoutRangeReader.open(accountId, storageAdapter);
    expect(reader.scope).toMatchObject({ accountId, deviceId: DEVICE,
      namespaceKey: db.namespaceKey, generationId: HEALTH_ROUTINE_GENERATION_ID });
    expect((await reader.readAllActive()).map(row => row.entityId)).toEqual([A]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
    reader.close();
    reader.close();
  });

  it('preserves exact frozen V1 entry/set identities and two sessions on one date', async () => {
    const db = await seed();
    const writer = new WorkoutSessionRepository(db);
    await writer.createWorkoutSession(session(A, '2026-09-29'));
    await writer.createWorkoutSession(session(B, '2026-09-29'));
    const reader = await WorkoutRangeReader.open(accountId, storageAdapter);
    const records = await reader.readAllActive();
    expect(records).toHaveLength(2);
    expect(records[0]?.session.entries[0]?.exercise.name).toBe('Frozen Squat');
    expect(records[0]?.session.entries[0]?.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(records[0]?.session.entries[0]?.sets[0]?.id).toBe('44444444-4444-4444-8444-444444444444');
    expect(records[0]?.localRevision).toBe(1);
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0]?.session.entries[0]?.exercise)).toBe(true);
    reader.close();
  });

  it('fails closed on a malformed established device ID without rewriting it', async () => {
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, 'malformed');
    await expect(WorkoutRangeReader.open(accountId, storageAdapter))
      .rejects.toThrow('workout_selected_day_device_id_invalid');
    expect(storage.get(HEALTH_ROUTINE_DEVICE_ID_KEY)).toBe('malformed');
  });

  it.each([
    ['account', { ownerId: 'other-account' }, 'ACCOUNT_MISMATCH'],
    ['namespace', { namespaceKey: 'other-namespace' }, 'NAMESPACE_MISMATCH'],
    ['generation', { generationId: 'other-generation' }, 'GENERATION_MISMATCH'],
    ['revision', { localRevision: 3 }, 'workout_range_canonical_envelope_invalid'],
    ['domain', { domain: 'notes' }, 'workout_range_canonical_envelope_invalid'],
    ['tombstone', { isDeleted: true, deletedAt: '2026-09-29T00:00:00.000Z' },
      'workout_range_canonical_envelope_invalid'],
  ])('rejects invalid %s envelope instead of dropping it', async (_label, patch, code) => {
    const db = await seed();
    await new WorkoutSessionRepository(db).createWorkoutSession(session(A, '2026-09-29'));
    const [entity] = await db.listEntities<WorkoutSessionV1>({ domain: WORKOUT_SESSION_DOMAIN });
    vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions')
      .mockResolvedValue([{ ...entity!, ...patch }]);
    const reader = await WorkoutRangeReader.open(accountId, storageAdapter);
    await expect(reader.readAllActive()).rejects.toThrow(code);
    reader.close();
  });

  it.each([undefined, 'INVALID_ENTITY'] as const)(
    'does not blanket-promote generic corruption with detail %s to isolation', async detail => {
      await seed();
      const error = new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'list_entities', detail);
      vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions').mockRejectedValue(error);
      const reader = await WorkoutRangeReader.open(accountId, storageAdapter);
      await expect(reader.readAllActive()).rejects.toBe(error);
      reader.close();
    },
  );

  it('fences a device transition while the domain list is in flight', async () => {
    await seed();
    let resolveList!: (value: Awaited<ReturnType<WorkoutSessionRepository['listWorkoutSessions']>>) => void;
    vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions')
      .mockImplementation(() => new Promise(resolve => { resolveList = resolve; }));
    const reader = await WorkoutRangeReader.open(accountId, storageAdapter);
    const load = reader.readAllActive();
    await vi.waitFor(() => expect(resolveList).toBeTypeOf('function'));
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, OTHER_DEVICE);
    resolveList([]);
    await expect(load).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    reader.close();
  });
});
