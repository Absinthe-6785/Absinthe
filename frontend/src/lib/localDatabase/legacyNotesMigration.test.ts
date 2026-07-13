import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const toLegacyNotesMigrationStorageId = (migrationSessionId: string) => `k325:legacy-notes:${migrationSessionId}`;
const compareCanonicalStrings = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

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
function ownEnumerableRecord<T>(entries: Array<[string, T]>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return result;
}
function expectOwnDataProperty<T>(record: Record<string, T>, key: string, value: T): void {
  expect(Object.prototype.hasOwnProperty.call(record, key)).toBe(true);
  expect(Object.getOwnPropertyDescriptor(record, key)).toMatchObject({
    value, enumerable: true, writable: true, configurable: true,
  });
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
function ordinaryMigrationRecord(namespaceKey: string, migrationId: string) {
  return {
    namespaceKey, migrationId, sourceDatabase: 'legacy', sourceSchemaVersion: 1,
    targetDatabase: LOCAL_DATABASE_NAME, targetSchemaVersion: 1, sourceGenerationId: 'generation-1',
    expectedActiveGenerationId: 'generation-1', targetGenerationId: 'generation-2', phase: 'planned',
    lastDurableStep: 'none', counts: {}, verificationState: 'pending' as const, rollbackEligibility: true,
    createdAt: T0, updatedAt: T0,
  };
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

  it('preserves special, ordinary, case-distinct, and Unicode metadata keys through the full lifecycle', async () => {
    const properties = ownEnumerableRecord([
      ['__proto__', 'property-proto'], ['constructor', 'property-constructor'], ['prototype', 'property-prototype'],
      ['ordinary', 'ordinary-value'], ['7', 'numeric-value'], ['punctuation:key', 'punctuation-value'],
      ['Case', 'upper-value'], ['case', 'lower-value'], ['한글', 'korean-value'],
      ['é', 'composed-value'], ['e\u0301', 'decomposed-value'],
    ]);
    const relations = ownEnumerableRecord([
      ['__proto__', [A]], ['constructor', [B, A]], ['prototype', []], ['ordinary', [A, B]],
      ['한글', ['관련']], ['é', ['composed']], ['e\u0301', ['decomposed']],
    ]);
    const objectPrototypeBefore = Object.getOwnPropertyNames(Object.prototype);
    const arrayPrototypeBefore = Object.getOwnPropertyNames(Array.prototype);
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [[A, note(A, { properties, relations })]]), repository.namespaceKey);
    const captured = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'special-metadata', now: T0 });
    expect(captured.source.entryCount).toBe(1);
    const staged = await repository.resumeLegacyNotesMigration(source, 'special-metadata', T1) as LegacyNotesMigrationSessionV1;
    const [persisted] = (await getAllRaw(LOCAL_DATABASE_STORES.entities))
      .filter(entity => entity.generationId === staged.target.generationId);
    expect(Object.getPrototypeOf(persisted.record.properties)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(persisted.record.relations)).toBe(Object.prototype);
    expect(Object.keys(persisted.record.properties).sort(compareCanonicalStrings))
      .toEqual(Object.keys(properties).sort(compareCanonicalStrings));
    expect(Object.keys(persisted.record.relations).sort(compareCanonicalStrings))
      .toEqual(Object.keys(relations).sort(compareCanonicalStrings));
    for (const [key, value] of Object.entries(properties)) expectOwnDataProperty(persisted.record.properties, key, value);
    for (const [key, value] of Object.entries(relations)) expectOwnDataProperty(persisted.record.relations, key, value);
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(objectPrototypeBefore);
    expect(Object.getOwnPropertyNames(Array.prototype)).toEqual(arrayPrototypeBefore);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(([] as unknown as Record<string, unknown>).polluted).toBeUndefined();
    const verified = await repository.verifyLegacyNotesMigration(source, 'special-metadata', T1);
    await expect(repository.resumeLegacyNotesMigration(source, 'special-metadata', T1)).resolves.toEqual(verified);
  });

  it('binds special metadata keys and values into source, manifest, and target digests', async () => {
    const repository = await repo();
    const firstProperties = ownEnumerableRecord([['__proto__', 'first'], ['ordinary', 'same']]);
    const firstRelations = ownEnumerableRecord([['__proto__', [A]], ['ordinary', [B]]]);
    const firstSource = adapter(bound(repository.namespaceKey, [[A, note(A, {
      properties: firstProperties, relations: firstRelations,
    })]]), repository.namespaceKey);
    const first = await repository.captureLegacyNotesMigration(firstSource, { migrationSessionId: 'special-digest-a', now: T0 });
    await repository.cancelLegacyNotesMigration('special-digest-a', T1);
    const secondProperties = ownEnumerableRecord([['__proto__', 'second'], ['ordinary', 'same']]);
    const secondRelations = ownEnumerableRecord([['__proto__', [A, B]], ['ordinary', [B]]]);
    const secondSource = adapter(bound(repository.namespaceKey, [[A, note(A, {
      properties: secondProperties, relations: secondRelations,
    })]]), repository.namespaceKey);
    const second = await repository.captureLegacyNotesMigration(secondSource, { migrationSessionId: 'special-digest-b', now: T0 });
    expect(second.source.snapshotDigest).not.toBe(first.source.snapshotDigest);
    expect(second.manifest.entries[0].sourceRecordDigest).not.toBe(first.manifest.entries[0].sourceRecordDigest);
    expect(second.manifest.entries[0].targetEntityDigest).not.toBe(first.manifest.entries[0].targetEntityDigest);
    expect(second.manifest.targetStateDigest).not.toBe(first.manifest.targetStateDigest);
    expect(second.manifest.manifestDigest).not.toBe(first.manifest.manifestDigest);
  });

  it.each([
    ['remove properties.__proto__', (record: any) => {
      record.properties = Object.fromEntries(Object.entries(record.properties).filter(([key]) => key !== '__proto__'));
    }],
    ['change properties.__proto__', (record: any) => {
      record.properties = Object.fromEntries(Object.entries(record.properties).map(([key, value]) =>
        [key, key === '__proto__' ? 'changed' : value]));
    }],
    ['remove relations.__proto__', (record: any) => {
      record.relations = Object.fromEntries(Object.entries(record.relations).filter(([key]) => key !== '__proto__'));
    }],
    ['change relations.__proto__', (record: any) => {
      record.relations = Object.fromEntries(Object.entries(record.relations).map(([key, value]) =>
        [key, key === '__proto__' ? [B] : value]));
    }],
    ['convert properties.__proto__ to an inherited property', (record: any) => {
      const inherited = ownEnumerableRecord([['__proto__', 'preserved']]);
      const replacement = Object.create(inherited) as Record<string, string>;
      Object.defineProperty(replacement, 'ordinary', {
        value: record.properties.ordinary, enumerable: true, writable: true, configurable: true,
      });
      record.properties = replacement;
    }],
  ] as const)('rejects verified target tampering that would %s', async (_label, tamper) => {
    const repository = await repo();
    const properties = ownEnumerableRecord([['__proto__', 'preserved'], ['ordinary', 'safe']]);
    const relations = ownEnumerableRecord([['__proto__', [A]], ['ordinary', [B]]]);
    const source = adapter(bound(repository.namespaceKey, [[A, note(A, { properties, relations })]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'special-tamper', now: T0 });
    const staged = await repository.resumeLegacyNotesMigration(source, 'special-tamper', T1) as LegacyNotesMigrationSessionV1;
    await repository.verifyLegacyNotesMigration(source, 'special-tamper', T1);
    await mutateRaw(LOCAL_DATABASE_STORES.entities,
      [repository.namespaceKey, staged.target.generationId, 'notes', A], value => {
        const record = { ...value.record }; tamper(record); return { ...value, record };
      });
    await expect(repository.resumeLegacyNotesMigration(source, 'special-tamper', T1))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
  });

  it('rejects special metadata tampering after staging and before initial verification', async () => {
    const repository = await repo();
    const properties = ownEnumerableRecord([['__proto__', 'preserved']]);
    const relations = ownEnumerableRecord([['__proto__', [A]]]);
    const source = adapter(bound(repository.namespaceKey, [[A, note(A, { properties, relations })]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'special-staged-tamper', now: T0 });
    const staged = await repository.resumeLegacyNotesMigration(source, 'special-staged-tamper', T1) as LegacyNotesMigrationSessionV1;
    await mutateRaw(LOCAL_DATABASE_STORES.entities,
      [repository.namespaceKey, staged.target.generationId, 'notes', A], value => ({
        ...value,
        record: {
          ...value.record,
          properties: Object.fromEntries(Object.entries(value.record.properties).map(([key, item]) =>
            [key, key === '__proto__' ? 'changed-before-verify' : item])),
        },
      }));
    await expect(repository.verifyLegacyNotesMigration(source, 'special-staged-tamper', T1))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect((await repository.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
  });

  it.each([
    ['invalid properties', { properties: ownEnumerableRecord([['__proto__', { unsafe: true }]]) }],
    ['invalid relations', { relations: ownEnumerableRecord([['__proto__', ['valid', 42]]]) }],
    ['sparse relations', { relations: ownEnumerableRecord([['__proto__', new Array(1)]]) }],
  ])('rejects the whole snapshot for %s without partial durable state', async (_label, overrides) => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [
      [A, note(A)], [B, note(B, overrides)],
    ]), repository.namespaceKey);
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'invalid-special', now: T0 }))
      .rejects.toMatchObject({ code: 'INVALID_LEGACY_MIGRATION' });
    expect((await getAllRaw(LOCAL_DATABASE_STORES.migrationState))
      .filter(row => row.kind === 'legacy_notes_migration_v1')).toEqual([]);
    expect((await getAllRaw(LOCAL_DATABASE_STORES.generations))
      .filter(row => row.creationReason === 'migration')).toEqual([]);
    expect((await getAllRaw(LOCAL_DATABASE_STORES.entities))
      .filter(row => row.generationId.startsWith('migration-'))).toEqual([]);
  });

  it('uses one canonical order for case-distinct and Unicode IDs through verification', async () => {
    const ids = [
      'a', 'B', 'A', 'b', '0', '9', '-', '_', ':', '가', 'é', 'e\u0301', '\uffff', '😀',
      'shared-prefix-a', 'shared-prefix-A',
    ];
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey,
      ids.map((id, index) => [`legacy-key-${index}`, note(id)])), repository.namespaceKey);
    const captured = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'canonical-unicode', now: T0 });
    expect(captured.manifest.entries.map(entry => entry.entityId)).toEqual([...ids].sort(compareCanonicalStrings));
    expect(new Set(captured.manifest.entries.map(entry => entry.entityId)).size).toBe(ids.length);
    await expect(repository.resumeLegacyNotesMigration(source, 'canonical-unicode', T1)).resolves.toMatchObject({ status: 'staged' });
    await expect(repository.verifyLegacyNotesMigration(source, 'canonical-unicode', T1))
      .resolves.toMatchObject({ entryCount: ids.length, liveCount: ids.length, tombstoneCount: 0 });
  });

  it('produces identical manifests and digests for bounded source permutations', async () => {
    const records = [
      ['key-a', note('a')], ['key-B', note('B')], ['key-korean', note('가')],
      ['key-composed', note('é')], ['key-decomposed', note('e\u0301')], ['key-emoji', note('😀')],
    ] as Array<[string, unknown]>;
    let repository = await repo();
    let source = adapter(bound(repository.namespaceKey, records), repository.namespaceKey);
    const original = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'permutation', now: T0 });
    closeLocalDatabase(repository); await deleteDatabase(LOCAL_DATABASE_NAME);
    repository = await repo();
    source = adapter(bound(repository.namespaceKey, [...records].reverse()), repository.namespaceKey);
    const reversed = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'permutation', now: T0 });
    expect(reversed.source.snapshotDigest).toBe(original.source.snapshotDigest);
    expect(reversed.manifest.manifestDigest).toBe(original.manifest.manifestDigest);
    expect(reversed.manifest.targetStateDigest).toBe(original.manifest.targetStateDigest);
    expect(reversed.manifest.entries).toEqual(original.manifest.entries);
  });

  it('does not call localeCompare while capturing or verifying', async () => {
    const localeCompare = vi.spyOn(String.prototype, 'localeCompare').mockImplementation(() => {
      throw new Error('locale-sensitive comparison used');
    });
    try {
      const repository = await repo();
      const source = adapter(bound(repository.namespaceKey, [['lower', note('a')], ['upper', note('B')]]), repository.namespaceKey);
      await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'no-locale', now: T0 });
      await repository.resumeLegacyNotesMigration(source, 'no-locale', T1);
      await expect(repository.verifyLegacyNotesMigration(source, 'no-locale', T1)).resolves.toMatchObject({ entryCount: 2 });
    } finally { localeCompare.mockRestore(); }
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

  it('coexists with an ordinary migration record using the same logical id', async () => {
    const repository = await repo(); await repository.createGeneration('generation-2', 'test');
    const ordinary = ordinaryMigrationRecord(repository.namespaceKey, 'shared-id');
    await repository.putMigrationState(ordinary);
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const captured = await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'shared-id', now: T0 });
    expect(captured.migrationId).toBe('shared-id');
    const rows = await getAllRaw(LOCAL_DATABASE_STORES.migrationState);
    expect(rows).toContainEqual(ordinary);
    expect(rows).toContainEqual(expect.objectContaining({
      kind: 'legacy_notes_migration_v1', migrationId: toLegacyNotesMigrationStorageId('shared-id'),
      migrationSessionId: 'shared-id',
    }));
  });

  it('allows an ordinary migration record after a K-325 record with the same logical id', async () => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'reverse-id', now: T0 });
    await repository.createGeneration('generation-2', 'test');
    const ordinary = ordinaryMigrationRecord(repository.namespaceKey, 'reverse-id');
    await expect(repository.putMigrationState(ordinary)).resolves.toBeUndefined();
    expect(await repository.getLegacyNotesMigrationSession('reverse-id')).toMatchObject({ migrationId: 'reverse-id' });
    expect(await getAllRaw(LOCAL_DATABASE_STORES.migrationState)).toContainEqual(ordinary);
  });

  it('keeps same-id K-325 and ordinary records independent across namespaces', async () => {
    const left = await repo(); const right = await repo({ ...base, userId: 'user-b' });
    await left.createGeneration('generation-2', 'test'); await right.createGeneration('generation-2', 'test');
    await left.putMigrationState(ordinaryMigrationRecord(left.namespaceKey, 'cross-namespace'));
    await right.putMigrationState(ordinaryMigrationRecord(right.namespaceKey, 'cross-namespace'));
    const leftSource = adapter(bound(left.namespaceKey, [[A, note(A)]]), left.namespaceKey);
    const rightSource = adapter(bound(right.namespaceKey, [[B, note(B)]]), right.namespaceKey);
    await expect(left.captureLegacyNotesMigration(leftSource, { migrationSessionId: 'cross-namespace', now: T0 })).resolves.toBeDefined();
    await expect(right.captureLegacyNotesMigration(rightSource, { migrationSessionId: 'cross-namespace', now: T0 })).resolves.toBeDefined();
  });

  it('ignores and preserves malformed unrelated rows during K-325 scans', async () => {
    const repository = await repo();
    const unrelated = { namespaceKey: repository.namespaceKey, migrationId: 'unrelated-malformed', kind: 'another_migration_v1', opaque: true };
    await putRaw(LOCAL_DATABASE_STORES.migrationState, unrelated);
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'safe-session', now: T0 })).resolves.toBeDefined();
    expect(await getAllRaw(LOCAL_DATABASE_STORES.migrationState)).toContainEqual(unrelated);
  });

  it.each([
    ['unprefixed key', (raw: any) => ({ ...raw, migrationId: raw.migrationSessionId })],
    ['wrong prefix', (raw: any) => ({ ...raw, migrationId: `other:${raw.migrationSessionId}` })],
    ['mismatched logical id', (raw: any) => ({ ...raw, migrationSessionId: 'different-id' })],
    ['wrong version', (raw: any) => ({ ...raw, version: 2 })],
  ])('rejects corrupted K-325 storage identity: %s', async (_label, corrupt) => {
    const repository = await repo(); const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'corrupt-id', now: T0 });
    const rows = await getAllRaw(LOCAL_DATABASE_STORES.migrationState);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState,
      [repository.namespaceKey, toLegacyNotesMigrationStorageId('corrupt-id')], () => null);
    await putRaw(LOCAL_DATABASE_STORES.migrationState, corrupt(rows.find(row => row.kind === 'legacy_notes_migration_v1')));
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'new-id', now: T0 }))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects a wrong discriminator occupying the reserved K-325 key', async () => {
    const repository = await repo();
    await putRaw(LOCAL_DATABASE_STORES.migrationState, {
      namespaceKey: repository.namespaceKey, migrationId: toLegacyNotesMigrationStorageId('occupied'), kind: 'wrong_type',
    });
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId: 'occupied', now: T0 }))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it.each([
    'k325:legacy-notes:public-id',
    'k325:legacy-notes:',
    'k325:legacy-notes:k325:legacy-notes:public-id',
  ])('rejects reserved public logical id %s without durable side effects', async migrationSessionId => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const stores = [
      LOCAL_DATABASE_STORES.migrationState, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
      LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints,
    ];
    const before = await Promise.all(stores.map(getAllRaw));
    await expect(repository.captureLegacyNotesMigration(source, { migrationSessionId, now: T0 }))
      .rejects.toMatchObject({ code: 'INVALID_LEGACY_MIGRATION' });
    const after = await Promise.all(stores.map(getAllRaw));
    expect(after).toEqual(before);
    expect(after[0].some(row => String(row.migrationId).includes('k325:legacy-notes:k325:legacy-notes:'))).toBe(false);
  });

  it.each(['get', 'resume', 'verify', 'cancel'] as const)(
    'rejects a reserved public logical id before %s lookup or transition', async operation => {
      const repository = await repo();
      const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
      const reserved = 'k325:legacy-notes:public-id';
      const action = operation === 'get'
        ? repository.getLegacyNotesMigrationSession(reserved)
        : operation === 'resume'
          ? repository.resumeLegacyNotesMigration(source, reserved, T1)
          : operation === 'verify'
            ? repository.verifyLegacyNotesMigration(source, reserved, T1)
            : repository.cancelLegacyNotesMigration(reserved, T1);
      await expect(action).rejects.toMatchObject({ code: 'INVALID_LEGACY_MIGRATION' });
      expect(await getAllRaw(LOCAL_DATABASE_STORES.migrationState)).toEqual([]);
    },
  );

  it.each([
    'public-id', 'public:id', 'k325', 'legacy-notes', 'legacy-notes:public-id',
    'K325:legacy-notes:public-id', 'xk325:legacy-notes:public-id',
  ])('preserves valid public logical id %s', async (migrationSessionId, index) => {
    const repository = await repo({ ...base, userId: `valid-user-${index}` });
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const captured = await repository.captureLegacyNotesMigration(source, { migrationSessionId, now: T0 });
    expect(captured.migrationId).toBe(migrationSessionId);
    const rows = await getAllRaw(LOCAL_DATABASE_STORES.migrationState);
    expect(rows).toContainEqual(expect.objectContaining({
      namespaceKey: repository.namespaceKey,
      migrationId: toLegacyNotesMigrationStorageId(migrationSessionId),
      migrationSessionId,
    }));
  });

  it('keeps concurrent exact capture idempotent and bounded', async () => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const [left, right] = await Promise.all([
      repository.captureLegacyNotesMigration(source, { migrationSessionId: 'concurrent-same', now: T0 }),
      repository.captureLegacyNotesMigration(source, { migrationSessionId: 'concurrent-same', now: T0 }),
    ]);
    expect(left).toEqual(right);
    const rows = (await getAllRaw(LOCAL_DATABASE_STORES.migrationState))
      .filter(row => row.kind === 'legacy_notes_migration_v1' && row.namespaceKey === repository.namespaceKey);
    expect(rows).toHaveLength(1);
    expect((await getAllRaw(LOCAL_DATABASE_STORES.generations)).filter(row => row.creationReason === 'migration')).toEqual([]);
  });

  it('keeps competing valid captures to one nonterminal session', async () => {
    const repository = await repo();
    const left = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const right = adapter(bound(repository.namespaceKey, [[B, note(B)]]), repository.namespaceKey);
    const results = await Promise.allSettled([
      repository.captureLegacyNotesMigration(left, { migrationSessionId: 'concurrent-left', now: T0 }),
      repository.captureLegacyNotesMigration(right, { migrationSessionId: 'concurrent-right', now: T0 }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ code: 'MIGRATION_SESSION_CONFLICT' });
    expect((await getAllRaw(LOCAL_DATABASE_STORES.migrationState)).filter(row => row.kind === 'legacy_notes_migration_v1')).toHaveLength(1);
  });

  it('rejects reserved capture concurrently without blocking a valid capture', async () => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [[A, note(A)]]), repository.namespaceKey);
    const [invalid, valid] = await Promise.allSettled([
      repository.captureLegacyNotesMigration(source, { migrationSessionId: 'k325:legacy-notes:invalid', now: T0 }),
      repository.captureLegacyNotesMigration(source, { migrationSessionId: 'concurrent-valid', now: T0 }),
    ]);
    expect(invalid.status).toBe('rejected');
    expect((invalid as PromiseRejectedResult).reason).toMatchObject({ code: 'INVALID_LEGACY_MIGRATION' });
    expect(valid).toMatchObject({ status: 'fulfilled', value: { migrationId: 'concurrent-valid' } });
    const rows = await getAllRaw(LOCAL_DATABASE_STORES.migrationState);
    expect(rows.filter(row => row.kind === 'legacy_notes_migration_v1')).toHaveLength(1);
    expect(rows.some(row => String(row.migrationId).includes('k325:legacy-notes:k325:legacy-notes:'))).toBe(false);
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
      await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [fixture.repository.namespaceKey, toLegacyNotesMigrationStorageId('verified')], value => ({
        ...value, manifest: { ...value.manifest, manifestDigest: '0'.repeat(64) },
      }));
    }],
    ['missing manifest', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [fixture.repository.namespaceKey, toLegacyNotesMigrationStorageId('verified')], value => ({
        ...value, manifest: null,
      }));
    }],
    ['stored result mismatch', async (fixture: Awaited<ReturnType<typeof verifiedFixture>>) => {
      await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [fixture.repository.namespaceKey, toLegacyNotesMigrationStorageId('verified')], value => ({
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

  it.each([
    ['locale-style reorder', (entries: any[]) => [...entries].reverse()],
    ['duplicate entry', (entries: any[]) => [entries[0], entries[0]]],
    ['missing entry', (entries: any[]) => entries.slice(0, 1)],
  ])('rejects noncanonical persisted manifest entries: %s', async (_label, transform) => {
    const repository = await repo();
    const source = adapter(bound(repository.namespaceKey, [['upper', note('B')], ['lower', note('a')]]), repository.namespaceKey);
    await repository.captureLegacyNotesMigration(source, { migrationSessionId: 'manifest-order', now: T0 });
    await repository.resumeLegacyNotesMigration(source, 'manifest-order', T1);
    await repository.verifyLegacyNotesMigration(source, 'manifest-order', T1);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState,
      [repository.namespaceKey, toLegacyNotesMigrationStorageId('manifest-order')], value => ({
        ...value,
        manifest: { ...value.manifest, entries: transform(value.manifest.entries) },
      }));
    await expect(repository.getLegacyNotesMigrationSession('manifest-order'))
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
