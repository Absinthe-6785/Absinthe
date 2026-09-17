import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, LOCAL_DATABASE_VERSION,
  acknowledgeOutboxRecord, calculateRetryAvailableAt, closeLocalDatabase,
  canonicalPayloadSnapshot, createDormantLocalDatabaseCapability, deriveOutboxIdempotencyKey, deriveOutboxMutationId,
  hashCanonicalPayload, openLocalDatabase,
  type LocalDatabaseNamespace, type LocalDatabaseRepository, type LocalEntityEnvelope,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const T0 = '2026-09-17T00:00:00.000Z';
const T1 = '2026-09-17T00:00:01.000Z';
const T2 = '2026-09-17T00:00:02.000Z';
const namespace: LocalDatabaseNamespace = {
  userId: 'account-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const repositories: LocalDatabaseRepository[] = [];

async function repository(
  factory: IDBFactory,
  scope: LocalDatabaseNamespace = namespace,
): Promise<LocalDatabaseRepository> {
  const value = await openLocalDatabase(scope, { capability, indexedDBFactory: factory, clock: () => T0 });
  repositories.push(value);
  await value.initializeNamespace();
  return value;
}

function rawOpen(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function remoteEntity<T>(
  value: LocalDatabaseRepository,
  domain: string,
  entityId: string,
  record: T,
  revision = 1,
  createdAt = T0,
): LocalEntityEnvelope<T> {
  return {
    namespaceKey: value.namespaceKey, generationId: value.namespace.generationId, accountId: value.namespace.userId,
    domain, entityId, record: canonicalPayloadSnapshot(record), revision, localRevision: revision,
    serverRevision: revision + 10, createdAt, updatedAt: T1, deletedAt: null, isDeleted: false,
    deletionState: 'active', ownerId: value.namespace.userId, contentHash: hashCanonicalPayload(record),
    pendingMutationId: null, lastRemoteMutationRef: `remote-${entityId}-${revision}`,
    source: { kind: 'remote', reference: 'supabase' }, restoreProvenance: null,
  };
}

afterEach(() => {
  for (const value of repositories.splice(0)) closeLocalDatabase(value);
});

describe('REL-05D database, account namespace, and atomic entity/outbox invariants', () => {
  it('creates the deterministic v5 durable sync stores and keeps accounts isolated', async () => {
    const factory = new IDBFactory();
    const accountA = await repository(factory);
    const accountB = await repository(factory, { ...namespace, userId: 'account-b' });
    await accountA.createEntity({ domain: 'notes', entityId: 'note-1', record: { body: 'A' } });

    expect(await accountB.getEntity('notes', 'note-1')).toBeNull();
    expect(await accountB.listOutboxMutations({ limit: 10 })).toEqual([]);

    const db = await rawOpen(factory);
    expect(db.version).toBe(LOCAL_DATABASE_VERSION);
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(Object.values(LOCAL_DATABASE_STORES)));
    const transaction = db.transaction([LOCAL_DATABASE_STORES.conflicts, LOCAL_DATABASE_STORES.workerLeases], 'readonly');
    expect([...transaction.objectStore(LOCAL_DATABASE_STORES.conflicts).indexNames])
      .toEqual(expect.arrayContaining(['by_namespace_generation_entity', 'by_namespace_generation_resolution', 'by_account']));
    expect([...transaction.objectStore(LOCAL_DATABASE_STORES.workerLeases).indexNames])
      .toEqual(expect.arrayContaining(['by_namespace_generation_owner', 'by_namespace_generation_expiry', 'by_account']));
    db.close();
  });

  it('commits both records together and preserves the previous state after every injected abort', async () => {
    const factory = new IDBFactory();
    const value = await repository(factory);
    await expect(value.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'new', record: { body: 'never' } },
      now: T0, testOnlyAbortAt: 'before_outbox',
    })).rejects.toHaveProperty('code');
    expect(await value.getEntity('notes', 'new')).toBeNull();
    expect(await value.listOutboxMutations({ limit: 10 })).toEqual([]);

    const created = await value.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'stable', record: { body: 'before' } }, now: T0,
    });
    await expect(value.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: 'stable', record: { body: 'after' }, expectedRevision: 1 },
      now: T1, testOnlyAbortAt: 'after_writes',
    })).rejects.toHaveProperty('code');
    expect(await value.getEntity('notes', 'stable')).toEqual(created.entity);
    expect(await value.listOutboxMutations({ domain: 'notes', entityId: 'stable', limit: 10 })).toEqual([created.outbox]);
  });

  it('derives deterministic identities and detached payload snapshots with no secret persistence', async () => {
    const left = await repository(new IDBFactory());
    const right = await repository(new IDBFactory());
    const record = { z: 1, nested: { b: 2, a: 1 } };
    const leftCommit = await left.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'deterministic', record }, now: T0,
    });
    const rightCommit = await right.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'deterministic', record: { nested: { a: 1, b: 2 }, z: 1 } }, now: T0,
    });
    expect(leftCommit.outbox.mutationId).toBe(rightCommit.outbox.mutationId);
    expect(leftCommit.outbox.idempotencyKey).toBe(rightCommit.outbox.idempotencyKey);
    expect(leftCommit.entity.contentHash).toBe(rightCommit.entity.contentHash);
    expect(leftCommit.outbox.payloadHash).toBe(rightCommit.outbox.payloadHash);
    record.nested.a = 99;
    expect((await left.getEntity<typeof record>('notes', 'deterministic'))?.record.nested.a).toBe(1);
    expect((await left.getOutboxRecord(leftCommit.outbox.mutationId))?.payload).toEqual({
      kind: 'entity_snapshot', record: { nested: { a: 1, b: 2 }, z: 1 },
    });

    await expect(left.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'secret', record: { access_token: 'not-durable' } }, now: T0,
    })).rejects.toMatchObject({ code: 'INVALID_ENTITY' });
    expect(await left.getEntity('notes', 'secret')).toBeNull();

    const hostile = JSON.parse('{"__proto__":{"value":"alpha"},"constructor":"ctor","prototype":"proto"}') as Record<string, unknown>;
    const hostileCommit = await left.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'hostile-keys', record: hostile }, now: T0,
    });
    const persisted = await left.getEntity<Record<string, unknown>>('notes', 'hostile-keys');
    expect(Object.prototype.hasOwnProperty.call(persisted?.record, '__proto__')).toBe(true);
    expect(persisted?.record.__proto__).toEqual({ value: 'alpha' });
    expect(persisted?.record.constructor).toBe('ctor');
    expect(persisted?.record.prototype).toBe('proto');
    const changed = JSON.parse('{"__proto__":{"value":"beta"},"constructor":"ctor","prototype":"proto"}') as Record<string, unknown>;
    const changedConstructor = JSON.parse('{"__proto__":{"value":"alpha"},"constructor":"ctor-2","prototype":"proto"}') as Record<string, unknown>;
    const changedPrototype = JSON.parse('{"__proto__":{"value":"alpha"},"constructor":"ctor","prototype":"proto-2"}') as Record<string, unknown>;
    expect(hashCanonicalPayload(hostile)).not.toBe(hashCanonicalPayload(changed));
    expect(new Set([hostile, changed, changedConstructor, changedPrototype].map(hashCanonicalPayload))).toHaveProperty('size', 4);
    expect(hostileCommit.entity.contentHash).toBe(hashCanonicalPayload(hostile));
  });

  it('fails closed when a v5 durable record loses or changes its account authority', async () => {
    const factory = new IDBFactory(); const value = await repository(factory);
    await value.createEntity({ domain: 'notes', entityId: 'note-1', record: { body: 'scoped' } });
    const db = await rawOpen(factory);
    const transaction = db.transaction(LOCAL_DATABASE_STORES.entities, 'readwrite');
    const store = transaction.objectStore(LOCAL_DATABASE_STORES.entities);
    const key = [value.namespaceKey, namespace.generationId, 'notes', 'note-1'];
    const request = store.get(key);
    request.onsuccess = () => {
      const corrupted = { ...request.result };
      delete corrupted.accountId;
      store.put(corrupted);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    await expect(value.getEntity('notes', 'note-1')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('represents deletion only as a tombstone and requires an explicit restore transition', async () => {
    const value = await repository(new IDBFactory());
    await value.createEntity({ domain: 'notes', entityId: 'note-1', record: { body: 'live' } });
    const tombstone = await value.tombstoneEntity('notes', 'note-1', 1, T1);
    expect(tombstone).toMatchObject({ deletedAt: T1, deletionState: 'deleted', localRevision: 2 });
    await expect(value.updateEntity({
      domain: 'notes', entityId: 'note-1', record: { body: 'implicit' }, expectedRevision: 2,
    })).rejects.toMatchObject({ code: 'TOMBSTONE_REACTIVATION_BLOCKED' });
    const restored = await value.commitLocalMutation({
      mutation: { mode: 'restore', domain: 'notes', entityId: 'note-1', record: { body: 'restored' }, expectedRevision: 2 },
      now: T2,
    });
    expect(restored).toMatchObject({
      entity: { deletedAt: null, deletionState: 'active', localRevision: 3 },
      outbox: { operation: 'restore', localRevision: 3 },
    });
  });
});

describe('REL-05D outbox state machine and ordering', () => {
  it('uses pure deterministic retry math and rejects impossible transitions', async () => {
    expect(calculateRetryAvailableAt({ now: T1, attemptCount: 3, baseDelayMs: 1_000, maxDelayMs: 2_500 }))
      .toBe('2026-09-17T00:00:03.500Z');
    const value = await repository(new IDBFactory());
    const committed = await value.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'note-1', record: {} }, now: T0,
    });
    expect(() => acknowledgeOutboxRecord(committed.outbox, {
      ownerId: 'worker-a', now: T1, remoteMutationRef: null, acknowledgedRevision: null, serverCommittedAt: null,
    })).toThrowError(expect.objectContaining({ code: 'INVALID_OUTBOX_TRANSITION' }));
    await value.claimNextMutations({ workerId: 'worker-a', now: T0, leaseDurationMs: 1_000, limit: 1 });
    const conflict = await value.markMutationConflict({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T1, errorCode: 'revision_conflict',
    });
    expect(conflict).toMatchObject({ status: 'conflict', leaseOwner: null, lastErrorCode: 'revision_conflict' });
    await expect(value.acknowledgeMutation({
      mutationId: committed.outbox.mutationId, workerId: 'worker-a', now: T2,
    })).rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
  });

  it('enforces per-entity order, allows only unclaimed supersession, and recovers expired claims', async () => {
    const value = await repository(new IDBFactory());
    const first = await value.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'note-1', record: { revision: 1 } }, now: T0,
    });
    const second = await value.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: 'note-1', record: { revision: 2 }, expectedRevision: 1 }, now: T1,
    });
    expect((await value.listNextDeliverableMutations({ now: T1, limit: 10 })).map(item => item.mutationId))
      .toEqual([first.outbox.mutationId]);
    expect(await value.supersedePendingMutation(first.outbox.mutationId, second.outbox.mutationId, T1))
      .toMatchObject({ status: 'superseded', supersededByMutationId: second.outbox.mutationId });
    expect((await value.listNextDeliverableMutations({ now: T1, limit: 10 })).map(item => item.mutationId))
      .toEqual([second.outbox.mutationId]);
    await value.claimNextMutations({ workerId: 'worker-a', now: T1, leaseDurationMs: 1_000, limit: 1 });
    await expect(value.supersedePendingMutation(second.outbox.mutationId, first.outbox.mutationId, T2))
      .rejects.toMatchObject({ code: 'INVALID_OUTBOX_TRANSITION' });
    const recovered = await value.claimNextMutations({
      workerId: 'worker-b', now: T2, leaseDurationMs: 1_000, limit: 1, recoverExpiredClaims: true,
    });
    expect(recovered[0]).toMatchObject({ mutationId: second.outbox.mutationId, status: 'claimed', leaseOwner: 'worker-b', attemptCount: 2 });
  });

  it('binds deterministic mutation and idempotency identities to canonical payload content', () => {
    const payloadHash = hashCanonicalPayload({ kind: 'entity_snapshot', record: { body: 'same' } });
    const identity = {
      namespaceKey: 'namespace', generationId: 'generation', domain: 'notes', entityId: 'note-1',
      localRevision: 7, operation: 'restore' as const, payloadHash,
    };
    expect(deriveOutboxMutationId(identity)).toBe(deriveOutboxMutationId({ ...identity }));
    expect(deriveOutboxIdempotencyKey(identity)).toBe(deriveOutboxIdempotencyKey({ ...identity }));
    expect(deriveOutboxMutationId({ ...identity, localRevision: 8 })).not.toBe(deriveOutboxMutationId(identity));
    const changed = { ...identity, payloadHash: hashCanonicalPayload({ kind: 'entity_snapshot', record: { body: 'different' } }) };
    expect(deriveOutboxMutationId(changed)).not.toBe(deriveOutboxMutationId(identity));
    expect(deriveOutboxIdempotencyKey(changed)).not.toBe(deriveOutboxIdempotencyKey(identity));
  });

  it('rejects a persisted v5 outbox whose payload hash no longer binds its identities', async () => {
    const factory = new IDBFactory(); const value = await repository(factory);
    const committed = await value.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'tampered', record: { body: 'before' } }, now: T0,
    });
    const db = await rawOpen(factory);
    const transaction = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
    const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
    const request = store.get([value.namespaceKey, namespace.generationId, committed.outbox.mutationId]);
    request.onsuccess = () => {
      const record = request.result;
      record.payload = { kind: 'entity_snapshot', record: { body: 'after' } };
      record.payloadHash = hashCanonicalPayload(record.payload);
      store.put(record);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    await expect(value.getOutboxRecord(committed.outbox.mutationId))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });
});

describe('REL-05D checkpoints, conflicts, and worker ownership', () => {
  it('advances checkpoints monotonically, aborts atomically, and invalidates without deleting entities', async () => {
    const factory = new IDBFactory(); const value = await repository(factory);
    await value.createEntity({ domain: 'notes', entityId: 'note-1', record: { body: 'authority' } });
    await value.advanceSyncCheckpoint({
      provider: 'supabase', stream: 'notes', checkpointValue: 'cursor-5', sequence: 5,
      serverEpoch: 'epoch-1', now: T0,
    });
    await expect(value.advanceSyncCheckpoint({
      provider: 'supabase', stream: 'notes', checkpointValue: 'cursor-4', sequence: 4,
      serverEpoch: 'epoch-1', now: T1,
    })).rejects.toMatchObject({ code: 'CHECKPOINT_REGRESSION' });
    await expect(value.advanceSyncCheckpoint({
      provider: 'supabase', stream: 'notes', checkpointValue: 'cursor-6', sequence: 6,
      serverEpoch: 'epoch-1', now: T1, testOnlyAbort: true,
    })).rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
    expect(await value.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ checkpointValue: 'cursor-5', sequence: 5 });
    expect(await value.invalidateSyncCheckpoint({ provider: 'supabase', stream: 'notes', reason: 'full_resync', now: T1 }))
      .toMatchObject({ invalidatedAt: T1, invalidationReason: 'full_resync' });
    expect(await value.advanceSyncCheckpoint({
      provider: 'supabase', stream: 'notes', checkpointValue: 'cursor-new-1', sequence: 1,
      serverEpoch: 'epoch-2', now: T2,
    })).toMatchObject({ sequence: 1, serverEpoch: 'epoch-2', invalidatedAt: null });
    expect(await value.getEntity('notes', 'note-1')).not.toBeNull();

    const other = await repository(factory, { ...namespace, userId: 'account-b' });
    expect(await other.getSyncCheckpoint('supabase', 'notes')).toBeNull();
  });

  it('atomically commits a bounded remote entity batch with its domain checkpoint', async () => {
    const factory = new IDBFactory(); const value = await repository(factory);
    const entity = remoteEntity(value, 'notes', 'remote-1', { body: 'server' });
    const committed = await value.commitRemoteEntityBatch({
      namespaceKey: value.namespaceKey, generationId: namespace.generationId, accountId: namespace.userId,
      domain: 'notes', provider: 'supabase', checkpointValue: 'cursor-1', sequence: 1,
      serverEpoch: 'epoch-1', now: T1, entities: [{ expectedLocalRevision: null, entity }],
    });
    expect(committed).toEqual({ entities: [entity], checkpoint: expect.objectContaining({
      provider: 'supabase', stream: 'notes', checkpointValue: 'cursor-1', sequence: 1,
    }) });
    expect(await value.getEntity('notes', 'remote-1')).toEqual(entity);
    expect(await value.getSyncCheckpoint('supabase', 'notes')).toEqual(committed.checkpoint);
  });

  it('rolls back remote entity writes before and after checkpoint insertion', async () => {
    const factory = new IDBFactory(); const value = await repository(factory);
    for (const [entityId, testOnlyAbortAt] of [
      ['before', 'before_checkpoint'], ['after', 'after_checkpoint'],
    ] as const) {
      await expect(value.commitRemoteEntityBatch({
        namespaceKey: value.namespaceKey, generationId: namespace.generationId, accountId: namespace.userId,
        domain: 'notes', provider: 'supabase', checkpointValue: `cursor-${entityId}`, sequence: 1,
        serverEpoch: 'epoch-1', now: T1,
        entities: [{ expectedLocalRevision: null, entity: remoteEntity(value, 'notes', entityId, { body: entityId }) }],
        testOnlyAbortAt,
      })).rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
      expect(await value.getEntity('notes', entityId)).toBeNull();
      expect(await value.getSyncCheckpoint('supabase', 'notes')).toBeNull();
    }
  });

  it('fences remote batches by namespace/generation and isolates account/domain checkpoints', async () => {
    const factory = new IDBFactory(); const accountA = await repository(factory);
    const base = {
      namespaceKey: accountA.namespaceKey, generationId: namespace.generationId, accountId: namespace.userId,
      domain: 'notes', provider: 'supabase', checkpointValue: 'cursor-1', sequence: 1,
      serverEpoch: 'epoch-1', now: T1,
      entities: [{ expectedLocalRevision: null, entity: remoteEntity(accountA, 'notes', 'scoped', { body: 'server' }) }],
    };
    await expect(accountA.commitRemoteEntityBatch({ ...base, namespaceKey: 'wrong-namespace' }))
      .rejects.toMatchObject({ code: 'NAMESPACE_MISMATCH' });
    await expect(accountA.commitRemoteEntityBatch({ ...base, generationId: 'generation-stale' }))
      .rejects.toMatchObject({ code: 'STALE_GENERATION' });
    expect(await accountA.getEntity('notes', 'scoped')).toBeNull();
    expect(await accountA.getSyncCheckpoint('supabase', 'notes')).toBeNull();
    await accountA.commitRemoteEntityBatch(base);
    await accountA.commitRemoteEntityBatch({
      ...base, domain: 'health', checkpointValue: 'health-cursor',
      entities: [{ expectedLocalRevision: null, entity: remoteEntity(accountA, 'health', 'health-1', { value: 7 }) }],
    });
    expect(await accountA.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ checkpointValue: 'cursor-1' });
    expect(await accountA.getSyncCheckpoint('supabase', 'health')).toMatchObject({ checkpointValue: 'health-cursor' });
    const accountB = await repository(factory, { ...namespace, userId: 'account-b' });
    expect(await accountB.getSyncCheckpoint('supabase', 'notes')).toBeNull();
    expect(await accountB.getEntity('notes', 'scoped')).toBeNull();
  });

  it('preserves both conflict candidates as detached, account-scoped evidence', async () => {
    const factory = new IDBFactory(); const accountA = await repository(factory);
    const localCandidate = { body: 'local' }; const remoteCandidate = { body: 'remote' };
    const conflict = await accountA.recordConflict({
      conflictId: 'conflict-1', domain: 'notes', entityId: 'note-1',
      localCandidate, remoteCandidate, remoteMetadata: { source: 'server' },
      localRevision: 2, serverRevision: 7, conflictType: 'concurrent_update', now: T0,
    });
    localCandidate.body = 'mutated'; remoteCandidate.body = 'mutated';
    expect(conflict.localContentHash).toBe(hashCanonicalPayload({ body: 'local' }));
    expect(await accountA.listConflicts('notes', 'note-1')).toEqual([expect.objectContaining({
      localCandidate: { body: 'local' }, remoteCandidate: { body: 'remote' }, resolutionState: 'unresolved',
    })]);
    expect(await accountA.resolveConflict({
      conflictId: 'conflict-1', resolutionState: 'resolved_merged', now: T1,
    })).toMatchObject({
      localCandidate: { body: 'local' }, remoteCandidate: { body: 'remote' },
      resolutionState: 'resolved_merged', resolvedAt: T1,
    });
    const accountB = await repository(factory, { ...namespace, userId: 'account-b' });
    expect(await accountB.listConflicts()).toEqual([]);
  });

  it('acquires, renews, releases, and reclaims expired account-scoped worker leases', async () => {
    const factory = new IDBFactory(); const accountA = await repository(factory);
    const initial = await accountA.acquireWorkerLease({ leaseName: 'sync', ownerId: 'worker-a', now: T0, durationMs: 1_000 });
    expect(initial).toMatchObject({ ownerId: 'worker-a', expiresAt: T1, leaseEpoch: 1, releasedAt: null });
    await expect(accountA.acquireWorkerLease({ leaseName: 'sync', ownerId: 'worker-b', now: T0, durationMs: 1_000 }))
      .rejects.toMatchObject({ code: 'WORKER_LEASE_HELD' });
    await expect(accountA.renewWorkerLease({
      leaseName: 'sync', ownerId: 'worker-b', leaseToken: initial.leaseToken, now: T0, durationMs: 1_000,
    }))
      .rejects.toMatchObject({ code: 'LEASE_OWNER_MISMATCH' });
    expect(await accountA.renewWorkerLease({
      leaseName: 'sync', ownerId: 'worker-a', leaseToken: initial.leaseToken,
      now: '2026-09-17T00:00:00.500Z', durationMs: 1_000,
    }))
      .toMatchObject({ ownerId: 'worker-a', expiresAt: '2026-09-17T00:00:01.500Z' });
    const reclaimed = await accountA.acquireWorkerLease({ leaseName: 'sync', ownerId: 'worker-a', now: T2, durationMs: 1_000 });
    expect(reclaimed).toMatchObject({ ownerId: 'worker-a', leaseEpoch: 2 });
    expect(reclaimed.leaseToken).not.toBe(initial.leaseToken);
    await expect(accountA.renewWorkerLease({
      leaseName: 'sync', ownerId: 'worker-a', leaseToken: initial.leaseToken, now: T2, durationMs: 1_000,
    })).rejects.toMatchObject({ code: 'LEASE_FENCE_MISMATCH' });
    await expect(accountA.releaseWorkerLease({
      leaseName: 'sync', ownerId: 'worker-a', leaseToken: initial.leaseToken, now: T2,
    })).rejects.toMatchObject({ code: 'LEASE_FENCE_MISMATCH' });
    await accountA.releaseWorkerLease({
      leaseName: 'sync', ownerId: 'worker-a', leaseToken: reclaimed.leaseToken, now: T2,
    });
    expect(await accountA.getWorkerLease('sync')).toBeNull();

    const reacquired = await accountA.acquireWorkerLease({ leaseName: 'sync', ownerId: 'worker-a', now: T2, durationMs: 1_000 });
    expect(reacquired).toMatchObject({ leaseEpoch: 3 });
    expect(reacquired.leaseToken).not.toBe(reclaimed.leaseToken);

    const accountB = await repository(factory, { ...namespace, userId: 'account-b' });
    await expect(accountB.acquireWorkerLease({ leaseName: 'sync', ownerId: 'worker-c', now: T0, durationMs: 1_000 }))
      .resolves.toMatchObject({ accountId: 'account-b', ownerId: 'worker-c' });
  });
});

describe('REL-05D dormant transport boundary', () => {
  it('fails closed without account authority and contains no transport or production writer hook', async () => {
    await expect(openLocalDatabase({ ...namespace, userId: '' }, {
      capability, indexedDBFactory: new IDBFactory(),
    })).rejects.toMatchObject({ code: 'INVALID_NAMESPACE' });
    const files = [
      'repository.ts', 'schema.ts', 'canonicalPayload.ts', 'outboxStateMachine.ts', 'outboxIdentity.ts',
    ];
    const source = files.map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
    expect(source).not.toMatch(/\/api\/sync\/v[12]\/mutations|fetch\s*\(|navigator\.locks|addEventListener\s*\(\s*['"](?:focus|online)/);
    expect(source).not.toMatch(/notesAccountAuthority|healthLocalRepository|useNotesStore|HealthView|PlannerView|RecipeView/);
  });
});
