import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryDatasets } from '../../../../lib/healthRecoveryExport';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository,
} from '../../../../lib/localDatabase';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID,
  HEALTH_ROUTINE_PROJECT_REF } from '../../../../lib/healthRoutineSync';
import { WorkoutRangeReader } from '../../../../lib/workoutRangeReader';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import type { WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import { previousWorkoutRange } from './previousWorkoutSession';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';
import {
  deriveWorkoutRange, projectVerifiedWorkoutRangeLegacyRows, WorkoutReadSnapshotCoordinator,
} from './verifiedWorkoutRangeSnapshot';

const mocks = vi.hoisted(() => ({ readAll: vi.fn() }));
vi.mock('../../../../lib/healthLocalRuntime', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/healthLocalRuntime')>(),
  createLocalHealthRepository: vi.fn(async (accountId: string) => ({
    readAll: () => mocks.readAll(accountId),
  })),
}));

const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_DEVICE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '55555555-5555-4555-8555-555555555555';
const storage = new Map<string, string>();
const storageAdapter = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
} as Storage;
const opened: LocalDatabaseRepository[] = [];

function datasets(): HealthRecoveryDatasets {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
}

function legacy(date = '2026-09-29', id = 'row-1', user = 'a') {
  return { id, user_id: user, date, block_id: 'squat', sort_order: 0,
    sets: [{ type: 'strength', set: 1, kg: 10, reps: 5, done: true }] };
}

function session(id: string, localDate: string): WorkoutSessionV1 {
  return { version: 1, id, localDate, entries: [{
    id: '33333333-3333-4333-8333-333333333333',
    exercise: { id: 'squat', name: 'Frozen Squat', type: 'strength', tags: [], cardioMode: null },
    sets: [{ id: '44444444-4444-4444-8444-444444444444', ordinal: 1,
      kind: 'strength', loadKind: 'external_weight', weightKg: '10', sourceValue: '10',
      sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false, done: true }],
  }] };
}

async function seed(accountId = 'a', sessions: WorkoutSessionV1[] = []): Promise<LocalDatabaseRepository> {
  const db = await openLocalDatabase({ userId: accountId, projectRef: HEALTH_ROUTINE_PROJECT_REF,
    deviceId: DEVICE, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
  { capability: createDormantLocalDatabaseCapability('range-snapshot-test') });
  opened.push(db);
  await db.initializeNamespace();
  const writer = new WorkoutSessionRepository(db);
  for (const value of sessions) await writer.createWorkoutSession(value);
  return db;
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  storage.clear();
  storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
  mocks.readAll.mockReset().mockImplementation(async () => datasets());
});
afterEach(() => {
  opened.splice(0).forEach(closeLocalDatabase);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('verified Workout range source snapshot', () => {
  it('adapts real persisted legacy rows, current catalog and truthful historical fallback', () => {
    const source = datasets();
    source.exercise_blocks.push({ id: 'squat', user_id: 'a', name: 'Current Squat', type: 'strength', tags: [] });
    source.workout_logs.push(legacy(), { ...legacy('2026-09-28', 'row-2'), block_id: 'missing',
      exercise_name: 'Historical Curl' });
    const rows = projectVerifiedWorkoutRangeLegacyRows(source, 'a');
    expect(rows).toMatchObject([
      { accountId: 'a', rowId: 'row-1', localDate: '2026-09-29', blockId: 'squat',
        sortOrder: 0, exerciseDisplay: { kind: 'current_catalog', block: { name: 'Current Squat' } } },
      { rowId: 'row-2', exerciseDisplay: { kind: 'historical_fallback', name: 'Historical Curl' } },
    ]);
    expect(rows[0]?.sets).not.toBe(source.workout_logs[0]?.sets);
  });

  it.each([
    [{ ...legacy(), id: '' }, 'workout_range_legacy_row_invalid'],
    [{ ...legacy(), date: '2026-02-30' }, 'workout_range_legacy_row_invalid'],
    [{ ...legacy(), block_id: '__session__' }, 'workout_range_legacy_row_invalid'],
    [{ ...legacy(), sort_order: -1 }, 'workout_range_legacy_row_invalid'],
    [{ ...legacy(), sets: 'bad' }, 'workout_range_legacy_row_invalid'],
  ])('poisons malformed legacy source %#', (row, code) => {
    const source = datasets();
    source.workout_logs.push(row);
    expect(() => projectVerifiedWorkoutRangeLegacyRows(source, 'a')).toThrow(code);
  });

  it('fails closed on a foreign owner and rejects duplicate source-qualified row identity', () => {
    const source = datasets();
    source.workout_logs.push(legacy('2026-09-29', 'row-1', 'b'));
    expect(() => projectVerifiedWorkoutRangeLegacyRows(source, 'a')).toThrow('ACCOUNT_MISMATCH');
    source.workout_logs.splice(0, 1, legacy(), legacy());
    expect(() => projectVerifiedWorkoutRangeLegacyRows(source, 'a'))
      .toThrow('workout_range_legacy_duplicate_identity');
  });

  it('reads both sources once and reuses them for month, Previous and single-day views', async () => {
    await seed('a', [session(A, '2026-09-29'), session(B, '2026-09-29')]);
    const source = datasets();
    source.workout_logs.push(legacy('2026-09-29', A), legacy('2026-09-28', 'row-2'),
      legacy('2026-09-29', 'row-3'));
    mocks.readAll.mockResolvedValue(source);
    const list = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const query = vi.spyOn(WorkoutSessionRepository.prototype, 'queryWorkoutSessionsByLocalDate');
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const snapshot = await coordinator.load();
    expect(snapshot?.result.status).toBe('complete');
    expect(snapshot?.scope).toMatchObject({ accountId: 'a', deviceId: DEVICE });
    const month = await coordinator.deriveRange('2026-09-01', '2026-09-30');
    const day = await coordinator.deriveRange('2026-09-29', '2026-09-29');
    const previous = previousWorkoutRange('2026-09-30');
    expect(await coordinator.deriveRange(previous.startDate, previous.endDate)).not.toBeNull();
    expect(month?.result.records).toHaveLength(5);
    expect(day?.dates).toMatchObject([{ localDate: '2026-09-29', legacyRows: [
      { legacy: { rowId: A } }, { legacy: { rowId: 'row-3' } }],
      canonicalSessions: [{ canonical: { entityId: A } }, { canonical: { entityId: B } }] }]);
    expect(day?.result.records.map(row => row.readId)).toContain(JSON.stringify(['legacy', 'a', A]));
    expect(day?.result.records.map(row => row.readId)).toContain(JSON.stringify([
      'canonical', snapshot?.scope?.namespaceKey, snapshot?.scope?.generationId, A,
    ]));
    expect(mocks.readAll).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
    expect(() => (day?.result.records as unknown as unknown[]).pop()).toThrow();
    expect((await coordinator.deriveRange('2026-09-29', '2026-09-29'))?.result.records).toHaveLength(4);
    coordinator.close();
  });

  it('uses exact inclusive semantic bounds, rejects invalid bounds and preserves complete empty', async () => {
    await seed('a', [session(A, '2026-09-01'), session(B, '2026-09-30'), session(C, '2026-10-01')]);
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const snapshot = await coordinator.load();
    expect(snapshot?.result.status).toBe('complete');
    expect((await coordinator.deriveRange('2026-09-01', '2026-09-30'))?.result.records.map(row => row.localDate))
      .toEqual(['2026-09-30', '2026-09-01']);
    expect((await coordinator.deriveRange('2026-08-01', '2026-08-31'))?.result)
      .toMatchObject({ status: 'complete', records: [] });
    expect(() => deriveWorkoutRange(snapshot!, '2026-02-30', '2026-09-30')).toThrow('workout_range_bounds_invalid');
    expect(() => deriveWorkoutRange(snapshot!, '2026-10-01', '2026-09-30')).toThrow('workout_range_bounds_invalid');
    expect(previousWorkoutRange('2024-03-01')).toEqual({ startDate: '2023-03-01', endDate: '2024-02-29' });
    coordinator.close();
  });

  it.each([
    ['legacy fails', true, false, 'partial_data', 'error', 'success'],
    ['canonical fails', false, true, 'partial_data', 'success', 'error'],
    ['both fail', true, true, 'error', 'error', 'error'],
  ])('keeps source-aware status when %s', async (_label, failLegacy, failCanonical, status, legacyStatus, canonicalStatus) => {
    await seed('a', [session(A, '2026-09-29')]);
    const source = datasets();
    source.workout_logs.push(legacy());
    mocks.readAll.mockImplementation(async () => {
      if (failLegacy) throw new Error('legacy_fail');
      return source;
    });
    if (failCanonical) vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive').mockRejectedValue(new Error('canonical_fail'));
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const snapshot = await coordinator.load();
    expect(snapshot?.result).toMatchObject({ status, legacyStatus, canonicalStatus });
    expect(snapshot?.result.records).toHaveLength(status === 'error' ? 0 : 1);
    coordinator.close();
  });

  it('does not turn either source isolation mismatch into partial data', async () => {
    await seed();
    const source = datasets();
    source.workout_logs.push(legacy('2026-09-29', 'row', 'b'));
    mocks.readAll.mockResolvedValue(source);
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    await expect(coordinator.load()).rejects.toThrow('ACCOUNT_MISMATCH');
    expect(coordinator.currentSnapshot).toBeNull();
    coordinator.close();
    mocks.readAll.mockResolvedValue(datasets());
    vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive')
      .mockRejectedValue(new CompositeWorkoutReadIsolationError('NAMESPACE_MISMATCH'));
    const second = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    await expect(second.load()).rejects.toThrow('NAMESPACE_MISMATCH');
    expect(second.currentSnapshot).toBeNull();
    second.close();
  });

  it('marks a malformed legacy source partial when canonical succeeds and permits explicit retry', async () => {
    await seed('a', [session(A, '2026-09-29')]);
    const malformed = datasets();
    malformed.workout_logs.push(legacy('2026-02-30'));
    mocks.readAll.mockResolvedValueOnce(malformed).mockResolvedValueOnce(datasets());
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    expect((await coordinator.load())?.result).toMatchObject({
      status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success',
    });
    expect((await coordinator.retry())?.result).toMatchObject({ status: 'complete' });
    expect(coordinator.currentSnapshot?.result.records).toHaveLength(1);
    coordinator.close();
  });

  it('keeps legacy records as partial when canonical open fails closed on the stored device ID', async () => {
    const source = datasets();
    source.workout_logs.push(legacy());
    mocks.readAll.mockResolvedValue(source);
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, 'malformed');
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const snapshot = await coordinator.load();
    expect(snapshot).toMatchObject({ scope: null, result: {
      status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error',
    } });
    expect(snapshot?.result.records).toHaveLength(1);
    expect(storage.get(HEALTH_ROUTINE_DEVICE_ID_KEY)).toBe('malformed');
    coordinator.close();
  });

  it('loads on the first device-open when the shared device ID must be created', async () => {
    storage.delete(HEALTH_ROUTINE_DEVICE_ID_KEY);
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const snapshot = await coordinator.load();
    expect(snapshot?.result.status).toBe('complete');
    expect(snapshot?.scope?.deviceId).toBe(storage.get(HEALTH_ROUTINE_DEVICE_ID_KEY));
    expect(await coordinator.deriveRange('2026-09-01', '2026-09-30')).not.toBeNull();
    coordinator.close();
  });

  it('invalidates in-flight L1 before late publication and retries a failed source load', async () => {
    await seed();
    let release!: (value: HealthRecoveryDatasets) => void;
    mocks.readAll.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const l1 = coordinator.load();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    coordinator.invalidate();
    const l2 = coordinator.retry();
    release(datasets());
    expect(await l1).toBeNull();
    expect((await l2)?.result.status).toBe('complete');
    expect(coordinator.currentSnapshot).not.toBeNull();
    coordinator.close();
  });

  it('fences A→B→A even when the first account string returns', async () => {
    await seed('a');
    await seed('b');
    let release!: (value: HealthRecoveryDatasets) => void;
    mocks.readAll.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const firstA = coordinator.load();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    coordinator.setAccount('b');
    expect((await coordinator.load())?.accountId).toBe('b');
    coordinator.setAccount('a');
    expect((await coordinator.load())?.accountId).toBe('a');
    release(datasets());
    expect(await firstA).toBeNull();
    expect(coordinator.currentSnapshot?.accountId).toBe('a');
    coordinator.close();
  });

  it('rejects a device change during load and does not reuse an old-device range', async () => {
    await seed();
    let release!: (value: HealthRecoveryDatasets) => void;
    mocks.readAll.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const old = coordinator.load();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, OTHER_DEVICE);
    release(datasets());
    expect(await old).toBeNull();
    expect(coordinator.currentSnapshot).toBeNull();
    expect((await coordinator.load())?.scope?.deviceId).toBe(OTHER_DEVICE);
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
    expect(await coordinator.deriveRange('2026-09-01', '2026-09-30')).toBeNull();
    coordinator.close();
  });

  it('reopens once after a final active-generation fence rejects the old load', async () => {
    const db = await seed();
    let release!: (value: HealthRecoveryDatasets) => void;
    mocks.readAll.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const list = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    const load = coordinator.load();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await list.mock.results[0]!.value;
    await db.createGeneration('generation-2', 'test');
    await db.activateGeneration('generation-2');
    release(datasets());
    expect(await load).toMatchObject({ scope: { generationId: 'generation-2' },
      result: { status: 'complete' } });
    expect(mocks.readAll).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(2);
    coordinator.close();
  });

  it('invalidates a previously loaded G1 snapshot when final publication rechecks G2', async () => {
    const db = await seed();
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    expect((await coordinator.load())?.scope?.generationId).toBe(HEALTH_ROUTINE_GENERATION_ID);
    await db.createGeneration('generation-2', 'test');
    await db.activateGeneration('generation-2');
    expect(await coordinator.verifyCurrentScope()).toBe(false);
    expect(coordinator.currentSnapshot).toBeNull();
    expect(await coordinator.deriveRange('2026-09-01', '2026-09-30')).toBeNull();
    coordinator.close();
  });

  it('does not let an old asynchronous verification invalidate a newer account snapshot', async () => {
    await seed('a');
    await seed('b');
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    await coordinator.load();
    let rejectOld!: (error: Error) => void;
    vi.spyOn(WorkoutRangeReader.prototype, 'verifyCurrentScope')
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }));
    const oldVerification = coordinator.verifyCurrentScope();
    await vi.waitFor(() => expect(rejectOld).toBeTypeOf('function'));
    coordinator.setAccount('b');
    expect((await coordinator.load())?.accountId).toBe('b');
    rejectOld(new Error('old_reader_closed'));
    expect(await oldVerification).toBe(false);
    expect(coordinator.currentSnapshot?.accountId).toBe('b');
    coordinator.close();
  });

  it('closes during a pending load and does no I/O or listener registration by construction', async () => {
    await seed();
    const add = vi.fn();
    vi.stubGlobal('window', { addEventListener: add });
    const list = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    expect(mocks.readAll).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    let release!: (value: HealthRecoveryDatasets) => void;
    mocks.readAll.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = coordinator.load();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    coordinator.close();
    release(datasets());
    expect(await pending).toBeNull();
    expect(coordinator.currentSnapshot).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('requires no network, G5A readiness, canonical writer or legacy writer', async () => {
    await seed('a', [session(A, '2026-09-29')]);
    const fetch = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetch);
    const create = vi.spyOn(WorkoutSessionRepository.prototype, 'createWorkoutSession');
    const update = vi.spyOn(WorkoutSessionRepository.prototype, 'updateWorkoutSession');
    const remove = vi.spyOn(WorkoutSessionRepository.prototype, 'deleteWorkoutSession');
    const restore = vi.spyOn(WorkoutSessionRepository.prototype, 'restoreWorkoutSession');
    const coordinator = new WorkoutReadSnapshotCoordinator('a', storageAdapter);
    expect((await coordinator.load())?.result.status).toBe('complete');
    expect(fetch).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
    coordinator.close();
  });
});
