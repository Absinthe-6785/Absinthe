import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, closeLocalDatabase,
  computeRestorePackageDigest, computeRestoreProjectFingerprint, createDormantLocalDatabaseCapability,
  deriveOutboxIdempotencyKey, openLocalDatabase, type LocalDatabaseNamespace, type LocalDatabaseRepository,
  type OutboxRecord, type RestoreEntityV1, type RestorePackageV1,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const base: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const T0 = '2026-07-12T00:00:00.000Z';
const T1 = '2026-07-12T00:00:01.000Z';
const T2 = '2026-07-12T00:00:02.000Z';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let mutation = 1;
const repositories: LocalDatabaseRepository[] = [];

function mutationId(): string {
  return `mut.00000000-0000-4000-8000-${String(mutation++).padStart(12, '0')}`;
}
function removeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('blocked'));
  });
}
async function repo(namespace = base): Promise<LocalDatabaseRepository> {
  const value = await openLocalDatabase(namespace, { capability, mutationIdFactory: mutationId, clock: () => T1 });
  repositories.push(value); await value.initializeNamespace(); return value;
}
function note(entityId: string, title = 'restored'): RestoreEntityV1 {
  return {
    domain: 'notes', entityId, sourceRevision: 9, sourceUpdatedAt: T0, sourceDeletedAt: null,
    payload: { id: entityId, title, body: 'synthetic', updatedAt: 1, folderId: null, deletedAt: null },
  };
}
async function packageFor(repository: LocalDatabaseRepository, entities: RestoreEntityV1[], packageId = 'package-1'): Promise<RestorePackageV1> {
  const core = {
    protocolVersion: 1 as const, packageId, exportedAt: T0, source: 'migration_fixture' as const,
    namespaceFingerprint: repository.namespaceKey,
    projectFingerprint: await computeRestoreProjectFingerprint(repository.namespace.projectRef), entities,
  };
  return { ...core, manifest: { entityCount: entities.length, contentDigest: await computeRestorePackageDigest(core) } };
}
async function rawDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function rawOutbox(namespaceKey: string, generationId: string): Promise<OutboxRecord[]> {
  const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readonly');
  const request = tx.objectStore(LOCAL_DATABASE_STORES.outbox).getAll(
    IDBKeyRange.bound([namespaceKey, generationId, ''], [namespaceKey, generationId, '\uffff']),
  );
  const records = await new Promise<OutboxRecord[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as OutboxRecord[]); request.onerror = () => reject(request.error);
  });
  db.close(); return records;
}
async function putRawOutbox(record: OutboxRecord): Promise<void> {
  const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
  tx.objectStore(LOCAL_DATABASE_STORES.outbox).put(record);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
}
async function mutateRawRecord(
  storeName: string, key: IDBValidKey, transform: (value: Record<string, unknown>) => Record<string, unknown> | null,
): Promise<void> {
  const db = await rawDb(); const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
  const request = store.get(key);
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const next = transform(request.result as Record<string, unknown>);
      if (next === null) store.delete(key); else store.put(next);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
}
async function acknowledgeAll(repository: LocalDatabaseRepository, at = T1): Promise<void> {
  while (true) {
    const claimed = await repository.claimNextMutations({ workerId: 'restore-test', now: at, leaseDurationMs: 1_000, limit: 100 });
    if (claimed.length === 0) return;
    for (const record of claimed) {
      await repository.acknowledgeMutation({ mutationId: record.mutationId, workerId: 'restore-test', now: at });
    }
  }
}
async function boundaryFixture() {
  const source = await repo();
  await source.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'old').payload }, now: T0 });
  await acknowledgeAll(source);
  const packageValue = await packageFor(source, [note(A, 'new')], 'boundary-package');
  const result = await source.restorePackageAtomically(packageValue, {
    sessionId: 'boundary-session', conflictPolicy: 'replace', now: T1,
  });
  const active = await repo({ ...base, generationId: result.targetGenerationId });
  const record = (await active.listOutboxMutations({ limit: 10 }))[0];
  return { source, active, packageValue, result, record };
}

beforeEach(async () => { mutation = 1; await removeDatabase().catch(() => undefined); });
afterEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase); await removeDatabase().catch(() => undefined);
});

describe('K-324 strict package validation', () => {
  it('rejects protocol, count, digest, duplicates, domains, timestamps, unsafe revisions, unknown fields, and scope mismatch', async () => {
    const repository = await repo(); const valid = await packageFor(repository, [note(A)]);
    const cases: Array<[unknown, string]> = [
      [{ ...valid, protocolVersion: 2 }, 'INVALID_RESTORE_PROTOCOL'],
      [{ ...valid, packageId: 'count-package', manifest: { ...valid.manifest, entityCount: 2 } }, 'PACKAGE_ENTITY_COUNT_MISMATCH'],
      [{ ...valid, packageId: 'digest-package', manifest: { ...valid.manifest, contentDigest: '0'.repeat(64) } }, 'PACKAGE_DIGEST_MISMATCH'],
      [await packageFor(repository, [note(A), note(A)], 'duplicate'), 'DUPLICATE_RESTORE_ENTITY'],
      [await packageFor(repository, [{ ...note(A), domain: 'recipes' as never }], 'domain'), 'UNSUPPORTED_RESTORE_DOMAIN'],
      [await packageFor(repository, [{ ...note(A), sourceUpdatedAt: 'not-time' }], 'time'), 'INVALID_RESTORE_PACKAGE'],
      [{ ...valid, packageId: 'revision-package', entities: [{ ...note(A), sourceRevision: Number.MAX_SAFE_INTEGER + 1 }] }, 'INVALID_RESTORE_PACKAGE'],
      [{ ...valid, unexpected: true }, 'INVALID_RESTORE_PACKAGE'],
      [{ ...valid, namespaceFingerprint: 'f'.repeat(64) }, 'RESTORE_NAMESPACE_MISMATCH'],
      [{ ...valid, projectFingerprint: 'e'.repeat(64) }, 'RESTORE_PROJECT_MISMATCH'],
    ];
    for (const [value, code] of cases) await expect(repository.restorePackageAtomically(value, { sessionId: `s-${code}` }))
      .rejects.toMatchObject({ code });
  });

  it('persists safe validation failures as terminal failed sessions without staging data', async () => {
    const repository = await repo(); const valid = await packageFor(repository, [note(A)], 'failed-package');
    const invalid = { ...valid, manifest: { ...valid.manifest, entityCount: 2 } };
    await expect(repository.restorePackageAtomically(invalid, { sessionId: 'failed-validation', now: T1 }))
      .rejects.toMatchObject({ code: 'PACKAGE_ENTITY_COUNT_MISMATCH' });
    expect(await repository.getRestoreSession('failed-validation')).toMatchObject({
      status: 'failed', failureCode: 'PACKAGE_ENTITY_COUNT_MISMATCH', failedAt: T1,
    });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    expect(await repository.getGeneration('restore-failed-validation')).toMatchObject({ status: 'preparing', validationState: 'pending' });
  });

  it('rolls back session and generation together on session-creation failure', async () => {
    const repository = await repo(); const valid = await packageFor(repository, [note(A)]);
    await expect(repository.restorePackageAtomically(valid, { sessionId: 'creation-failure', testOnlyFailAt: 'session_creation' }))
      .rejects.toMatchObject({ code: 'RESTORE_TRANSACTION_FAILED' });
    expect(await repository.getRestoreSession('creation-failure')).toBeNull();
    expect(await repository.getGeneration('restore-creation-failure')).toBeNull();
  });

  it('rejects bounded entity and package payload overflow', async () => {
    const repository = await repo();
    const oversizedEntity = note(A); oversizedEntity.payload.body = 'x'.repeat(120_000);
    oversizedEntity.payload.properties = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`key-${index}`, 'y'.repeat(4_000)]),
    );
    const entityPackage = await packageFor(repository, [oversizedEntity], 'large-entity');
    await expect(repository.restorePackageAtomically(entityPackage, { sessionId: 'large-entity' }))
      .rejects.toMatchObject({ code: 'RESTORE_PAYLOAD_TOO_LARGE' });
    const many = Array.from({ length: 20 }, (_, index) => {
      const id = `${index.toString(16).padStart(8, '0')}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
      const item = note(id); item.payload.body = 'z'.repeat(119_000); return item;
    });
    const largePackage = await packageFor(repository, many, 'large-package');
    await expect(repository.restorePackageAtomically(largePackage, { sessionId: 'large-package' }))
      .rejects.toMatchObject({ code: 'RESTORE_PAYLOAD_TOO_LARGE' });
  });
});

describe('K-324 overlay restore lifecycle', () => {
  it('atomically inserts, activates, queues once, and converges exact committed retry', async () => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)]);
    const result = await repository.restorePackageAtomically(value, { sessionId: 'restore-1', now: T1 });
    expect(result.summary).toEqual({ inserted: 1, replaced: 0, skipped: 0, resurrected: 0, conflicts: 0 });
    const session = await repository.getRestoreSession('restore-1');
    expect(session).toMatchObject({ status: 'committed', targetGenerationId: 'restore-restore-1', committedAt: T1 });
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect(await active.getEntity('notes', A)).toMatchObject({ revision: 1, updatedAt: T1, deletedAt: null });
    expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
    expect(await repository.restorePackageAtomically(value, { sessionId: 'restore-1', now: T1 })).toEqual(result);
    expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
  });

  it('overlays current data, skips identical, preserves omissions, and replaces only by explicit policy', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'local').payload }, now: T0 });
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: B, record: note(B, 'unrelated').payload }, now: T0 });
    await acknowledgeAll(repository);
    const value = await packageFor(repository, [note(A, 'restored')]);
    const result = await repository.restorePackageAtomically(value, { sessionId: 'replace', conflictPolicy: 'replace', now: T1 });
    expect(result.summary.replaced).toBe(1);
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect((await active.getEntity<ReturnType<typeof note>['payload']>('notes', A))?.record.title).toBe('restored');
    expect((await active.getEntity('notes', A))?.revision).toBe(2);
    expect(await active.getEntity('notes', B)).not.toBeNull();
    expect(await active.listOutboxMutations({ limit: 20 })).toHaveLength(1);
  });

  it('fails divergent default policy and supports explicit preserve-local without timestamp winner selection', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'local').payload }, now: T0 });
    await acknowledgeAll(repository);
    const divergent = await packageFor(repository, [note(A, 'remote')]);
    await expect(repository.restorePackageAtomically(divergent, { sessionId: 'conflict' })).rejects.toMatchObject({ code: 'RESTORE_ENTITY_REVISION_CONFLICT' });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    const preserved = await packageFor(repository, [note(A, 'remote')], 'preserve-package');
    const result = await repository.restorePackageAtomically(preserved, { sessionId: 'preserve', conflictPolicy: 'preserve_local' });
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect((await active.getEntity<ReturnType<typeof note>['payload']>('notes', A))?.record.title).toBe('local');
    expect(result.summary.skipped).toBe(1);
  });

  it('supports a second overlay without replaying prior restore mutations', async () => {
    const first = await repo(); const firstPackage = await packageFor(first, [note(A)], 'first-package');
    const firstResult = await first.restorePackageAtomically(firstPackage, { sessionId: 'first' });
    const active = await repo({ ...base, generationId: firstResult.targetGenerationId });
    await acknowledgeAll(active);
    const secondPackage = await packageFor(active, [note(B)], 'second-package');
    const secondResult = await active.restorePackageAtomically(secondPackage, { sessionId: 'second' });
    const next = await repo({ ...base, generationId: secondResult.targetGenerationId });
    expect(await next.getEntity('notes', A)).not.toBeNull();
    expect(await next.getEntity('notes', B)).not.toBeNull();
    expect(await next.listOutboxMutations({ limit: 10 })).toHaveLength(1);
  });
});

describe('K-324A immutable outbox fencing', () => {
  it.each([
    ['pending', async (_repository: LocalDatabaseRepository, _mutationId: string) => undefined],
    ['claimed', async (repository: LocalDatabaseRepository) => {
      await repository.claimNextMutations({ workerId: 'worker', now: T0, leaseDurationMs: 10_000, limit: 1 });
    }],
    ['expired claimed', async (repository: LocalDatabaseRepository) => {
      await repository.claimNextMutations({ workerId: 'worker', now: T0, leaseDurationMs: 1, limit: 1 });
    }],
    ['retry_wait', async (repository: LocalDatabaseRepository, mutationId: string) => {
      await repository.claimNextMutations({ workerId: 'worker', now: T0, leaseDurationMs: 10_000, limit: 1 });
      await repository.releaseClaimForRetry({ mutationId, workerId: 'worker', now: T1, errorCode: 'transient', baseDelayMs: 1_000, maxDelayMs: 1_000 });
    }],
    ['permanent_failure', async (repository: LocalDatabaseRepository, mutationId: string) => {
      await repository.claimNextMutations({ workerId: 'worker', now: T0, leaseDurationMs: 10_000, limit: 1 });
      await repository.markPermanentFailure({ mutationId, workerId: 'worker', now: T1, errorCode: 'permanent' });
    }],
  ])('blocks restore with %s history without copying or rewriting identity', async (label, prepare) => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A).payload }, now: T0,
    });
    await prepare(repository, committed.outbox.mutationId);
    const before = await repository.getOutboxRecord(committed.outbox.mutationId);
    const value = await packageFor(repository, [note(B)], `blocked-${String(label).replace(' ', '-')}`);
    await expect(repository.restorePackageAtomically(value, { sessionId: `blocked-${String(label).replace(' ', '-')}`, now: T1 }))
      .rejects.toMatchObject({ code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT' });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    expect(await repository.getOutboxRecord(committed.outbox.mutationId)).toEqual(before);
    expect(await rawOutbox(repository.namespaceKey, `restore-blocked-${String(label).replace(' ', '-')}`)).toEqual([]);
    if (label === 'pending') await acknowledgeAll(repository);
    if (label === 'claimed' || label === 'expired claimed') {
      await repository.acknowledgeMutation({ mutationId: committed.outbox.mutationId, workerId: 'worker', now: T1 });
    }
    if (label === 'retry_wait') await acknowledgeAll(repository, T2);
    if (label === 'permanent_failure') {
      await repository.resetPermanentFailure({ mutationId: committed.outbox.mutationId, now: T2 });
      await acknowledgeAll(repository, T2);
    }
    const resumed = await repository.resumeRestoreSession(value, {
      sessionId: `blocked-${String(label).replace(' ', '-')}`, now: T2,
    });
    const active = await repo({ ...base, generationId: resumed.targetGenerationId });
    expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
    expect(await active.getRestoreSession(`blocked-${String(label).replace(' ', '-')}`))
      .toMatchObject({ status: 'committed', blockingState: null });
    const settled = (await rawOutbox(repository.namespaceKey, 'generation-1'))[0];
    expect(settled).toMatchObject({
      mutationId: committed.outbox.mutationId, generationId: 'generation-1', idempotencyKey: committed.outbox.idempotencyKey,
      status: 'acknowledged',
    });
  });

  it('keeps repeated queue conflicts on one staged session and commits once after resolution', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A).payload }, now: T0 });
    const value = await packageFor(repository, [note(B)], 'resumable-package');
    await expect(repository.restorePackageAtomically(value, { sessionId: 'resumable-session', now: T1 }))
      .rejects.toMatchObject({ code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT' });
    for (const expectedAttempt of [2, 3]) {
      await expect(repository.resumeRestoreSession(value, { sessionId: 'resumable-session', now: T1 }))
        .rejects.toMatchObject({ code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT' });
      expect(await repository.getRestoreSession('resumable-session')).toMatchObject({
        status: 'staged', targetGenerationId: 'restore-resumable-session',
        blockingState: { code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', attemptCount: expectedAttempt },
      });
      expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
      expect(await rawOutbox(repository.namespaceKey, 'restore-resumable-session')).toEqual([]);
    }
    await acknowledgeAll(repository);
    const result = await repository.resumeRestoreSession(value, { sessionId: 'resumable-session', now: T2 });
    expect(result.targetGenerationId).toBe('restore-resumable-session');
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
    expect(await active.getEntity('notes', B)).toMatchObject({ revision: 1 });
    expect(await active.getRestoreSession('resumable-session')).toMatchObject({ status: 'committed', blockingState: null });
    expect(await active.resumeRestoreSession(value, { sessionId: 'resumable-session', now: T2 })).toEqual(result);
  });

  it('allows explicit cancellation of a blocked session and never resumes it', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A).payload }, now: T0 });
    const value = await packageFor(repository, [note(B)], 'cancel-blocked-package');
    await expect(repository.restorePackageAtomically(value, { sessionId: 'cancel-blocked', now: T1 }))
      .rejects.toMatchObject({ code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT' });
    expect(await repository.cancelRestoreSession('cancel-blocked', T1)).toMatchObject({ status: 'cancelled', blockingState: null });
    await acknowledgeAll(repository);
    await expect(repository.resumeRestoreSession(value, { sessionId: 'cancel-blocked', now: T2 }))
      .rejects.toMatchObject({ code: 'RESTORE_CANCELLED' });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
  });

  it('keeps acknowledged history immutable and starts target sequencing at an explicit restore boundary', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'old').payload }, now: T0,
    });
    await acknowledgeAll(repository);
    const oldHistory = await repository.getOutboxRecord(committed.outbox.mutationId);
    const value = await packageFor(repository, [note(A, 'new')], 'acknowledged-history');
    const result = await repository.restorePackageAtomically(value, { sessionId: 'acknowledged-history', conflictPolicy: 'replace', now: T1 });
    expect(await rawOutbox(repository.namespaceKey, 'generation-1')).toEqual([oldHistory]);
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    const target = await active.listOutboxMutations({ limit: 10 });
    expect(target).toHaveLength(1);
    expect(target[0]).toMatchObject({ baseRevision: 1, localRevision: 2, generationBoundary: {
      kind: 'restore_generation_sequence_boundary', namespaceKey: repository.namespaceKey,
      sourceGenerationId: 'generation-1', targetGenerationId: result.targetGenerationId,
      domain: 'notes', entityId: A, sourceRevision: 1, targetRevision: 2,
      restoreSessionId: 'acknowledged-history', packageId: 'acknowledged-history',
      packageDigest: value.manifest.contentDigest, classification: 'replace', createdAt: T1,
    } });
    expect(target[0].mutationId).not.toBe(committed.outbox.mutationId);
  });

  it('leaves superseded history in the source generation without copying or redelivery', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A).payload }, now: T0,
    });
    const superseded: OutboxRecord = {
      ...committed.outbox, status: 'superseded', supersededByMutationId: 'mut.11111111-1111-4111-8111-111111111111',
    };
    await putRawOutbox(superseded);
    const result = await repository.restorePackageAtomically(
      await packageFor(repository, [note(B)], 'superseded-history'), { sessionId: 'superseded-history', now: T1 },
    );
    expect(await rawOutbox(repository.namespaceKey, 'generation-1')).toEqual([superseded]);
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
    expect(await active.listNextDeliverableMutations({ now: T1, limit: 10 })).toHaveLength(1);
  });

  it('treats a blocked resurrection mutation as unresolved and blocks the next restore', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A).payload }, now: T0 });
    await repository.commitLocalMutation({ mutation: { mode: 'tombstone', domain: 'notes', entityId: A, record: null, expectedRevision: 1 }, now: T0 });
    await acknowledgeAll(repository);
    const resurrected = await repository.restorePackageAtomically(
      await packageFor(repository, [note(A, 'reborn')], 'blocked-resurrection'),
      { sessionId: 'blocked-resurrection', allowResurrection: true, now: T1 },
    );
    const active = await repo({ ...base, generationId: resurrected.targetGenerationId });
    const nextPackage = await packageFor(active, [note(B)], 'after-blocked-resurrection');
    await expect(active.restorePackageAtomically(
      nextPackage, { sessionId: 'after-blocked-resurrection', now: T1 },
    )).rejects.toMatchObject({ code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT' });
    const blocked = (await active.listOutboxMutations({ limit: 10 }))[0];
    await putRawOutbox({
      ...blocked, status: 'acknowledged', attemptCount: 1, updatedAt: T2, lastAttemptAt: T1,
      acknowledgedAt: T2, acknowledgedBy: 'explicit-policy', availableAt: T1,
    });
    const resumed = await active.resumeRestoreSession(nextPackage, { sessionId: 'after-blocked-resurrection', now: T2 });
    expect(resumed.targetGenerationId).toBe('restore-after-blocked-resurrection');
  });

  it('revalidates outbox state inside activation and rolls back a race without identity changes', async () => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)], 'outbox-race');
    await expect(repository.restorePackageAtomically(value, { sessionId: 'outbox-race', testOnlyFailAt: 'outbox_creation', now: T1 }))
      .rejects.toHaveProperty('code');
    const raced: OutboxRecord = {
      namespaceKey: repository.namespaceKey, generationId: 'generation-1', mutationId: 'mut.22222222-2222-4222-8222-222222222222',
      domain: 'notes', entityId: 'race-only', operation: 'upsert', baseRevision: null, localRevision: 1,
      payloadMode: 'inline', payload: { kind: 'entity_snapshot', record: { synthetic: true } }, payloadHash: null,
      createdAt: T1, updatedAt: T1, availableAt: T1, attemptCount: 0, status: 'pending',
      idempotencyKey: deriveOutboxIdempotencyKey({ namespaceKey: repository.namespaceKey, generationId: 'generation-1',
        domain: 'notes', entityId: 'race-only', localRevision: 1, operation: 'upsert' }),
      lastAttemptAt: null, lastErrorCode: null, leaseOwner: null, leaseExpiresAt: null,
      acknowledgedAt: null, acknowledgedBy: null, remoteMutationRef: null, supersededByMutationId: null,
    };
    await putRawOutbox(raced);
    await expect(repository.resumeRestoreSession(value, { sessionId: 'outbox-race', now: T1 }))
      .rejects.toMatchObject({ code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT' });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    expect(await repository.getOutboxRecord(raced.mutationId)).toEqual(raced);
    expect(await rawOutbox(repository.namespaceKey, 'restore-outbox-race')).toEqual([]);
    expect(await repository.getRestoreSession('outbox-race')).toMatchObject({
      status: 'staged', failureCode: null,
      blockingState: { code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', attemptCount: 1, detectedAt: T1 },
    });
    await acknowledgeAll(repository);
    const result = await repository.resumeRestoreSession(value, { sessionId: 'outbox-race', now: T2 });
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect(await active.getRestoreSession('outbox-race')).toMatchObject({ status: 'committed', blockingState: null });
    expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
  });
});

describe('K-324B provenance-bound restore sequence validation', () => {
  it.each([
    ['cross-entity boundary', { entityId: B }],
    ['wrong domain', { domain: 'recipes' }],
    ['wrong package', { packageId: 'other-package' }],
    ['wrong digest', { packageDigest: '0'.repeat(64) }],
    ['wrong session', { restoreSessionId: 'other-session' }],
    ['wrong predecessor', { sourceGenerationId: 'other-generation' }],
    ['wrong target', { targetGenerationId: 'other-generation' }],
    ['wrong base revision', { sourceRevision: 2 }],
    ['wrong target revision', { targetRevision: 3 }],
    ['wrong classification', { classification: 'resurrect' }],
  ])('rejects %s through public outbox reads', async (_label, corruption) => {
    const { active, record } = await boundaryFixture();
    await putRawOutbox({ ...record, generationBoundary: { ...record.generationBoundary!, ...corruption } } as OutboxRecord);
    await expect(active.getOutboxRecord(record.mutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(active.listOutboxMutations({ limit: 10 })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['missing session', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.restoreSessions, [namespaceKey, 'boundary-session'], () => null);
    }],
    ['failed session', async (namespaceKey: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.restoreSessions, [namespaceKey, 'boundary-session'], value => ({
        ...value, status: 'failed', committedAt: null, failedAt: T2, updatedAt: T2, failureCode: 'RESTORE_TRANSACTION_FAILED',
      }));
    }],
    ['cancelled session', async (namespaceKey: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.restoreSessions, [namespaceKey, 'boundary-session'], value => ({
        ...value, status: 'cancelled', committedAt: null, failedAt: T2, updatedAt: T2, failureCode: 'RESTORE_CANCELLED',
      }));
    }],
    ['staged session', async (namespaceKey: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.restoreSessions, [namespaceKey, 'boundary-session'], value => ({
        ...value, status: 'staged', committedAt: null,
      }));
    }],
    ['missing source generation', async (namespaceKey: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.generations, [namespaceKey, 'generation-1'], () => null);
    }],
    ['missing target generation', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.generations, [namespaceKey, targetGenerationId], () => null);
    }],
    ['inactive target generation', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.generations, [namespaceKey, targetGenerationId], value => ({
        ...value, status: 'preparing', activeNamespaceKey: undefined,
      }));
    }],
    ['wrong predecessor link', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.generations, [namespaceKey, targetGenerationId], value => ({
        ...value, predecessorGenerationId: 'other-generation',
      }));
    }],
    ['target belongs to another package', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.generations, [namespaceKey, targetGenerationId], value => ({
        ...value, safeSourceReference: { kind: 'recovery_package', reference: 'other-package' },
      }));
    }],
    ['missing target entity', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.entities, [namespaceKey, targetGenerationId, 'notes', A], () => null);
    }],
    ['stale predecessor entity revision', async (namespaceKey: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.entities, [namespaceKey, 'generation-1', 'notes', A], value => ({
        ...value, revision: 2,
      }));
    }],
    ['wrong target entity provenance', async (namespaceKey: string, targetGenerationId: string) => {
      await mutateRawRecord(LOCAL_DATABASE_STORES.entities, [namespaceKey, targetGenerationId, 'notes', A], value => ({
        ...value, restoreProvenance: { ...(value.restoreProvenance as object), packageId: 'other-package' },
      }));
    }],
  ] as const)('rejects relational corruption: %s', async (_label, corrupt) => {
    const { active, result, record } = await boundaryFixture();
    await corrupt(active.namespaceKey, result.targetGenerationId);
    await expect(active.getOutboxRecord(record.mutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects boundary replay to N+2 and a cross-entity copied boundary', async () => {
    const { active, record } = await boundaryFixture();
    const replay: OutboxRecord = {
      ...record, mutationId: 'mut.99999999-9999-4999-8999-999999999999', baseRevision: 2, localRevision: 3,
      createdAt: T2, updatedAt: T2, availableAt: T2,
      idempotencyKey: deriveOutboxIdempotencyKey({ ...record, localRevision: 3 }),
      generationBoundary: { ...record.generationBoundary!, sourceRevision: 2, targetRevision: 3, createdAt: T2 },
    };
    await putRawOutbox(replay);
    await expect(active.getOutboxRecord(replay.mutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });

    const copied: OutboxRecord = {
      ...record, mutationId: 'mut.88888888-8888-4888-8888-888888888888', entityId: B,
      idempotencyKey: deriveOutboxIdempotencyKey({ ...record, entityId: B }),
      generationBoundary: { ...record.generationBoundary!, entityId: B },
    };
    await putRawOutbox(copied);
    await expect(active.getOutboxRecord(copied.mutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects a restore boundary attached to a normal local mutation', async () => {
    const repository = await repo();
    const committed = await repository.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A).payload }, now: T0,
    });
    await putRawOutbox({
      ...committed.outbox,
      generationBoundary: {
        kind: 'restore_generation_sequence_boundary', namespaceKey: repository.namespaceKey,
        sourceGenerationId: 'source-generation', targetGenerationId: 'generation-1', domain: 'notes', entityId: A,
        sourceRevision: 1, targetRevision: 2, restoreSessionId: 'normal-mutation', packageId: 'package',
        packageDigest: '0'.repeat(64), classification: 'replace', createdAt: T0,
      },
    });
    await expect(repository.getOutboxRecord(committed.outbox.mutationId))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('keeps normal K-322 sequencing strict after one valid restore boundary', async () => {
    const { active } = await boundaryFixture();
    await active.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: A, record: note(A, 'local-after-restore').payload, expectedRevision: 2 },
      now: T2,
    });
    const records = await active.listOutboxMutations({ limit: 10 });
    expect(records.map(record => [record.baseRevision, record.localRevision])).toEqual([[1, 2], [2, 3]]);
    expect(records[0].generationBoundary).not.toBeNull();
    expect(records[1].generationBoundary).toBeUndefined();
    expect((await active.listNextDeliverableMutations({ now: T2, limit: 10 }))[0].localRevision).toBe(2);
  });
});

describe('K-324 explicit resurrection and failure fencing', () => {
  it('resurrects only explicitly, increments tombstone revision, persists provenance, and blocks remote delivery', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'old').payload }, now: T0 });
    await repository.commitLocalMutation({ mutation: { mode: 'tombstone', domain: 'notes', entityId: A, record: null, expectedRevision: 1 }, now: T0 });
    await acknowledgeAll(repository);
    const value = await packageFor(repository, [note(A, 'reborn')]);
    await expect(repository.restorePackageAtomically(value, { sessionId: 'blocked' })).rejects.toMatchObject({ code: 'RESTORE_TOMBSTONE_CONFLICT' });
    const other = await packageFor(repository, [note(A, 'reborn')], 'resurrection-package');
    const result = await repository.restorePackageAtomically(other, { sessionId: 'resurrect', allowResurrection: true, now: T1 });
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    const entity = await active.getEntity('notes', A);
    expect(entity).toMatchObject({ revision: 3, deletedAt: null, updatedAt: T1 });
    expect(entity?.restoreProvenance?.resurrection).toMatchObject({ supersedesTombstoneRevision: 2, restoredAt: T1 });
    const queued = await active.listOutboxMutations({ domain: 'notes', entityId: A, limit: 10 });
    expect(queued.at(-1)).toMatchObject({ localRevision: 3, deliveryBlockCode: 'REMOTE_RESURRECTION_UNSUPPORTED' });
    expect(await active.listNextDeliverableMutations({ now: T1, limit: 10 })).not.toContainEqual(queued.at(-1));
  });

  it.each(['active_generation_reread', 'entity_materialization', 'outbox_creation', 'generation_activation', 'session_committed_update', 'transaction_completion'] as const)(
    'rolls back activation/session/outbox on %s failure and resumes without duplicates', async testOnlyFailAt => {
      const repository = await repo(); const value = await packageFor(repository, [note(A)]);
      await expect(repository.restorePackageAtomically(value, { sessionId: `failure-${testOnlyFailAt}`, testOnlyFailAt, now: T1 }))
        .rejects.toHaveProperty('code');
      expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
      const result = await repository.resumeRestoreSession(value, { sessionId: `failure-${testOnlyFailAt}`, now: T1 });
      const active = await repo({ ...base, generationId: result.targetGenerationId });
      expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(1);
    },
  );

  it.each(['staging_first_entity', 'staging_middle_entity', 'staging_final_entity'] as const)(
    'rolls back all staged entities on %s and resumes deterministically', async testOnlyFailAt => {
      const repository = await repo(); const value = await packageFor(repository, [note(A), note(B)]);
      await expect(repository.restorePackageAtomically(value, { sessionId: `stage-${testOnlyFailAt}`, testOnlyFailAt }))
        .rejects.toHaveProperty('code');
      expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
      expect(await repository.getRestoreSession(`stage-${testOnlyFailAt}`)).toMatchObject({ status: 'validating' });
      const result = await repository.resumeRestoreSession(value, { sessionId: `stage-${testOnlyFailAt}` });
      const active = await repo({ ...base, generationId: result.targetGenerationId });
      expect(await active.listEntities({ domain: 'notes' })).toHaveLength(2);
      expect(await active.listOutboxMutations({ limit: 10 })).toHaveLength(2);
    },
  );

  it('allows only one concurrent restore to commit against one active generation', async () => {
    const repository = await repo();
    const left = await packageFor(repository, [note(A)], 'left-package');
    const right = await packageFor(repository, [note(B)], 'right-package');
    const settled = await Promise.allSettled([
      repository.restorePackageAtomically(left, { sessionId: 'left' }),
      repository.restorePackageAtomically(right, { sessionId: 'right' }),
    ]);
    expect(settled.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter(item => item.status === 'rejected')).toHaveLength(1);
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toMatch(/^restore-(left|right)$/);
  });

  it('fences a local mutation committed after staging and rejects duplicate package sessions', async () => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)]);
    await expect(repository.restorePackageAtomically(value, { sessionId: 'staged', testOnlyFailAt: 'outbox_creation', now: T1 })).rejects.toHaveProperty('code');
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: B, record: note(B).payload }, now: T1 });
    await expect(repository.resumeRestoreSession(value, { sessionId: 'staged', now: T1 })).rejects.toMatchObject({ code: 'RESTORE_ENTITY_REVISION_CONFLICT' });
    await expect(repository.restorePackageAtomically(value, { sessionId: 'different', now: T1 })).rejects.toMatchObject({ code: 'RESTORE_SESSION_CONFLICT' });
  });

  it('cancels only pre-commit sessions and fails closed on corrupt persisted sessions', async () => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)]);
    await expect(repository.restorePackageAtomically(value, { sessionId: 'cancel-me', testOnlyFailAt: 'validation_completion' })).rejects.toHaveProperty('code');
    expect(await repository.cancelRestoreSession('cancel-me', T1)).toMatchObject({ status: 'cancelled' });
    await expect(repository.resumeRestoreSession(value, { sessionId: 'cancel-me' })).rejects.toMatchObject({ code: 'RESTORE_CANCELLED' });
    const persisted = await repository.getRestoreSession('cancel-me');
    const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.restoreSessions, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).put({ ...persisted, status: 'committed', committedAt: null });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    await expect(repository.getRestoreSession('cancel-me')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects cancellation after durable commit', async () => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)]);
    await repository.restorePackageAtomically(value, { sessionId: 'done' });
    await expect(repository.cancelRestoreSession('done', T1)).rejects.toHaveProperty('code');
  });

  it.each([
    ['committed without time', { committedAt: null }],
    ['committed without target', { targetGenerationId: null }],
    ['failed without metadata', { status: 'failed', committedAt: null, failedAt: null, failureCode: null }],
    ['bad digest', { packageDigest: 'bad' }],
    ['negative summary', { summary: { inserted: -1, replaced: 0, skipped: 0, resurrected: 0, conflicts: 0 } }],
    ['reversed chronology', { updatedAt: '2020-01-01T00:00:00.000Z' }],
    ['committed with blocking state', { blockingState: { code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', detectedAt: T1, attemptCount: 1 } }],
    ['invalid blocking attempt', { blockingState: { code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', detectedAt: T1, attemptCount: 0 } }],
    ['blocking state with unknown field', {
      blockingState: { code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', detectedAt: T1, attemptCount: 1, rawMutation: 'forbidden' },
    }],
  ])('fails closed on persisted restore-session corruption: %s', async (_label, corruption) => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)]);
    await repository.restorePackageAtomically(value, { sessionId: 'corrupt', now: T1 });
    const persisted = await repository.getRestoreSession('corrupt');
    const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.restoreSessions, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).put({ ...persisted, ...corruption });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    await expect(repository.getRestoreSession('corrupt')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('fails closed on every required malformed restore-generation graph through public reads', async () => {
    const cases = [
      'missing-target', 'missing-staging', 'target-not-active', 'metadata-mismatch', 'source-equals-staging',
      'missing-source', 'staging-other-namespace', 'target-other-namespace', 'incompatible-target-status',
      'failed-active-target', 'cancelled-active-target',
    ] as const;
    for (let index = 0; index < cases.length; index += 1) {
      const kind = cases[index];
      const namespace = { ...base, userId: `graph-user-${index}` };
      const repository = await repo(namespace); const value = await packageFor(repository, [note(A)], `graph-package-${index}`);
      const result = await repository.restorePackageAtomically(value, { sessionId: `graph-session-${index}`, now: T1 });
      const persisted = await repository.getRestoreSession(`graph-session-${index}`);
      const db = await rawDb();
      const tx = db.transaction([
        LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.restoreSessions,
      ], 'readwrite');
      const generations = tx.objectStore(LOCAL_DATABASE_STORES.generations);
      const sessions = tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions);
      const targetKey = [repository.namespaceKey, result.targetGenerationId];
      const sourceKey = [repository.namespaceKey, 'generation-1'];
      const targetRequest = generations.get(targetKey);
      const sourceRequest = generations.get(sourceKey);
      const metaRequest = tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(repository.namespaceKey);
      await Promise.all([
        new Promise<void>((resolve, reject) => { targetRequest.onsuccess = () => resolve(); targetRequest.onerror = () => reject(targetRequest.error); }),
        new Promise<void>((resolve, reject) => { sourceRequest.onsuccess = () => resolve(); sourceRequest.onerror = () => reject(sourceRequest.error); }),
        new Promise<void>((resolve, reject) => { metaRequest.onsuccess = () => resolve(); metaRequest.onerror = () => reject(metaRequest.error); }),
      ]);
      const target = targetRequest.result; const source = sourceRequest.result; const meta = metaRequest.result;
      if (kind === 'missing-target' || kind === 'missing-staging') generations.delete(targetKey);
      if (kind === 'target-not-active' || kind === 'incompatible-target-status') {
        generations.put({ ...target, status: 'preparing', activeNamespaceKey: undefined });
      }
      if (kind === 'metadata-mismatch') tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).put({ ...meta, activeGenerationId: 'generation-1' });
      if (kind === 'source-equals-staging') sessions.put({ ...persisted, sourceGenerationId: result.targetGenerationId });
      if (kind === 'missing-source') generations.delete(sourceKey);
      if (kind === 'staging-other-namespace' || kind === 'target-other-namespace') {
        generations.delete(targetKey);
        const otherNamespace = `other-namespace-${index}`;
        generations.put({ ...target, namespaceKey: otherNamespace, activeNamespaceKey: otherNamespace });
      }
      if (kind === 'failed-active-target') sessions.put({
        ...persisted, status: 'failed', committedAt: null, failedAt: T1, failureCode: 'RESTORE_TRANSACTION_FAILED',
      });
      if (kind === 'cancelled-active-target') sessions.put({
        ...persisted, status: 'cancelled', committedAt: null, failedAt: T1, failureCode: 'RESTORE_CANCELLED',
      });
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
      await expect(repository.getRestoreSession(`graph-session-${index}`))
        .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
      expect(source).toBeDefined();
    }
  });

  it.each(['restorePackageAtomically', 'resumeRestoreSession'] as const)(
    'revalidates a corrupt committed graph before terminal success through %s', async method => {
      const repository = await repo(); const value = await packageFor(repository, [note(A)], `corrupt-retry-${method}`);
      const result = await repository.restorePackageAtomically(value, { sessionId: `corrupt-retry-${method}`, now: T1 });
      const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.generations, 'readwrite');
      tx.objectStore(LOCAL_DATABASE_STORES.generations).delete([repository.namespaceKey, result.targetGenerationId]);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
      await expect(repository[method](value, { sessionId: `corrupt-retry-${method}`, now: T1 }))
        .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    },
  );

  it('accepts a valid staged graph and preserves valid failed and cancelled controls', async () => {
    const stagedRepository = await repo(); const stagedPackage = await packageFor(stagedRepository, [note(A)], 'staged-control');
    await expect(stagedRepository.restorePackageAtomically(stagedPackage, {
      sessionId: 'staged-control', testOnlyFailAt: 'outbox_creation', now: T1,
    })).rejects.toHaveProperty('code');
    const committing = await stagedRepository.getRestoreSession('staged-control');
    const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.restoreSessions, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).put({ ...committing, status: 'staged' });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    expect(await stagedRepository.getRestoreSession('staged-control')).toMatchObject({ status: 'staged' });

    const failedRepository = await repo({ ...base, userId: 'failed-control' });
    const failedPackage = await packageFor(failedRepository, [note(A)], 'failed-control');
    await expect(failedRepository.restorePackageAtomically(
      { ...failedPackage, manifest: { ...failedPackage.manifest, entityCount: 2 } }, { sessionId: 'failed-control', now: T1 },
    )).rejects.toHaveProperty('code');
    expect(await failedRepository.getRestoreSession('failed-control')).toMatchObject({ status: 'failed' });

    const cancelledRepository = await repo({ ...base, userId: 'cancelled-control' });
    const cancelledPackage = await packageFor(cancelledRepository, [note(A)], 'cancelled-control');
    await expect(cancelledRepository.restorePackageAtomically(cancelledPackage, {
      sessionId: 'cancelled-control', testOnlyFailAt: 'validation_completion', now: T1,
    })).rejects.toHaveProperty('code');
    await cancelledRepository.cancelRestoreSession('cancelled-control', T1);
    expect(await cancelledRepository.getRestoreSession('cancelled-control')).toMatchObject({ status: 'cancelled' });
  });
});
