import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, LOCAL_DATABASE_VERSION,
  attachmentEntityIdentity, closeLocalDatabase, createDormantLocalDatabaseCapability,
  idEntityIdentity, openLocalDatabase, ownerDateEntityIdentity, singletonEntityIdentity,
  type LocalDatabaseNamespace, type LocalDatabaseRepository,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const baseNamespace: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const repositories: LocalDatabaseRepository[] = [];

function deleteDatabase(name = LOCAL_DATABASE_NAME): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('delete_blocked'));
  });
}

function rawOpen(name: string, version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

async function repository(namespace: LocalDatabaseNamespace = baseNamespace, initialize = true,
  options: { mutationIdFactory?: () => string; clock?: () => string } = {}): Promise<LocalDatabaseRepository> {
  const value = await openLocalDatabase(namespace, { capability, ...options }); repositories.push(value);
  if (initialize) await value.initializeNamespace();
  return value;
}

async function overwriteOutbox(
  repo: LocalDatabaseRepository, mutationId: string, transform: (record: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const db = await rawOpen(LOCAL_DATABASE_NAME);
  const transaction = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
  const store = transaction.objectStore(LOCAL_DATABASE_STORES.outbox);
  const request = store.get([repo.namespaceKey, repo.namespace.generationId, mutationId]);
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => { store.put(transform(request.result)); resolve(); };
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

const mutationNow = '2026-07-11T00:00:00.000Z';
const fixedMutationId = 'mut.00000000-0000-4000-8000-000000000001';

beforeEach(async () => { await deleteDatabase().catch(() => undefined); });
afterEach(async () => {
  for (const value of repositories.splice(0)) closeLocalDatabase(value);
  await deleteDatabase().catch(() => undefined);
});

describe('K-321 isolated schema and dormant boundary', () => {
  it('requires explicit capability and creates the isolated versioned stores and indexes', async () => {
    await expect(openLocalDatabase(baseNamespace, { capability: {} as never })).rejects.toMatchObject({ code: 'CAPABILITY_REQUIRED' });
    const repo = await repository();
    const db = await rawOpen(LOCAL_DATABASE_NAME);
    expect(db.version).toBe(LOCAL_DATABASE_VERSION);
    expect([...db.objectStoreNames]).toEqual(expect.arrayContaining(Object.values(LOCAL_DATABASE_STORES)));
    const transaction = db.transaction(Object.values(LOCAL_DATABASE_STORES), 'readonly');
    expect([...transaction.objectStore(LOCAL_DATABASE_STORES.entities).indexNames]).toEqual(expect.arrayContaining([
      'by_namespace_generation_domain', 'by_namespace_generation_owner',
      'by_namespace_generation_deleted', 'by_namespace_generation_updated',
    ]));
    expect([...transaction.objectStore(LOCAL_DATABASE_STORES.outbox).indexNames]).toContain('by_namespace_generation_status');
    db.close();
    const metadata = await repo.readDatabaseMetadata();
    expect(metadata).toMatchObject({ activeGenerationId: 'generation-1', databaseFormatVersion: LOCAL_DATABASE_VERSION, recoveryCompatible: true });
    repo.close();
    const reopened = await repository(baseNamespace, false);
    expect((await reopened.readDatabaseMetadata()).createdAt).toBe(metadata.createdAt);
  });

  it('rejects invalid namespaces, unsafe components, and unsupported schema versions', async () => {
    for (const namespace of [
      { ...baseNamespace, userId: '' }, { ...baseNamespace, projectRef: 'https://unsafe.example' },
      { ...baseNamespace, deviceId: 'Bearer-token' }, { ...baseNamespace, schemaVersion: 2 },
    ]) await expect(openLocalDatabase(namespace, { capability })).rejects.toHaveProperty('code');
  });

  it('does not touch a legacy database or localStorage and performs no network request', async () => {
    const legacy = await rawOpen('absinthe-notes', 1, db => db.createObjectStore('notes', { keyPath: 'id' }));
    const tx = legacy.transaction('notes', 'readwrite'); tx.objectStore('notes').put({ id: 'legacy', body: 'preserved' });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    legacy.close();
    const storage = new Map<string, string>();
    const localStorageStub = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    };
    Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
    localStorageStub.setItem('k321-sentinel', 'preserved');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await repository();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorageStub.getItem('k321-sentinel')).toBe('preserved');
    const legacyAgain = await rawOpen('absinthe-notes');
    const read = legacyAgain.transaction('notes').objectStore('notes').get('legacy');
    expect(await new Promise(resolve => { read.onsuccess = () => resolve(read.result); })).toEqual({ id: 'legacy', body: 'preserved' });
    legacyAgain.close(); fetchSpy.mockRestore(); localStorageStub.removeItem('k321-sentinel');
    Reflect.deleteProperty(globalThis, 'localStorage'); await deleteDatabase('absinthe-notes');
  });
});

describe('K-321 namespace and generation fencing', () => {
  it('isolates user, project, device, and generation scopes', async () => {
    const first = await repository();
    await first.createEntity({ domain: 'notes', entityId: 'n1', record: { body: 'synthetic' } });
    for (const namespace of [
      { ...baseNamespace, userId: 'user-b' }, { ...baseNamespace, projectRef: 'project-b' }, { ...baseNamespace, deviceId: 'device-b' },
    ]) {
      const isolated = await repository(namespace);
      expect(await isolated.getEntity('notes', 'n1')).toBeNull();
    }
    await first.createGeneration('generation-2', 'test'); await first.activateGeneration('generation-2');
    await expect(first.createEntity({ domain: 'notes', entityId: 'stale', record: {} })).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    const second = await repository({ ...baseNamespace, generationId: 'generation-2' });
    expect(await second.getEntity('notes', 'n1')).toBeNull();
  });

  it('activates generations atomically, seals the predecessor, and preserves the active generation after failed activation', async () => {
    const repo = await repository();
    await repo.createGeneration('generation-2', 'test');
    await repo.activateGeneration('generation-2');
    expect(await repo.getGeneration('generation-1')).toMatchObject({ status: 'sealed' });
    expect(await repo.getGeneration('generation-2')).toMatchObject({ status: 'active', predecessorGenerationId: 'generation-1' });

    const activeRepo = await repository({ ...baseNamespace, generationId: 'generation-2' });
    await activeRepo.createGeneration('generation-failed', 'test');
    await activeRepo.setGenerationStatus('generation-failed', 'failed');
    await expect(activeRepo.activateGeneration('generation-failed')).rejects.toMatchObject({ code: 'INVALID_GENERATION_TRANSITION' });
    expect((await activeRepo.readDatabaseMetadata()).activeGenerationId).toBe('generation-2');
    const db = await rawOpen(LOCAL_DATABASE_NAME);
    const activeIndex = db.transaction(LOCAL_DATABASE_STORES.generations).objectStore(LOCAL_DATABASE_STORES.generations).index('one_active_per_namespace');
    const count = activeIndex.count(activeRepo.namespaceKey);
    expect(await new Promise<number>((resolve, reject) => { count.onsuccess = () => resolve(count.result); count.onerror = () => reject(count.error); })).toBe(1);
    db.close();
  });

  it('rejects writes to non-active generations', async () => {
    const repo = await repository();
    await repo.createGeneration('sealed-generation', 'test'); await repo.setGenerationStatus('sealed-generation', 'sealed');
    const sealedRepo = await openLocalDatabase({ ...baseNamespace, generationId: 'sealed-generation' }, { capability });
    repositories.push(sealedRepo);
    await expect(sealedRepo.createEntity({ domain: 'notes', entityId: 'n1', record: {} })).rejects.toMatchObject({ code: 'STALE_GENERATION' });
  });
});

describe('K-321 entity, revision, and tombstone model', () => {
  it('performs entity-level CRUD without replacing unrelated records', async () => {
    const repo = await repository();
    const first = await repo.createEntity({ domain: 'notes', entityId: 'n1', record: { value: 1 }, ownerId: 'user-a' });
    await repo.createEntity({ domain: 'notes', entityId: 'n2', record: { value: 2 }, ownerId: 'user-a' });
    await repo.createEntity({ domain: 'recipes', entityId: 'r1', record: { value: 3 } });
    expect(first.revision).toBe(1);
    const updated = await repo.updateEntity({ domain: 'notes', entityId: 'n1', record: { value: 4 }, expectedRevision: 1 });
    expect(updated.revision).toBe(2);
    expect((await repo.getEntity<{ value: number }>('notes', 'n2'))?.record.value).toBe(2);
    expect((await repo.listEntities({ domain: 'notes' })).map(item => item.entityId)).toEqual(['n1', 'n2']);
    expect((await repo.listEntities({ domain: 'recipes' })).map(item => item.entityId)).toEqual(['r1']);
    expect((await repo.listEntitiesByOwner('user-a')).map(item => item.entityId)).toEqual(['n1', 'n2']);
  });

  it('uses compare-and-set revisions and rejects concurrent stale writers', async () => {
    const repo = await repository();
    await repo.createEntity({ domain: 'notes', entityId: 'n1', record: { value: 1 } });
    await expect(repo.updateEntity({ domain: 'notes', entityId: 'n1', record: { value: 2 }, expectedRevision: 0 }))
      .rejects.toMatchObject({ code: 'STALE_REVISION' });
    const results = await Promise.allSettled([
      repo.updateEntity({ domain: 'notes', entityId: 'n1', record: { value: 2 }, expectedRevision: 1 }),
      repo.updateEntity({ domain: 'notes', entityId: 'n1', record: { value: 3 }, expectedRevision: 1 }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('separates create from mutation and requires CAS for every update and tombstone', async () => {
    const repo = await repository();
    await repo.createEntity({ domain: 'notes', entityId: 'n1', record: { value: 1 } });
    await expect(repo.createEntity({ domain: 'notes', entityId: 'n1', record: { value: 2 } }))
      .rejects.toMatchObject({ code: 'ENTITY_ALREADY_EXISTS' });
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: 'n1', record: { value: 2 } } as never,
      now: mutationNow,
    })).rejects.toMatchObject({ code: 'EXPECTED_REVISION_REQUIRED' });
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'tombstone', domain: 'notes', entityId: 'n1', record: null } as never,
      now: mutationNow,
    })).rejects.toMatchObject({ code: 'EXPECTED_REVISION_REQUIRED' });
    expect((await repo.getEntity<{ value: number }>('notes', 'n1'))?.record.value).toBe(1);
  });

  it('creates explicit tombstones, increments revision, filters them, and blocks ordinary resurrection', async () => {
    const repo = await repository();
    await repo.createEntity({ domain: 'notes', entityId: 'n1', record: { value: 1 } });
    const tombstone = await repo.tombstoneEntity('notes', 'n1', 1, '2026-07-11T01:00:00.000Z');
    expect(tombstone).toMatchObject({ revision: 2, isDeleted: true, deletedAt: '2026-07-11T01:00:00.000Z' });
    expect(await repo.listEntities({ domain: 'notes' })).toEqual([]);
    expect(await repo.listEntities({ domain: 'notes', includeDeleted: true })).toHaveLength(1);
    await expect(repo.updateEntity({ domain: 'notes', entityId: 'n1', record: { value: 2 }, expectedRevision: 2 }))
      .rejects.toMatchObject({ code: 'TOMBSTONE_REACTIVATION_BLOCKED' });
  });

  it('provides explicit collision-safe external identity helpers', () => {
    expect(idEntityIdentity('abc')).not.toBe(idEntityIdentity('a:bc'));
    expect(ownerDateEntityIdentity('owner-a', '2026-07-11')).toContain('owner-date');
    expect(() => ownerDateEntityIdentity('owner-a', '2026-02-30')).toThrow();
    expect(singletonEntityIdentity('owner-a', 'protein-profile')).not.toBe(singletonEntityIdentity('owner-b', 'protein-profile'));
    expect(attachmentEntityIdentity('att-1')).toContain('attachment');
  });
});

describe('K-321 atomic entity and outbox transaction', () => {
  it('commits entity and outbox together only after transaction completion', async () => {
    const repo = await repository();
    let resolved = false;
    const promise = repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'entity-1', record: { body: 'synthetic' } }, now: mutationNow,
    }).then(value => { resolved = true; return value; });
    expect(resolved).toBe(false);
    const value = await promise;
    expect(value.entity.revision).toBe(1);
    expect(await repo.getEntity('notes', 'entity-1')).not.toBeNull();
    expect(await repo.getOutboxRecord(value.outbox.mutationId)).toMatchObject({
      domain: 'notes', entityId: 'entity-1', operation: 'upsert', baseRevision: null, localRevision: 1,
      payloadMode: 'inline', payloadHash: null, payload: { kind: 'entity_snapshot', record: { body: 'synthetic' } },
      attemptCount: 0, status: 'pending', lastErrorCode: null,
    });
  });

  it.each(['before_entity', 'before_outbox', 'after_writes'] as const)('rolls both stores back on %s abort', async testOnlyAbortAt => {
    const repo = await repository();
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'entity-1', record: { body: 'synthetic' } },
      now: mutationNow, testOnlyAbortAt,
    })).rejects.toHaveProperty('code');
    expect(await repo.getEntity('notes', 'entity-1')).toBeNull();
    expect(await repo.listOutboxMutations({ limit: 10 })).toEqual([]);
  });

  it('rolls back both records on invalid input, stale revision, and stale generation', async () => {
    const repo = await repository();
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'entity-1', record: {} },
      now: 'not-a-time',
    })).rejects.toMatchObject({ code: 'INVALID_ENTITY' });
    expect(await repo.getEntity('notes', 'entity-1')).toBeNull();

    await repo.createEntity({ domain: 'notes', entityId: 'entity-1', record: { value: 1 } });
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: 'entity-1', record: { value: 2 }, expectedRevision: 0 }, now: mutationNow,
    })).rejects.toMatchObject({ code: 'STALE_REVISION' });
    expect(await repo.listOutboxMutations({ limit: 10 })).toHaveLength(1);
    expect((await repo.getEntity<{ value: number }>('notes', 'entity-1'))?.record.value).toBe(1);

    await repo.createGeneration('generation-2', 'test'); await repo.activateGeneration('generation-2');
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'stale', record: {} }, now: mutationNow,
    })).rejects.toMatchObject({ code: 'STALE_GENERATION' });
  });

  it('derives tombstone outbox identity, operation, revision, and payload from the entity mutation', async () => {
    const repo = await repository();
    await repo.createEntity({ domain: 'notes', entityId: 'entity-1', record: { body: 'synthetic' } });
    await repo.updateEntity({ domain: 'notes', entityId: 'entity-1', record: { body: 'updated' }, expectedRevision: 1 });
    const committed = await repo.commitLocalMutation({
      mutation: { mode: 'tombstone', domain: 'notes', entityId: 'entity-1', record: null, expectedRevision: 2,
        timestamp: '2026-07-11T02:00:00.000Z' },
      now: '2026-07-11T02:00:00.000Z',
    });
    expect(await repo.getOutboxRecord(committed.outbox.mutationId)).toMatchObject({
      domain: 'notes', entityId: 'entity-1', operation: 'tombstone', baseRevision: 2, localRevision: 3,
      payload: { kind: 'tombstone', entityId: 'entity-1', deletedAt: '2026-07-11T02:00:00.000Z', revision: 3 },
    });
  });

  it('derives update outbox revisions and post-mutation payload', async () => {
    const repo = await repository();
    await repo.createEntity({ domain: 'notes', entityId: 'entity-1', record: { value: 1 } });
    const committed = await repo.commitLocalMutation({
      mutation: { mode: 'update', domain: 'notes', entityId: 'entity-1', record: { value: 2 }, expectedRevision: 1 },
      now: mutationNow,
    });
    expect(await repo.getOutboxRecord(committed.outbox.mutationId)).toMatchObject({
      domain: committed.entity.domain, entityId: committed.entity.entityId, operation: 'upsert', baseRevision: 1,
      localRevision: committed.entity.revision, payload: { kind: 'entity_snapshot', record: { value: 2 } },
    });
  });

  it('rolls back the entity when a duplicate mutation identity conflicts', async () => {
    const fixedId = () => 'mut.00000000-0000-4000-8000-000000000001';
    const repo = await repository(baseNamespace, true, { mutationIdFactory: fixedId });
    await repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'entity-1', record: {} }, now: mutationNow,
    });
    await expect(repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'entity-2', record: {} },
      now: mutationNow,
    })).rejects.toHaveProperty('code');
    expect(await repo.getEntity('notes', 'entity-2')).toBeNull();
  });
});

describe('K-321 reserved store foundations', () => {
  it('writes generation-scoped checkpoint and attachment metadata without network behavior', async () => {
    const repo = await repository();
    await repo.putSyncCheckpoint({
      namespaceKey: repo.namespaceKey, generationId: 'generation-1', provider: 'supabase', stream: 'notes',
      checkpointValue: 'cursor-1', serverEpoch: null, updatedAt: '2026-07-11T00:00:00.000Z',
    });
    await repo.putAttachmentState({
      namespaceKey: repo.namespaceKey, generationId: 'generation-1', attachmentId: 'att-1', referencedBy: ['note-1'],
      localAvailability: 'unknown', remoteAvailability: 'unknown', checksumState: 'unknown', syncState: 'pending',
      storageLocatorReference: null, createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z',
    });
    await expect(repo.putSyncCheckpoint({
      namespaceKey: 'wrong', generationId: 'generation-1', provider: 'supabase', stream: 'notes',
      checkpointValue: 'cursor-1', serverEpoch: null, updatedAt: '2026-07-11T00:00:00.000Z',
    })).rejects.toMatchObject({ code: 'NAMESPACE_MISMATCH' });
  });

  it('reserves validated restore and migration state without performing either operation', async () => {
    const repo = await repository();
    await repo.createGeneration('generation-2', 'test');
    await repo.putRestoreSession({
      namespaceKey: repo.namespaceKey, sessionId: 'restore-1', expectedActiveGenerationId: 'generation-1',
      sourceGenerationId: 'generation-1', targetGenerationId: 'generation-2',
      status: 'preparing', packageFingerprint: 'a'.repeat(64), validationResult: 'pending',
      startedAt: '2026-07-11T00:00:00.000Z', committedAt: null, failureCode: null,
    });
    await repo.putMigrationState({
      namespaceKey: repo.namespaceKey, migrationId: 'migration-1', sourceDatabase: 'legacy', sourceSchemaVersion: 1,
      targetDatabase: LOCAL_DATABASE_NAME, targetSchemaVersion: 1, sourceGenerationId: 'generation-1',
      expectedActiveGenerationId: 'generation-1', targetGenerationId: 'generation-2',
      phase: 'planned', lastDurableStep: 'none', counts: {}, verificationState: 'pending', rollbackEligibility: true,
      createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z',
    });
  });

  it('rejects stale or non-preparing restore generation fences', async () => {
    const repo = await repository();
    await repo.createGeneration('generation-2', 'test');
    const restore = {
      namespaceKey: repo.namespaceKey, sessionId: 'restore-1', expectedActiveGenerationId: 'stale-generation',
      sourceGenerationId: 'generation-1', targetGenerationId: 'generation-2', status: 'preparing' as const,
      packageFingerprint: 'a'.repeat(64), validationResult: 'pending' as const,
      startedAt: '2026-07-11T00:00:00.000Z', committedAt: null, failureCode: null,
    };
    await expect(repo.putRestoreSession(restore)).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    await expect(repo.putRestoreSession({
      ...restore, expectedActiveGenerationId: 'generation-1', sourceGenerationId: 'missing-source',
    })).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    await expect(repo.putRestoreSession({
      ...restore, expectedActiveGenerationId: 'generation-1', targetGenerationId: 'missing-target',
    })).rejects.toMatchObject({ code: 'GENERATION_NOT_FOUND' });
    for (const status of ['sealed', 'abandoned', 'failed'] as const) {
      const generationId = `generation-${status}`;
      await repo.createGeneration(generationId, 'test'); await repo.setGenerationStatus(generationId, status);
      await expect(repo.putRestoreSession({
        ...restore, sessionId: `restore-${status}`, expectedActiveGenerationId: 'generation-1', targetGenerationId: generationId,
      })).rejects.toMatchObject({ code: 'INVALID_GENERATION_TRANSITION' });
      expect(await repo.getGeneration(generationId)).toMatchObject({ status });
    }
    await expect(repo.putRestoreSession({ ...restore, namespaceKey: 'wrong', expectedActiveGenerationId: 'generation-1' }))
      .rejects.toMatchObject({ code: 'NAMESPACE_MISMATCH' });
  });

  it('rejects restore and migration metadata from a repository made stale by activation', async () => {
    const repo = await repository();
    await repo.createGeneration('generation-2', 'test'); await repo.activateGeneration('generation-2');
    await expect(repo.putRestoreSession({
      namespaceKey: repo.namespaceKey, sessionId: 'restore-stale', expectedActiveGenerationId: 'generation-1',
      sourceGenerationId: 'generation-1', targetGenerationId: 'generation-2', status: 'preparing',
      packageFingerprint: 'a'.repeat(64), validationResult: 'pending', startedAt: '2026-07-11T00:00:00.000Z',
      committedAt: null, failureCode: null,
    })).rejects.toMatchObject({ code: 'STALE_GENERATION' });
    await expect(repo.putMigrationState({
      namespaceKey: repo.namespaceKey, migrationId: 'migration-stale', sourceDatabase: 'legacy', sourceSchemaVersion: 1,
      targetDatabase: LOCAL_DATABASE_NAME, targetSchemaVersion: 1, sourceGenerationId: 'generation-1',
      expectedActiveGenerationId: 'generation-1', targetGenerationId: 'generation-2', phase: 'planned',
      lastDurableStep: 'none', counts: {}, verificationState: 'pending', rollbackEligibility: true,
      createdAt: '2026-07-11T00:00:00.000Z', updatedAt: '2026-07-11T00:00:00.000Z',
    })).rejects.toMatchObject({ code: 'STALE_GENERATION' });
  });
});

describe('K-321 lifecycle and static safety', () => {
  it('rejects operations after close and closes stale connections on versionchange', async () => {
    const repo = await repository(); repo.close();
    await expect(repo.getEntity('notes', 'n1')).rejects.toMatchObject({ code: 'DATABASE_CLOSED' });

    const active = await repository();
    const upgrade = indexedDB.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION + 1);
    await new Promise(resolve => { upgrade.onerror = () => resolve(null); upgrade.onsuccess = () => { upgrade.result.close(); resolve(null); }; });
    await expect(active.getEntity('notes', 'n1')).rejects.toMatchObject({ code: 'STALE_CONNECTION' });
    await expect(openLocalDatabase(baseNamespace, { capability })).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEMA_VERSION' });
  });

  it('fails closed on malformed metadata', async () => {
    const repo = await repository();
    const metadata = await repo.readDatabaseMetadata();
    const db = await rawOpen(LOCAL_DATABASE_NAME);
    const tx = db.transaction(LOCAL_DATABASE_STORES.databaseMeta, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).put({ ...metadata, schemaVersion: 999 });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    await expect(repo.readDatabaseMetadata()).rejects.toMatchObject({ code: 'MALFORMED_METADATA' });
  });

  it('fails closed when persisted entity or outbox envelopes are corrupt', async () => {
    const repo = await repository(baseNamespace, true, { mutationIdFactory: () => fixedMutationId });
    await repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: { value: 1 } }, now: mutationNow,
    });
    const db = await rawOpen(LOCAL_DATABASE_NAME);
    const entityTx = db.transaction(LOCAL_DATABASE_STORES.entities, 'readwrite');
    const entityStore = entityTx.objectStore(LOCAL_DATABASE_STORES.entities);
    const entityRequest = entityStore.get([repo.namespaceKey, 'generation-1', 'notes', 'n1']);
    await new Promise<void>((resolve, reject) => {
      entityRequest.onsuccess = () => { entityStore.put({ ...entityRequest.result, revision: 0 }); resolve(); };
      entityRequest.onerror = () => reject(entityRequest.error);
    });
    await new Promise<void>((resolve, reject) => { entityTx.oncomplete = () => resolve(); entityTx.onerror = () => reject(entityTx.error); });
    await expect(repo.getEntity('notes', 'n1')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(repo.listEntities({ domain: 'notes' })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(repo.updateEntity({ domain: 'notes', entityId: 'n1', record: {}, expectedRevision: 1 }))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });

    const outboxTx = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
    const outboxStore = outboxTx.objectStore(LOCAL_DATABASE_STORES.outbox);
    const outboxRequest = outboxStore.get([repo.namespaceKey, 'generation-1', fixedMutationId]);
    await new Promise<void>((resolve, reject) => {
      outboxRequest.onsuccess = () => { outboxStore.put({ ...outboxRequest.result, payload: { kind: 'tombstone' } }); resolve(); };
      outboxRequest.onerror = () => reject(outboxRequest.error);
    });
    await new Promise<void>((resolve, reject) => { outboxTx.oncomplete = () => resolve(); outboxTx.onerror = () => reject(outboxTx.error); });
    db.close();
    await expect(repo.getOutboxRecord(fixedMutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['timestamp', { updatedAt: 'not-a-time' }],
    ['deletion metadata', { isDeleted: true, deletedAt: null }],
  ])('strict reads reject malformed persisted entity %s', async (_label, corruption) => {
    const repo = await repository();
    const created = await repo.createEntity({ domain: 'notes', entityId: 'n1', record: {} });
    const db = await rawOpen(LOCAL_DATABASE_NAME);
    const tx = db.transaction(LOCAL_DATABASE_STORES.entities, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.entities).put({ ...created, ...corruption });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    await expect(repo.getEntity('notes', 'n1')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(repo.listEntities({ domain: 'notes', includeDeleted: true }))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['operation', { operation: 'purge_request' }],
    ['revision', { localRevision: 0 }],
  ])('rejects malformed persisted outbox %s', async (_label, corruption) => {
    const repo = await repository(baseNamespace, true, { mutationIdFactory: () => fixedMutationId });
    await repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: mutationNow,
    });
    const queued = await repo.getOutboxRecord(fixedMutationId);
    const db = await rawOpen(LOCAL_DATABASE_NAME);
    const tx = db.transaction(LOCAL_DATABASE_STORES.outbox, 'readwrite');
    tx.objectStore(LOCAL_DATABASE_STORES.outbox).put({ ...queued, ...corruption });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
    await expect(repo.getOutboxRecord(fixedMutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['create skips revision', { baseRevision: null, localRevision: 2 }],
    ['zero base', { baseRevision: 0, localRevision: 1 }],
    ['unchanged update', { baseRevision: 1, localRevision: 1 }],
    ['skipped update', { baseRevision: 1, localRevision: 3 }],
    ['decreasing update', { baseRevision: 42, localRevision: 1 }],
    ['unsafe base', { baseRevision: Number.MAX_SAFE_INTEGER + 1, localRevision: 1 }],
    ['unsafe local', { baseRevision: 1, localRevision: Number.MAX_SAFE_INTEGER + 1 }],
    ['overflow', { baseRevision: Number.MAX_SAFE_INTEGER, localRevision: Number.MAX_SAFE_INTEGER }],
  ])('rejects persisted outbox revision relationship: %s', async (_label, corruption) => {
    const repo = await repository(baseNamespace, true, { mutationIdFactory: () => fixedMutationId });
    await repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: mutationNow,
    });
    await overwriteOutbox(repo, fixedMutationId, queued => ({ ...queued, ...corruption }));
    await expect(repo.getOutboxRecord(fixedMutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['null tombstone base', { baseRevision: null, localRevision: 1 }],
    ['skipped tombstone revision', { baseRevision: 2, localRevision: 4 }],
  ])('rejects persisted tombstone revision relationship: %s', async (_label, revisions) => {
    const repo = await repository(baseNamespace, true, { mutationIdFactory: () => fixedMutationId });
    await repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: mutationNow,
    });
    await overwriteOutbox(repo, fixedMutationId, queued => ({
      ...queued, ...revisions, operation: 'tombstone',
      payload: {
        kind: 'tombstone', entityId: 'n1', deletedAt: '2026-07-12T00:00:00.000Z', revision: revisions.localRevision,
      },
    }));
    await expect(repo.getOutboxRecord(fixedMutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    ['missing snapshot record', { payload: { kind: 'entity_snapshot' } }],
    ['extra snapshot field', { payload: { kind: 'entity_snapshot', record: {}, extra: true } }],
    ['missing tombstone field', {
      operation: 'tombstone', baseRevision: 1, localRevision: 2,
      payload: { kind: 'tombstone', entityId: 'n1', revision: 2 },
    }],
    ['contradictory hash', { payloadHash: 'a'.repeat(64) }],
  ])('rejects incomplete persisted outbox payload contract: %s', async (_label, corruption) => {
    const repo = await repository(baseNamespace, true, { mutationIdFactory: () => fixedMutationId });
    await repo.commitLocalMutation({
      mutation: { mode: 'create', domain: 'notes', entityId: 'n1', record: {} }, now: mutationNow,
    });
    await overwriteOutbox(repo, fixedMutationId, queued => ({ ...queued, ...corruption }));
    await expect(repo.getOutboxRecord(fixedMutationId)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('contains no destructive, network, auth, legacy-storage, or production wiring paths', () => {
    const files = ['repository.ts', 'schema.ts', 'namespace.ts', 'validation.ts', 'types.ts', 'index.ts'];
    const source = files.map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
    expect(source).not.toMatch(/\.clear\s*\(/);
    expect(source).not.toMatch(/fetch\s*\(|supabase|localStorage|deleteDatabase|restore\s*\(|migrate\s*\(/i);
    expect(source).not.toContain('recoveryModeActive = false');
  });
});
