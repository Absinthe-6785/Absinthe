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
import {
  MAX_WORKOUT_ADOPTION_BLOCK_BYTES, MAX_WORKOUT_ADOPTION_BLOCKS,
  MAX_WORKOUT_ADOPTION_ITEM_BYTES, MAX_WORKOUT_ADOPTION_ROWS,
  MAX_WORKOUT_ADOPTION_SETS, MAX_WORKOUT_ADOPTION_SNAPSHOT_BYTES,
  MAX_WORKOUT_ADOPTION_MANIFEST_BYTES,
} from './types';
import { canonicalPayloadJson, hashCanonicalPayload } from '../localDatabase/canonicalPayload';
import type { WorkoutSessionV1 } from '../workoutSessionV1';
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

async function rawDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open('absinthe-local-v2', 6);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rawPut(factory: IDBFactory, store: string, value: unknown): Promise<void> {
  const raw = await rawDatabase(factory);
  const tx = raw.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  raw.close();
}

async function rawDelete(factory: IDBFactory, store: string, key: IDBValidKey): Promise<void> {
  const raw = await rawDatabase(factory);
  const tx = raw.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  raw.close();
}

async function rawCount(factory: IDBFactory, store: string): Promise<number> {
  const raw = await rawDatabase(factory);
  const tx = raw.transaction(store, 'readonly');
  const count = await new Promise<number>((resolve, reject) => {
    const request = tx.objectStore(store).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  raw.close();
  return count;
}

// A pre-correction completed adoption fixture: G3 no longer creates ADOPTABLE rows from
// untrusted recovery extras, but dependent manifests must still verify existing target evidence.
async function seedPreviouslyAdopted(factory: IDBFactory, database: LocalDatabaseRepository, id = 'old-exact') {
  const first = await runDormantWorkoutAdoption({ database,
    healthDriver: driverFor(capture([row(id, true)])), authenticatedAccountId: namespace.userId, now: () => T0 });
  const [oldItem] = await database.listWorkoutAdoptionItems(first.manifestId);
  const sessionId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const setId = crypto.randomUUID();
  const candidate: WorkoutSessionV1 = {
    version: 1, id: sessionId, localDate: '2026-09-23', entries: [{ id: entryId,
      exercise: { id: 'block-1', name: 'Historical Squat', type: 'strength', tags: ['LEGS'], cardioMode: null },
      sets: [{ id: setId, ordinal: 1, kind: 'strength', loadKind: 'external_weight',
        weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8, assistedReps: 2,
        dropset: false, done: true }],
    }],
  };
  const created = await new WorkoutSessionRepository(database, () => T0).createWorkoutSession(candidate);
  const entity = { ...created.entity, source: { kind: 'legacy_migration', reference: first.manifestId },
    migrationProvenance: { conversionVersion: 1, sourceAdapter: 'health-local-workout-logs-v1',
      sourceSchemaVersion: 1, migrationSessionId: first.manifestId,
      sourceSnapshotDigest: first.sourceSnapshotDigest, migratedAt: T0,
      legacyKeyDigest: oldItem!.sourceKeyDigest } };
  const adopted = { ...oldItem!, classification: 'ADOPTABLE', reason: 'source_exact', state: 'VERIFIED',
    sessionId, entryIds: [entryId], setIds: [setId], candidate,
    conversionResultDigest: hashCanonicalPayload(candidate), targetEntityHash: created.entity.contentHash,
    outboxMutationId: created.outbox.mutationId, verifiedAt: T0 };
  const session = { ...first, counts: { ...first.counts, ADOPTABLE: 1, AMBIGUOUS_REVIEW: 0 },
    requiresReview: false, targetStateDigest: hashCanonicalPayload([[
      adopted.sourceKeyDigest, sessionId, created.entity.contentHash, created.outbox.mutationId, first.manifestId,
    ]]),
    itemManifestDigest: hashCanonicalPayload([first.lineageOrdinal, first.sourceCapturedAt, [[
      adopted.sourceKeyDigest, adopted.sourceItemDigest, adopted.classification, adopted.reason,
      adopted.priorManifestId, adopted.conversionResultDigest, adopted.historicalExerciseEvidence,
      [adopted.sessionId, adopted.entryIds, adopted.setIds],
    ]]]) };
  await rawPut(factory, LOCAL_DATABASE_STORES.entities, entity);
  await rawPut(factory, LOCAL_DATABASE_STORES.workoutAdoptionItems, adopted);
  await rawPut(factory, LOCAL_DATABASE_STORES.workoutAdoptionSessions, session);
  return { first: session, item: adopted, candidate, outbox: created.outbox, entity };
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

  it('rejects shape-valid recovery extras as historical authority without a trusted producer', async () => {
    const database = await repo();
    const source = capture([row('exact', true)]);
    const first = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(source),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const [item] = await database.listWorkoutAdoptionItems(first.manifestId);
    expect(item.classification).toBe('AMBIGUOUS_REVIEW');
    expect(item.reason).toBe('historical_source_provenance_unverified');
    expect(item.historicalExerciseEvidence.name).toBe('AMBIGUOUS');
    expect(item.sessionId).toBeNull();
    expect(await database.listEntities({ domain: 'health_workout_session' })).toEqual([]);
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 0 });
    const second = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(source),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(second).toEqual(first);
    expect((await database.listWorkoutAdoptionItems(first.manifestId))[0]).toEqual(item);
  });

  it('does not allow a review item to enter the canonical commit path', async () => {
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
      expect((await database.listWorkoutAdoptionItems(sealed.manifestId))[0]?.state).toBe('REVIEW_REQUIRED');
    }
    await expect(database.completeWorkoutAdoption(sealed.manifestId, true)).rejects.toThrow();
    expect((await database.getWorkoutAdoptionSession(sealed.manifestId))?.status).toBe('SEALED');
    await database.completeWorkoutAdoption(sealed.manifestId);
    expect((await database.listWorkoutAdoptionItems(sealed.manifestId))[0]?.state).toBe('REVIEW_REQUIRED');
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 0 });
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
    const factory = new IDBFactory();
    const database = await repo(factory);
    const { first, item: original, candidate } = await seedPreviouslyAdopted(factory, database);
    const second = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true), row('new-review')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const carried = (await database.listWorkoutAdoptionItems(second.manifestId))
      .find(item => item.sourceReference === original!.sourceReference);
    expect(carried).toMatchObject({ classification: 'CARRIED_FORWARD', priorManifestId: first.manifestId });
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 1 });

    const workouts = new WorkoutSessionRepository(database, () => T0);
    await workouts.updateWorkoutSession(original!.sessionId!, 1, {
      ...candidate, localDate: '2026-09-24',
    });
    await expect(database.completeWorkoutAdoption(second.manifestId)).rejects.toThrow();
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
    await expect(database.completeWorkoutAdoption(sealed.manifestId)).rejects.toThrow();
  });

  it('rejects foreign source evidence and detects later modification of a completed target', async () => {
    const factory = new IDBFactory();
    const database = await repo(factory);
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
    const { first: completed, item, candidate } = await seedPreviouslyAdopted(factory, database, 'exact');
    const workouts = new WorkoutSessionRepository(database, () => T0);
    await workouts.updateWorkoutSession(item.sessionId!, 1, {
      ...candidate, localDate: '2026-09-24',
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

  it.each(['entity_deleted', 'entity_mutated', 'outbox_deleted', 'binding_changed', 'provenance_changed',
    'outbox_payload_changed'])('rechecks carried predecessor dependency after %s', async change => {
    const factory = new IDBFactory();
    const database = await repo(factory);
    const { first, item, entity, outbox } = await seedPreviouslyAdopted(factory, database);
    const second = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true), row('another')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const carried = (await database.listWorkoutAdoptionItems(second.manifestId))
      .find(value => value.sourceKeyDigest === item.sourceKeyDigest)!;
    expect(carried).toMatchObject({ classification: 'CARRIED_FORWARD',
      priorManifestId: first.manifestId, targetProvenanceManifestId: first.manifestId,
      sessionId: item.sessionId, targetEntityHash: item.targetEntityHash, outboxMutationId: item.outboxMutationId });
    expect(second.targetStateDigest).toBe(hashCanonicalPayload([[
      item.sourceKeyDigest, item.sessionId, item.targetEntityHash, item.outboxMutationId, first.manifestId,
    ]]));
    await expect(database.completeWorkoutAdoption(second.manifestId)).resolves.toMatchObject({ status: 'COMPLETED' });
    if (change === 'entity_deleted') await rawDelete(factory, LOCAL_DATABASE_STORES.entities,
      [database.namespaceKey, namespace.generationId, 'health_workout_session', item.sessionId!]);
    if (change === 'entity_mutated') await rawPut(factory, LOCAL_DATABASE_STORES.entities,
      { ...entity, record: { ...entity.record, localDate: '2026-09-24' } });
    if (change === 'outbox_deleted') await rawDelete(factory, LOCAL_DATABASE_STORES.outbox,
      [database.namespaceKey, namespace.generationId, outbox.mutationId]);
    if (change === 'binding_changed') await rawPut(factory, LOCAL_DATABASE_STORES.outbox,
      { ...outbox, deliveryBinding: { version: 1, state: 'bound' } });
    if (change === 'provenance_changed') await rawPut(factory, LOCAL_DATABASE_STORES.entities,
      { ...entity, migrationProvenance: { ...entity.migrationProvenance, legacyKeyDigest: 'f'.repeat(64) } });
    if (change === 'outbox_payload_changed') await rawPut(factory, LOCAL_DATABASE_STORES.outbox,
      { ...outbox, payload: { kind: 'entity_snapshot', record: { ...entity.record, localDate: '2026-09-24' } } });
    await expect(database.completeWorkoutAdoption(second.manifestId)).rejects.toThrow();
  });

  it.each([
    ['deviceId', 'other-device'], ['projectRef', 'other-project'], ['sourceAdapter', 'other-adapter'],
    ['conversionVersion', 999], ['sourceImportStateDigest', 'e'.repeat(64)],
    ['itemManifestDigest', 'f'.repeat(64)], ['sourceCapturedAt', '2026-09-24T00:00:00.000Z'],
    ['createdAt', '2026-09-24T00:00:00.000Z'], ['lineageOrdinal', 99],
  ] as const)('rejects existing seal with corrupted %s', async (field, value) => {
    const factory = new IDBFactory();
    const database = await repo(factory);
    const instance = hashCanonicalPayload(['workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME]);
    const snapshot = buildWorkoutAdoptionSnapshot(capture([row('seal')]), instance);
    const sealed = await database.sealWorkoutAdoptionSnapshot(snapshot, T0);
    await rawPut(factory, LOCAL_DATABASE_STORES.workoutAdoptionSessions, { ...sealed, [field]: value });
    await expect(database.sealWorkoutAdoptionSnapshot(snapshot, T0)).rejects.toThrow('CORRUPT_PERSISTED_RECORD');
  });

  it.each(['sourceItemDigest', 'sourceKeyDigest'])('rejects existing seal with corrupted item %s', async field => {
    const factory = new IDBFactory();
    const database = await repo(factory);
    const instance = hashCanonicalPayload(['workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME]);
    const snapshot = buildWorkoutAdoptionSnapshot(capture([row('seal')]), instance);
    const sealed = await database.sealWorkoutAdoptionSnapshot(snapshot, T0);
    const [item] = await database.listWorkoutAdoptionItems(sealed.manifestId);
    if (field === 'sourceKeyDigest') await rawDelete(factory, LOCAL_DATABASE_STORES.workoutAdoptionItems,
      [database.namespaceKey, namespace.generationId, sealed.manifestId, item!.sourceKeyDigest]);
    await rawPut(factory, LOCAL_DATABASE_STORES.workoutAdoptionItems, { ...item, [field]: 'f'.repeat(64) });
    await expect(database.sealWorkoutAdoptionSnapshot(snapshot, T0)).rejects.toThrow('CORRUPT_PERSISTED_RECORD');
  });

  it('rejects tampered persisted UUID allocation on seal reuse', async () => {
    const factory = new IDBFactory();
    const database = await repo(factory);
    const { item } = await seedPreviouslyAdopted(factory, database);
    await rawPut(factory, LOCAL_DATABASE_STORES.workoutAdoptionItems,
      { ...item, entryIds: [crypto.randomUUID()] });
    const instance = hashCanonicalPayload(['workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME]);
    const snapshot = buildWorkoutAdoptionSnapshot(capture([row('old-exact', true)]), instance);
    await expect(database.sealWorkoutAdoptionSnapshot(snapshot, T0)).rejects.toThrow('CORRUPT_PERSISTED_RECORD');
  });

  it('selects the latest completed lineage for X to Y to Y, then fails closed for X reappearance', async () => {
    const database = await repo();
    const x = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(capture([row('lineage')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const yRow = row('lineage', false, '2026-09-24');
    const y = await runDormantWorkoutAdoption({ database, healthDriver: driverFor(capture([yRow])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect((await database.listWorkoutAdoptionItems(y.manifestId))[0]).toMatchObject({
      classification: 'CHANGED_SOURCE_REVIEW', priorManifestId: x.manifestId,
    });
    const yy = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([yRow, row('extra')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const carried = (await database.listWorkoutAdoptionItems(yy.manifestId))
      .find(item => item.sourceReference.endsWith(':lineage'))!;
    expect(carried).toMatchObject({ classification: 'CARRIED_FORWARD', priorManifestId: y.manifestId });
    const reappeared = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('lineage'), row('extra'), row('third')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const reviewed = (await database.listWorkoutAdoptionItems(reappeared.manifestId))
      .find(item => item.sourceReference.endsWith(':lineage'))!;
    expect(reviewed).toMatchObject({ classification: 'CHANGED_SOURCE_REVIEW', priorManifestId: yy.manifestId });
    expect([x.lineageOrdinal, y.lineageOrdinal, yy.lineageOrdinal, reappeared.lineageOrdinal]).toEqual([1, 2, 3, 4]);
  });

  it('retains review-required semantics when only unresolved evidence is carried forward', async () => {
    const database = await repo();
    const first = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('keep-review'), row('removed')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const second = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('keep-review')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(second.requiresReview).toBe(true);
    expect(second.counts.CARRIED_FORWARD).toBe(1);
    expect((await database.listWorkoutAdoptionItems(second.manifestId))[0]).toMatchObject({
      classification: 'CARRIED_FORWARD', priorManifestId: first.manifestId,
      targetProvenanceManifestId: null,
    });
    await expect(database.completeWorkoutAdoption(second.manifestId)).resolves.toMatchObject({ requiresReview: true });
  });

  it('does not carry from multiple unfinished predecessors', async () => {
    const database = await repo();
    const instance = hashCanonicalPayload(['workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME]);
    const x = await database.sealWorkoutAdoptionSnapshot(buildWorkoutAdoptionSnapshot(capture([row('lineage')]), instance), T0);
    const yRow = row('lineage', false, '2026-09-24');
    const y = await database.sealWorkoutAdoptionSnapshot(buildWorkoutAdoptionSnapshot(capture([yRow]), instance), T0);
    const z = await database.sealWorkoutAdoptionSnapshot(buildWorkoutAdoptionSnapshot(capture([yRow, row('extra')]), instance), T0);
    const item = (await database.listWorkoutAdoptionItems(z.manifestId))
      .find(value => value.sourceReference.endsWith(':lineage'))!;
    expect(item).toMatchObject({ classification: 'CHANGED_SOURCE_REVIEW', reason: 'prior_snapshot_unfinished',
      priorManifestId: y.manifestId });
    expect([x.lineageOrdinal, y.lineageOrdinal, z.lineageOrdinal]).toEqual([1, 2, 3]);
  });

  it('selects immediate carry lineage while retaining the original target provenance', async () => {
    const factory = new IDBFactory();
    const database = await repo(factory);
    const { first, item } = await seedPreviouslyAdopted(factory, database);
    const y = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true), row('extra')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const z = await runDormantWorkoutAdoption({ database,
      healthDriver: driverFor(capture([row('old-exact', true), row('third')])),
      authenticatedAccountId: namespace.userId, now: () => T0 });
    const carried = (await database.listWorkoutAdoptionItems(z.manifestId))
      .find(value => value.sourceKeyDigest === item.sourceKeyDigest)!;
    expect(carried).toMatchObject({ classification: 'CARRIED_FORWARD', priorManifestId: y.manifestId,
      targetProvenanceManifestId: first.manifestId, sessionId: item.sessionId });
    await expect(database.completeWorkoutAdoption(z.manifestId)).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  it('accepts the row-count boundary and rejects max plus one before durable writes', async () => {
    const rows = Array.from({ length: MAX_WORKOUT_ADOPTION_ROWS }, (_, index) => row(`bounded-${index}`));
    expect(buildWorkoutAdoptionSnapshot(capture(rows), 'source-instance').items).toHaveLength(MAX_WORKOUT_ADOPTION_ROWS);
    const oversized = capture([...rows, row('one-too-many')]);
    const before = structuredClone(oversized);
    const factory = new IDBFactory();
    const database = await repo(factory);
    await expect(runDormantWorkoutAdoption({ database, healthDriver: driverFor(oversized),
      authenticatedAccountId: namespace.userId })).rejects.toThrow('workout_adoption_row_limit');
    expect(oversized).toEqual(before);
    expect(await rawCount(factory, LOCAL_DATABASE_STORES.workoutAdoptionSessions)).toBe(0);
    expect(await rawCount(factory, LOCAL_DATABASE_STORES.workoutAdoptionItems)).toBe(0);
    expect(await database.listEntities({ domain: 'health_workout_session' })).toEqual([]);
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 0 });
  });

  it('uses UTF-8 bytes for the exact per-item boundary and rejects one multibyte character over', () => {
    const source = capture([row('byte-boundary')]);
    const set = (source.workouts[0]!.record.sets as Record<string, unknown>[])[0]!;
    set.note = '';
    const item = buildWorkoutAdoptionSnapshot(source, 'source-instance').items[0]!;
    const size = (value: unknown) => new TextEncoder().encode(canonicalPayloadJson(value)).byteLength;
    const base = size([item.sourceReference, item.sourceRow, item.referenceBlock, item.ownership]);
    set.note = 'a'.repeat(MAX_WORKOUT_ADOPTION_ITEM_BYTES - base);
    const exact = buildWorkoutAdoptionSnapshot(source, 'source-instance').items[0]!;
    expect(size([exact.sourceReference, exact.sourceRow, exact.referenceBlock, exact.ownership]))
      .toBe(MAX_WORKOUT_ADOPTION_ITEM_BYTES);
    set.note += 'é';
    expect(() => buildWorkoutAdoptionSnapshot(source, 'source-instance'))
      .toThrow('workout_adoption_item_byte_limit');
  });

  it('bounds set evidence at 256 entries without truncating the source', () => {
    const source = capture([row('sets')]);
    const original = (source.workouts[0]!.record.sets as Record<string, unknown>[])[0]!;
    source.workouts[0]!.record.sets = Array.from({ length: MAX_WORKOUT_ADOPTION_SETS },
      (_, index) => ({ ...original, set: index + 1 }));
    expect(buildWorkoutAdoptionSnapshot(source, 'source-instance').items).toHaveLength(1);
    (source.workouts[0]!.record.sets as Record<string, unknown>[]).push({ ...original, set: MAX_WORKOUT_ADOPTION_SETS + 1 });
    expect(() => buildWorkoutAdoptionSnapshot(source, 'source-instance')).toThrow('workout_adoption_set_limit');
    expect((source.workouts[0]!.record.sets as unknown[])).toHaveLength(MAX_WORKOUT_ADOPTION_SETS + 1);
  });

  it('rejects an oversized reference block independently of the row payload', () => {
    const source = capture([row('block-boundary')]);
    source.exerciseBlocks[0]!.record.name = 'b'.repeat(MAX_WORKOUT_ADOPTION_BLOCK_BYTES);
    expect(() => buildWorkoutAdoptionSnapshot(source, 'source-instance'))
      .toThrow('workout_adoption_block_byte_limit');
  });

  it('rejects an excessive captured block catalog before snapshot persistence', () => {
    const source = capture([row('block-count')]);
    source.exerciseBlocks = Array.from({ length: MAX_WORKOUT_ADOPTION_BLOCKS + 1 }, (_, index) => ({
      storageKey: `${namespace.userId}:exercise_blocks:${index}`, accountId: namespace.userId,
      record: { id: String(index), user_id: namespace.userId, name: 'Block', type: 'strength',
        tags: [], cardio_mode: null },
    }));
    expect(() => buildWorkoutAdoptionSnapshot(source, 'source-instance'))
      .toThrow('workout_adoption_block_count_limit');
  });

  it('accepts exactly the total sealed evidence limit and rejects one byte over', () => {
    const rows = Array.from({ length: 33 }, (_, index) => row(`total-${String(index).padStart(2, '0')}`));
    for (const value of rows) (value.sets as Record<string, unknown>[])[0]!.note = '';
    const source = capture(rows);
    const size = (value: unknown) => new TextEncoder().encode(canonicalPayloadJson(value)).byteLength;
    const initial = buildWorkoutAdoptionSnapshot(source, 'source-instance');
    let remaining = MAX_WORKOUT_ADOPTION_SNAPSHOT_BYTES
      - size([initial.accountId, initial.sourceInstanceId, initial.sourceImportStateDigest])
      - initial.items.reduce((sum, item) => sum + size([
        item.sourceReference, item.sourceRow, item.referenceBlock, item.ownership,
      ]), 0);
    for (let index = 0; index < rows.length && remaining > 0; index += 1) {
      const item = initial.items[index]!;
      const current = size([item.sourceReference, item.sourceRow, item.referenceBlock, item.ownership]);
      const addition = Math.min(MAX_WORKOUT_ADOPTION_ITEM_BYTES - current, remaining);
      (rows[index]!.sets as Record<string, unknown>[])[0]!.note = 'a'.repeat(addition);
      remaining -= addition;
    }
    expect(remaining).toBe(0);
    const exact = buildWorkoutAdoptionSnapshot(source, 'source-instance');
    expect(size([exact.accountId, exact.sourceInstanceId, exact.sourceImportStateDigest])
      + exact.items.reduce((sum, item) => sum + size([
        item.sourceReference, item.sourceRow, item.referenceBlock, item.ownership,
      ]), 0)).toBe(MAX_WORKOUT_ADOPTION_SNAPSHOT_BYTES);
    (rows[rows.length - 1]!.sets as Record<string, unknown>[])[0]!.note += 'b';
    expect(() => buildWorkoutAdoptionSnapshot(source, 'source-instance'))
      .toThrow('workout_adoption_snapshot_byte_limit');
  });

  it('bounds the persisted session and item envelope before inserting any records', async () => {
    const rows = Array.from({ length: MAX_WORKOUT_ADOPTION_ROWS }, (_, index) => {
      const value = row(`manifest-${index}`);
      (value.sets as Record<string, unknown>[])[0]!.note = 'm'.repeat(200);
      return value;
    });
    const factory = new IDBFactory();
    const database = await repo(factory);
    const instance = hashCanonicalPayload(['workout-health-source-instance-v1', database.namespaceKey, HEALTH_LOCAL_DATABASE_NAME]);
    const snapshot = buildWorkoutAdoptionSnapshot(capture(rows), instance);
    expect(MAX_WORKOUT_ADOPTION_MANIFEST_BYTES).toBeGreaterThan(MAX_WORKOUT_ADOPTION_SNAPSHOT_BYTES);
    await expect(database.sealWorkoutAdoptionSnapshot(snapshot, T0))
      .rejects.toThrow('workout_adoption_manifest_byte_limit');
    expect(await rawCount(factory, LOCAL_DATABASE_STORES.workoutAdoptionSessions)).toBe(0);
    expect(await rawCount(factory, LOCAL_DATABASE_STORES.workoutAdoptionItems)).toBe(0);
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
    await driver.putRecord('workout_logs', namespace.userId, row('local', true));
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
    tx.objectStore('health_recovery_state').put(capture([row('local', true)]).importState);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    const before = await driver.readDatasets(namespace.userId);
    const captured = await driver.captureWorkoutAdoptionSource(namespace.userId);
    const after = await driver.readDatasets(namespace.userId);
    expect(after).toEqual(before);
    expect(captured.workouts).toHaveLength(1);
    const database = await repo();
    const adoption = await runDormantWorkoutAdoption({ database, healthDriver: driver,
      authenticatedAccountId: namespace.userId, now: () => T0 });
    expect(adoption.counts.AMBIGUOUS_REVIEW).toBe(1);
    expect((await database.listWorkoutAdoptionItems(adoption.manifestId))[0]?.reason)
      .toBe('historical_source_provenance_unverified');
    expect(await database.listEntities({ domain: 'health_workout_session' })).toEqual([]);
    expect(await database.countOutboxByStatus()).toMatchObject({ pending: 0 });
    raw.close();
  });
});
