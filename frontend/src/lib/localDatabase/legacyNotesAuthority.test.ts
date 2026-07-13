import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_NOTES_AUTHORITY_NAMESPACE, LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES,
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase,
  type LegacyNotesSourceAuthorityRecordV1, type LocalDatabaseNamespace, type LocalDatabaseRepository,
} from './index';

const capability = createDormantLocalDatabaseCapability('test');
const T0 = '2026-07-13T00:00:00.000Z';
const base: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const repositories: LocalDatabaseRepository[] = [];

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}
async function repo(namespace = base): Promise<LocalDatabaseRepository> {
  const repository = await openLocalDatabase(namespace, { capability, clock: () => T0 });
  repositories.push(repository); await repository.initializeNamespace(); return repository;
}
async function register(
  repository: LocalDatabaseRepository,
  options: Partial<{
    authorityId: string; sourceType: 'indexeddb' | 'localstorage'; sourceInstanceId: string;
    sourceIdentityId: string; ownershipMode: 'authenticated' | 'local_only';
  }> = {},
): Promise<LegacyNotesSourceAuthorityRecordV1> {
  return repository.registerLegacyNotesSourceAuthority({
    authorityId: options.authorityId ?? 'authority-a', sourceType: options.sourceType ?? 'indexeddb',
    sourceInstanceId: options.sourceInstanceId ?? 'absinthe-notes-v1.notes.v1',
    sourceIdentityId: options.sourceIdentityId ?? 'external-root-a',
    ownershipMode: options.ownershipMode ?? 'authenticated', now: T0,
  });
}
async function globalRows(): Promise<any[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const request = tx.objectStore(LOCAL_DATABASE_STORES.migrationState).getAll(IDBKeyRange.bound(
    [LEGACY_NOTES_AUTHORITY_NAMESPACE, ''], [LEGACY_NOTES_AUTHORITY_NAMESPACE, '\uffff'],
  ));
  const rows = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  db.close(); return rows;
}
async function mutateGlobal(key: [string, string], transform: (value: any) => any | null): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState); const request = store.get(key);
  request.onsuccess = () => { const next = transform(request.result); if (next === null) store.delete(key); else store.put(next); };
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => undefined;
  });
  db.close();
}

beforeEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
});
afterEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
});

describe('K-325F root-level legacy source authority', () => {
  it('binds one external root to one exact type, descriptor, namespace, and authority', async () => {
    const left = await repo(); const right = await repo({ ...base, userId: 'user-b' });
    const canonical = await register(left);
    await expect(register(right, {
      authorityId: 'authority-b', sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      sourceIdentityId: 'external-root-a', ownershipMode: 'local_only',
    })).rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    await expect(register(right, {
      authorityId: 'authority-c', sourceInstanceId: 'absinthe-notes-v1.other-store.v1',
      sourceIdentityId: 'external-root-a',
    })).rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    await expect(register(left, { authorityId: 'authority-other', sourceIdentityId: 'external-root-a' }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    await expect(register(left, { authorityId: 'authority-a', sourceIdentityId: 'different-root' }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_CONFLICT' });
    await expect(register(left)).resolves.toEqual(canonical);
    const rows = await globalRows();
    expect(rows.filter(row => row.kind === 'legacy_notes_source_root_binding_v1')).toHaveLength(1);
    expect(rows.filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });

  it('serializes concurrent descriptor aliases to one root binding and one authority', async () => {
    const left = await repo(); const right = await repo({ ...base, userId: 'user-b' });
    const results = await Promise.allSettled([
      register(left, { authorityId: 'race-idb', sourceIdentityId: 'race-root' }),
      register(right, {
        authorityId: 'race-local', sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
        sourceIdentityId: 'race-root', ownershipMode: 'local_only',
      }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const rows = await globalRows();
    expect(rows.filter(row => row.kind === 'legacy_notes_source_root_binding_v1')).toHaveLength(1);
    expect(rows.filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });

  it('converges concurrent identical claims without duplicate records', async () => {
    const repository = await repo();
    const [first, second] = await Promise.all([register(repository), register(repository)]);
    expect(second).toEqual(first);
    const rows = await globalRows();
    expect(rows.filter(row => row.kind === 'legacy_notes_source_root_binding_v1')).toHaveLength(1);
    expect(rows.filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });

  it.each([
    ['discriminator', (value: any) => ({ ...value, kind: 'wrong' })],
    ['version', (value: any) => ({ ...value, version: 2 })],
    ['storage id', (value: any) => ({ ...value, migrationId: 'root:wrong' })],
    ['external root', (value: any) => ({ ...value, externalRootDigest: '0'.repeat(64) })],
    ['authority id', (value: any) => ({ ...value, authorityId: 'other' })],
    ['source type', (value: any) => ({ ...value, sourceType: 'localstorage' })],
    ['source instance', (value: any) => ({ ...value, sourceInstanceId: 'tampered.source' })],
    ['source binding', (value: any) => ({ ...value, sourceBindingDigest: '0'.repeat(64) })],
    ['namespace', (value: any) => ({ ...value, boundNamespaceKey: '0'.repeat(64) })],
    ['user', (value: any) => ({ ...value, userId: 'other-user' })],
    ['project', (value: any) => ({ ...value, projectRef: 'other-project' })],
    ['device', (value: any) => ({ ...value, deviceId: 'other-device' })],
    ['schema', (value: any) => ({ ...value, schemaVersion: 2 })],
    ['ownership', (value: any) => ({ ...value, ownershipMode: 'local_only' })],
    ['created at', (value: any) => ({ ...value, createdAt: '2026-07-13T00:00:01.000Z' })],
    ['digest', (value: any) => ({ ...value, rootBindingDigest: '0'.repeat(64) })],
  ] as const)('fails closed on root-binding tamper without repair: %s', async (_label, transform) => {
    const repository = await repo(); const authority = await register(repository);
    const rootKey: [string, string] = [LEGACY_NOTES_AUTHORITY_NAMESPACE, `root:${authority.externalRootDigest}`];
    await mutateGlobal(rootKey, transform);
    const rowsAfterTamper = await globalRows();
    await expect(repository.getLegacyNotesSourceAuthority(authority.authorityId))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    await expect(register(repository)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect(await globalRows()).toEqual(rowsAfterTamper);
  });

  it('treats either half of the atomic pair being absent as corruption and never reconstructs it', async () => {
    const repository = await repo(); const authority = await register(repository);
    await mutateGlobal([LEGACY_NOTES_AUTHORITY_NAMESPACE, `root:${authority.externalRootDigest}`], () => null);
    await expect(register(repository)).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    const rows = await globalRows();
    expect(rows.filter(row => row.kind === 'legacy_notes_source_root_binding_v1')).toHaveLength(0);
    expect(rows.filter(row => row.kind === 'legacy_notes_source_authority_v1')).toHaveLength(1);
  });
});
