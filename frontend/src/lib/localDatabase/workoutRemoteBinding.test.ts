import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  namespaceFingerprint, type LocalDatabaseRepository, type LocalDatabaseNamespace, type WorkoutRemoteAuthorityRecordV1,
} from './index';
import { WorkoutSessionRepository } from '../workoutSessionRepository';
import type { WorkoutSessionV1 } from '../workoutSessionV1';
import { hashCanonicalPayload } from './canonicalPayload';
import { WORKOUT_ADOPTION_ADAPTER } from '../workoutAdoption/types';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SERVER_EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VERIFICATION = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const VERIFICATION_ROTATED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const T0 = '2026-09-27T00:00:00.000Z';
const T1 = '2026-09-27T00:01:00.000Z';
const namespace: LocalDatabaseNamespace = {
  userId: OWNER, projectRef: 'not-the-server-project', deviceId: 'device-desktop',
  generationId: 'generation-desktop', schemaVersion: 1,
};
const capability = createDormantLocalDatabaseCapability('test');
const opened: LocalDatabaseRepository[] = [];

async function open(factory: IDBFactory, scope = namespace) {
  const repo = await openLocalDatabase(scope, { capability, indexedDBFactory: factory, clock: () => T0 });
  opened.push(repo);
  await repo.initializeNamespace();
  return repo;
}

function session(id = ID, reps = 8): WorkoutSessionV1 {
  const letterCase = (value: string) => id === id.toUpperCase() ? value.toUpperCase() : value;
  return { version: 1, id, localDate: '2026-09-27', entries: [{
    id: letterCase('2aaaaaaa-2222-4222-8222-222222222222'),
    exercise: { id: null, name: 'Push-up', type: 'bodyweight', tags: [], cardioMode: null },
    sets: [{ id: letterCase('3bbbbbbb-3333-4333-8333-333333333333'), ordinal: 1, kind: 'bodyweight',
      loadKind: 'bodyweight', reps, assistedReps: null, dropset: false, done: true }],
  }] };
}

function authority(repo: LocalDatabaseRepository, projectScope = 'nondefault-workout-project',
  authorityEpoch = 1): WorkoutRemoteAuthorityRecordV1 {
  return {
    accountId: OWNER, namespaceKey: repo.namespaceKey, generationId: namespace.generationId,
    domain: 'health_workout_session', deviceId: namespace.deviceId, protocolVersion: 2,
    projectScope, capability: 'FOUNDATION_READY', authorityState: 'OPEN', authorityEpoch,
    bindingState: 'bound', generationBindingId: BINDING, serverEpoch: SERVER_EPOCH, verifiedAt: T0,
    discoverySequence: authorityEpoch, verificationId: authorityEpoch === 1 ? VERIFICATION : VERIFICATION_ROTATED,
  };
}

async function persistAuthority(repo: LocalDatabaseRepository, evidence = authority(repo)) {
  const discoverySequence = await repo.reserveWorkoutRemoteDiscovery();
  const row = { ...evidence, discoverySequence };
  await repo.persistWorkoutRemoteAuthority(row, () => OWNER, () => namespace.deviceId);
  return row;
}

async function setup(factory = new IDBFactory(), id = ID) {
  const repo = await open(factory);
  const workouts = new WorkoutSessionRepository(repo, () => T0);
  const created = await workouts.createWorkoutSession(session(id), { now: T0 });
  await persistAuthority(repo);
  return { repo, workouts, created, factory };
}

function raw(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open('absinthe-local-v2');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function mutateRaw(factory: IDBFactory, storeName: string, key: IDBValidKey,
  change: (value: any) => any): Promise<void> {
  const db = await raw(factory);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const request = store.get(key);
  request.onsuccess = () => store.put(change(request.result));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function putRaw(factory: IDBFactory, storeName: string, value: unknown): Promise<void> {
  const db = await raw(factory);
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
}

/** Historical G3 ADOPTABLE output, following its exact seal/item/target digests. */
async function seedHistoricalG3(factory = new IDBFactory()) {
  const repo = await open(factory);
  const sourceReference = `${OWNER}:workout_logs:old-exact`;
  const sourceRow = { id: 'old-exact', user_id: OWNER, date: '2026-09-27', block_id: 'block-1',
    sort_order: 0, sets: [{ type: 'strength', set: 1, kg: 10, reps: 8, assisted_reps: 2,
      weight_source_value: 10, weight_source_unit: 'kg', done: true }],
    session_boundary: { version: 1, kind: 'single-row', sourceSessionId: 'old-session' },
    historical_exercise_snapshot: { id: 'block-1', name: 'Historical Squat', type: 'strength',
      tags: ['LEGS'], cardioMode: null } };
  const referenceBlock = { id: 'block-1', user_id: OWNER, name: 'Current Squat',
    type: 'strength', tags: ['CURRENT'], cardio_mode: null };
  const sourceInstanceId = hashCanonicalPayload([
    'workout-health-source-instance-v1', repo.namespaceKey, 'absinthe.health.local',
  ]);
  const sourceKeyDigest = hashCanonicalPayload(['workout-source-key-v1', sourceInstanceId, sourceReference]);
  const sourceItemDigest = hashCanonicalPayload(['workout-source-item-v1', WORKOUT_ADOPTION_ADAPTER,
    1, sourceReference, sourceRow, referenceBlock, 'BOUND']);
  const sourceImportStateDigest = hashCanonicalPayload({ status: 'VERIFIED_IMPORT_COMPLETE', accountId: OWNER });
  const sourceSnapshotDigest = hashCanonicalPayload(['workout-source-snapshot-v1', WORKOUT_ADOPTION_ADAPTER,
    1, OWNER, sourceInstanceId, sourceImportStateDigest, [[sourceKeyDigest, sourceItemDigest]]]);
  const sealed = await repo.sealWorkoutAdoptionSnapshot({ accountId: OWNER, sourceInstanceId,
    sourceSchemaVersion: 1, sourceImportStateDigest, sourceSnapshotDigest,
    items: [{ sourceReference, sourceKeyDigest, sourceItemDigest, sourceRow, referenceBlock,
      ownership: 'BOUND' }] }, T0);
  const [item] = await repo.listWorkoutAdoptionItems(sealed.manifestId);
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const candidate: WorkoutSessionV1 = { version: 1, id, localDate: '2026-09-27', entries: [{
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    exercise: { id: 'block-1', name: 'Historical Squat', type: 'strength', tags: ['LEGS'], cardioMode: null },
    sets: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ordinal: 1, kind: 'strength',
      loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg',
      reps: 8, assistedReps: 2, dropset: false, done: true }],
  }] };
  const created = await new WorkoutSessionRepository(repo, () => T0).createWorkoutSession(candidate);
  const entity = { ...created.entity, source: { kind: 'legacy_migration', reference: sealed.manifestId },
    migrationProvenance: { conversionVersion: 1, sourceAdapter: WORKOUT_ADOPTION_ADAPTER,
      sourceSchemaVersion: 1, migrationSessionId: sealed.manifestId,
      sourceSnapshotDigest, migratedAt: T0, legacyKeyDigest: sourceKeyDigest } };
  const adopted = { ...item!, classification: 'ADOPTABLE', reason: 'source_exact', state: 'VERIFIED',
    sessionId: id, entryIds: [candidate.entries[0]!.id], setIds: [candidate.entries[0]!.sets[0]!.id],
    candidate, conversionResultDigest: hashCanonicalPayload(candidate),
    targetEntityHash: created.entity.contentHash, outboxMutationId: created.outbox.mutationId, verifiedAt: T0 };
  const completed = { ...sealed, status: 'COMPLETED', counts: {
    ...sealed.counts, ADOPTABLE: 1, AMBIGUOUS_REVIEW: 0 }, requiresReview: false,
    targetStateDigest: hashCanonicalPayload([[
      sourceKeyDigest, id, created.entity.contentHash, created.outbox.mutationId, sealed.manifestId,
    ]]),
    itemManifestDigest: hashCanonicalPayload([sealed.lineageOrdinal, sealed.sourceCapturedAt, [[
      adopted.sourceKeyDigest, adopted.sourceItemDigest, adopted.classification, adopted.reason,
      adopted.priorManifestId, adopted.conversionResultDigest, adopted.historicalExerciseEvidence,
      [adopted.sessionId, adopted.entryIds, adopted.setIds],
    ]]]) };
  await putRaw(factory, 'entities', entity);
  await putRaw(factory, 'workout_adoption_items', adopted);
  await putRaw(factory, 'workout_adoption_sessions', completed);
  await persistAuthority(repo);
  return { repo, factory, id, created, sealed, adopted };
}

/** Test-only durable remote baseline; G4B1 itself never pulls or acknowledges. */
async function seedRemoteBaseline(factory: IDBFactory, repo: LocalDatabaseRepository,
  mutationId: string, remoteState: 'active' | 'unknown', id = ID): Promise<void> {
  const db = await raw(factory);
  const tx = db.transaction(['entities', 'outbox'], 'readwrite');
  tx.objectStore('outbox').delete([repo.namespaceKey, namespace.generationId, mutationId]);
  const entities = tx.objectStore('entities');
  const request = entities.get([repo.namespaceKey, namespace.generationId, 'health_workout_session', id]);
  request.onsuccess = () => entities.put({
    ...request.result, serverRevision: 9,
    ...(remoteState === 'active' ? { remoteState } : {}), pendingMutationId: null,
    lastRemoteMutationRef: 'remote-receipt-9',
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
}

/** G4B2 settlement fixture only: retain ACK history, then use real convergence for remote apply. */
async function seedAcknowledged(factory: IDBFactory, repo: LocalDatabaseRepository,
  mutationId: string, revision = 7): Promise<void> {
  const db = await raw(factory);
  const tx = db.transaction(['entities', 'outbox'], 'readwrite');
  const outbox = tx.objectStore('outbox');
  const row = outbox.get([repo.namespaceKey, namespace.generationId, mutationId]);
  row.onsuccess = () => outbox.put({ ...row.result, status: 'acknowledged', attemptCount: 1,
    lastAttemptAt: T0, acknowledgedAt: T1, acknowledgedBy: 'seeded-receipt',
    acknowledgedRevision: revision, remoteMutationRef: `receipt-${revision}`,
    serverCommittedAt: T1, updatedAt: T1 });
  const entities = tx.objectStore('entities');
  const current = entities.get([repo.namespaceKey, namespace.generationId, 'health_workout_session', ID]);
  current.onsuccess = () => entities.put({ ...current.result, serverRevision: revision,
    pendingMutationId: null, remoteState: 'active', lastRemoteMutationRef: `receipt-${revision}` });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
}

async function applyRemote(repo: LocalDatabaseRepository, id: string, revision: number,
  expectedLocalRevision: number | null, deletedAt: string | null, sequence = revision) {
  return repo.commitRemoteConvergenceBatch<WorkoutSessionV1>({
    namespaceKey: repo.namespaceKey, generationId: namespace.generationId,
    accountId: OWNER, domain: 'health_workout_session', provider: 'workout-test',
    checkpointValue: `checkpoint-${sequence}`, sequence, serverEpoch: SERVER_EPOCH, now: T1,
    changes: [{ expectedLocalRevision, candidate: {
      entityId: id, record: session(id), serverRevision: revision,
      remoteMutationRef: `remote-${revision}`, createdAt: T0, updatedAt: T1,
      deletedAt, ownerId: OWNER, source: { kind: 'remote', reference: 'workout-test' },
    } }],
  });
}

afterEach(() => { for (const repo of opened.splice(0)) closeLocalDatabase(repo); });

describe('REL-05G4B1 durable workout binding', () => {
  it('upgrades populated v6 data to v7 without rewriting existing workout, Notes, adoption or writer rows', async () => {
    const factory = new IDBFactory();
    const key = await namespaceFingerprint(namespace);
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open('absinthe-local-v2', 6);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('database_meta', { keyPath: 'namespaceKey' });
        db.createObjectStore('generations', { keyPath: ['namespaceKey', 'generationId'] });
        db.createObjectStore('entities', { keyPath: ['namespaceKey', 'generationId', 'domain', 'entityId'] });
        db.createObjectStore('outbox', { keyPath: ['namespaceKey', 'generationId', 'mutationId'] });
        db.createObjectStore('workout_adoption_sessions', { keyPath: ['namespaceKey', 'generationId', 'manifestId'] });
        db.createObjectStore('workout_adoption_items', { keyPath: ['namespaceKey', 'generationId', 'manifestId', 'sourceKeyDigest'] });
        db.createObjectStore('writer_coordination_state');
        db.createObjectStore('sync_checkpoints', { keyPath: ['namespaceKey', 'generationId', 'provider', 'stream'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = legacy.transaction([...legacy.objectStoreNames], 'readwrite');
    tx.objectStore('database_meta').put({
      namespaceKey: key, databaseFormatVersion: 6, namespaceFingerprint: key,
      activeGenerationId: namespace.generationId, createdAt: T0,
      minimumCompatibleSchemaVersion: 1, recoveryCompatible: true,
      migrationStatePointer: null, schemaVersion: 1,
    });
    tx.objectStore('generations').put({
      namespaceKey: key, generationId: namespace.generationId, status: 'active',
      createdAt: T0, activatedAt: T0, predecessorGenerationId: null, creationReason: 'initial',
      schemaVersion: 1, validationState: 'valid', safeSourceReference: null, activeNamespaceKey: key,
    });
    const sentinels: [string, object, IDBValidKey?][] = [
      ['entities', { namespaceKey: key, generationId: namespace.generationId, domain: 'health_workout_session',
        entityId: ID, marker: 'workout-preserved' }],
      ['entities', { namespaceKey: key, generationId: namespace.generationId, domain: 'notes',
        entityId: 'note-1', marker: 'notes-preserved' }],
      ['outbox', { namespaceKey: key, generationId: namespace.generationId,
        mutationId: 'mut.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        deliveryBinding: { version: 1, state: 'unbound' }, marker: 'unbound-preserved' }],
      ['workout_adoption_sessions', { namespaceKey: key, generationId: namespace.generationId,
        manifestId: 'manifest-1', marker: 'adoption-preserved' }],
      ['workout_adoption_items', { namespaceKey: key, generationId: namespace.generationId,
        manifestId: 'manifest-1', sourceKeyDigest: 'source-1', marker: 'adoption-item-preserved' }],
      ['writer_coordination_state', { marker: 'writer-preserved' }, 'writer-state'],
      ['sync_checkpoints', { namespaceKey: key, generationId: namespace.generationId,
        provider: 'notes', stream: 'primary', marker: 'checkpoint-preserved' }],
    ];
    for (const [name, value, explicitKey] of sentinels) {
      if (explicitKey === undefined) tx.objectStore(name).put(value);
      else tx.objectStore(name).put(value, explicitKey);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    legacy.close();
    const repo = await openLocalDatabase(namespace, { capability, indexedDBFactory: factory });
    opened.push(repo);
    expect((await repo.readDatabaseMetadata()).databaseFormatVersion).toBe(7);
    const upgraded = await raw(factory);
    expect(upgraded.version).toBe(7);
    const read = upgraded.transaction([...upgraded.objectStoreNames], 'readonly');
    for (const [name, value, explicitKey] of sentinels) {
      const store = read.objectStore(name);
      const primaryKey = explicitKey ?? (name === 'entities'
        ? [key, namespace.generationId, (value as { domain: string }).domain, (value as { entityId: string }).entityId]
        : name === 'outbox' ? [key, namespace.generationId, (value as { mutationId: string }).mutationId]
          : name === 'workout_adoption_sessions' ? [key, namespace.generationId, 'manifest-1']
            : name === 'workout_adoption_items' ? [key, namespace.generationId, 'manifest-1', 'source-1']
              : [key, namespace.generationId, 'notes', 'primary']);
      const actual = await new Promise((resolve, reject) => {
        const request = store.get(primaryKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(actual).toEqual(value);
    }
    upgraded.close();
  });

  it('creates v7 stores and binds an immutable first create without activating the old worker', async () => {
    const { repo, created, factory } = await setup();
    const db = await raw(factory);
    expect(db.version).toBe(7);
    for (const store of ['workout_remote_authority', 'workout_remote_ids',
      'workout_full_resync_sessions', 'workout_full_resync_items']) expect(db.objectStoreNames.contains(store)).toBe(true);
    db.close();
    const bound = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({
      version: 1, state: 'bound', projectScope: 'nondefault-workout-project',
      remoteCasBaseRevision: null, wireEntityId: ID, boundPayloadHash: created.outbox.payloadHash,
    });
    expect(bound.payload).toEqual(created.outbox.payload);
    expect(await repo.getWorkoutRemoteIdByLocal(ID)).toMatchObject({ localEntityId: ID, wireEntityId: ID });
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toHaveLength(1);
    expect(await repo.claimNextMutations({ workerId: 'old-worker', now: T1, leaseDurationMs: 30_000, limit: 10 })).toEqual([]);
    expect(await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId })).toEqual(bound);
  });

  it('rolls back mapping and binding at either injected failure point', async () => {
    const { repo, created } = await setup();
    for (const point of ['after_mapping', 'before_commit'] as const) {
      await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
        expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId,
        testOnlyAbortAt: point })).rejects.toHaveProperty('code', 'TRANSACTION_ABORTED');
      expect(await repo.getWorkoutRemoteIdByLocal(ID)).toBeNull();
      expect((await repo.getOutboxRecord(created.outbox.mutationId))?.deliveryBinding).toEqual({ version: 1, state: 'unbound' });
    }
  });

  it('serializes two binders to one durable binding', async () => {
    const { repo, created, factory } = await setup();
    const second = await open(factory);
    const results = await Promise.all([
      repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId, expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
        currentDeviceId: () => namespace.deviceId }),
      second.bindWorkoutMutation({ mutationId: created.outbox.mutationId, expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
        currentDeviceId: () => namespace.deviceId }),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toHaveLength(1);
  });

  it('preserves mixed-case local payload and maps lower-case wire UUID', async () => {
    const mixed = ID.toUpperCase();
    const { repo, created } = await setup(new IDBFactory(), mixed);
    const beforeHash = hashCanonicalPayload(created.outbox.payload);
    const bound = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.payloadHash).toBe(beforeHash);
    expect(bound.payload).toEqual(created.outbox.payload);
    expect((bound.payload as { record: WorkoutSessionV1 }).record.id).toBe(mixed);
    expect((bound.payload as { record: WorkoutSessionV1 }).record.entries[0]?.id).toBe('2AAAAAAA-2222-4222-8222-222222222222');
    expect((bound.payload as { record: WorkoutSessionV1 }).record.entries[0]?.sets[0]?.id)
      .toBe('3BBBBBBB-3333-4333-8333-333333333333');
    expect(bound.deliveryBinding).toMatchObject({ wireEntityId: ID, boundPayloadHash: beforeHash });
    expect((await repo.getEntity<WorkoutSessionV1>('health_workout_session', mixed))?.record.id).toBe(mixed);
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toMatchObject([{ localEntityId: mixed }]);
  });

  it('blocks case-only twin UUID entities without merging either', async () => {
    const { repo, created } = await setup();
    const twin = await new WorkoutSessionRepository(repo).createWorkoutSession(session(ID.toUpperCase()), { now: T1 });
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_ENTITY');
    expect(await repo.getEntity('health_workout_session', ID)).not.toBeNull();
    expect(await repo.getEntity('health_workout_session', ID.toUpperCase())).not.toBeNull();
    expect(await repo.getWorkoutRemoteIdByLocal(ID)).toBeNull();
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.deliveryBlockCode).toBe('UUID_MAPPING_COLLISION');
    expect((await repo.getOutboxRecord(twin.outbox.mutationId))?.deliveryBinding).toEqual({ version: 1, state: 'unbound' });
  });

  it('durably quarantines an attempted explicit-unbound mutation', async () => {
    const { repo, created, factory } = await setup();
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, status: 'permanent_failure', attemptCount: 1, lastAttemptAt: T1,
      updatedAt: T1, lastErrorCode: 'NETWORK_ERROR',
    }));
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_OUTBOX_TRANSITION');
    expect(await repo.getOutboxRecord(created.outbox.mutationId)).toMatchObject({
      deliveryBinding: { version: 1, state: 'unbound' },
      deliveryBlockCode: 'UNBOUND_ATTEMPT_QUARANTINED', attemptCount: 1,
    });
  });

  it('blocks attempted-unbound, corrupted payload, auth switch and stale generation', async () => {
    const { repo, created, factory } = await setup();
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => '22222222-2222-4222-8222-222222222222',
      currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'NAMESPACE_MISMATCH');
    await repo.createGeneration('next-generation', 'test');
    await repo.activateGeneration('next-generation');
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'STALE_GENERATION');
    const next = await open(factory, { ...namespace, generationId: 'next-generation' });
    expect(await next.getWorkoutRemoteAuthority()).toBeNull();
  });

  it('blocks unsettled successor and remote-unknown update, then uses seeded settlement revision', async () => {
    const { repo, workouts, created, factory } = await setup();
    const edited = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T1 });
    await expect(repo.bindWorkoutMutation({ mutationId: edited.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_OUTBOX_TRANSITION');
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    // G4B1 never acknowledges. The test seeds G4B2-style durable settlement evidence.
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, status: 'acknowledged', attemptCount: 1, lastAttemptAt: T0,
      acknowledgedAt: T1, acknowledgedBy: 'seeded-server-receipt', acknowledgedRevision: 17,
      serverCommittedAt: T1, updatedAt: T1,
    }));
    const bound = await repo.bindWorkoutMutation({ mutationId: edited.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 17 });
    expect(bound.baseRevision).toBe(1);
  });

  it('blocks unknown remote state and uses only seeded server revision for an update', async () => {
    const unknown = await setup();
    await seedRemoteBaseline(unknown.factory, unknown.repo, unknown.created.outbox.mutationId, 'unknown');
    const unknownUpdate = await unknown.workouts.updateWorkoutSession(ID, 1, session(ID, 10), { now: T1 });
    await expect(unknown.repo.bindWorkoutMutation({ mutationId: unknownUpdate.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_OUTBOX_TRANSITION');
    expect((await unknown.repo.getOutboxRecord(unknownUpdate.outbox.mutationId))?.deliveryBinding)
      .toEqual({ version: 1, state: 'unbound' });

    const known = await setup();
    await seedRemoteBaseline(known.factory, known.repo, known.created.outbox.mutationId, 'active');
    const update = await known.workouts.updateWorkoutSession(ID, 1, session(ID, 10), { now: T1 });
    const bound = await known.repo.bindWorkoutMutation({ mutationId: update.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 9 });
    expect(bound.baseRevision).toBe(1);
  });

  it('binds a tombstone only against known active remote state', async () => {
    const { repo, workouts, created, factory } = await setup();
    await seedRemoteBaseline(factory, repo, created.outbox.mutationId, 'active');
    const deleted = await workouts.deleteWorkoutSession(ID, 1, { now: T1 });
    const bound = await repo.bindWorkoutMutation({ mutationId: deleted.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 9, wireEntityId: ID });
  });

  it('preserves a mixed-case tombstone payload/hash while binding lowercase wire identity', async () => {
    const mixed = ID.toUpperCase();
    const { repo, workouts, created, factory } = await setup(new IDBFactory(), mixed);
    await seedRemoteBaseline(factory, repo, created.outbox.mutationId, 'active', mixed);
    const deleted = await workouts.deleteWorkoutSession(mixed, 1, { now: T1 });
    const originalHash = deleted.outbox.payloadHash;
    const bound = await repo.bindWorkoutMutation({ mutationId: deleted.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(bound.payload).toEqual(deleted.outbox.payload);
    expect(bound.payloadHash).toBe(originalHash);
    expect(bound.deliveryBinding).toMatchObject({ wireEntityId: ID, boundPayloadHash: originalHash });
    expect(hashCanonicalPayload({ ...bound.payload, entityId: ID })).not.toBe(originalHash);
  });

  it('rejects a tombstone whose valid payload UUID has a different value', async () => {
    const mixed = ID.toUpperCase();
    const { repo, workouts, created, factory } = await setup(new IDBFactory(), mixed);
    await seedRemoteBaseline(factory, repo, created.outbox.mutationId, 'active', mixed);
    const deleted = await workouts.deleteWorkoutSession(mixed, 1, { now: T1 });
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId,
      deleted.outbox.mutationId], row => {
      const payload = { ...row.payload, entityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
      return { ...row, payload, payloadHash: hashCanonicalPayload(payload) };
    });
    await expect(repo.bindWorkoutMutation({ mutationId: deleted.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'CORRUPT_PERSISTED_RECORD');
  });

  it('persists real remote active/deleted state and binds update, tombstone and restore to their remote base', async () => {
    const { repo, workouts } = await setup();
    const remoteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await applyRemote(repo, remoteId, 9, null, null);
    expect(await repo.getEntity('health_workout_session', remoteId)).toMatchObject({
      serverRevision: 9, remoteState: 'active', revision: 1,
    });
    const updated = await workouts.updateWorkoutSession(remoteId, 1, session(remoteId, 9), { now: T1 });
    const updateBound = await repo.bindWorkoutMutation({ mutationId: updated.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(updateBound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 9 });

    const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await applyRemote(repo, secondId, 9, null, null, 10);
    const deleted = await workouts.deleteWorkoutSession(secondId, 1, { now: T1 });
    const deleteBound = await repo.bindWorkoutMutation({ mutationId: deleted.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(deleteBound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 9 });

    const restoreId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await applyRemote(repo, restoreId, 9, null, null, 11);
    await applyRemote(repo, restoreId, 12, 1, T1, 12);
    expect(await repo.getEntity('health_workout_session', restoreId)).toMatchObject({
      serverRevision: 12, remoteState: 'deleted', revision: 2,
    });
    const restored = await workouts.restoreWorkoutSession(restoreId, 2, session(restoreId), { now: T1 });
    const restoreBound = await repo.bindWorkoutMutation({ mutationId: restored.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(restoreBound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 12 });
  });

  it('uses a newer real remote boundary over retained acknowledged M1 history', async () => {
    const { repo, workouts, created, factory } = await setup();
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    await seedAcknowledged(factory, repo, created.outbox.mutationId, 7);
    await applyRemote(repo, ID, 11, 1, null);
    const m2 = await workouts.updateWorkoutSession(ID, 2, session(ID, 10), { now: T1 });
    expect((await repo.getOutboxRecord(created.outbox.mutationId))?.status).toBe('acknowledged');
    expect(m2.outbox.remoteSequenceBoundary).toMatchObject({ baselineLocalRevision: 2,
      baselineServerRevision: 11 });
    const bound = await repo.bindWorkoutMutation({ mutationId: m2.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 11 });
  });

  it('keeps direct acknowledged predecessor continuity when no newer remote apply intervenes', async () => {
    const { repo, workouts, created, factory } = await setup();
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    await seedAcknowledged(factory, repo, created.outbox.mutationId, 7);
    const m2 = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T1 });
    expect(m2.outbox.remoteSequenceBoundary).toBeUndefined();
    const bound = await repo.bindWorkoutMutation({ mutationId: m2.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 7 });
  });

  it('requires current discovery identity for every new binding, without rewriting historical bound rows', async () => {
    const { repo, workouts, created } = await setup();
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
    const bound = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    const second = await workouts.createWorkoutSession(session(BINDING), { now: T1 });
    await persistAuthority(repo, { ...authority(repo, 'new-project', 2), verifiedAt: '2026-09-26T00:00:00.000Z' });
    await expect(repo.bindWorkoutMutation({ mutationId: second.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId })).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
    const next = await repo.bindWorkoutMutation({ mutationId: second.outbox.mutationId,
      expectedVerificationId: VERIFICATION_ROTATED, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(next.deliveryBinding).toMatchObject({ projectScope: 'new-project', authorityEpoch: 2 });
    expect(await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId })).toEqual(bound);
  });

  it('binds only a completed, sealed historical G3 adopted first create to null remote CAS', async () => {
    const { repo, created, id } = await seedHistoricalG3();
    const bound = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: null, wireEntityId: id });
    expect(bound.payload).toEqual(created.outbox.payload);
  });

  it('blocks incomplete, mismatched and remotely settled historical G3 adoption evidence', async () => {
    for (const defect of ['unsealed', 'target', 'server', 'receipt', 'sequence', 'conflict'] as const) {
      const { repo, factory, id, created, sealed, adopted } = await seedHistoricalG3();
      if (defect === 'unsealed') await mutateRaw(factory, 'workout_adoption_sessions', [
        repo.namespaceKey, namespace.generationId, sealed.manifestId,
      ], row => ({ ...row, status: 'SEALED' }));
      if (defect === 'target') await mutateRaw(factory, 'workout_adoption_items', [
        repo.namespaceKey, namespace.generationId, sealed.manifestId, adopted.sourceKeyDigest,
      ], row => ({ ...row, outboxMutationId: 'mut.ffffffff-ffff-4fff-8fff-ffffffffffff' }));
      if (defect === 'server' || defect === 'receipt') await mutateRaw(factory, 'entities', [
        repo.namespaceKey, namespace.generationId, 'health_workout_session', id,
      ], row => ({ ...row, ...(defect === 'server' ? { serverRevision: 8 }
        : { lastRemoteMutationRef: 'remote-receipt-8' }) }));
      if (defect === 'sequence') await mutateRaw(factory, 'outbox', [
        repo.namespaceKey, namespace.generationId, created.outbox.mutationId,
      ], row => ({ ...row, remoteSequenceBoundary: {
        kind: 'remote_entity_sequence_boundary', namespaceKey: repo.namespaceKey,
        generationId: namespace.generationId, domain: 'health_workout_session', entityId: id,
        baselineLocalRevision: 1, baselineServerRevision: 8, remoteMutationRef: 'remote-receipt-8',
        baselineContentHash: created.entity.contentHash, createdAt: T0,
      } }));
      if (defect === 'conflict') await repo.recordConflict({ conflictId: 'g3-conflict',
        mutationId: created.outbox.mutationId, domain: 'health_workout_session', entityId: id,
        localCandidate: created.entity.record, remoteCandidate: session(id, 9),
        localRevision: 1, serverRevision: 8, conflictType: 'remote_change_with_pending_local', now: T1 });
      await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
        expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER,
        currentDeviceId: () => namespace.deviceId })).rejects.toHaveProperty('code');
      if (defect !== 'sequence') expect((await repo.getOutboxRecord(created.outbox.mutationId))?.deliveryBinding)
        .toEqual({ version: 1, state: 'unbound' });
    }
  });

  it('rejects a corrupted immutable outbox payload hash and preserves unbound state', async () => {
    const { repo, created, factory } = await setup();
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, payloadHash: 'f'.repeat(64),
    }));
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code');
    expect(await repo.getWorkoutRemoteIdByLocal(ID)).toBeNull();
  });

  it('does not rewrite an existing bound row when server scope rotates', async () => {
    const { repo, created } = await setup();
    const first = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await persistAuthority(repo, { ...authority(repo, 'rotated-project', 2), verifiedAt: T1 });
    const second = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(second).toEqual(first);
  });

  it('uses refreshed server scope only for a separate never-bound first create', async () => {
    const { repo, workouts, created } = await setup();
    const first = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await persistAuthority(repo, { ...authority(repo, 'rotated-project', 2), verifiedAt: T1 });
    const fresh = await workouts.createWorkoutSession(session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), { now: T1 });
    const newlyBound = await repo.bindWorkoutMutation({ mutationId: fresh.outbox.mutationId,
      expectedVerificationId: VERIFICATION_ROTATED, currentAuthenticatedAccount: () => OWNER,
      currentDeviceId: () => namespace.deviceId });
    expect(first.deliveryBinding).toMatchObject({ projectScope: 'nondefault-workout-project' });
    expect(newlyBound.deliveryBinding).toMatchObject({ projectScope: 'rotated-project' });
    expect(newlyBound.deliveryBinding).not.toEqual(first.deliveryBinding);
  });

  it('rejects a tampered bound digest instead of treating it as an idempotent bind', async () => {
    const { repo, created, factory } = await setup();
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, deliveryBinding: { ...row.deliveryBinding, requestDigest: 'f'.repeat(64) },
    }));
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'CORRUPT_PERSISTED_RECORD');
  });

  it('rejects malformed persisted authority and UUID mappings', async () => {
    const { repo, created, factory } = await setup();
    await mutateRaw(factory, 'workout_remote_authority', [OWNER, repo.namespaceKey,
      namespace.generationId, 'health_workout_session'], row => ({ ...row, projectScope: '../invalid' }));
    await expect(repo.getWorkoutRemoteAuthority()).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');

    const mapped = await setup();
    await mapped.repo.bindWorkoutMutation({ mutationId: mapped.created.outbox.mutationId,
      expectedVerificationId: VERIFICATION, currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await mutateRaw(mapped.factory, 'workout_remote_ids', [OWNER, mapped.repo.namespaceKey,
      namespace.generationId, 'health_workout_session', ID], row => ({ ...row, wireEntityId: BINDING }));
    await expect(mapped.repo.getWorkoutRemoteIdByLocal(ID)).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
  });
});
