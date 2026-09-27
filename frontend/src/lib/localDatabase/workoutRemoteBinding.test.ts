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

const OWNER = '11111111-1111-4111-8111-111111111111';
const ID = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
const BINDING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SERVER_EPOCH = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
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

function authority(repo: LocalDatabaseRepository, projectScope = 'nondefault-workout-project'): WorkoutRemoteAuthorityRecordV1 {
  return {
    accountId: OWNER, namespaceKey: repo.namespaceKey, generationId: namespace.generationId,
    domain: 'health_workout_session', deviceId: namespace.deviceId, protocolVersion: 2,
    projectScope, capability: 'FOUNDATION_READY', authorityState: 'OPEN', authorityEpoch: 1,
    bindingState: 'bound', generationBindingId: BINDING, serverEpoch: SERVER_EPOCH, verifiedAt: T0,
  };
}

async function setup(factory = new IDBFactory(), id = ID) {
  const repo = await open(factory);
  const workouts = new WorkoutSessionRepository(repo, () => T0);
  const created = await workouts.createWorkoutSession(session(id), { now: T0 });
  await repo.persistWorkoutRemoteAuthority(authority(repo), () => OWNER, () => namespace.deviceId);
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

/** Test-only durable remote baseline; G4B1 itself never pulls or acknowledges. */
async function seedRemoteBaseline(factory: IDBFactory, repo: LocalDatabaseRepository,
  mutationId: string, remoteState: 'active' | 'unknown'): Promise<void> {
  const db = await raw(factory);
  const tx = db.transaction(['entities', 'outbox'], 'readwrite');
  tx.objectStore('outbox').delete([repo.namespaceKey, namespace.generationId, mutationId]);
  const entities = tx.objectStore('entities');
  const request = entities.get([repo.namespaceKey, namespace.generationId, 'health_workout_session', ID]);
  request.onsuccess = () => entities.put({
    ...request.result, serverRevision: 9, remoteState, pendingMutationId: null,
    lastRemoteMutationRef: 'remote-receipt-9',
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
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
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({
      version: 1, state: 'bound', projectScope: 'nondefault-workout-project',
      remoteCasBaseRevision: null, wireEntityId: ID, boundPayloadHash: created.outbox.payloadHash,
    });
    expect(bound.payload).toEqual(created.outbox.payload);
    expect(await repo.getWorkoutRemoteIdByLocal(ID)).toMatchObject({ localEntityId: ID, wireEntityId: ID });
    expect(await repo.getWorkoutRemoteIdsByWire(ID)).toHaveLength(1);
    expect(await repo.claimNextMutations({ workerId: 'old-worker', now: T1, leaseDurationMs: 30_000, limit: 10 })).toEqual([]);
    expect(await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId })).toEqual(bound);
  });

  it('rolls back mapping and binding at either injected failure point', async () => {
    const { repo, created } = await setup();
    for (const point of ['after_mapping', 'before_commit'] as const) {
      await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
        currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId,
        testOnlyAbortAt: point })).rejects.toHaveProperty('code', 'TRANSACTION_ABORTED');
      expect(await repo.getWorkoutRemoteIdByLocal(ID)).toBeNull();
      expect((await repo.getOutboxRecord(created.outbox.mutationId))?.deliveryBinding).toEqual({ version: 1, state: 'unbound' });
    }
  });

  it('serializes two binders to one durable binding', async () => {
    const { repo, created, factory } = await setup();
    const second = await open(factory);
    const results = await Promise.all([
      repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId, currentAuthenticatedAccount: () => OWNER,
        currentDeviceId: () => namespace.deviceId }),
      second.bindWorkoutMutation({ mutationId: created.outbox.mutationId, currentAuthenticatedAccount: () => OWNER,
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
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
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
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
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
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
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
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'STALE_GENERATION');
    const next = await open(factory, { ...namespace, generationId: 'next-generation' });
    expect(await next.getWorkoutRemoteAuthority()).toBeNull();
  });

  it('blocks unsettled successor and remote-unknown update, then uses seeded settlement revision', async () => {
    const { repo, workouts, created, factory } = await setup();
    const edited = await workouts.updateWorkoutSession(ID, 1, session(ID, 9), { now: T1 });
    await expect(repo.bindWorkoutMutation({ mutationId: edited.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_OUTBOX_TRANSITION');
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    // G4B1 never acknowledges. The test seeds G4B2-style durable settlement evidence.
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, status: 'acknowledged', attemptCount: 1, lastAttemptAt: T0,
      acknowledgedAt: T1, acknowledgedBy: 'seeded-server-receipt', acknowledgedRevision: 17,
      serverCommittedAt: T1, updatedAt: T1,
    }));
    const bound = await repo.bindWorkoutMutation({ mutationId: edited.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 17 });
    expect(bound.baseRevision).toBe(1);
  });

  it('blocks unknown remote state and uses only seeded server revision for an update', async () => {
    const unknown = await setup();
    await seedRemoteBaseline(unknown.factory, unknown.repo, unknown.created.outbox.mutationId, 'unknown');
    const unknownUpdate = await unknown.workouts.updateWorkoutSession(ID, 1, session(ID, 10), { now: T1 });
    await expect(unknown.repo.bindWorkoutMutation({ mutationId: unknownUpdate.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_OUTBOX_TRANSITION');
    expect((await unknown.repo.getOutboxRecord(unknownUpdate.outbox.mutationId))?.deliveryBinding)
      .toEqual({ version: 1, state: 'unbound' });

    const known = await setup();
    await seedRemoteBaseline(known.factory, known.repo, known.created.outbox.mutationId, 'active');
    const update = await known.workouts.updateWorkoutSession(ID, 1, session(ID, 10), { now: T1 });
    const bound = await known.repo.bindWorkoutMutation({ mutationId: update.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 9 });
    expect(bound.baseRevision).toBe(1);
  });

  it('binds a tombstone only against known active remote state', async () => {
    const { repo, workouts, created, factory } = await setup();
    await seedRemoteBaseline(factory, repo, created.outbox.mutationId, 'active');
    const deleted = await workouts.deleteWorkoutSession(ID, 1, { now: T1 });
    const bound = await repo.bindWorkoutMutation({ mutationId: deleted.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(bound.deliveryBinding).toMatchObject({ remoteCasBaseRevision: 9, wireEntityId: ID });
  });

  it('rejects a corrupted immutable outbox payload hash and preserves unbound state', async () => {
    const { repo, created, factory } = await setup();
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, payloadHash: 'f'.repeat(64),
    }));
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code');
    expect(await repo.getWorkoutRemoteIdByLocal(ID)).toBeNull();
  });

  it('does not rewrite an existing bound row when server scope rotates', async () => {
    const { repo, created } = await setup();
    const first = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await repo.persistWorkoutRemoteAuthority({ ...authority(repo, 'rotated-project'), verifiedAt: T1 },
      () => OWNER, () => namespace.deviceId);
    const second = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(second).toEqual(first);
  });

  it('uses refreshed server scope only for a separate never-bound first create', async () => {
    const { repo, workouts, created } = await setup();
    const first = await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await repo.persistWorkoutRemoteAuthority({ ...authority(repo, 'rotated-project'), verifiedAt: T1 },
      () => OWNER, () => namespace.deviceId);
    const fresh = await workouts.createWorkoutSession(session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), { now: T1 });
    const newlyBound = await repo.bindWorkoutMutation({ mutationId: fresh.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    expect(first.deliveryBinding).toMatchObject({ projectScope: 'nondefault-workout-project' });
    expect(newlyBound.deliveryBinding).toMatchObject({ projectScope: 'rotated-project' });
    expect(newlyBound.deliveryBinding).not.toEqual(first.deliveryBinding);
  });

  it('rejects a tampered bound digest instead of treating it as an idempotent bind', async () => {
    const { repo, created, factory } = await setup();
    await repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await mutateRaw(factory, 'outbox', [repo.namespaceKey, namespace.generationId, created.outbox.mutationId], row => ({
      ...row, deliveryBinding: { ...row.deliveryBinding, requestDigest: 'f'.repeat(64) },
    }));
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'CORRUPT_PERSISTED_RECORD');
  });

  it('rejects malformed persisted authority and UUID mappings', async () => {
    const { repo, created, factory } = await setup();
    await mutateRaw(factory, 'workout_remote_authority', [OWNER, repo.namespaceKey,
      namespace.generationId, 'health_workout_session'], row => ({ ...row, projectScope: '../invalid' }));
    await expect(repo.getWorkoutRemoteAuthority()).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
    await expect(repo.bindWorkoutMutation({ mutationId: created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId }))
      .rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');

    const mapped = await setup();
    await mapped.repo.bindWorkoutMutation({ mutationId: mapped.created.outbox.mutationId,
      currentAuthenticatedAccount: () => OWNER, currentDeviceId: () => namespace.deviceId });
    await mutateRaw(mapped.factory, 'workout_remote_ids', [OWNER, mapped.repo.namespaceKey,
      namespace.generationId, 'health_workout_session', ID], row => ({ ...row, wireEntityId: BINDING }));
    await expect(mapped.repo.getWorkoutRemoteIdByLocal(ID)).rejects.toHaveProperty('code', 'INVALID_RESERVED_RECORD');
  });
});
