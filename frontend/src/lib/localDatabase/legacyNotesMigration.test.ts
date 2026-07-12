import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_NOTES_INDEXED_DB_NAME, LEGACY_NOTES_INDEXED_DB_STORE, LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES,
  closeLocalDatabase, createDormantLocalDatabaseCapability, createLegacyNotesIndexedDbAdapter,
  createLegacyNotesLocalStorageAdapter, openLocalDatabase,
  type LegacyNotesMigrationSessionV1, type LegacyNotesSourceAdapter, type LegacyNotesSourceRecord,
  type LocalDatabaseNamespace, type LocalDatabaseRepository,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const base: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const T0 = '2026-07-12T00:00:00.000Z';
const T1 = '2026-07-12T00:00:01.000Z';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const repositories: LocalDatabaseRepository[] = [];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('blocked'));
  });
}
async function repo(namespace = base): Promise<LocalDatabaseRepository> {
  const repository = await openLocalDatabase(namespace, { capability, clock: () => T1 });
  repositories.push(repository); await repository.initializeNamespace(); return repository;
}
function note(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, title: `title-${id.slice(0, 4)}`, body: 'synthetic', createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000, folderId: null, deletedAt: null, starred: false,
    properties: { tags: 'safe' }, relations: { links: [A] }, ...overrides,
  };
}
interface MutableAdapter extends LegacyNotesSourceAdapter { records: LegacyNotesSourceRecord[]; captures: number }
function adapter(records: LegacyNotesSourceRecord[], namespaceKey: string, mode: 'authenticated' | 'local_only' = 'authenticated'): MutableAdapter {
  const value: MutableAdapter = {
    adapter: 'synthetic_legacy_notes', schemaVersion: 1, sourceInstanceId: 'synthetic.notes.v1', namespaceKey,
    ownershipMode: mode, records, captures: 0,
    async capture() { value.captures += 1; return { capturedAt: T0, records: value.records }; },
  };
  return value;
}
function bound(namespaceKey: string, values: Array<[string, unknown]>): LegacyNotesSourceRecord[] {
  return values.map(([legacyKey, value]) => ({ legacyKey, value, ownership: { kind: 'bound', namespaceKey } }));
}
async function newDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function mutateRaw(storeName: string, key: IDBValidKey, transform: (value: any) => any | null): Promise<void> {
  const db = await newDb(); const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
  const request = store.get(key);
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => { const next = transform(request.result); if (next === null) store.delete(key); else store.put(next); resolve(); };
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
}
async function putRaw(storeName: string, value: unknown): Promise<void> {
  const db = await newDb(); const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(value);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
}
async function getAllRaw(storeName: string): Promise<any[]> {
  const db = await newDb(); const tx = db.transaction(storeName, 'readonly'); const request = tx.objectStore(storeName).getAll();
  const values = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); db.close(); return values;
}
async function seedLegacyIndexedDb(values: unknown[]): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_NOTES_INDEXED_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LEGACY_NOTES_INDEXED_DB_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(LEGACY_NOTES_INDEXED_DB_STORE, 'readwrite');
  for (const value of values) tx.objectStore(LEGACY_NOTES_INDEXED_DB_STORE).put(value);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
}

beforeEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
  await deleteDatabase(LEGACY_NOTES_INDEXED_DB_NAME).catch(() => undefined);
});
afterEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
  await deleteDatabase(LEGACY_NOTES_INDEXED_DB_NAME).catch(() => undefined);
});

describe('K-325 legacy Notes migration and shadow verification', () => {
  it('verifies an empty authoritative legacy store without activating the target', async () => {
    const repository = await repo(); const source = adapter([], repository.namespaceKey, 'local_only');
    const captured = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'empty', now: T0 });
    expect(captured.status).toBe('capturing');
    const staged = await repository.resumeLegacyNotesMigration(source, 'empty', T1) as LegacyNotesMigrationSessionV1;
    expect(staged.status).toBe('staged');
    const result = await repository.verifyLegacyNotesMigration(source, 'empty', T1);
    expect(result).toMatchObject({ entryCount: 0, liveCount: 0, tombstoneCount: 0 });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    expect((await repository.getGeneration(staged.target.generationId))).toMatchObject({ status: 'preparing', validationState: 'valid' });
    expect(await getAllRaw(LOCAL_DATABASE_STORES.outbox)).toEqual([]);
    expect(await getAllRaw(LOCAL_DATABASE_STORES.syncCheckpoints)).toEqual([]);
  });

  it('preserves live/tombstone state, timestamps, metadata, and attachment references exactly', async () => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [
      [A, note(A, { body: `before attachment://asset-1 after`, createdAt: undefined, lastOpenedAt: 1_700_000_002_000 })],
      [B, note(B, { deletedAt: 1_700_000_003_000, properties: { kind: 'archive' } })],
    ]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'mixed', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'mixed', T1);
    const result = await repository.verifyLegacyNotesMigration(source, 'mixed', T1);
    expect(result).toMatchObject({ entryCount: 2, liveCount: 1, tombstoneCount: 1 });
    const entities = await getAllRaw(LOCAL_DATABASE_STORES.entities);
    const migrated = entities.filter(entity => entity.generationId === 'migration-mixed');
    expect(migrated).toHaveLength(2);
    expect(migrated.find(entity => entity.entityId === A)).toMatchObject({
      isDeleted: false, createdAt: new Date(1_700_000_001_000).toISOString(),
      record: { body: `before attachment://asset-1 after`, lastOpenedAt: 1_700_000_002_000 },
    });
    expect(migrated.find(entity => entity.entityId === B)).toMatchObject({
      isDeleted: true, deletedAt: new Date(1_700_000_003_000).toISOString(), deletionState: 'deleted',
    });
    const session = await repository.getLegacyNotesMigrationSession('mixed');
    expect(session?.manifest.entries[0].attachmentReferenceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reads the actual legacy IndexedDB store in one readonly snapshot without changing it', async () => {
    await seedLegacyIndexedDb([note(A), note(B)]);
    const repository = await repo();
    const source = createLegacyNotesIndexedDbAdapter({ namespaceKey: repository.namespaceKey, ownershipMode: 'authenticated', indexedDB, clock: () => T0 });
    const before = await source.capture();
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'actual-idb', now: T0 });
    const after = await source.capture();
    expect(after.records).toEqual(before.records);
    expect(after.records).toHaveLength(2);
  });

  it('supports the explicit localStorage fallback and distinguishes missing from an authoritative empty array', async () => {
    const repository = await repo();
    const missing = createLegacyNotesLocalStorageAdapter({
      namespaceKey: repository.namespaceKey, ownershipMode: 'local_only', source: { getItem: () => null }, clock: () => T0,
    });
    await expect(repository.captureLegacyNotesMigration(missing, { migrationSessionId: 'missing', now: T0 }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_UNAVAILABLE' });
    const empty = createLegacyNotesLocalStorageAdapter({
      namespaceKey: repository.namespaceKey, ownershipMode: 'local_only', source: { getItem: () => '[]' }, clock: () => T0,
    });
    await expect(repository.captureLegacyNotesMigration(empty, { migrationSessionId: 'empty-local', now: T0 }))
      .resolves.toMatchObject({ source: { entryCount: 0, ownershipMode: 'local_only' } });
  });

  it('fails closed when the real legacy IndexedDB database is missing', async () => {
    const repository = await repo();
    const source = createLegacyNotesIndexedDbAdapter({ namespaceKey: repository.namespaceKey, ownershipMode: 'authenticated', indexedDB });
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'missing-idb', now: T0 }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_UNAVAILABLE' });
  });

  it.each([
    ['foreign ownership', (namespaceKey: string) => [{ legacyKey: A, value: note(A), ownership: { kind: 'foreign' as const } }]],
    ['ambiguous ownership', (namespaceKey: string) => [{ legacyKey: A, value: note(A), ownership: { kind: 'ambiguous' as const } }]],
    ['wrong bound namespace', (namespaceKey: string) => [{ legacyKey: A, value: note(A), ownership: { kind: 'bound' as const, namespaceKey: `${namespaceKey}x` } }]],
    ['duplicate legacy key', (namespaceKey: string) => bound(namespaceKey, [[A, note(A)], [A, note(B)]])],
    ['duplicate entity id', (namespaceKey: string) => bound(namespaceKey, [['key-a', note(A)], ['key-b', note(A)]])],
    ['malformed timestamp', (namespaceKey: string) => bound(namespaceKey, [[A, note(A, { updatedAt: -1 })]])],
    ['malformed tombstone', (namespaceKey: string) => bound(namespaceKey, [[A, note(A, { deletedAt: 'bad' })]])],
    ['unknown field', (namespaceKey: string) => bound(namespaceKey, [[A, note(A, { remoteCursor: 'unsafe' })]])],
  ])('rejects %s without staging anything', async (_label, records) => {
    const repository = await repo(); const source = adapter(records(repository.namespaceKey), repository.namespaceKey);
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'invalid', now: T0 })).rejects.toHaveProperty('code');
    expect((await getAllRaw(LOCAL_DATABASE_STORES.generations)).filter(generation => generation.creationReason === 'migration')).toEqual([]);
  });

  it('resumes safely across both capture/stage and stage/verify restarts', async () => {
    let repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'restart', now: T0 });
    closeLocalDatabase(repository);
    repository = await repo();
    await expect(repository.resumeLegacyNotesMigration(source, 'restart', T1)).resolves.toMatchObject({ status: 'staged' });
    closeLocalDatabase(repository);
    repository = await repo();
    await expect(repository.resumeLegacyNotesMigration(source, 'restart', T1)).resolves.toMatchObject({ entryCount: 1 });
  });

  it('is idempotent for exact duplicate capture and verified retry', async () => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const first = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'same', now: T0 });
    const duplicate = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'other', now: T1 });
    expect(duplicate.migrationId).toBe(first.migrationId);
    await repository.resumeLegacyNotesMigration(source, first.migrationId, T1);
    const result = await repository.verifyLegacyNotesMigration(source, first.migrationId, T1);
    const before = (await getAllRaw(LOCAL_DATABASE_STORES.entities)).filter(entity => entity.generationId === 'migration-same');
    await expect(repository.resumeLegacyNotesMigration(source, first.migrationId, T1)).resolves.toEqual(result);
    const after = (await getAllRaw(LOCAL_DATABASE_STORES.entities)).filter(entity => entity.generationId === 'migration-same');
    expect(after).toEqual(before);
    expect((await getAllRaw(LOCAL_DATABASE_STORES.generations)).filter(generation => generation.creationReason === 'migration')).toHaveLength(1);
  });

  it('requires a new session for a changed source and leaves the verified generation immutable', async () => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'old-source', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'old-source', T1);
    await repository.verifyLegacyNotesMigration(source, 'old-source', T1);
    const oldEntities = (await getAllRaw(LOCAL_DATABASE_STORES.entities)).filter(entity => entity.generationId === 'migration-old-source');
    source.records = bound(repository.namespaceKey, [[A, note(A)], [B, note(B)]]);
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'old-source', now: T1 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    await expect(repository.resumeLegacyNotesMigration(source, 'old-source', T1))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repository.getLegacyNotesMigrationSession('old-source')).toMatchObject({ status: 'verified' });
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'new-source', now: T1 }))
      .resolves.toMatchObject({ migrationId: 'new-source', status: 'capturing', source: { entryCount: 2 } });
    expect((await getAllRaw(LOCAL_DATABASE_STORES.entities)).filter(entity => entity.generationId === 'migration-old-source'))
      .toEqual(oldEntities);
  });

  it('rejects a stale resume adapter without changing the captured session', async () => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const captured = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'stale-adapter', now: T0 });
    const other = { ...source, sourceInstanceId: 'other.source.instance', capture: source.capture.bind(source) };
    await expect(repository.resumeLegacyNotesMigration(other, 'stale-adapter', T1)).rejects.toHaveProperty('code');
    expect(await repository.getLegacyNotesMigrationSession('stale-adapter')).toEqual(captured);
  });

  it('fails the captured session when the legacy source changes before staging', async () => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'changed-capture', now: T0 });
    source.records = bound(repository.namespaceKey, [[A, note(A)], [B, note(B)]]);
    await expect(repository.resumeLegacyNotesMigration(source, 'changed-capture', T1))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repository.getLegacyNotesMigrationSession('changed-capture')).toMatchObject({
      status: 'failed', failure: { code: 'MIGRATION_SOURCE_CHANGED' },
    });
  });

  it('fails verification when the legacy source changes after staging', async () => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'changed-stage', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'changed-stage', T1);
    source.records = bound(repository.namespaceKey, [[A, note(A, { title: 'changed' })]]);
    await expect(repository.verifyLegacyNotesMigration(source, 'changed-stage', T1))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repository.getLegacyNotesMigrationSession('changed-stage')).toMatchObject({ status: 'failed' });
  });

  it('detects a source change between the two verification captures', async () => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'change-during-verify', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'change-during-verify', T1);
    const originalCapture = source.capture.bind(source);
    source.capture = async () => {
      const captured = await originalCapture();
      if (source.captures === 3) {
        source.records = bound(repository.namespaceKey, [[A, note(A, { title: 'changed-concurrently' })]]);
      }
      return captured;
    };
    await expect(repository.verifyLegacyNotesMigration(source, 'change-during-verify', T1))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repository.getLegacyNotesMigrationSession('change-during-verify')).toMatchObject({ status: 'failed' });
  });

  it('fences concurrent sessions in one namespace while allowing different namespaces', async () => {
    const left = await repo(); const leftSource = adapter(bound(left.namespaceKey, [[A, note(A)]]), left.namespaceKey);
    await left.captureLegacyNotesMigration(leftSource, { migrationSessionId: 'left', now: T0 });
    leftSource.records = bound(left.namespaceKey, [[A, note(A, { title: 'changed' })]]);
    await expect(left.captureLegacyNotesMigration(leftSource, { migrationSessionId: 'right', now: T1 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SESSION_CONFLICT' });
    const right = await repo({ ...base, userId: 'user-b' });
    const rightSource = adapter(bound(right.namespaceKey, [[B, note(B)]]), right.namespaceKey);
    await expect(right.captureLegacyNotesMigration(rightSource, { migrationSessionId: 'right', now: T0 })).resolves.toBeDefined();
  });

  it('cancels capturing and staged sessions without deleting inactive evidence', async () => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'cancel-capture', now: T0 });
    await expect(repository.cancelLegacyNotesMigration('cancel-capture', T1)).resolves.toMatchObject({ status: 'cancelled' });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'cancel-stage', now: T0 });
    const staged = await repository.resumeLegacyNotesMigration(source, 'cancel-stage', T1) as LegacyNotesMigrationSessionV1;
    await expect(repository.cancelLegacyNotesMigration('cancel-stage', T1)).resolves.toMatchObject({ status: 'cancelled' });
    expect(await repository.getGeneration(staged.target.generationId)).toMatchObject({ status: 'preparing' });
    expect((await getAllRaw(LOCAL_DATABASE_STORES.entities)).filter(entity => entity.generationId === staged.target.generationId)).toHaveLength(1);
  });

  async function verifiedFixture() {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'verified', now: T0 });
    const staged = await repository.resumeLegacyNotesMigration(source, 'verified', T1) as LegacyNotesMigrationSessionV1;
    await repository.verifyLegacyNotesMigration(source, 'verified', T1);
    return { repository, source, staged };
  }

  it.each([
    ['missing target entity', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.entities, [fixture.repository.namespaceKey, fixture.staged.target.generationId, 'notes', A], () => null);
    }],
    ['altered payload', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.entities, [fixture.repository.namespaceKey, fixture.staged.target.generationId, 'notes', A], value => ({ ...value, record: note(A, { title: 'tampered' }) }));
    }],
    ['altered revision', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.entities, [fixture.repository.namespaceKey, fixture.staged.target.generationId, 'notes', A], value => ({ ...value, revision: 2 }));
    }],
    ['altered provenance', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.entities, [fixture.repository.namespaceKey, fixture.staged.target.generationId, 'notes', A], value => ({
        ...value, migrationProvenance: { ...value.migrationProvenance, migrationSessionId: 'other' },
      }));
    }],
    ['missing generation', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.generations, [fixture.repository.namespaceKey, fixture.staged.target.generationId], () => null);
    }],
    ['invalid target generation status', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.generations, [fixture.repository.namespaceKey, fixture.staged.target.generationId], value => ({
        ...value, status: 'sealed', activeNamespaceKey: undefined,
      }));
    }],
    ['manifest digest mismatch', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [fixture.repository.namespaceKey, 'verified'], value => ({
        ...value, manifest: { ...value.manifest, manifestDigest: '0'.repeat(64) },
      }));
    }],
    ['missing manifest', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [fixture.repository.namespaceKey, 'verified'], value => ({
        ...value, manifest: null,
      }));
    }],
    ['stored result mismatch', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [fixture.repository.namespaceKey, 'verified'], value => ({
        ...value, result: { ...value.result, liveCount: 0, tombstoneCount: 1 },
      }));
    }],
  ] as const)('rejects verified durable corruption: %s', async (_label, corrupt) => {
    const fixture = await verifiedFixture(); await corrupt(fixture);
    await expect(fixture.repository.getLegacyNotesMigrationSession('verified'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(fixture.repository.resumeLegacyNotesMigration(fixture.source, 'verified', T1))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects extra target evidence and any outbox/checkpoint contamination', async () => {
    const fixture = await verifiedFixture();
    const [entity] = (await getAllRaw(LOCAL_DATABASE_STORES.entities)).filter(value => value.generationId === fixture.staged.target.generationId);
    await putRaw(LOCAL_DATABASE_STORES.entities, { ...entity, entityId: B, record: note(B) });
    await expect(fixture.repository.getLegacyNotesMigrationSession('verified'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints])(
    'rejects unexpected %s evidence in the inactive migration generation', async storeName => {
      const fixture = await verifiedFixture();
      const value = storeName === LOCAL_DATABASE_STORES.outbox
        ? { namespaceKey: fixture.repository.namespaceKey, generationId: fixture.staged.target.generationId, mutationId: 'unexpected' }
        : { namespaceKey: fixture.repository.namespaceKey, generationId: fixture.staged.target.generationId, provider: 'unexpected', stream: 'unexpected' };
      await putRaw(storeName, value);
      await expect(fixture.repository.getLegacyNotesMigrationSession('verified'))
        .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    },
  );

  it('never changes the active pointer and detects external metadata movement', async () => {
    const fixture = await verifiedFixture();
    expect((await fixture.repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    await mutateRaw(LOCAL_DATABASE_STORES.databaseMeta, fixture.repository.namespaceKey, value => ({
      ...value, activeGenerationId: fixture.staged.target.generationId,
    }));
    await expect(fixture.repository.getLegacyNotesMigrationSession('verified'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });
});
