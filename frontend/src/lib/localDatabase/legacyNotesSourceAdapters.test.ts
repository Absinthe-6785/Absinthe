import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_NOTES_AUTHORITY_NAMESPACE, LEGACY_NOTES_INDEXED_DB_NAME, LEGACY_NOTES_INDEXED_DB_STORE,
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, closeLocalDatabase, createDormantLocalDatabaseCapability,
  createLegacyNotesIndexedDbAdapter, createLegacyNotesLocalStorageAdapter, openLocalDatabase,
  type LegacyNotesSourceAdapter, type LegacyNotesSourceAuthorityRecordV1,
  type LocalDatabaseNamespace, type LocalDatabaseRepository,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const T0 = '2026-07-13T00:00:00.000Z';
const T1 = '2026-07-13T00:00:01.000Z';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const base: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const repositories: LocalDatabaseRepository[] = [];

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}
async function repo(namespace = base): Promise<LocalDatabaseRepository> {
  const repository = await openLocalDatabase(namespace, { capability, clock: () => T1 });
  repositories.push(repository); await repository.initializeNamespace(); return repository;
}
function note(id = A): Record<string, unknown> {
  return {
    id, title: 'synthetic', body: 'synthetic', createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000, folderId: null, deletedAt: null, starred: false,
    properties: { safe: 'value' }, relations: { links: [A] },
  };
}
async function seed(factory: IDBFactory, values = [note()]): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(LEGACY_NOTES_INDEXED_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(LEGACY_NOTES_INDEXED_DB_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(LEGACY_NOTES_INDEXED_DB_STORE, 'readwrite');
  for (const value of values) tx.objectStore(LEGACY_NOTES_INDEXED_DB_STORE).put(value);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
}
async function authority(
  repository: LocalDatabaseRepository,
  options: Partial<{
    authorityId: string; sourceType: 'indexeddb' | 'localstorage'; sourceInstanceId: string;
    sourceIdentityId: string; ownershipMode: 'authenticated' | 'local_only'; now: string;
  }> = {},
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  return repository.registerLegacyNotesSourceAuthority({
    authorityId: options.authorityId ?? 'authority-one', sourceType: options.sourceType ?? 'indexeddb',
    sourceInstanceId: options.sourceInstanceId ?? 'absinthe-notes-v1.notes.v1',
    sourceIdentityId: options.sourceIdentityId ?? 'physical-vault-one',
    ownershipMode: options.ownershipMode ?? 'authenticated', now: options.now ?? T0,
  });
}
async function rawAuthorityMutation(
  record: LegacyNotesSourceAuthorityRecordV1, transform: (value: any) => any | null,
): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
  const key: [string, string] = [LEGACY_NOTES_AUTHORITY_NAMESPACE, `source:${record.sourceIdentityDigest}`];
  const get = store.get(key);
  get.onsuccess = () => {
    const next = transform(get.result); if (next === null) store.delete(key); else store.put(next);
  };
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  });
  db.close();
}
async function migrationRows(): Promise<any[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const request = tx.objectStore(LOCAL_DATABASE_STORES.migrationState).getAll();
  const rows = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  db.close(); return rows;
}
async function targetRows(storeName: string): Promise<any[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(storeName, 'readonly'); const request = tx.objectStore(storeName).getAll();
  const rows = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  }); db.close(); return rows;
}

beforeEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(indexedDB as IDBFactory, LOCAL_DATABASE_NAME).catch(() => undefined);
  await deleteDatabase(indexedDB as IDBFactory, LEGACY_NOTES_INDEXED_DB_NAME).catch(() => undefined);
});
afterEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(indexedDB as IDBFactory, LOCAL_DATABASE_NAME).catch(() => undefined);
  await deleteDatabase(indexedDB as IDBFactory, LEGACY_NOTES_INDEXED_DB_NAME).catch(() => undefined);
});

describe('K-325E durable legacy source authority', () => {
  it('requires durable authority before capture and does not invoke the adapter', async () => {
    const repository = await repo(); let captures = 0;
    const missing: LegacyNotesSourceAdapter = {
      adapter: 'missing_authority', schemaVersion: 1, authorityId: 'missing', authorityVersion: 1,
      authorityDigest: 'a'.repeat(64), sourceType: 'indexeddb', sourceInstanceId: 'synthetic.notes.v1',
      sourceIdentityDigest: 'b'.repeat(64), namespaceKey: repository.namespaceKey, ownershipMode: 'authenticated',
      async capture() { captures += 1; return { capturedAt: T0, records: [] }; },
    };
    await expect(repository.captureLegacyNotesMigration(missing, { migrationSessionId: 'missing-authority', now: T0 }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_REQUIRED' });
    expect(captures).toBe(0);
    expect((await migrationRows()).filter(row => row.kind === 'legacy_notes_migration_v1')).toEqual([]);
    expect(await targetRows(LOCAL_DATABASE_STORES.generations)).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ creationReason: 'migration' }),
    ]));
    expect(await targetRows(LOCAL_DATABASE_STORES.entities)).toEqual([]);
  });

  it('registers the same namespace claim idempotently while preserving the original creation time', async () => {
    const repository = await repo();
    const [first, second] = await Promise.all([authority(repository), authority(repository, { now: T1 })]);
    expect(second).toEqual(first);
    expect((await migrationRows()).filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });

  it('rejects conflicting authority IDs and altered source reuse', async () => {
    const repository = await repo(); await authority(repository);
    await expect(authority(repository, { authorityId: 'different-authority' }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    await expect(authority(repository, { sourceIdentityId: 'different-physical-source' }))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect((await migrationRows()).filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });

  it('rejects the same source identity for a different user before migration writes', async () => {
    const left = await repo(); const right = await repo({ ...base, userId: 'user-b' });
    const bound = await authority(left);
    await expect(authority(right, { authorityId: 'authority-user-b' }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB });
    await expect(right.captureLegacyNotesMigration(source, { migrationSessionId: 'wrong-user', now: T0 }))
      .rejects.toHaveProperty('code');
    await expect(right.resumeLegacyNotesMigration(source, 'wrong-user', T1)).rejects.toHaveProperty('code');
    await expect(right.verifyLegacyNotesMigration(source, 'wrong-user', T1)).rejects.toHaveProperty('code');
    expect((await migrationRows()).filter(row => row.kind === 'legacy_notes_migration_v1'
      && row.namespaceKey === right.namespaceKey)).toEqual([]);
    expect((await targetRows(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.namespaceKey === right.namespaceKey && row.creationReason === 'migration')).toEqual([]);
    expect((await targetRows(LOCAL_DATABASE_STORES.entities))
      .filter(row => row.namespaceKey === right.namespaceKey)).toEqual([]);
  });

  it('rejects the same source identity for the same user in a different project', async () => {
    const left = await repo(); const right = await repo({ ...base, projectRef: 'project-b' });
    const bound = await authority(left);
    await expect(authority(right, { authorityId: 'authority-project-b' }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB });
    await expect(right.captureLegacyNotesMigration(source, { migrationSessionId: 'wrong-project', now: T0 }))
      .rejects.toHaveProperty('code');
    expect((await targetRows(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.namespaceKey === right.namespaceKey && row.creationReason === 'migration')).toEqual([]);
  });

  it('serializes concurrent cross-namespace claims so at most one namespace wins', async () => {
    const left = await repo(); const right = await repo({ ...base, userId: 'user-b' });
    const results = await Promise.allSettled([
      authority(left, { authorityId: 'race-a' }), authority(right, { authorityId: 'race-b' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await migrationRows()).filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });

  it('applies the same durable binding to localStorage sources', async () => {
    const left = await repo(); const right = await repo({ ...base, userId: 'user-b' });
    const bound = await authority(left, {
      authorityId: 'local-authority', sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      sourceIdentityId: 'physical-local-vault', ownershipMode: 'local_only',
    });
    const storage = { getItem: () => JSON.stringify([note()]) };
    const source = createLegacyNotesLocalStorageAdapter({ authority: bound, source: storage, clock: () => T0 });
    await expect(left.captureLegacyNotesMigration(source, { migrationSessionId: 'local-left', now: T0 })).resolves.toBeDefined();
    await expect(authority(right, {
      authorityId: 'local-authority-b', sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      sourceIdentityId: 'physical-local-vault', ownershipMode: 'local_only',
    })).rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    await expect(right.captureLegacyNotesMigration(source, { migrationSessionId: 'local-right', now: T0 }))
      .rejects.toHaveProperty('code');
  });

  it('rejects source-type authority reuse at adapter construction', async () => {
    const repository = await repo(); const indexedAuthority = await authority(repository);
    expect(() => createLegacyNotesLocalStorageAdapter({
      authority: indexedAuthority, source: { getItem: () => '[]' },
    })).toThrow(expect.objectContaining({ code: 'LEGACY_SOURCE_IDENTITY_MISMATCH' }));
    const wrongDescriptor = await authority(repository, {
      authorityId: 'wrong-descriptor', sourceInstanceId: 'another.indexeddb.source',
      sourceIdentityId: 'wrong-descriptor-source',
    });
    expect(() => createLegacyNotesIndexedDbAdapter({ authority: wrongDescriptor, indexedDB }))
      .toThrow(expect.objectContaining({ code: 'LEGACY_SOURCE_IDENTITY_MISMATCH' }));
  });

  it('does not let identical payloads continue a session under a replacement identity', async () => {
    const firstFactory = indexedDB as IDBFactory; const secondFactory = new IDBFactory();
    await seed(firstFactory); await seed(secondFactory);
    const repository = await repo(); const firstAuthority = await authority(repository);
    const replacementAuthority = await authority(repository, {
      authorityId: 'replacement-authority', sourceIdentityId: 'physical-vault-replacement',
    });
    const first = createLegacyNotesIndexedDbAdapter({ authority: firstAuthority, indexedDB: firstFactory, clock: () => T0 });
    const replacement = createLegacyNotesIndexedDbAdapter({ authority: replacementAuthority, indexedDB: secondFactory, clock: () => T0 });
    await repository.captureLegacyNotesMigration(first, { migrationSessionId: 'replacement', now: T0 });
    await expect(repository.resumeLegacyNotesMigration(replacement, 'replacement', T1))
      .rejects.toMatchObject({ code: 'MIGRATION_SESSION_CONFLICT' });
    expect((await targetRows(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.generationId === 'migration-replacement')).toEqual([]);
    await deleteDatabase(secondFactory, LEGACY_NOTES_INDEXED_DB_NAME);
  });

  it('applies identical-payload replacement fencing to localStorage', async () => {
    const repository = await repo();
    const firstAuthority = await authority(repository, {
      authorityId: 'local-first', sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      sourceIdentityId: 'local-physical-one', ownershipMode: 'local_only',
    });
    const replacementAuthority = await authority(repository, {
      authorityId: 'local-replacement', sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      sourceIdentityId: 'local-physical-two', ownershipMode: 'local_only',
    });
    const payload = JSON.stringify([note()]);
    const first = createLegacyNotesLocalStorageAdapter({
      authority: firstAuthority, source: { getItem: () => payload }, clock: () => T0,
    });
    const replacement = createLegacyNotesLocalStorageAdapter({
      authority: replacementAuthority, source: { getItem: () => payload }, clock: () => T0,
    });
    await repository.captureLegacyNotesMigration(first, { migrationSessionId: 'local-replacement', now: T0 });
    await expect(repository.resumeLegacyNotesMigration(replacement, 'local-replacement', T1))
      .rejects.toMatchObject({ code: 'MIGRATION_SESSION_CONFLICT' });
    expect((await targetRows(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.generationId === 'migration-local-replacement')).toEqual([]);
  });

  it('fails closed when persisted authority is removed or tampered', async () => {
    await seed(indexedDB as IDBFactory); const repository = await repo(); const bound = await authority(repository);
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB, clock: () => T0 });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'authority-evidence', now: T0 });
    await rawAuthorityMutation(bound, value => ({ ...value, projectRef: 'tampered-project' }));
    await expect(repository.getLegacyNotesMigrationSession('authority-evidence'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await rawAuthorityMutation(bound, () => null);
    await expect(repository.resumeLegacyNotesMigration(source, 'authority-evidence', T1))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_REQUIRED' });
    expect((await targetRows(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.generationId === 'migration-authority-evidence')).toEqual([]);
  });

  it.each([
    ['namespace', (value: any) => ({ ...value, boundNamespaceKey: '0'.repeat(64) })],
    ['user', (value: any) => ({ ...value, userId: 'tampered-user' })],
    ['project', (value: any) => ({ ...value, projectRef: 'tampered-project' })],
    ['source type', (value: any) => ({ ...value, sourceType: 'localstorage' })],
    ['source instance', (value: any) => ({ ...value, sourceInstanceId: 'tampered.source' })],
    ['source identity', (value: any) => ({ ...value, sourceIdentityDigest: '0'.repeat(64) })],
    ['authority id', (value: any) => ({ ...value, authorityId: 'tampered-authority' })],
    ['version', (value: any) => ({ ...value, version: 2 })],
    ['discriminator', (value: any) => ({ ...value, kind: 'tampered_authority' })],
    ['method', (value: any) => ({ ...value, authorityMethod: 'implicit' })],
    ['digest', (value: any) => ({ ...value, authorityDigest: '0'.repeat(64) })],
  ] as const)('rejects persisted authority tampering: %s', async (_label, tamper) => {
    await seed(indexedDB as IDBFactory); const repository = await repo(); const bound = await authority(repository);
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB, clock: () => T0 });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'tampered-authority', now: T0 });
    await rawAuthorityMutation(bound, tamper);
    await expect(repository.getLegacyNotesMigrationSession('tampered-authority'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect((await targetRows(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.generationId === 'migration-tampered-authority')).toEqual([]);
  });

  it('rejects missing authority after staging and before verification', async () => {
    await seed(indexedDB as IDBFactory); const repository = await repo(); const bound = await authority(repository);
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB, clock: () => T0 });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'missing-staged', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'missing-staged', T1);
    const entitiesBefore = await targetRows(LOCAL_DATABASE_STORES.entities);
    await rawAuthorityMutation(bound, () => null);
    await expect(repository.verifyLegacyNotesMigration(source, 'missing-staged', T1))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_REQUIRED' });
    expect(await targetRows(LOCAL_DATABASE_STORES.entities)).toEqual(entitiesBefore);
  });

  it('rejects revoked authority after staging and before verification', async () => {
    await seed(indexedDB as IDBFactory); const repository = await repo(); const bound = await authority(repository);
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB, clock: () => T0 });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'revoked-staged', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'revoked-staged', T1);
    await repository.revokeLegacyNotesSourceAuthority(bound.authorityId, T1);
    await expect(repository.verifyLegacyNotesMigration(source, 'revoked-staged', T1))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_REVOKED' });
  });

  it('revalidates revocation during verify and verified retry without deleting evidence', async () => {
    await seed(indexedDB as IDBFactory); const repository = await repo(); const bound = await authority(repository);
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB, clock: () => T0 });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'revoked', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'revoked', T1);
    await repository.verifyLegacyNotesMigration(source, 'revoked', T1);
    const entitiesBefore = await targetRows(LOCAL_DATABASE_STORES.entities);
    await repository.revokeLegacyNotesSourceAuthority(bound.authorityId, T1);
    await expect(repository.resumeLegacyNotesMigration(source, 'revoked', T1))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_REVOKED' });
    expect(await targetRows(LOCAL_DATABASE_STORES.entities)).toEqual(entitiesBefore);
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
  });

  it('derives staged owner only from the validated authority namespace', async () => {
    await seed(indexedDB as IDBFactory); const repository = await repo(); const bound = await authority(repository);
    const source = createLegacyNotesIndexedDbAdapter({ authority: bound, indexedDB, clock: () => T0 });
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'authority-owner', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'authority-owner', T1);
    const [entity] = (await targetRows(LOCAL_DATABASE_STORES.entities))
      .filter(row => row.generationId === 'migration-authority-owner');
    expect(entity.ownerId).toBe(bound.userId);
    expect(entity.namespaceKey).toBe(bound.boundNamespaceKey);
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    expect(await targetRows(LOCAL_DATABASE_STORES.outbox)).toEqual([]);
    expect(await targetRows(LOCAL_DATABASE_STORES.syncCheckpoints)).toEqual([]);
  });
});
