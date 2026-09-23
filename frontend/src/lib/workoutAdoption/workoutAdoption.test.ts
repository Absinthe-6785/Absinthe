import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDormantLocalDatabaseCapability, openLocalDatabase, LOCAL_DATABASE_STORES,
  type LocalDatabaseNamespace, type LocalDatabaseRepository,
} from '../localDatabase';
import { WorkoutSessionRepository } from '../workoutSessionRepository';
import { HEALTH_LOCAL_DATABASE_NAME, IndexedDbLocalHealthDriver,
  type HealthWorkoutAdoptionCapture } from '../healthLocalRepository';
import { HEALTH_RECOVERY_DATASETS } from '../healthRecoveryExport';
import { buildWorkoutAdoptionSnapshot } from './source';
import { runDormantWorkoutAdoption } from './index';

const T0 = '2026-09-23T00:00:00.000Z';
const namespace: LocalDatabaseNamespace = {
  userId: 'account-g3', projectRef: 'project-g3', deviceId: 'desktop-edge',
  generationId: 'generation-g3', schemaVersion: 1,
};
const capability = createDormantLocalDatabaseCapability('test');
const opened: LocalDatabaseRepository[] = [];
const drivers: IndexedDbLocalHealthDriver[] = [];

async function repo(factory = new IDBFactory(), scope = namespace): Promise<LocalDatabaseRepository> {
  const database = await openLocalDatabase(scope, { capability, indexedDBFactory: factory, clock: () => T0 });
  opened.push(database);
  await database.initializeNamespace();
  return database;
}

function row(id: string, exact = false, date = '2026-09-23'): Record<string, unknown> {
  return {
    id, user_id: namespace.userId, date, block_id: 'block-1', sort_order: 0,
    sets: [{ type: 'strength', set: 1, kg: 10, reps: 8, assisted_reps: 2,
      weight_source_value: 10, weight_source_unit: 'kg', done: true }],
    ...(exact ? {
      session_boundary: { version: 1, kind: 'single-row', sourceSessionId: `source-session-${id}` },
      historical_exercise_snapshot: { id: 'block-1', name: 'Historical Squat', type: 'strength',
        tags: ['LEGS'], cardioMode: null },
    } : {}),
  };
}

function capture(rows: Record<string, unknown>[], catalogName = 'Current Squat'): HealthWorkoutAdoptionCapture {
  return {
    accountId: namespace.userId, sourceSchemaVersion: 1,
    importState: {
      accountId: namespace.userId, status: 'VERIFIED_IMPORT_COMPLETE', importedAt: T0,
      sourceFileSha256: 'a'.repeat(64), sourceContentSha256: 'b'.repeat(64), sourceExportedAt: T0,
      totalRowCount: rows.length + 1,
      datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [
        name, name === 'workout_logs' ? rows.length : name === 'exercise_blocks' ? 1 : 0,
      ])) as never,
      diagnostics: {} as never,
    },
    workouts: rows.map(value => ({
      storageKey: `${namespace.userId}:workout_logs:${value.id}`, accountId: namespace.userId, record: value,
    })),
    exerciseBlocks: [{
      storageKey: `${namespace.userId}:exercise_blocks:block-1`, accountId: namespace.userId,
      record: { id: 'block-1', user_id: namespace.userId, name: catalogName,
        type: 'strength', tags: ['CURRENT'], cardio_mode: null },
    }],
  };
}

function driverFor(source: HealthWorkoutAdoptionCapture): IndexedDbLocalHealthDriver {
  return { captureWorkoutAdoptionSource: async () => structuredClone(source) } as IndexedDbLocalHealthDriver;
}

afterEach(() => {
  for (const value of opened.splice(0)) value.close();
  for (const value of drivers.splice(0)) value.close();
});

describe('REL-05G3 dormant workout adoption', () => {
  it('orders Unicode source keys by stable code-point order, not browser locale', () => {
    const source = capture([row('한'), row('Z'), row('a')]);
    const first = buildWorkoutAdoptionSnapshot(source, 'source-instance');
    const reversed = structuredClone(source);
    reversed.workouts.reverse();
    const second = buildWorkoutAdoptionSnapshot(reversed, 'source-instance');
    expect(first.sourceSnapshotDigest).toBe(second.sourceSnapshotDigest);
    expect(first.items.map(item => item.sourceReference)).toEqual([
      `${namespace.userId}:workout_logs:Z`,
      `${namespace.userId}:workout_logs:a`,
      `${namespace.userId}:workout_logs:한`,
    ]);
  });

  it('keeps current source rows review-required, with deterministic evidence independent of enumeration order', async () => {
    const database = await repo();
    const input = capture([row('a'), row('b')]);
    const first = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(input),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const reversed = structuredClone(input);
    reversed.workouts.reverse();
    const second = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(reversed),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(first.manifestId).toBe(second.manifestId);
    expect(second.status).toBe('COMPLETED');
    expect(second.counts.AMBIGUOUS_REVIEW).toBe(2);
    expect((await database.listWorkoutAdoptionItems(first.manifestId)).map(item => item.reason))
      .toEqual(['session_boundary_unproven', 'session_boundary_unproven']);
    expect(await database.listEntities({ domain: 'health_workout_session' })).toEqual([]);
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 0 });
  });

  it('preallocates stable UUIDs and atomically commits entity, unbound outbox, and item', async () => {
    const database = await repo();
    const source = capture([row('exact', true)]);
    const first = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(source),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const [item] = await database.listWorkoutAdoptionItems(first.manifestId);
    expect(item.classification).toBe('ADOPTABLE');
    expect(item.state).toBe('VERIFIED');
    expect(item.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
    expect(item.candidate?.entries[0]?.exercise.name).toBe('Historical Squat');
    const entity = await database.getEntity('health_workout_session', item.sessionId!);
    const outbox = await database.getOutboxRecord(item.outboxMutationId!);
    expect(entity?.migrationProvenance).toMatchObject({ migrationSessionId: first.manifestId,
      legacyKeyDigest: item.sourceKeyDigest });
    expect(outbox?.deliveryBinding).toEqual({ version: 1, state: 'unbound' });
    const second = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(source),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(second).toEqual(first);
    expect((await database.listWorkoutAdoptionItems(first.manifestId))[0]?.sessionId).toBe(item.sessionId);
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 1 });
  });

  it('resumes allocated identities after each atomic write abort', async () => {
    const database = await repo();
    const source = capture([row('crash', true)]);
    const instance = (await import('../localDatabase/canonicalPayload')).hashCanonicalPayload([
      'workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME,
    ]);
    const snapshot = buildWorkoutAdoptionSnapshot(source, instance);
    const sealed = await database.sealWorkoutAdoptionSnapshot(snapshot, T0);
    const allocated = (await database.listWorkoutAdoptionItems(sealed.manifestId))[0]!;
    for (const boundary of ['after_entity', 'after_outbox', 'after_item'] as const) {
      await expect(database.commitWorkoutAdoptionItem(sealed.manifestId, allocated.sourceKeyDigest, boundary)).rejects.toThrow();
      expect(await database.getEntity('health_workout_session', allocated.sessionId!)).toBeNull();
      expect((await database.listWorkoutAdoptionItems(sealed.manifestId))[0]?.state).toBe('ALLOCATED');
    }
    const committed = await database.commitWorkoutAdoptionItem(sealed.manifestId, allocated.sourceKeyDigest);
    expect(committed.sessionId).toBe(allocated.sessionId);
    await expect(database.completeWorkoutAdoption(sealed.manifestId, true)).rejects.toThrow();
    expect((await database.listWorkoutAdoptionItems(sealed.manifestId))[0]?.state).toBe('COMMITTED');
    await database.completeWorkoutAdoption(sealed.manifestId);
    expect((await database.listWorkoutAdoptionItems(sealed.manifestId))[0]?.state).toBe('VERIFIED');
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 1 });
  });

  it('detects changed source, catalog drift, and malformed values without altering completed evidence', async () => {
    const database = await repo();
    const firstSource = capture([row('old')]);
    const first = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(firstSource),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const changed = capture([row('old'), row('new')], 'Renamed Catalog');
    const second = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(changed),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(second.manifestId).not.toBe(first.manifestId);
    expect(second.counts.CHANGED_SOURCE_REVIEW).toBe(1);
    expect((await database.getWorkoutAdoptionSession(first.manifestId))?.sourceSnapshotDigest)
      .toBe(first.sourceSnapshotDigest);
    const bad = row('invalid');
    (bad.sets as Record<string, unknown>[])[0]!.reps = 'bad';
    const third = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(capture([bad])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(third.counts.INVALID_ACCOUNTED).toBe(1);
  });

  it('carries forward only completed same-source evidence with an intact adopted target', async () => {
    const database = await repo();
    const first = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true)])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const [original] = await database.listWorkoutAdoptionItems(first.manifestId);
    const second = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true), row('new-review')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const carried = (await database.listWorkoutAdoptionItems(second.manifestId))
      .find(item => item.sourceReference === original!.sourceReference);
    expect(carried).toMatchObject({ classification: 'CARRIED_FORWARD', priorManifestId: first.manifestId });
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 1 });

    const workouts = new WorkoutSessionRepository(database, () => T0);
    await workouts.updateWorkoutSession(original!.sessionId!, 1, {
      ...original!.candidate!, localDate: '2026-09-24',
    });
    const third = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true), row('new-review'), row('another')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const reviewed = (await database.listWorkoutAdoptionItems(third.manifestId))
      .find(item => item.sourceReference === original!.sourceReference);
    expect(reviewed).toMatchObject({ classification: 'CHANGED_SOURCE_REVIEW', reason: 'prior_target_changed' });
  });

  it('treats Desktop Edge and late iOS Home Screen stores independently, without payload dedupe', async () => {
    const desktop = await repo(new IDBFactory(), namespace);
    const mobile = await repo(new IDBFactory(), { ...namespace, deviceId: 'ios-home-screen' });
    const desktopResult = await runDormantWorkoutAdoption({ database: desktop,
      healthDriver: driverFor(capture([row('A'), row('B'), row('C')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const mobileResult = await runDormantWorkoutAdoption({ database: mobile,
      healthDriver: driverFor(capture([row('B-like'), row('C-like'), row('D')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(desktopResult.manifestId).not.toBe(mobileResult.manifestId);
    expect(desktopResult.sourceRowCount).toBe(3);
    expect(mobileResult.sourceRowCount).toBe(3);
    expect((await mobile.listWorkoutAdoptionItems(mobileResult.manifestId)).every(item => item.priorManifestId === null)).toBe(true);
  });

  it('fails closed on account and active-generation changes', async () => {
    const factory = new IDBFactory();
    const database = await repo(factory);
    await expect(runDormantWorkoutAdoption({ database, healthDriver: driverFor(capture([row('a')])),
      authenticatedAccountId: 'account-other' })).rejects.toThrow('account_mismatch');
    const instance = (await import('../localDatabase/canonicalPayload')).hashCanonicalPayload([
      'workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME,
    ]);
    const sealed = await database.sealWorkoutAdoptionSnapshot(buildWorkoutAdoptionSnapshot(capture([row('exact', true)]), instance), T0);
    const item = (await database.listWorkoutAdoptionItems(sealed.manifestId))[0]!;
    await database.createGeneration('generation-next', 'test');
    await database.activateGeneration('generation-next');
    await expect(database.commitWorkoutAdoptionItem(sealed.manifestId, item.sourceKeyDigest)).rejects.toThrow();
    expect(await database.getEntity('health_workout_session', item.sessionId!)).toBeNull();
  });

  it('rejects foreign source evidence and detects later modification of a completed target', async () => {
    const database = await repo();
    const foreign = capture([row('foreign')]);
    foreign.workouts[0]!.record.user_id = 'account-other';
    const foreignResult = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(foreign),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(foreignResult.counts.INVALID_ACCOUNTED).toBe(1);
    expect((await database.listWorkoutAdoptionItems(foreignResult.manifestId))[0]?.ownership).toBe('UNATTRIBUTABLE');
    const otherAccount = await repo(new IDBFactory(), { ...namespace, userId: 'account-other' });
    const instance = (await import('../localDatabase/canonicalPayload')).hashCanonicalPayload([
      'workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME,
    ]);
    await expect(otherAccount.sealWorkoutAdoptionSnapshot(
      buildWorkoutAdoptionSnapshot(capture([row('a')]), instance), T0,
    )).rejects.toThrow();
    const completed = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('exact', true)])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const item = (await database.listWorkoutAdoptionItems(completed.manifestId))[0]!;
    const workouts = new WorkoutSessionRepository(database, () => T0);
    await workouts.updateWorkoutSession(item.sessionId!, 1, {
      ...item.candidate!, localDate: '2026-09-24',
    });
    await expect(database.completeWorkoutAdoption(completed.manifestId)).rejects.toThrow();
  });

  it('keeps catalog drift/missing blocks and invalid measurements as separate review evidence', async () => {
    const database = await repo();
    const renamed = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('no-history')], 'Renamed Today')),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const first = (await database.listWorkoutAdoptionItems(renamed.manifestId))[0]!;
    expect(first.historicalExerciseEvidence.name).toBe('CURRENT_CATALOG_DERIVED');
    expect(first.classification).toBe('AMBIGUOUS_REVIEW');
    const missing = capture([row('missing')]);
    missing.exerciseBlocks.length = 0;
    const missingResult = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(missing),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect((await database.listWorkoutAdoptionItems(missingResult.manifestId))[0]?.historicalExerciseEvidence.name)
      .toBe('MISSING');
    for (const [field, value] of [['kg', 'bad'], ['reps', 'bad'], ['assisted_reps', 99],
      ['weight_source_unit', 'stone']] as const) {
      const invalid = row(`invalid-${field}`, true);
      (invalid.sets as Record<string, unknown>[])[0]![field] = value;
      const result = await runDormantWorkoutAdoption({ database,
        healthDriver: driverFor(capture([invalid])), authenticatedAccountId: namespace.userId, now: () => T0 });
      expect(result.counts.INVALID_ACCOUNTED).toBe(1);
    }
  });

  it('upgrades v5 to v6 additively without clearing old stores', async () => {
    const factory = new IDBFactory();
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('absinthe-local-v2', 5);
      request.onupgradeneeded = () => {
        for (const name of Object.values(LOCAL_DATABASE_STORES)) {
          if (name === LOCAL_DATABASE_STORES.workoutAdoptionSessions
            || name === LOCAL_DATABASE_STORES.workoutAdoptionItems) continue;
          request.result.createObjectStore(name, { keyPath: name === 'database_meta' ? 'namespaceKey' : 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const preservedStores = Object.values(LOCAL_DATABASE_STORES).filter(name =>
      name !== LOCAL_DATABASE_STORES.databaseMeta
      && name !== LOCAL_DATABASE_STORES.workoutAdoptionSessions
      && name !== LOCAL_DATABASE_STORES.workoutAdoptionItems);
    const oldTx = old.transaction(preservedStores, 'readwrite');
    for (const name of preservedStores) {
      oldTx.objectStore(name).put({ id: `preserve-${name}`, value: name });
    }
    await new Promise<void>((resolve, reject) => { oldTx.oncomplete = () => resolve(); oldTx.onerror = () => reject(oldTx.error); });
    old.close();
    const database = await openLocalDatabase(namespace, { capability, indexedDBFactory: factory });
    opened.push(database);
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('absinthe-local-v2', 6);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(upgraded.objectStoreNames.contains('workout_adoption_sessions')).toBe(true);
    expect(upgraded.objectStoreNames.contains('workout_adoption_items')).toBe(true);
    const tx = upgraded.transaction(preservedStores, 'readonly');
    const retained = await Promise.all(preservedStores.map(name =>
      new Promise<unknown>((resolve, reject) => {
        const request = tx.objectStore(name).get(`preserve-${name}`);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })));
    preservedStores.forEach((name, index) => {
      expect(retained[index]).toEqual({ id: `preserve-${name}`, value: name });
    });
    upgraded.close();
  });

  it('captures legacy Health rows in one readonly transaction without repairing pending imports', async () => {
    const factory = new IDBFactory();
    const driver = await IndexedDbLocalHealthDriver.open({ indexedDBFactory: factory });
    drivers.push(driver);
    await driver.putRecord('workout_logs', namespace.userId, row('local'));
    await driver.putRecord('exercise_blocks', namespace.userId, {
      id: 'block-1', user_id: namespace.userId, name: 'Current Squat', type: 'strength', tags: [], cardio_mode: null,
    });
    await expect(driver.captureWorkoutAdoptionSource(namespace.userId)).rejects.toThrow('source_unstable');
    const raw = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(HEALTH_LOCAL_DATABASE_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = raw.transaction('health_recovery_state', 'readwrite');
    tx.objectStore('health_recovery_state').put(capture([row('local')]).importState);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    const before = await driver.readDatasets(namespace.userId);
    const captured = await driver.captureWorkoutAdoptionSource(namespace.userId);
    const after = await driver.readDatasets(namespace.userId);
    expect(after).toEqual(before);
    expect(captured.workouts).toHaveLength(1);
    raw.close();
  });
});
