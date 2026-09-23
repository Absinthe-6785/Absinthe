import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeLocalDatabase,
  createDormantLocalDatabaseCapability,
  openLocalDatabase,
  type CommitRemoteConvergenceBatchInput,
  type LocalDatabaseNamespace,
  type LocalDatabaseRepository,
  type RemoteConvergenceCandidate,
} from './index';

const T0 = '2026-09-23T00:00:00.000Z';
const T1 = '2026-09-23T00:01:00.000Z';
const T2 = '2026-09-23T00:02:00.000Z';
const T3 = '2026-09-23T00:03:00.000Z';
const scope: LocalDatabaseNamespace = {
  userId: 'account-convergence', projectRef: 'project-convergence',
  deviceId: 'device-convergence', generationId: 'generation-convergence', schemaVersion: 1,
};
const capability = createDormantLocalDatabaseCapability('test');
const opened: LocalDatabaseRepository[] = [];

async function makeRepository(factory = new IDBFactory(), namespace = scope): Promise<LocalDatabaseRepository> {
  const repository = await openLocalDatabase(namespace, { capability, indexedDBFactory: factory, clock: () => T0 });
  opened.push(repository);
  await repository.initializeNamespace();
  return repository;
}

function candidate(
  entityId: string,
  overrides: Partial<RemoteConvergenceCandidate<{ value: string }>> = {},
): RemoteConvergenceCandidate<{ value: string }> {
  return {
    entityId,
    record: { value: `remote-${entityId}` },
    serverRevision: 1,
    remoteMutationRef: `remote-${entityId}-1`,
    createdAt: T0,
    updatedAt: T1,
    deletedAt: null,
    ownerId: scope.userId,
    source: { kind: 'remote', reference: 'supabase' },
    ...overrides,
  };
}

function batch(
  repository: LocalDatabaseRepository,
  changes: CommitRemoteConvergenceBatchInput['changes'],
  overrides: Partial<CommitRemoteConvergenceBatchInput> = {},
): CommitRemoteConvergenceBatchInput {
  return {
    namespaceKey: repository.namespaceKey,
    generationId: scope.generationId,
    accountId: scope.userId,
    domain: 'notes',
    provider: 'supabase',
    checkpointValue: 'cursor-1',
    sequence: 1,
    serverEpoch: 'epoch-1',
    now: T1,
    changes,
    ...overrides,
  };
}

afterEach(() => {
  for (const repository of opened.splice(0)) closeLocalDatabase(repository);
});

describe('REL-05G2 generic remote convergence batch', () => {
  it('atomically applies remote active entities and remote tombstones without local pending state', async () => {
    const repository = await makeRepository();
    const active = await repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('remote-active') },
    ]));
    expect(active.entities[0]).toMatchObject({
      domain: 'notes', entityId: 'remote-active', revision: 1, localRevision: 1,
      serverRevision: 1, pendingMutationId: null, isDeleted: false,
    });
    expect(active.checkpoint).toMatchObject({ sequence: 1, stream: 'notes', checkpointValue: 'cursor-1' });

    const deleted = await repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('remote-active', {
        record: { value: 'remote-deleted' }, serverRevision: 2, remoteMutationRef: 'remote-active-2',
        createdAt: T1, updatedAt: T2, deletedAt: T2,
      }) },
    ], { checkpointValue: 'cursor-2', sequence: 2, now: T2 }));
    expect(deleted.entities[0]).toMatchObject({
      revision: 2, localRevision: 2, serverRevision: 2, isDeleted: true,
      deletionState: 'deleted', deletedAt: T2, createdAt: T0, record: { value: 'remote-deleted' },
    });
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 2, checkpointValue: 'cursor-2' });
  });

  it('preserves pending local active state against both remote active and remote deletion candidates', async () => {
    const repository = await makeRepository();
    const localActive = await repository.createEntity({ domain: 'notes', entityId: 'local-active', record: { value: 'keep-me' } });
    const localActiveOutbox = await repository.getOutboxRecord(localActive.pendingMutationId!);
    const result = await repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('local-active', {
        serverRevision: 7, createdAt: T1, updatedAt: T2,
      }) },
    ]));
    expect(result.conflicts[0]).toMatchObject({
      entityId: 'local-active', mutationId: localActive.pendingMutationId, serverRevision: 7,
      conflictType: 'remote_change_with_pending_local', resolutionState: 'unresolved',
      remoteMetadata: { isDeleted: false, remoteMutationRef: 'remote-local-active-1' },
    });
    expect(result.conflicts[0]!.remoteCandidate).toMatchObject({
      isDeleted: false, createdAt: T1, contentHash: expect.any(String),
    });
    expect(await repository.getEntity('notes', 'local-active')).toEqual(localActive);
    expect(await repository.getOutboxRecord(localActive.pendingMutationId!)).toEqual(localActiveOutbox);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 1 });

    const localForDelete = await repository.createEntity({ domain: 'notes', entityId: 'local-for-delete', record: { value: 'also keep' } });
    const deletedConflict = await repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('local-for-delete', {
        serverRevision: 8, remoteMutationRef: 'delete-ref', createdAt: T1, updatedAt: T2, deletedAt: T2,
      }) },
    ], { checkpointValue: 'cursor-2', sequence: 2, now: T2 }));
    expect(deletedConflict.conflicts[0]).toMatchObject({
      entityId: 'local-for-delete', conflictType: 'remote_delete_with_pending_local', serverRevision: 8,
      remoteMetadata: { isDeleted: true, deletedAt: T2, remoteMutationRef: 'delete-ref' },
      remoteCandidate: { createdAt: T1 },
    });
    expect(await repository.getEntity('notes', 'local-for-delete')).toEqual(localForDelete);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 2 });
  });

  it('preserves a pending local tombstone against a remote active candidate', async () => {
    const repository = await makeRepository();
    await repository.createEntity({ domain: 'notes', entityId: 'local-tombstone', record: { value: 'local' } });
    const tombstone = await repository.commitLocalMutation({
      mutation: { mode: 'tombstone', domain: 'notes', entityId: 'local-tombstone', record: null, expectedRevision: 1 }, now: T1,
    });
    const result = await repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 2, candidate: candidate('local-tombstone', {
        serverRevision: 3, remoteMutationRef: 'remote-active-ref', createdAt: T1, updatedAt: T2,
      }) },
    ]));
    expect(result.conflicts[0]).toMatchObject({
      entityId: 'local-tombstone', mutationId: tombstone.outbox.mutationId,
      remoteMetadata: { isDeleted: false, deletedAt: null },
      remoteCandidate: { createdAt: T1 },
    });
    expect(await repository.getEntity('notes', 'local-tombstone')).toEqual(tombstone.entity);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 1 });
  });

  it('keeps remote-to-local outbox continuity for UUID, opaque, and null remote refs', async () => {
    for (const [entityId, remoteMutationRef] of [
      ['uuid-ref', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      ['opaque-ref', 'remote-change-1'],
      ['null-ref', null],
    ] as const) {
      const repository = await makeRepository();
      await repository.commitRemoteConvergenceBatch(batch(repository, [
        { expectedLocalRevision: null, candidate: candidate(entityId, { remoteMutationRef }) },
      ]));
      const updated = await repository.commitLocalMutation({
        mutation: { mode: 'update', domain: 'notes', entityId, record: { value: 'local-edit' }, expectedRevision: 1 },
        now: T2,
      });
      expect(updated.entity).toMatchObject({ revision: 2, localRevision: 2, serverRevision: 1 });
      expect(updated.outbox).toMatchObject({
        baseRevision: 1, localRevision: 2,
        remoteSequenceBoundary: { baselineLocalRevision: 1, baselineServerRevision: 1, remoteMutationRef },
      });
      expect(await repository.getOutboxRecord(updated.outbox.mutationId)).toEqual(updated.outbox);
      expect(await repository.listOutboxMutations({ domain: 'notes', entityId, limit: 10 })).toHaveLength(1);
      expect(await repository.listNextDeliverableMutations({ now: T2, limit: 10 })).toHaveLength(1);
      expect(await repository.claimNextMutations({
        workerId: 'worker-convergence', now: T2, leaseDurationMs: 1_000, limit: 10,
      })).toMatchObject([{ mutationId: updated.outbox.mutationId, status: 'claimed' }]);
    }
  });

  it('bridges a remote-applied revision after acknowledged local outbox history', async () => {
    const repository = await makeRepository();
    const created = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'historical-local', record: { value: 'initial' } }, now: T0,
    });
    const [claimed] = await repository.claimNextMutations({
      workerId: 'worker-history', now: T0, leaseDurationMs: 1_000, limit: 10,
    });
    expect(claimed?.mutationId).toBe(created.outbox.mutationId);
    await repository.acknowledgeMutationAndEntity({
      mutationId: created.outbox.mutationId, workerId: 'worker-history', now: T1,
      remoteMutationRef: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', acknowledgedRevision: 1, serverCommittedAt: T1,
    });
    const applied = await repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('historical-local', {
        record: { value: 'remote-next' }, serverRevision: 2, remoteMutationRef: null,
        createdAt: T1, updatedAt: T2,
      }) },
    ], { checkpointValue: 'cursor-history', now: T2 }));
    expect(applied.entities[0]).toMatchObject({ revision: 2, serverRevision: 2, createdAt: T0 });
    const updated = await repository.commitLocalMutation({
      mutation: {
        mode: 'update', domain: 'notes', entityId: 'historical-local',
        record: { value: 'next-local' }, expectedRevision: 2,
      }, now: T3,
    });
    expect(updated.outbox).toMatchObject({
      baseRevision: 2, localRevision: 3,
      remoteSequenceBoundary: { baselineLocalRevision: 2, baselineServerRevision: 2, remoteMutationRef: null },
    });
    expect(await repository.listOutboxMutations({ domain: 'notes', entityId: 'historical-local', limit: 10 }))
      .toMatchObject([{ status: 'acknowledged', localRevision: 1 }, { status: 'pending', localRevision: 3 }]);
    expect(await repository.listNextDeliverableMutations({ now: T3, limit: 10 }))
      .toMatchObject([{ mutationId: updated.outbox.mutationId }]);
    expect(await repository.claimNextMutations({
      workerId: 'worker-history', now: T3, leaseDurationMs: 1_000, limit: 10,
    })).toMatchObject([{ mutationId: updated.outbox.mutationId, status: 'claimed' }]);
  });

  it('keeps same-stream conflict identity deterministic while separating providers', async () => {
    const repository = await makeRepository();
    await repository.createEntity({ domain: 'notes', entityId: 'provider-conflict', record: { value: 'pending' } });
    const change = { expectedLocalRevision: 1, candidate: candidate('provider-conflict') };
    const first = await repository.commitRemoteConvergenceBatch(batch(repository, [change]));
    const second = await repository.commitRemoteConvergenceBatch(batch(repository, [change], {
      provider: 'other-provider', checkpointValue: 'other-cursor',
    }));
    expect(first.conflicts[0]?.conflictId).not.toBe(second.conflicts[0]?.conflictId);
    expect(await repository.listConflicts('notes', 'provider-conflict')).toHaveLength(2);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 1 });
    expect(await repository.getSyncCheckpoint('other-provider', 'notes')).toMatchObject({ sequence: 1 });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [change])))
      .rejects.toHaveProperty('code');
    expect(await repository.listConflicts('notes', 'provider-conflict')).toHaveLength(2);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 1 });
  });

  it('separates conflict identity across a checkpoint-invalidated server epoch', async () => {
    const repository = await makeRepository();
    await repository.createEntity({ domain: 'notes', entityId: 'epoch-conflict', record: { value: 'pending' } });
    const change = { expectedLocalRevision: 1, candidate: candidate('epoch-conflict') };
    const first = await repository.commitRemoteConvergenceBatch(batch(repository, [change]));
    await repository.invalidateSyncCheckpoint({
      provider: 'supabase', stream: 'notes', reason: 'epoch_reset', now: T2,
    });
    const second = await repository.commitRemoteConvergenceBatch(batch(repository, [change], {
      serverEpoch: 'epoch-2', checkpointValue: 'epoch-2-cursor', now: T3,
    }));
    expect(first.conflicts[0]?.conflictId).not.toBe(second.conflicts[0]?.conflictId);
    expect(await repository.listConflicts('notes', 'epoch-conflict')).toHaveLength(2);
    expect(await repository.getSyncCheckpoint('supabase', 'notes'))
      .toMatchObject({ sequence: 1, serverEpoch: 'epoch-2', checkpointValue: 'epoch-2-cursor' });
  });

  it('rejects empty, duplicate, malformed, out-of-scope, and stale members without writes', async () => {
    const repository = await makeRepository();
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [])))
      .rejects.toMatchObject({ code: 'INVALID_RESERVED_RECORD' });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('duplicate') },
      { expectedLocalRevision: null, candidate: candidate('duplicate', { serverRevision: 2 }) },
    ]))).rejects.toMatchObject({ code: 'INVALID_ENTITY' });

    const invalidSecond = candidate('invalid-second', { serverRevision: 0 });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('valid-first') },
      { expectedLocalRevision: null, candidate: invalidSecond },
    ]))).rejects.toMatchObject({ code: 'INVALID_ENTITY' });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('bad-record', { record: { authorization: 'Bearer not-for-storage' } }) },
    ]))).rejects.toHaveProperty('code');
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('wrong-scope') },
    ], { namespaceKey: 'wrong-namespace' }))).rejects.toMatchObject({ code: 'NAMESPACE_MISMATCH' });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('wrong-generation') },
    ], { generationId: 'stale-generation' }))).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    expect(await repository.getEntity('notes', 'valid-first')).toBeNull();
    expect(await repository.getEntity('notes', 'wrong-scope')).toBeNull();
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toBeNull();
  });

  it('aborts an earlier valid member when a later local revision check fails', async () => {
    const repository = await makeRepository();
    await repository.createEntity({ domain: 'notes', entityId: 'already-local', record: { value: 'local' } });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('would-have-applied') },
      { expectedLocalRevision: null, candidate: candidate('already-local') },
    ]))).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(await repository.getEntity('notes', 'would-have-applied')).toBeNull();
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toBeNull();
  });

  it('rolls back remote entities and conflicts when the checkpoint fails or the transaction is aborted', async () => {
    const repository = await makeRepository();
    await repository.advanceSyncCheckpoint({
      provider: 'supabase', stream: 'notes', checkpointValue: 'cursor-5', sequence: 5,
      serverEpoch: 'epoch-1', now: T0,
    });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('stale-checkpoint') },
    ]))).rejects.toMatchObject({ code: 'CHECKPOINT_REGRESSION' });
    expect(await repository.getEntity('notes', 'stale-checkpoint')).toBeNull();
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 5, checkpointValue: 'cursor-5' });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: null, candidate: candidate('wrong-epoch') },
    ], { checkpointValue: 'cursor-6', sequence: 6, serverEpoch: 'epoch-2' })))
      .rejects.toMatchObject({ code: 'SERVER_EPOCH_MISMATCH' });
    expect(await repository.getEntity('notes', 'wrong-epoch')).toBeNull();

    const localConflictCandidate = await repository.createEntity({
      domain: 'notes', entityId: 'checkpoint-conflict', record: { value: 'local' },
    });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('checkpoint-conflict', { serverRevision: 10 }) },
    ], { checkpointValue: 'stale-conflict-cursor', sequence: 5 })))
      .rejects.toMatchObject({ code: 'CHECKPOINT_REGRESSION' });
    expect(await repository.getEntity('notes', 'checkpoint-conflict')).toEqual(localConflictCandidate);
    expect(await repository.listConflicts('notes', 'checkpoint-conflict')).toEqual([]);

    const local = await repository.createEntity({ domain: 'notes', entityId: 'conflict-abort', record: { value: 'local' } });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('conflict-abort', { serverRevision: 9 }) },
    ], { checkpointValue: 'cursor-6', sequence: 6, testOnlyAbortAt: 'before_checkpoint' })))
      .rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
    expect(await repository.getEntity('notes', 'conflict-abort')).toEqual(local);
    expect(await repository.listConflicts('notes', 'conflict-abort')).toEqual([]);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toMatchObject({ sequence: 5 });
  });

  it('rolls back entity and conflict writes both before and after checkpoint insertion', async () => {
    const repository = await makeRepository();
    for (const [entityId, abortAt] of [
      ['abort-before', 'before_checkpoint'], ['abort-after', 'after_checkpoint'],
    ] as const) {
      await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
        { expectedLocalRevision: null, candidate: candidate(entityId) },
      ], { checkpointValue: `cursor-${entityId}`, testOnlyAbortAt: abortAt })))
        .rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
      expect(await repository.getEntity('notes', entityId)).toBeNull();
      expect(await repository.getSyncCheckpoint('supabase', 'notes')).toBeNull();
    }

    await repository.createEntity({ domain: 'notes', entityId: 'conflict-before-checkpoint', record: { value: 'local' } });
    await expect(repository.commitRemoteConvergenceBatch(batch(repository, [
      { expectedLocalRevision: 1, candidate: candidate('conflict-before-checkpoint', { serverRevision: 4 }) },
    ], { checkpointValue: 'conflict-cursor', testOnlyAbortAt: 'after_checkpoint' })))
      .rejects.toMatchObject({ code: 'TRANSACTION_ABORTED' });
    expect(await repository.listConflicts('notes', 'conflict-before-checkpoint')).toEqual([]);
    expect(await repository.getSyncCheckpoint('supabase', 'notes')).toBeNull();
  });
});
