import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrengthSet, Workout } from '../types';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryDatasets } from './healthRecoveryExport';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LocalDatabaseRepository,
} from './localDatabase';
import {
  HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF,
} from './workoutLocalReaderAuthority';
import { WorkoutRangeReader } from './workoutRangeReader';
import { WorkoutSessionRepository } from './workoutSessionRepository';
import type { WorkoutSessionV1 } from './workoutSessionV1';
import { CompositeWorkoutReadIsolationError } from '../components/views/features/health/compositeWorkoutReadProjection';
import { WorkoutReadSnapshotCoordinator } from '../components/views/features/health/verifiedWorkoutRangeSnapshot';
import { deleteHealthWorkout, saveHealthWorkouts } from '../components/views/features/health/healthWorkoutPersistence';
import { WorkoutExerciseComparisonOwner, type WorkoutExerciseComparisonPublication } from './workoutExerciseComparisonOwner';
import type { ExerciseComparisonKey, WorkoutExerciseComparisonResult } from './workoutExerciseComparisonProjection';

const mocks = vi.hoisted(() => ({ readAll: vi.fn() }));
vi.mock('./healthLocalRuntime', async importOriginal => ({
  ...await importOriginal<typeof import('./healthLocalRuntime')>(),
  createLocalHealthRepository: vi.fn(async (account: string) => ({ readAll: () => mocks.readAll(account) })),
}));

const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_DEVICE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key: ExerciseComparisonKey = { id: 'squat', name: 'Squat', type: 'strength' };
const date = '2026-10-02';
const uuid = (n: number) => `${n.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
const storage = new Map<string, string>();
const adapter = { getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); } } as Storage;
const databases: LocalDatabaseRepository[] = [];
const coordinators: WorkoutReadSnapshotCoordinator[] = [];

function datasets(account = 'a', patch: Partial<StrengthSet> = {}, localDate = '2026-09-30') {
  const value = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
  value.workout_logs.push({ id: 'legacy-row', user_id: account, date: localDate,
    block_id: key.id, sort_order: 0, sets: [{ type: 'strength', set: 1, kg: 20, reps: 8, done: true, ...patch }] });
  return value;
}

async function seed(account = 'a', exercise = key): Promise<LocalDatabaseRepository> {
  const db = await openLocalDatabase({ userId: account, projectRef: HEALTH_ROUTINE_PROJECT_REF,
    deviceId: DEVICE, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
  { capability: createDormantLocalDatabaseCapability('comparison-owner-test') });
  databases.push(db);
  await db.initializeNamespace();
  const session: WorkoutSessionV1 = { version: 1, id: uuid(1), localDate: '2026-09-30', entries: [{
    id: uuid(2), exercise: { id: exercise.id, name: exercise.name!, type: 'strength', tags: [], cardioMode: null },
    sets: [{ id: uuid(3), ordinal: 1, kind: 'strength', loadKind: 'external_weight', weightKg: '20',
      sourceValue: '20', sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false, done: true }],
  }] };
  await new WorkoutSessionRepository(db).createWorkoutSession(session);
  return db;
}

function pair(account = 'a') {
  const coordinator = new WorkoutReadSnapshotCoordinator(account, adapter);
  coordinators.push(coordinator);
  const view = new WorkoutExerciseComparisonOwner(coordinator);
  view.setContext({ enabled: true, selectedDate: date });
  return { coordinator, view };
}

async function ready() {
  const db = await seed();
  const owner = pair();
  await owner.coordinator.load();
  return { db, ...owner };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function read(publication: WorkoutExerciseComparisonPublication | null) {
  expect(publication).not.toBeNull();
  const consume = vi.fn<(result: WorkoutExerciseComparisonResult) => void>();
  expect(await publication!.publish(consume)).toBe(true);
  expect(consume).toHaveBeenCalledTimes(1);
  return consume.mock.calls[0]![0];
}

async function rejected(publication: WorkoutExerciseComparisonPublication) {
  const consume = vi.fn();
  expect(await publication.publish(consume)).toBe(false);
  expect(consume).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  storage.clear(); storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
  mocks.readAll.mockReset().mockImplementation(async (account: string) => datasets(account));
});
afterEach(() => {
  coordinators.splice(0).forEach(owner => owner.close());
  databases.splice(0).forEach(closeLocalDatabase);
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('dormant comparison view over the actual shared paired coordinator', () => {
  it('constructs disabled, installs no listeners, reads nothing, and has no current publication', async () => {
    const list = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const add = vi.fn(); vi.stubGlobal('window', { addEventListener: add });
    const coordinator = new WorkoutReadSnapshotCoordinator('a', adapter); coordinators.push(coordinator);
    const view = new WorkoutExerciseComparisonOwner(coordinator);
    expect(await view.derive(key)).toBeNull();
    view.setContext({ enabled: true, selectedDate: date });
    expect(await view.derive(key)).toBeNull();
    expect(mocks.readAll).not.toHaveBeenCalled(); expect(list).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('derives and publishes real canonical and adapted legacy facts as an immutable DTO', async () => {
    const { view } = await ready();
    const exercise = { ...key };
    const publication = await view.derive(exercise);
    exercise.id = 'changed-after-derive';
    const result = await read(publication);
    expect(result).toMatchObject({ status: 'complete', scope: { accountId: 'a', selectedDate: date, exercise: key },
      legacy: { observations: [{ origin: { rowId: 'legacy-row' } }] },
      canonical: { observations: [{ origin: { sessionId: uuid(1), entryId: uuid(2), setId: uuid(3) } }] } });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.status === 'complete') {
      expect(Object.isFrozen(result.scope.exercise)).toBe(true);
      if (result.canonical.status === 'success') expect(Object.isFrozen(result.canonical.observations[0]?.origin)).toBe(true);
    }
    expect(publication).not.toHaveProperty('result');
    expect(publication).not.toHaveProperty('snapshot');
    expect(publication).not.toHaveProperty('repository');
  });

  it('shares one full load across concurrent exercises, dates and independently removable views', async () => {
    await seed();
    const list = vi.spyOn(WorkoutSessionRepository.prototype, 'listWorkoutSessions');
    const canonical = vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive');
    const open = vi.spyOn(WorkoutRangeReader, 'open');
    const { coordinator, view } = pair();
    await coordinator.load();
    const [a, b] = await Promise.all([view.derive(key), view.derive({ ...key, id: 'bench' })]);
    await read(a); await read(b); await read(a); // B does not supersede A's separate key.
    view.setContext({ enabled: true, selectedDate: '2026-10-03' });
    await read(await view.derive(key));
    const another = new WorkoutExerciseComparisonOwner(coordinator);
    another.setContext({ enabled: true, selectedDate: date });
    await read(await another.derive(key));
    another.close();
    await read(await view.derive(key));
    expect(mocks.readAll).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1); expect(canonical).toHaveBeenCalledTimes(1); expect(open).toHaveBeenCalledTimes(1);
    // Scope metadata checks are required; they are not additional Workout scans.
  });

  it.each(['account', 'invalidate', 'close', 'retry'] as const)('revokes a settled DTO through shared %s', async action => {
    const { coordinator, view } = await ready();
    const publication = (await view.derive(key))!;
    if (action === 'account') coordinator.setAccount('b');
    if (action === 'invalidate') coordinator.invalidate();
    if (action === 'close') coordinator.close();
    const retry = action === 'retry' ? coordinator.retry() : null;
    expect(publication.isCurrent()).toBe(false); // before any reload continuation
    await rejected(publication);
    if (retry) {
      await retry;
      await rejected(publication);
      await read(await view.derive(key));
    }
  });

  it('fences account A -> B -> A and a delayed first-A load without reviving evidence', async () => {
    const { coordinator, view } = await ready();
    await seed('b');
    const oldA = (await view.derive(key))!;
    const gate = deferred<HealthRecoveryDatasets>();
    mocks.readAll.mockImplementationOnce(() => gate.promise);
    const pendingA = coordinator.load();
    coordinator.setAccount('b'); await coordinator.load();
    coordinator.setAccount('a'); await coordinator.load();
    gate.resolve(datasets());
    expect(await pendingA).toBeNull();
    await rejected(oldA);
    expect((await read(await view.derive(key)))).toMatchObject({ scope: { accountId: 'a' } });
  });

  it('fences late account-A derivation after A -> B -> A while preserving the new snapshot', async () => {
    const { coordinator, view } = await ready();
    await seed('b');
    const gate = deferred<boolean>();
    vi.spyOn(coordinator, 'verifyCurrentScope').mockReturnValueOnce(gate.promise);
    const old = view.derive(key);
    coordinator.setAccount('b'); await coordinator.load();
    coordinator.setAccount('a'); const latest = await coordinator.load();
    gate.resolve(true);
    expect(await old).toBeNull();
    expect(coordinator.currentSnapshot).toBe(latest);
    await read(await view.derive(key));
  });

  it('supersedes same-exercise R1 with R2, including late successful verification', async () => {
    const { coordinator, view } = await ready();
    const gate = deferred<boolean>();
    vi.spyOn(coordinator, 'verifyCurrentScope').mockReturnValueOnce(gate.promise);
    const first = view.derive(key);
    const second = await view.derive(key);
    await read(second);
    gate.resolve(true);
    expect(await first).toBeNull();
    await read(second);
  });

  it('cannot publish a settled old request after a newer request takes ownership', async () => {
    const { view } = await ready();
    const first = (await view.derive(key))!;
    await read(await view.derive(key));
    expect(first.isCurrent()).toBe(false);
    await rejected(first);
  });

  it.each(['date', 'dateABA', 'disable', 'disableABA', 'invalidate', 'close'] as const)(
    'synchronously revokes view publications on %s without closing the shared owner', async action => {
      const { coordinator, view } = await ready();
      const source = coordinator.currentSnapshot;
      const old = (await view.derive(key))!;
      if (action === 'date' || action === 'dateABA') view.setContext({ enabled: true, selectedDate: '2026-10-03' });
      if (action === 'dateABA') view.setContext({ enabled: true, selectedDate: date });
      if (action === 'disable' || action === 'disableABA') view.setContext({ enabled: false, selectedDate: date });
      if (action === 'disableABA') view.setContext({ enabled: true, selectedDate: date });
      if (action === 'invalidate') view.invalidate();
      if (action === 'close') view.close();
      expect(old.isCurrent()).toBe(false);
      await rejected(old);
      expect(coordinator.currentSnapshot).toBe(source);
      if (action === 'close' || action === 'disable') expect(await view.derive(key)).toBeNull();
      else await read(await view.derive(key));
    },
  );

  it('fences Date A -> B -> A during pending derive and during pending publication', async () => {
    const { coordinator, view } = await ready();
    const gate = deferred<boolean>();
    vi.spyOn(coordinator, 'verifyCurrentScope').mockReturnValueOnce(gate.promise);
    const pending = view.derive(key);
    view.setContext({ enabled: true, selectedDate: '2026-10-03' });
    view.setContext({ enabled: true, selectedDate: date });
    gate.resolve(true); expect(await pending).toBeNull();
    const old = (await view.derive(key))!;
    const publicationGate = deferred<boolean>();
    vi.spyOn(coordinator, 'verifyCurrentScope').mockReturnValueOnce(publicationGate.promise);
    const consume = vi.fn(); const publishing = old.publish(consume);
    view.setContext({ enabled: true, selectedDate: '2026-10-03' });
    view.setContext({ enabled: true, selectedDate: date });
    publicationGate.resolve(true);
    expect(await publishing).toBe(false); expect(consume).not.toHaveBeenCalled();
    await read(await view.derive(key));
  });

  it('revokes device evidence synchronously and does not revive it when the device string returns', async () => {
    const { coordinator, view } = await ready();
    const old = (await view.derive(key))!;
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, OTHER_DEVICE);
    expect(old.isCurrent()).toBe(false);
    storage.set(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
    expect(old.isCurrent()).toBe(false); await rejected(old);
    await coordinator.load(); await read(await view.derive(key));
  });

  it('final publication rechecks actual generation metadata after a reset-relevant transition', async () => {
    const { db, coordinator, view } = await ready();
    const old = (await view.derive(key))!;
    await db.createGeneration('generation-2', 'test'); await db.activateGeneration('generation-2');
    // isCurrent is deliberately not advertised as durable generation proof.
    await rejected(old);
    expect(coordinator.currentSnapshot).toBeNull(); expect(old.isCurrent()).toBe(false);
    await coordinator.load();
    expect(await read(await view.derive(key))).toMatchObject({ scope: { generationId: 'generation-2' } });
  });

  it('rejects late publication on shared invalidation without invalidating the newer load', async () => {
    const { coordinator, view } = await ready();
    const old = (await view.derive(key))!;
    const gate = deferred<boolean>();
    vi.spyOn(coordinator, 'verifyCurrentScope').mockReturnValueOnce(gate.promise);
    const consume = vi.fn(); const publishing = old.publish(consume);
    coordinator.invalidate(); const newer = await coordinator.load();
    gate.resolve(true);
    expect(await publishing).toBe(false); expect(consume).not.toHaveBeenCalled();
    expect(coordinator.currentSnapshot).toBe(newer);
    await read(await view.derive(key));
  });

  it.each(['save', 'delete'] as const)('actual %s persistence commit callback revokes synchronously before reload', async operation => {
    const { coordinator, view } = await ready();
    const publication = (await view.derive(key))!;
    const repository = { saveWorkouts: vi.fn(async () => [{ id: 'saved', date, version: 'v1' }]),
      deleteWorkout: vi.fn(async () => undefined) };
    const dependencies = { createLocalHealthRepository: vi.fn(async () => repository) };
    let synchronouslyInvalidated = false;
    const onLocalCommit = () => {
      coordinator.invalidate(); // same seam used by the existing shared owner's invalidateAndReload
      synchronouslyInvalidated = !publication.isCurrent();
      expect(coordinator.currentSnapshot).toBeNull();
    };
    if (operation === 'save') {
      const workout: Workout = { id: 'temp-row', block_id: key.id,
        exercise_blocks: { id: key.id, name: key.name!, type: 'strength' },
        sets: [{ type: 'strength', set: 1, kg: 20, reps: 8, done: true }] };
      await saveHealthWorkouts({ mode: 'local', accountId: 'a', date, workouts: [workout], dependencies, onLocalCommit });
    } else await deleteHealthWorkout({ mode: 'local', accountId: 'a', workoutId: 'saved', expectedVersion: 'v1', dependencies, onLocalCommit });
    expect(synchronouslyInvalidated).toBe(true); await rejected(publication);
    // No comparison-owned reload; the shared owner refreshes once.
    await coordinator.retry(); expect(mocks.readAll).toHaveBeenCalledTimes(2);
    await read(await view.derive(key));
  });

  it.each(['ACCOUNT_MISMATCH', 'NAMESPACE_MISMATCH', 'GENERATION_MISMATCH'] as const)(
    'typed %s never becomes ordinary partial evidence', async code => {
      const { coordinator, view } = await ready();
      const old = (await view.derive(key))!;
      vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive').mockRejectedValueOnce(new CompositeWorkoutReadIsolationError(code));
      await expect(coordinator.load()).rejects.toMatchObject({ code });
      expect(await view.derive(key)).toBeNull(); await rejected(old);
    },
  );

  it.each(['legacy', 'canonical', 'both', 'canonical-open'] as const)('preserves ordinary %s failure without fabricating absence', async failed => {
    await seed();
    if (failed === 'legacy' || failed === 'both') mocks.readAll.mockRejectedValue(new Error('legacy_ordinary_error'));
    if (failed === 'canonical' || failed === 'both') vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive').mockRejectedValue(new Error('canonical_ordinary_error'));
    if (failed === 'canonical-open') vi.spyOn(WorkoutRangeReader, 'open').mockRejectedValue(new Error('open_failed'));
    const { coordinator, view } = pair(); await coordinator.load();
    const result = await read(await view.derive(key));
    expect(result.status).toBe(failed === 'both' ? 'unavailable' : 'partial_data');
    expect(result.legacy?.status).toBe(failed === 'legacy' || failed === 'both' ? 'unavailable' : 'success');
    expect(result.canonical?.status).toBe(failed === 'legacy' ? 'success' : 'unavailable');
    if (failed === 'canonical-open' && result.status === 'partial_data') {
      expect(result.scope.namespaceKey).toBeNull(); expect(result.scope.generationId).toBeNull();
    }
  });

  it.each(['true', 'false', 1, 0, null, undefined, {}, [], NaN, Infinity])(
    'does not weaken the merged malformed normal/drop rule for %j', async flag => {
      await seed();
      const source = datasets('a', { is_dropset: flag } as unknown as Partial<StrengthSet>, '2026-10-01');
      source.workout_logs.push({ ...datasets().workout_logs[0]!, id: 'older' });
      mocks.readAll.mockResolvedValue(source);
      const { coordinator, view } = pair(); await coordinator.load();
      const result = await read(await view.derive(key));
      expect(result.legacy).toMatchObject({ latestEligibleDate: '2026-09-30', observations: [{ origin: { rowId: 'older' } }],
        withheldWeightClaims: 0, withheldRepetitionClaims: 0 });
    },
  );
});
