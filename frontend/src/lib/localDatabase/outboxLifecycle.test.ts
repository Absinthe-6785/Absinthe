import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, LOCAL_DATABASE_VERSION,
  closeLocalDatabase, createDormantLocalDatabaseCapability, deriveOutboxIdempotencyKey,
  namespaceFingerprint, openLocalDatabase, type LocalDatabaseNamespace, type LocalDatabaseRepository, type OutboxRecord,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const namespace: LocalDatabaseNamespace = {
  userId: 'user-k322', projectRef: 'project-k322', deviceId: 'device-k322', generationId: 'generation-1', schemaVersion: 1,
};
const T0 = '2026-07-12T00:00:00.000Z';
const T1 = '2026-07-12T00:00:01.000Z';
const T2 = '2026-07-12T00:00:02.000Z';
const openRepositories: LocalDatabaseRepository[] = [];
let mutationCounter = 0;

function mutationId(): string {
  mutationCounter += 1;
  return `mut.00000000-0000-4000-8000-${String(mutationCounter).padStart(12, '0')}`;
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('delete_blocked'));
  });
}

function rawOpen(version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(LOCAL_DATABASE_NAME) : indexedDB.open(LOCAL_DATABASE_NAME, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

async function repo(scope = namespace): Promise<LocalDatabaseRepository> {
  const value = await openLocalDatabase(scope, { capability, mutationIdFactory: mutationId, clock: () => T0 });
  openRepositories.push(value); await value.initializeNamespace(); return value;
}

async function overwrite(record: OutboxRecord): Promise<void> {
  const db = await rawOpen();
  const transaction = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
  transaction.objectStore(LOCAL_DATABASE_STORES.outbox).put(record);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

beforeEach(async () => { mutationCounter = 0; await deleteDatabase().catch(() => undefined); });
afterEach(async () => {
  for (const value of openRepositories.splice(0)) closeLocalDatabase(value);
  await deleteDatabase().catch(() => undefined);
});

describe('K-322 atomic mutation identity and schema', () => {
  it('atomically commits create, update, and tombstone with repository-derived identities', async () => {
    const repository = await repo();
    const created = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: { value: 1 } }, now: T0,
    });
    const updated = await repository.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: 'n1', record: { value: 2 }, expectedRevision: 1 }, now: T1,
    });
    const tombstoned = await repository.commitLocalMutation({
      mutation: { mode: 'tombstone', domain: 'notes', entityId: 'n1', record: null, expectedRevision: 2 }, now: T2,
    });
    expect([created.outbox.localRevision, updated.outbox.localRevision, tombstoned.outbox.localRevision]).toEqual([1, 2, 3]);
    expect([created.outbox.operation, updated.outbox.operation, tombstoned.outbox.operation]).toEqual(['upsert', 'upsert', 'tombstone']);
    expect(new Set([created.outbox.mutationId, updated.outbox.mutationId, tombstoned.outbox.mutationId]).size).toBe(3);
    expect(new Set([created.outbox.idempotencyKey, updated.outbox.idempotencyKey, tombstoned.outbox.idempotencyKey]).size).toBe(3);
    expect(await repository.listOutboxMutations({ domain: 'notes', entityId: 'n1', limit: 10 })).toHaveLength(3);
  });

  it('derives deterministic collision-safe idempotency identities without payload data', async () => {
    const repository = await repo();
    const base = { namespaceKey: repository.namespaceKey, generationId: 'generation-1', domain: 'notes', entityId: 'n1', localRevision: 1, operation: 'upsert' as const };
    expect(deriveOutboxIdempotencyKey(base)).toBe(deriveOutboxIdempotencyKey(base));
    for (const changed of [
      { ...base, localRevision: 2 }, { ...base, operation: 'tombstone' as const }, { ...base, generationId: 'generation-2' },
      { ...base, domain: 'recipes' }, { ...base, entityId: 'n2' }, { ...base, namespaceKey: `${repository.namespaceKey}a` },
    ]) expect(deriveOutboxIdempotencyKey(changed)).not.toBe(deriveOutboxIdempotencyKey(base));
    const canonical = JSON.stringify(['absinthe-outbox-v1', base.namespaceKey, base.generationId, base.domain, base.entityId, base.localRevision, base.operation]);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)));
    const expected = `k322.${[...digest].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    expect(deriveOutboxIdempotencyKey(base)).toBe(expected);
    expect(deriveOutboxIdempotencyKey(base)).not.toContain('notes');
    expect(deriveOutboxIdempotencyKey(base)).not.toContain('n1');
  });

  it.each(['before_entity', 'before_outbox', 'after_writes'] as const)('rolls back entity and outbox on %s', async testOnlyAbortAt => {
    const repository = await repo();
    await expect(repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0, testOnlyAbortAt,
    })).rejects.toHaveProperty('code');
    expect(await repository.getEntity('notes', 'n1')).toBeNull();
    expect(await repository.listOutboxMutations({ limit: 10 })).toEqual([]);
  });

  it('rolls back entity creation on duplicate mutation and deterministic idempotency conflicts', async () => {
    const fixed = 'mut.00000000-0000-4000-8000-000000000009';
    const first = await openLocalDatabase(namespace, { capability, mutationIdFactory: () => fixed, clock: () => T0 });
    openRepositories.push(first); await first.initializeNamespace();
    await first.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    await expect(first.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n2', record: {} }, now: T0,
    })).rejects.toHaveProperty('code');
    expect(await first.getEntity('notes', 'n2')).toBeNull();

    const repository = await repo();
    const idempotencyKey = deriveOutboxIdempotencyKey({
      namespaceKey: repository.namespaceKey, generationId: 'generation-1', domain: 'recipes', entityId: 'r1', localRevision: 1, operation: 'upsert',
    });
    await overwrite({
      namespaceKey: repository.namespaceKey, generationId: 'generation-1', mutationId: mutationId(), domain: 'recipes', entityId: 'r1',
      operation: 'upsert', baseRevision: null, localRevision: 1, payloadMode: 'inline', payload: { kind: 'entity_snapshot', record: {} },
      payloadHash: null, idempotencyKey, status: 'pending', createdAt: T0, updatedAt: T0, availableAt: T0,
      attemptCount: 0, lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
      acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null, supersededByMutationId: null,
    });
    await expect(repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'recipes', entityId: 'r1', record: {} }, now: T0,
    })).rejects.toHaveProperty('code');
    expect(await repository.getEntity('recipes', 'r1')).toBeNull();
  });

  it('upgrades v1 outbox indexes without deleting persisted records', async () => {
    const fingerprint = await namespaceFingerprint(namespace);
    const legacy = await rawOpen(1, db => {
      db.createObjectStore(LOCAL_DATABASE_STORES.databaseMeta, { keyPath: 'namespaceKey' });
      const outbox = db.createObjectStore(LOCAL_DATABASE_STORES.outbox, { keyPath: ['namespaceKey', 'generationId', 'mutationId'] });
      outbox.createIndex('by_namespace_generation_status', ['namespaceKey', 'generationId', 'status']);
      outbox.createIndex('by_namespace_generation_entity', ['namespaceKey', 'generationId', 'domain', 'entityId']);
      outbox.createIndex('by_idempotency_key', ['namespaceKey', 'generationId', 'idempotencyKey'], { unique: true });
      db.createObjectStore(LOCAL_DATABASE_STORES.restoreSessions, { keyPath: ['namespaceKey', 'sessionId'] })
        .createIndex('by_namespace_status', ['namespaceKey', 'status']);
    });
    const transaction = legacy.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.outbox], 'readwrite');
    transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta).put({
      namespaceKey: fingerprint, databaseFormatVersion: 1, namespaceFingerprint: fingerprint,
      activeGenerationId: 'generation-1', createdAt: T0, minimumCompatibleSchemaVersion: 1,
      recoveryCompatible: true, migrationStatePointer: null, schemaVersion: 1,
    });
    transaction.objectStore(LOCAL_DATABASE_STORES.outbox).put({ namespaceKey: 'sentinel', generationId: 'g', mutationId: 'm', value: 'preserved' });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    legacy.close();
    const upgradedRepository = await openLocalDatabase(namespace, { capability, mutationIdFactory: mutationId, clock: () => T0 });
    openRepositories.push(upgradedRepository);
    const upgraded = await rawOpen();
    const store = upgraded.transaction(LOCAL_DATABASE_STORES.outbox).objectStore(LOCAL_DATABASE_STORES.outbox);
    expect([...store.indexNames]).toEqual(expect.arrayContaining([
      'by_namespace_generation_status_available', 'by_namespace_generation_status_lease', 'by_namespace_generation_entity_revision',
    ]));
    const restoreStore = upgraded.transaction(LOCAL_DATABASE_STORES.restoreSessions)
      .objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    expect([...restoreStore.indexNames]).toEqual(expect.arrayContaining([
      'by_namespace_package_id', 'by_namespace_package_digest', 'by_namespace_staging_generation',
    ]));
    const request = store.get(['sentinel', 'g', 'm']);
    expect(await new Promise(resolve => { request.onsuccess = () => resolve(request.result); })).toMatchObject({ value: 'preserved' });
    upgraded.close();
    expect((await upgradedRepository.readDatabaseMetadata()).databaseFormatVersion).toBe(LOCAL_DATABASE_VERSION);
  });

  it('upgrades a populated v2 database to v3 without rewriting entities, tombstones, outbox identity, or metadata scope', async () => {
    const fingerprint = await namespaceFingerprint(namespace);
    const legacy = await rawOpen(2, db => {
      const meta = db.createObjectStore(LOCAL_DATABASE_STORES.databaseMeta, { keyPath: 'namespaceKey' });
      meta.createIndex('by_schema_version', 'schemaVersion');
      const generations = db.createObjectStore(LOCAL_DATABASE_STORES.generations, { keyPath: ['namespaceKey', 'generationId'] });
      generations.createIndex('by_namespace_status', ['namespaceKey', 'status']);
      generations.createIndex('by_namespace_created', ['namespaceKey', 'createdAt']);
      generations.createIndex('one_active_per_namespace', 'activeNamespaceKey', { unique: true });
      const entities = db.createObjectStore(LOCAL_DATABASE_STORES.entities, { keyPath: ['namespaceKey', 'generationId', 'domain', 'entityId'] });
      entities.createIndex('by_namespace_generation_domain', ['namespaceKey', 'generationId', 'domain']);
      entities.createIndex('by_namespace_generation_owner', ['namespaceKey', 'generationId', 'ownerId']);
      entities.createIndex('by_namespace_generation_deleted', ['namespaceKey', 'generationId', 'deletionState']);
      entities.createIndex('by_namespace_generation_updated', ['namespaceKey', 'generationId', 'updatedAt']);
      const outbox = db.createObjectStore(LOCAL_DATABASE_STORES.outbox, { keyPath: ['namespaceKey', 'generationId', 'mutationId'] });
      outbox.createIndex('by_namespace_generation_status', ['namespaceKey', 'generationId', 'status']);
      outbox.createIndex('by_namespace_generation_entity', ['namespaceKey', 'generationId', 'domain', 'entityId']);
      outbox.createIndex('by_idempotency_key', ['namespaceKey', 'generationId', 'idempotencyKey'], { unique: true });
      outbox.createIndex('by_namespace_generation_status_available', ['namespaceKey', 'generationId', 'status', 'availableAt']);
      outbox.createIndex('by_namespace_generation_status_lease', ['namespaceKey', 'generationId', 'status', 'leaseExpiresAt']);
      outbox.createIndex('by_namespace_generation_entity_revision', ['namespaceKey', 'generationId', 'domain', 'entityId', 'localRevision'], { unique: true });
      db.createObjectStore(LOCAL_DATABASE_STORES.syncCheckpoints, { keyPath: ['namespaceKey', 'generationId', 'provider', 'stream'] })
        .createIndex('by_namespace_generation_provider', ['namespaceKey', 'generationId', 'provider']);
      db.createObjectStore(LOCAL_DATABASE_STORES.restoreSessions, { keyPath: ['namespaceKey', 'sessionId'] })
        .createIndex('by_namespace_status', ['namespaceKey', 'status']);
      db.createObjectStore(LOCAL_DATABASE_STORES.migrationState, { keyPath: ['namespaceKey', 'migrationId'] })
        .createIndex('by_namespace_phase', ['namespaceKey', 'phase']);
      const attachments = db.createObjectStore(LOCAL_DATABASE_STORES.attachmentState, { keyPath: ['namespaceKey', 'generationId', 'attachmentId'] });
      attachments.createIndex('by_namespace_generation_sync', ['namespaceKey', 'generationId', 'syncState']);
      attachments.createIndex('by_namespace_generation_updated', ['namespaceKey', 'generationId', 'updatedAt']);
    });
    const pendingId = 'mut.33333333-3333-4333-8333-333333333333';
    const acknowledgedId = 'mut.44444444-4444-4444-8444-444444444444';
    const pending: OutboxRecord = {
      namespaceKey: fingerprint, generationId: 'generation-1', mutationId: pendingId, domain: 'notes', entityId: 'pending-note',
      operation: 'upsert', baseRevision: null, localRevision: 1, payloadMode: 'inline', payload: { kind: 'entity_snapshot', record: { value: 1 } },
      payloadHash: null, createdAt: T0, updatedAt: T0, availableAt: T0, attemptCount: 0, status: 'pending',
      idempotencyKey: deriveOutboxIdempotencyKey({ namespaceKey: fingerprint, generationId: 'generation-1', domain: 'notes', entityId: 'pending-note', localRevision: 1, operation: 'upsert' }),
      lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null, acknowledgedAt: null,
      acknowledgedBy: null, remoteMutationRef: null, supersededByMutationId: null,
    };
    const acknowledged: OutboxRecord = {
      ...pending, mutationId: acknowledgedId, entityId: 'acknowledged-note', status: 'acknowledged', attemptCount: 1,
      updatedAt: T1, lastAttemptAt: T0, acknowledgedAt: T1, acknowledgedBy: 'worker',
      idempotencyKey: deriveOutboxIdempotencyKey({ namespaceKey: fingerprint, generationId: 'generation-1', domain: 'notes', entityId: 'acknowledged-note', localRevision: 1, operation: 'upsert' }),
    };
    const live = {
      namespaceKey: fingerprint, generationId: 'generation-1', domain: 'notes', entityId: 'pending-note', record: { value: 1 },
      revision: 1, createdAt: T0, updatedAt: T0, deletedAt: null, isDeleted: false, deletionState: 'active',
      ownerId: null, contentHash: null, source: null,
    };
    const tombstone = {
      ...live, entityId: 'deleted-note', record: { value: 2 }, deletedAt: T1, updatedAt: T1, isDeleted: true, deletionState: 'deleted',
    };
    const transaction = legacy.transaction([
      LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities, LOCAL_DATABASE_STORES.outbox,
    ], 'readwrite');
    transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta).put({
      namespaceKey: fingerprint, databaseFormatVersion: 2, namespaceFingerprint: fingerprint, activeGenerationId: 'generation-1',
      createdAt: T0, minimumCompatibleSchemaVersion: 1, recoveryCompatible: true, migrationStatePointer: null, schemaVersion: 1,
    });
    transaction.objectStore(LOCAL_DATABASE_STORES.generations).put({
      namespaceKey: fingerprint, generationId: 'generation-1', status: 'active', createdAt: T0, activatedAt: T0,
      predecessorGenerationId: null, creationReason: 'initial', schemaVersion: 1, validationState: 'valid',
      safeSourceReference: { kind: 'local', reference: 'initial' }, activeNamespaceKey: fingerprint,
    });
    transaction.objectStore(LOCAL_DATABASE_STORES.entities).put(live);
    transaction.objectStore(LOCAL_DATABASE_STORES.entities).put(tombstone);
    transaction.objectStore(LOCAL_DATABASE_STORES.outbox).put(pending);
    transaction.objectStore(LOCAL_DATABASE_STORES.outbox).put(acknowledged);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    legacy.close();

    const upgradedRepository = await openLocalDatabase(namespace, { capability, mutationIdFactory: mutationId, clock: () => T0 });
    openRepositories.push(upgradedRepository);
    expect((await upgradedRepository.readDatabaseMetadata()).databaseFormatVersion).toBe(3);
    expect(await upgradedRepository.getEntity('notes', 'pending-note')).toEqual(live);
    expect(await upgradedRepository.getEntity('notes', 'deleted-note')).toEqual(tombstone);
    expect(await upgradedRepository.listOutboxMutations({ limit: 10 })).toEqual([acknowledged, pending]);
    const upgraded = await rawOpen();
    const restore = upgraded.transaction(LOCAL_DATABASE_STORES.restoreSessions).objectStore(LOCAL_DATABASE_STORES.restoreSessions);
    expect([...restore.indexNames]).toEqual(expect.arrayContaining([
      'by_namespace_package_id', 'by_namespace_package_digest', 'by_namespace_staging_generation',
    ]));
    upgraded.close();
  });
});

describe('K-322 claim, retry, acknowledgement, and failure lifecycle', () => {
  it('claims one ordered mutation per entity and excludes concurrent workers', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: { value: 1 } }, now: T1 });
    await repository.commitLocalMutation({ mutation: { mode: 'update', domain: 'notes', entityId: 'n1', record: { value: 2 }, expectedRevision: 1 }, now: T0 });
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n2', record: {} }, now: T0 });
    const [left, right] = await Promise.all([
      repository.claimNextMutations({ workerId: 'worker-a', now: T2, leaseDurationMs: 10_000, limit: 10 }),
      repository.claimNextMutations({ workerId: 'worker-b', now: T2, leaseDurationMs: 10_000, limit: 10 }),
    ]);
    expect([...left, ...right]).toHaveLength(2);
    expect(new Set([...left, ...right].map(value => value.mutationId)).size).toBe(2);
    expect([...left, ...right].filter(value => value.entityId === 'n1').map(value => value.localRevision)).toEqual([1]);
    expect([...left, ...right].every(value => value.attemptCount === 1 && value.status === 'claimed')).toBe(true);
  });

  it('uses exact capped retry backoff, clears leases, and schedules no timer', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    await repository.claimNextMutations({ workerId: 'worker-a', now: T0, leaseDurationMs: 10_000, limit: 1 });
    await expect(repository.releaseClaimForRetry({
      mutationId: committed.outbox.mutationId, workerId: 'worker-b', now: T1, errorCode: 'transient', baseDelayMs: 1_000, maxDelayMs: 1_500,
    })).rejects.toMatchObject({ code: 'LEASE_OWNER_MISMATCH' });
    const retry = await repository.releaseClaimForRetry({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T1, errorCode: 'transient', baseDelayMs: 1_000, maxDelayMs: 1_500,
    });
    expect(retry).toMatchObject({ status: 'retry_wait', availableAt: '2026-07-12T00:00:02.000Z', leaseOwner: null, attemptCount: 1 });
    expect(await repository.claimNextMutations({ workerId: 'worker-a', now: '2026-07-12T00:00:01.999Z', leaseDurationMs: 10_000, limit: 1 })).toEqual([]);
    const reclaimed = await repository.claimNextMutations({ workerId: 'worker-a', now: T2, leaseDurationMs: 10_000, limit: 1 });
    expect(reclaimed[0]).toMatchObject({ attemptCount: 2, status: 'claimed' });
    const capped = await repository.releaseClaimForRetry({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T2,
      errorCode: 'transient', baseDelayMs: 1_000, maxDelayMs: 1_500,
    });
    expect(capped.availableAt).toBe('2026-07-12T00:00:03.500Z');
  });

  it('acknowledges only the lease owner, retains the record, and supports exact idempotent repeat', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    await repository.claimNextMutations({ workerId: 'worker-a', now: T0, leaseDurationMs: 10_000, limit: 1 });
    await expect(repository.acknowledgeMutation({ mutationId: committed.outbox.mutationId, workerId: 'worker-b', now: T1 }))
      .rejects.toMatchObject({ code: 'LEASE_OWNER_MISMATCH' });
    const acknowledged = await repository.acknowledgeMutation({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T1, remoteMutationRef: 'remote-1',
    });
    expect(acknowledged).toMatchObject({ status: 'acknowledged', acknowledgedAt: T1, leaseOwner: null, remoteMutationRef: 'remote-1' });
    expect(await repository.acknowledgeMutation({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T1, remoteMutationRef: 'remote-1',
    })).toEqual(acknowledged);
    await expect(repository.acknowledgeMutation({
      mutationId: committed.outbox.mutationId, workerId: 'worker-b', now: T1, remoteMutationRef: 'remote-1',
    })).rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    await expect(repository.acknowledgeMutation({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T2, remoteMutationRef: 'remote-1',
    })).rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    expect(await repository.getEntity('notes', 'n1')).not.toBeNull();
    expect((await repository.countOutboxByStatus()).acknowledged).toBe(1);
    await expect(repository.releaseClaimForRetry({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T2,
      errorCode: 'transient', baseDelayMs: 1_000, maxDelayMs: 10_000,
    })).rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    await expect(repository.resetPermanentFailure({ mutationId: committed.outbox.mutationId, now: T2 }))
      .rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
  });

  it('retains permanent failures and resets them explicitly without resetting attempts', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    await repository.claimNextMutations({ workerId: 'worker-a', now: T0, leaseDurationMs: 10_000, limit: 1 });
    const failed = await repository.markPermanentFailure({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T1, errorCode: 'invalid_remote',
    });
    expect(failed).toMatchObject({ status: 'permanent_failure', attemptCount: 1, leaseOwner: null });
    expect(await repository.claimNextMutations({ workerId: 'worker-a', now: T2, leaseDurationMs: 10_000, limit: 1 })).toEqual([]);
    const reset = await repository.resetPermanentFailure({ mutationId: committed.outbox.mutationId, now: T2 });
    expect(reset).toMatchObject({ status: 'pending', attemptCount: 1, availableAt: T2, lastErrorCode: null });
  });

  it('recovers expired leases only when explicitly requested and fences stale generations', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    await repository.claimNextMutations({ workerId: 'worker-a', now: T0, leaseDurationMs: 1_000, limit: 1 });
    expect(await repository.claimNextMutations({ workerId: 'worker-b', now: T2, leaseDurationMs: 1_000, limit: 1 })).toEqual([]);
    expect(await repository.claimNextMutations({
      workerId: 'worker-b', now: T2, leaseDurationMs: 1_000, limit: 1, recoverExpiredClaims: true,
    })).toMatchObject([{ status: 'claimed', leaseOwner: 'worker-b', attemptCount: 2 }]);
    await repository.createGeneration('generation-2', 'test'); await repository.activateGeneration('generation-2');
    await expect(repository.claimNextMutations({ workerId: 'worker-a', now: T2, leaseDurationMs: 1_000, limit: 1 }))
      .rejects.toMatchObject({ code: 'STALE_GENERATION' });
  });

  it('rejects unbounded claim requests', async () => {
    const repository = await repo();
    await expect(repository.claimNextMutations({ workerId: 'worker-a', now: T0, leaseDurationMs: 1_000, limit: 101 }))
      .rejects.toMatchObject({ code: 'INVALID_OUTBOX_QUERY' });
  });
});

describe('K-322 persisted validation and conservative scope', () => {
  it.each([
    ['invalid status', { status: 'unknown' }],
    ['pending lease', { leaseOwner: 'worker-a', leaseExpiresAt: T2 }],
    ['claimed without lease', { status: 'claimed', attemptCount: 1, lastAttemptAt: T0 }],
    ['retry without error', { status: 'retry_wait', attemptCount: 1, lastAttemptAt: T0 }],
    ['acknowledged without timestamp', { status: 'acknowledged', attemptCount: 1, lastAttemptAt: T0 }],
    ['superseded without target', { status: 'superseded' }],
    ['invalid attempt', { attemptCount: -1 }],
    ['invalid available time', { availableAt: 'bad-time' }],
    ['mismatched idempotency', { idempotencyKey: 'k322.invalid' }],
  ])('fails closed on persisted corruption: %s', async (_label, corruption) => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    await overwrite({ ...committed.outbox, ...corruption } as OutboxRecord);
    await expect(repository.getOutboxRecord(committed.outbox.mutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(repository.listOutboxMutations({ limit: 10 })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['zero attempts with timestamp', { attemptCount: 0, lastAttemptAt: T1 }],
    ['positive attempts without timestamp', { attemptCount: 1, lastAttemptAt: null }],
    ['last attempt before creation', { attemptCount: 1, lastAttemptAt: T0 }],
    ['last attempt after update', { attemptCount: 1, lastAttemptAt: T2 }],
    ['acknowledgement before last attempt', {
      status: 'acknowledged', attemptCount: 1, lastAttemptAt: T1,
      acknowledgedAt: T0, acknowledgedBy: 'worker-a',
    }],
    ['acknowledgement after update', {
      status: 'acknowledged', attemptCount: 1, lastAttemptAt: T1,
      acknowledgedAt: T2, acknowledgedBy: 'worker-a',
    }],
    ['acknowledgement before creation', {
      status: 'acknowledged', attemptCount: 1, lastAttemptAt: T0,
      acknowledgedAt: T0, acknowledgedBy: 'worker-a',
    }],
    ['claimed lease before last attempt', {
      status: 'claimed', attemptCount: 1, lastAttemptAt: T1,
      leaseOwner: 'worker-a', leaseExpiresAt: T0,
    }],
    ['negative attempt count', { attemptCount: -1 }],
    ['unsafe attempt count', { attemptCount: Number.MAX_SAFE_INTEGER + 1 }],
  ])('fails closed on persisted chronology corruption: %s', async (_label, corruption) => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T1,
    });
    await overwrite({ ...committed.outbox, ...corruption } as OutboxRecord);
    await expect(repository.getOutboxRecord(committed.outbox.mutationId))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(repository.listOutboxMutations({ limit: 10 }))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('accepts repository-generated chronology across every implemented lifecycle state', async () => {
    const repository = await repo();
    const first = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0,
    });
    expect(await repository.getOutboxRecord(first.outbox.mutationId)).toMatchObject({
      status: 'pending', attemptCount: 0, lastAttemptAt: null,
    });
    expect((await repository.claimNextMutations({
      workerId: 'worker-a', now: T0, leaseDurationMs: 1_000, limit: 1,
    }))[0]).toMatchObject({ status: 'claimed', attemptCount: 1, lastAttemptAt: T0 });
    expect(await repository.releaseClaimForRetry({
      mutationId: first.outbox.mutationId, workerId: 'worker-a', now: T1,
      errorCode: 'transient', baseDelayMs: 1_000, maxDelayMs: 1_000,
    })).toMatchObject({ status: 'retry_wait', attemptCount: 1, lastAttemptAt: T0, availableAt: T2 });
    await repository.claimNextMutations({ workerId: 'worker-a', now: T2, leaseDurationMs: 1_000, limit: 1 });
    expect(await repository.acknowledgeMutation({
      mutationId: first.outbox.mutationId, workerId: 'worker-a', now: T2,
    })).toMatchObject({ status: 'acknowledged', attemptCount: 2, lastAttemptAt: T2, acknowledgedAt: T2 });

    const second = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n2', record: {} }, now: T2,
    });
    await repository.claimNextMutations({ workerId: 'worker-b', now: T2, leaseDurationMs: 1_000, limit: 1 });
    expect(await repository.markPermanentFailure({
      mutationId: second.outbox.mutationId, workerId: 'worker-b', now: T2, errorCode: 'invalid_remote',
    })).toMatchObject({ status: 'permanent_failure', attemptCount: 1, lastAttemptAt: T2 });
    expect(await repository.resetPermanentFailure({ mutationId: second.outbox.mutationId, now: T2 }))
      .toMatchObject({ status: 'pending', attemptCount: 1, lastAttemptAt: T2 });
    expect(await repository.listOutboxMutations({ limit: 10 })).toHaveLength(2);
  });

  it('detects missing per-entity revision sequences and has no compaction or deletion API', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: T0 });
    const db = await rawOpen();
    const transaction = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
    transaction.objectStore(LOCAL_DATABASE_STORES.outbox).delete([repository.namespaceKey, 'generation-1', committed.outbox.mutationId]);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
    const revisionTwo: OutboxRecord = {
      ...committed.outbox, mutationId: mutationId(), baseRevision: 1, localRevision: 2,
      idempotencyKey: deriveOutboxIdempotencyKey({ ...committed.outbox, localRevision: 2 }),
    };
    await overwrite(revisionTwo);
    await expect(repository.listOutboxMutations({ limit: 10 })).rejects.toMatchObject({ code: 'OUTBOX_SEQUENCE_GAP' });
    expect('compactOutbox' in repository || 'deleteOutbox' in repository || 'markSuperseded' in repository).toBe(false);
  });
});
