import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, closeLocalDatabase,
  computeRestorePackageDigest, computeRestoreProjectFingerprint, createDormantLocalDatabaseCapability,
  openLocalDatabase, type LocalDatabaseNamespace, type LocalDatabaseRepository,
  type RestoreEntityV1, type RestorePackageV1,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const base: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const T0 = '2026-07-12T00:00:00.000Z';
const T1 = '2026-07-12T00:00:01.000Z';
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
    const value = await packageFor(repository, [note(A, 'restored')]);
    const result = await repository.restorePackageAtomically(value, { sessionId: 'replace', conflictPolicy: 'replace', now: T1 });
    expect(result.summary.replaced).toBe(1);
    const active = await repo({ ...base, generationId: result.targetGenerationId });
    expect((await active.getEntity<ReturnType<typeof note>['payload']>('notes', A))?.record.title).toBe('restored');
    expect((await active.getEntity('notes', A))?.revision).toBe(2);
    expect(await active.getEntity('notes', B)).not.toBeNull();
    expect(await active.listOutboxMutations({ limit: 20 })).toHaveLength(3);
  });

  it('fails divergent default policy and supports explicit preserve-local without timestamp winner selection', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'local').payload }, now: T0 });
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
    const secondPackage = await packageFor(active, [note(B)], 'second-package');
    const secondResult = await active.restorePackageAtomically(secondPackage, { sessionId: 'second' });
    const next = await repo({ ...base, generationId: secondResult.targetGenerationId });
    expect(await next.getEntity('notes', A)).not.toBeNull();
    expect(await next.getEntity('notes', B)).not.toBeNull();
    expect(await next.listOutboxMutations({ limit: 10 })).toHaveLength(2);
  });
});

describe('K-324 explicit resurrection and failure fencing', () => {
  it('resurrects only explicitly, increments tombstone revision, persists provenance, and blocks remote delivery', async () => {
    const repository = await repo();
    await repository.commitLocalMutation({ mutation: { mode: 'create', domain: 'notes', entityId: A, record: note(A, 'old').payload }, now: T0 });
    await repository.commitLocalMutation({ mutation: { mode: 'tombstone', domain: 'notes', entityId: A, record: null, expectedRevision: 1 }, now: T0 });
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
  ])('fails closed on persisted restore-session corruption: %s', async (_label, corruption) => {
    const repository = await repo(); const value = await packageFor(repository, [note(A)]);
    await repository.restorePackageAtomically(value, { sessionId: 'corrupt', now: T1 });
    const persisted = await repository.getRestoreSession('corrupt');
    const db = await rawDb(); const tx = db.transaction(LOCAL_DATABASE_STORES.restoreSessions, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).put({ ...persisted, ...corruption });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    await expect(repository.getRestoreSession('corrupt')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });
});
