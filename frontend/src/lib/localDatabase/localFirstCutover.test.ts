import 'fake-indexeddb/auto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as recoverySafetyPolicy from '../recoverySafetyPolicy';
import {
  K326_LEGACY_WRITE_FENCE_PREFIX,
  K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX,
  beginLegacyNotesCutoverFence,
  captureOperationEpoch,
  clearLegacyNotesCutoverFenceForTest,
  buildLegacyNotesCutoverSettlementArtifact,
  createRecoveryCutoverAuthorization,
  createLegacyNotesCutoverFenceIdentity,
  deriveLegacyNotesCutoverFenceKey,
  deriveLegacyNotesCutoverFenceSettlementKey,
  isRecoveryModeActive,
  isOperationEpochCurrent,
  mayReset,
  mayRestore,
  mayUploadRemote,
  mayWriteLegacyNotes,
  readLegacyNotesCutoverFence,
  scanLegacyNotesCutoverFences,
  type LegacyCutoverFenceIdentity,
} from '../recoverySafetyPolicy';
import {
  NOTES_IDB_MIGRATION_FLAG, NOTES_IDB_REV_KEY, bumpNotesIndexedDbRevision,
  loadNotesFromIndexedDb, markIndexedDbMigrationComplete, saveNotesToIndexedDb,
} from '../noteIndexedDb';
import { NOTES_SEEDED_KEY, clearNotesOnboardingMarker, markNotesOnboardingComplete } from '../notesOnboarding';
import {
  ACTIVE_KEY, FOLDERS_KEY, NOTES_KEY, clearNotesStorage, saveActiveNoteId, saveFolders, saveNotes,
} from '../../components/views/noteUtils';
import {
  LOCAL_DATABASE_NAME, LOCAL_DATABASE_STORES, closeLocalDatabase, computeRestorePackageDigest,
  computeRestoreProjectFingerprint, createDormantLocalDatabaseCapability, legacyNotesAuthorityReference,
  openLocalDatabase,
  type CutoverFailurePoint, type LegacyNotesMigrationSessionV1, type LegacyNotesSourceAdapter,
  type LegacyNotesSourceAuthorityRecordV1, type LegacyNotesSourceRecord,
  type LocalDatabaseNamespace, type LocalDatabaseRepository, type RestorePackageV1,
} from './index';
import { buildLocalFirstRuntimeModeRecord } from './runtimeMode';
import { sha256Hex } from './outboxIdentity';

const capability = createDormantLocalDatabaseCapability('test');
const base: LocalDatabaseNamespace = {
  userId: 'user-a', projectRef: 'project-a', deviceId: 'device-a', generationId: 'generation-1', schemaVersion: 1,
};
const T0 = '2026-07-13T00:00:00.000Z';
const T1 = '2026-07-13T00:00:01.000Z';
const T2 = '2026-07-13T00:00:02.000Z';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const repositories: LocalDatabaseRepository[] = [];
const authorities = new Map<string, LegacyNotesSourceAuthorityRecordV1>();

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

function physicalFence(identity: LegacyCutoverFenceIdentity) {
  const key = deriveLegacyNotesCutoverFenceKey(identity);
  return {
    key,
    value: {
      kind: 'legacy_notes_cutover_fence_v4', version: 4,
      storageDigest: key.slice(K326_LEGACY_WRITE_FENCE_PREFIX.length),
      ...identity,
    },
  } as const;
}

function setPhysicalFence(identity: Parameters<typeof physicalFence>[0]): string {
  const artifact = physicalFence(identity);
  localStorage.setItem(artifact.key, JSON.stringify(artifact.value));
  return artifact.key;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

async function repository(namespace = base): Promise<LocalDatabaseRepository> {
  const value = await openLocalDatabase(namespace, { capability, clock: () => T2 });
  repositories.push(value); await value.initializeNamespace();
  const authority = await value.registerLegacyNotesSourceAuthority({
    authorityId: `synthetic-${value.namespaceKey.slice(0, 16)}`,
    sourceType: 'indexeddb', sourceInstanceId: 'synthetic.notes.v1',
    sourceIdentityId: `synthetic-${value.namespaceKey.slice(0, 16)}`,
    ownershipMode: 'authenticated', now: T0,
  });
  authorities.set(value.namespaceKey, authority);
  return value;
}

async function reopenRepository(namespace = base): Promise<LocalDatabaseRepository> {
  const value = await openLocalDatabase(namespace, { capability, clock: () => T2 });
  repositories.push(value);
  await value.initializeNamespace();
  return value;
}

function note(id = A): Record<string, unknown> {
  return {
    id, title: 'synthetic', body: 'attachment://asset-1', createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_001_000, folderId: null, deletedAt: null, starred: false,
    properties: { safe: 'value' }, relations: { links: [] },
  };
}

interface MutableAdapter extends LegacyNotesSourceAdapter {
  records: LegacyNotesSourceRecord[];
  captures: number;
}

function sourceAdapter(repositoryValue: LocalDatabaseRepository, records = [note()]): MutableAdapter {
  const authority = authorities.get(repositoryValue.namespaceKey);
  if (!authority) throw new Error('authority missing');
  const source: MutableAdapter = {
    ...legacyNotesAuthorityReference(authority), adapter: 'synthetic_legacy_notes', schemaVersion: 1,
    records: records.map((value, index) => ({
      legacyKey: `legacy-${index}`, value, ownership: { kind: 'bound', namespaceKey: repositoryValue.namespaceKey },
    })),
    captures: 0,
    async capture() { source.captures += 1; return { capturedAt: T0, records: source.records }; },
  };
  return source;
}

async function prepareVerified(repositoryValue: LocalDatabaseRepository, source: MutableAdapter, migrationId = 'verified'): Promise<void> {
  await repositoryValue.captureLegacyNotesMigration(source, { migrationSessionId: migrationId, now: T0 });
  await repositoryValue.resumeLegacyNotesMigration(source, migrationId, T1);
  await repositoryValue.verifyLegacyNotesMigration(source, migrationId, T1);
}

async function plan(repositoryValue: LocalDatabaseRepository, source: MutableAdapter, cutoverId = 'cutover-1', migrationId = 'verified') {
  const authorization = repositoryValue.createLocalFirstCutoverAuthorization(cutoverId, migrationId, 'test');
  const session = await repositoryValue.planLocalFirstCutover(source, {
    cutoverSessionId: cutoverId, migrationSessionId: migrationId, authorization, now: T1,
  });
  return { authorization, session };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

async function enterSettlementPending(
  repositoryValue: LocalDatabaseRepository,
  source: MutableAdapter,
  authorization: ReturnType<LocalDatabaseRepository['createLocalFirstCutoverAuthorization']>,
): Promise<string> {
  await repositoryValue.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
  source.records = [{ legacyKey: 'changed', value: note(B),
    ownership: { kind: 'bound', namespaceKey: repositoryValue.namespaceKey } }];
  const originalSet = localStorage.setItem.bind(localStorage);
  const defer = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) throw new Error('defer settlement');
    originalSet(key, value);
  });
  await expect(repositoryValue.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
    .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
  defer.mockRestore();
  const pending = await repositoryValue.getLocalFirstCutoverSession('cutover-1');
  expect(pending).toMatchObject({
    status: 'failed_precommit_settling', fence: { phase: 'settlement_pending' },
  });
  return deriveLegacyNotesCutoverFenceSettlementKey(pending!.fence!.identity);
}

async function expectSettlementRecoveryBlocked(
  repositoryValue: LocalDatabaseRepository,
  authorization: ReturnType<LocalDatabaseRepository['createLocalFirstCutoverAuthorization']>,
  settlementKey: string,
  code: string = 'CORRUPT_PERSISTED_RECORD',
): Promise<void> {
  await expect(repositoryValue.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
    .rejects.toMatchObject({ code });
  expect(localStorage.getItem(settlementKey)).toBeNull();
  expect(await repositoryValue.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
    status: 'failed_precommit_settling', fence: { phase: 'settlement_pending' },
  });
  expect(await repositoryValue.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
  expect(await repositoryValue.getLocalFirstRuntimeMode()).toMatchObject({
    mode: 'legacy', activeGenerationId: 'generation-1',
  });
  expect(mayWriteLegacyNotes()).toBe(false);
}

async function rawDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

async function rawStoreValues(storeName: string): Promise<any[]> {
  const db = await rawDatabase(); const tx = db.transaction(storeName, 'readonly');
  const request = tx.objectStore(storeName).getAll();
  const values = await new Promise<any[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  db.close(); return values;
}

async function mutateRaw(storeName: string, key: IDBValidKey, transform: (value: any) => any): Promise<void> {
  const db = await rawDatabase(); const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
  const request = store.get(key);
  request.onsuccess = () => store.put(transform(request.result));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => undefined;
  });
  db.close();
}

async function putRaw(storeName: string, value: unknown): Promise<void> {
  const db = await rawDatabase(); const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(value);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => undefined;
  });
  db.close();
}

async function deleteRaw(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await rawDatabase(); const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => undefined;
  });
  db.close();
}

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name); const stats = statSync(path);
    if (stats.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) files.push(path);
  }
  return files;
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  authorities.clear(); repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
  clearLegacyNotesCutoverFenceForTest();
});

afterEach(async () => {
  repositories.splice(0).forEach(closeLocalDatabase);
  await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
  vi.unstubAllGlobals();
});

describe('K-326 local-first cutover foundation', () => {
  it('accepts compatible version-3 K-325 evidence as a dormant version-4 planning prerequisite', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState,
      [repo.namespaceKey, 'k325:legacy-notes:verified'], value => ({
        ...value, target: { ...value.target, databaseVersion: 3 },
      }));
    const { session } = await plan(repo, source);
    expect(session).toMatchObject({ status: 'planned', plan: { migrationSessionId: 'verified' } });
    expect(await repo.getLegacyNotesMigrationSession('verified')).toMatchObject({
      target: { databaseVersion: 3 }, status: 'verified',
    });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'legacy', activeGenerationId: 'generation-1' });
    expect((await repo.readDatabaseMetadata()).activeGenerationId).toBe('generation-1');
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
  });

  it('permanently documents the raw localStorage guard/write race that K-326G refuses to trust', () => {
    const tabBEpoch = captureOperationEpoch();
    const authorization = createRecoveryCutoverAuthorization({
      namespaceKey: 'a'.repeat(64), cutoverSessionId: 'cross-tab-race',
      targetGenerationId: 'migration-cross-tab-race', purpose: 'test',
    });
    const identity = createLegacyNotesCutoverFenceIdentity(authorization);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES_KEY) beginLegacyNotesCutoverFence(authorization, identity);
      originalSetItem(key, value);
    });

    expect(saveNotes([])).toBe(true);
    expect(localStorage.getItem(NOTES_KEY)).toBe('[]');
    expect(scanLegacyNotesCutoverFences().status).toBe('active');
    expect(mayWriteLegacyNotes()).toBe(false);
    expect(isOperationEpochCurrent(tabBEpoch)).toBe(false);
  });

  it.each([
    ['localStorage', {
      adapter: 'absinthe_notes_localstorage_v2', schemaVersion: 2,
      sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
    }],
    ['legacy IndexedDB', {
      adapter: 'absinthe_notes_indexeddb_v1', schemaVersion: 1,
      sourceType: 'indexeddb', sourceInstanceId: 'absinthe-notes-v1.notes.v1',
    }],
    ['mixed', {
      adapter: 'absinthe_notes_indexeddb_v1', schemaVersion: 1,
      sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
    }],
    ['unknown', {
      adapter: 'unknown_legacy_notes', schemaVersion: null,
      sourceType: 'indexeddb', sourceInstanceId: 'unknown.notes',
    }],
  ] as const)('rejects %s source identity before any K-326 durable transition', async (_label, identity) => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    Object.assign(source, identity);
    const authorization = repo.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    const epoch = captureOperationEpoch();

    await expect(repo.planLocalFirstCutover(source, {
      cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization, now: T1,
    })).rejects.toMatchObject({ code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toBeNull();
    expect(await repo.getLocalFirstRuntimeMode()).toBeNull();
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
    expect(scanLegacyNotesCutoverFences().activeFences).toHaveLength(0);
    expect(isOperationEpochCurrent(epoch)).toBe(true);
  });

  it('revalidates source safety during preflight without installing a fence', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    Object.assign(source, {
      adapter: 'absinthe_notes_localstorage_v2', schemaVersion: 2,
      sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
    });
    const epoch = captureOperationEpoch();

    await expect(repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'planned', fence: null });
    expect(scanLegacyNotesCutoverFences().activeFences).toHaveLength(0);
    expect(isOperationEpochCurrent(epoch)).toBe(true);
  });

  it('fails closed with append-only fence evidence when safety changes after fence installation', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);

    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2,
      testOnlyBeforePostFenceSourceSafety: () => Object.assign(source, {
        adapter: 'absinthe_notes_localstorage_v2', schemaVersion: 2,
        sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      }),
    })).rejects.toMatchObject({ code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'failed_precommit_fenced',
      failure: { code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' },
      fence: { phase: 'installed' },
    });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'legacy', activeGenerationId: 'generation-1' });
    await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' });
    expect(scanLegacyNotesCutoverFences().settledFences).toHaveLength(0);
  });

  it('revalidates source safety at the final activation boundary and preserves the inactive graph', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);

    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2,
      testOnlyBeforeActivationTransactionSourceSafety: () => Object.assign(source, {
        adapter: 'absinthe_notes_localstorage_v2', schemaVersion: 2,
        sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
      }),
    })).rejects.toMatchObject({ code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'failed_precommit_fenced', failure: { code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' },
    });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'legacy', activeGenerationId: 'generation-1' });
  });

  it('does not confirm an activated graph through a now-unsafe source adapter', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2, testOnlyFailAt: 'after_activation_commit',
    })).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    Object.assign(source, {
      adapter: 'absinthe_notes_localstorage_v2', schemaVersion: 2,
      sourceType: 'localstorage', sourceInstanceId: 'localStorage.notes-v2',
    });

    await expect(repo.confirmLocalFirstCutover(source, 'cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'activated', confirmedAt: null });
  });

  it('fails closed on a pre-K-326G cutover session discriminator without synthesizing safety', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'],
      value => ({ ...value, kind: 'local_first_cutover_session_v4', version: 4 }),
    );

    await expect(repo.getLocalFirstCutoverSession('cutover-1'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
    expect(scanLegacyNotesCutoverFences().activeFences).toHaveLength(0);
  });

  it('rejects a re-digested persisted plan that falsely labels an unknown backend safe', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => {
        const { planDigest: _oldDigest, ...oldCore } = value.plan;
        const core = { ...oldCore, sourceAdapter: 'unknown_but_claimed_safe' };
        return {
          ...value,
          plan: { ...core, planDigest: sha256Hex(canonical(['absinthe-local-first-cutover-plan-v2', core])) },
        };
      },
    );

    await expect(repo.getLocalFirstCutoverSession('cutover-1'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
  });

  it('atomically activates and confirms one exact verified K-325 generation', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization, session } = await plan(repo, source);
    expect(session).toMatchObject({ status: 'planned', plan: { targetEntryCount: 1, expectedRuntimeStorageMode: 'legacy' } });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'legacy', activeGenerationId: 'generation-1' });

    const result = await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 });
    expect(result).toMatchObject({ status: 'confirmed', mode: 'local_first', activeGenerationId: 'migration-verified', entityCount: 1 });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'migration-verified' });
    expect(await repo.getGeneration('generation-1')).toMatchObject({ status: 'sealed' });
    expect(await repo.getGeneration('migration-verified')).toMatchObject({
      status: 'active', predecessorGenerationId: 'generation-1', activeNamespaceKey: repo.namespaceKey,
    });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({
      mode: 'local_first', activeGenerationId: 'migration-verified', cutoverSessionId: 'cutover-1',
    });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'confirmed' });
    expect(readLegacyNotesCutoverFence()).toMatchObject({ version: 4, namespaceKey: repo.namespaceKey });
    expect(isRecoveryModeActive()).toBe(true);
    expect([mayRestore(), mayReset(), mayUploadRemote()]).toEqual([false, false, false]);
    expect(await rawStoreValues(LOCAL_DATABASE_STORES.outbox)).toEqual([]);
    expect(await rawStoreValues(LOCAL_DATABASE_STORES.syncCheckpoints)).toEqual([]);
  });

  it('rejects generic generation activation after local-first cutover without changing the graph', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 });
    const active = await repository({ ...base, generationId: 'migration-verified' });
    await active.createGeneration('future-generation', 'test');

    await expect(active.activateGeneration('future-generation')).rejects.toMatchObject({
      code: 'ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL',
    });
    expect(await active.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'migration-verified' });
    expect(await active.getGeneration('migration-verified')).toMatchObject({ status: 'active' });
    expect(await active.getGeneration('future-generation')).toMatchObject({ status: 'preparing' });
    expect(await active.getLocalFirstRuntimeMode()).toMatchObject({
      mode: 'local_first', activeGenerationId: 'migration-verified', targetGenerationId: 'migration-verified',
    });
  });

  it('keeps pointer, runtime mode, restore session, and historical cutover coherent after restore', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 });
    const active = await repository({ ...base, generationId: 'migration-verified' });
    const entities = [{
      domain: 'notes' as const,
      entityId: A,
      sourceRevision: 1,
      sourceUpdatedAt: T1,
      sourceDeletedAt: null,
      payload: { id: A, title: 'restored', body: 'synthetic', updatedAt: 1_700_000_002_000,
        folderId: null, deletedAt: null },
    }];
    const core = {
      protocolVersion: 1 as const,
      packageId: 'post-cutover-restore-package',
      exportedAt: T2,
      source: 'migration_fixture' as const,
      namespaceFingerprint: active.namespaceKey,
      projectFingerprint: await computeRestoreProjectFingerprint(active.namespace.projectRef),
      entities,
    };
    const restorePackage: RestorePackageV1 = {
      ...core,
      manifest: { entityCount: entities.length, contentDigest: await computeRestorePackageDigest(core) },
    };
    const result = await active.restorePackageAtomically(restorePackage, {
      sessionId: 'post-cutover-restore', conflictPolicy: 'replace', now: T2,
    });

    expect(await active.readDatabaseMetadata()).toMatchObject({ activeGenerationId: result.targetGenerationId });
    expect(await active.getLocalFirstRuntimeMode()).toMatchObject({
      mode: 'local_first', activeGenerationId: result.targetGenerationId,
      cutoverSessionId: 'cutover-1', targetGenerationId: 'migration-verified',
    });
    expect(await active.getRestoreSession('post-cutover-restore')).toMatchObject({ status: 'committed' });
    expect(await active.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'confirmed' });
    const restored = await repository({ ...base, generationId: result.targetGenerationId });
    await restored.createGeneration('post-restore-generic', 'test');
    await expect(restored.activateGeneration('post-restore-generic')).rejects.toMatchObject({
      code: 'ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL',
    });
  });

  it('rejects generic activation while an explicit legacy-to-local-first plan owns runtime mode', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await repo.createGeneration('unreviewed-generation', 'test');
    await expect(repo.activateGeneration('unreviewed-generation')).rejects.toMatchObject({
      code: 'ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL',
    });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(await repo.getGeneration('generation-1')).toMatchObject({ status: 'active' });
    expect(await repo.getGeneration('unreviewed-generation')).toMatchObject({ status: 'preparing' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({
      mode: 'legacy', activeGenerationId: 'generation-1',
    });
  });

  it('fails closed without repairing a preexisting pointer and runtime-mode divergence', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 });
    const active = await repository({ ...base, generationId: 'migration-verified' });
    await active.createGeneration('future-generation', 'test');
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:runtime-mode'], value =>
      buildLocalFirstRuntimeModeRecord({
        namespaceKey: repo.namespaceKey,
        mode: 'local_first',
        activeGenerationId: 'future-generation',
        cutoverSessionId: value.cutoverSessionId,
        targetGenerationId: value.targetGenerationId,
        updatedAt: T2,
        activatedAt: value.activatedAt,
      }));

    await expect(active.activateGeneration('future-generation')).rejects.toMatchObject({
      code: 'CORRUPT_PERSISTED_RECORD',
    });
    await expect(active.getLocalFirstRuntimeMode()).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    expect(await active.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'migration-verified' });
    expect(await active.getGeneration('migration-verified')).toMatchObject({ status: 'active' });
    expect(await active.getGeneration('future-generation')).toMatchObject({ status: 'preparing' });
    const rawMode = (await rawStoreValues(LOCAL_DATABASE_STORES.migrationState))
      .find(value => value.migrationId === 'k326:runtime-mode');
    expect(rawMode).toMatchObject({ activeGenerationId: 'future-generation' });
  });

  it('rejects a staged but not verified K-325 session without creating K-326 state', async () => {
    const repo = await repository(); const source = sourceAdapter(repo);
    await repo.captureLegacyNotesMigration(source, { migrationSessionId: 'staged', now: T0 });
    await repo.resumeLegacyNotesMigration(source, 'staged', T1);
    const authorization = repo.createLocalFirstCutoverAuthorization('cutover-staged', 'staged', 'test');
    await expect(repo.planLocalFirstCutover(source, {
      cutoverSessionId: 'cutover-staged', migrationSessionId: 'staged', authorization, now: T1,
    })).rejects.toMatchObject({ code: 'MIGRATION_SESSION_CONFLICT' });
    expect(await repo.getLocalFirstCutoverSession('cutover-staged')).toBeNull();
  });

  it('requires an exact namespace/session/generation-scoped recovery authorization', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const wrong = repo.createLocalFirstCutoverAuthorization('other-cutover', 'verified', 'test');
    await expect(repo.planLocalFirstCutover(source, {
      cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization: wrong, now: T1,
    })).rejects.toMatchObject({ code: 'CUTOVER_RECOVERY_AUTHORIZATION_REQUIRED' });
  });

  it('rejects missing authority and mismatched root binding evidence', async () => {
    for (const mutate of ['missing', 'mismatched'] as const) {
      repositories.splice(0).forEach(closeLocalDatabase);
      await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
      authorities.clear();
      const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
      const authorization = repo.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
      if (mutate === 'missing') {
        await deleteRaw(LOCAL_DATABASE_STORES.migrationState, [
          'k325:legacy-source-authority:v1', `authority:${source.authorityId}`,
        ]);
        await expect(repo.planLocalFirstCutover(source, {
          cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization, now: T1,
        })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
      } else {
        const forged = { ...source, externalRootDigest: 'b'.repeat(64) } as LegacyNotesSourceAdapter;
        await expect(repo.planLocalFirstCutover(forged, {
          cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization, now: T1,
        })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
      }
      expect(await repo.getLocalFirstCutoverSession('cutover-1')).toBeNull();
    }
  });

  it('revalidates source authority between planning and activation', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.revokeLegacyNotesSourceAuthority(source.authorityId, T2);
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'LEGACY_SOURCE_AUTHORITY_REVOKED' });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'legacy' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'failed', failure: { code: 'LEGACY_SOURCE_AUTHORITY_REVOKED' },
    });
    await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
      .resolves.toMatchObject({ status: 'failed', fence: null });
  });

  it('detects a source change between preflight and activation without activating', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'failed' });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
  });

  it('durably retries exact failed-precommit fence cleanup after restart without reviving stale epochs', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    const staleEpoch = captureOperationEpoch();
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    const originalSet = localStorage.setItem.bind(localStorage);
    const cleanup = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) throw new Error('synthetic storage failure');
      originalSet(key, value);
    });

    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'failed_precommit_settling', failure: { context: 'precommit_fence_cleanup' },
    });
    const pending = await repo.getLocalFirstCutoverSession('cutover-1');
    const fenceKey = deriveLegacyNotesCutoverFenceKey(pending!.fence!.identity);
    const settlementKey = deriveLegacyNotesCutoverFenceSettlementKey(pending!.fence!.identity);
    expect(readLegacyNotesCutoverFence()).toMatchObject({
      namespaceKey: repo.namespaceKey, cutoverSessionId: 'cutover-1', version: 4,
    });
    expect(localStorage.getItem(fenceKey)).not.toBeNull();
    expect(localStorage.getItem(settlementKey)).toBeNull();
    cleanup.mockRestore();
    repo.close();

    const restarted = await reopenRepository();
    const restartedAuthorization = restarted.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(restarted.recoverFailedPrecommitCutoverFence(
      'cutover-1', restartedAuthorization, T2, 'after_fence_settlement',
    )).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    expect(readLegacyNotesCutoverFence()).toBeNull();
    expect(localStorage.getItem(fenceKey)).not.toBeNull();
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
    expect(await restarted.getLocalFirstCutoverSession('cutover-1'))
      .toMatchObject({ status: 'failed_precommit_settling' });
    await expect(restarted.recoverFailedPrecommitCutoverFence('cutover-1', restartedAuthorization, T2))
      .resolves.toMatchObject({ status: 'failed', failure: { context: 'precommit_fence_settled' } });
    expect(readLegacyNotesCutoverFence()).toBeNull();
    expect(isOperationEpochCurrent(staleEpoch)).toBe(false);
    await expect(restarted.recoverFailedPrecommitCutoverFence('cutover-1', restartedAuthorization, T2))
      .resolves.toMatchObject({ status: 'failed' });
    expect(await restarted.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(await restarted.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
  });

  it.each([
    ['payload', async (repo: LocalDatabaseRepository) => mutateRaw(
      LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A],
      value => ({ ...value, record: { ...value.record, title: 'tampered-after-verification' } }),
    )],
    ['content digest', async (repo: LocalDatabaseRepository) => mutateRaw(
      LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A],
      value => ({ ...value, contentHash: '0'.repeat(64) }),
    )],
    ['owner binding', async (repo: LocalDatabaseRepository) => mutateRaw(
      LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A],
      value => ({ ...value, ownerId: 'other-owner' }),
    )],
    ['generation binding', async (repo: LocalDatabaseRepository) => {
      const existing = (await rawStoreValues(LOCAL_DATABASE_STORES.entities))
        .find(value => value.generationId === 'migration-verified' && value.entityId === A);
      await deleteRaw(LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A]);
      await putRaw(LOCAL_DATABASE_STORES.entities, { ...existing, generationId: 'other-generation' });
    }],
    ['missing entity', async (repo: LocalDatabaseRepository) => deleteRaw(
      LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A],
    )],
    ['unmanifested extra entity', async (repo: LocalDatabaseRepository) => {
      const existing = (await rawStoreValues(LOCAL_DATABASE_STORES.entities))
        .find(value => value.generationId === 'migration-verified' && value.entityId === A);
      await putRaw(LOCAL_DATABASE_STORES.entities, {
        ...existing, entityId: B, record: { ...existing.record, id: B },
      });
    }],
  ] as const)('blocks settlement before capability mint when verified target has %s mutation', async (_label, corrupt) => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const settlementKey = await enterSettlementPending(repo, source, authorization);
    await corrupt(repo);
    await expectSettlementRecoveryBlocked(repo, authorization, settlementKey);
  });

  it.each([
    ['manifest', async (repo: LocalDatabaseRepository) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k325:legacy-notes:verified'],
      value => ({ ...value, manifest: { ...value.manifest, unknown: true } }),
    )],
    ['migration lifecycle', async (repo: LocalDatabaseRepository) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k325:legacy-notes:verified'],
      value => ({ ...value, status: 'staged' }),
    )],
    ['verification result', async (repo: LocalDatabaseRepository) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k325:legacy-notes:verified'],
      value => ({ ...value, result: { ...value.result, targetStateDigest: '0'.repeat(64) } }),
    )],
  ] as const)('blocks settlement for mutated K-325 %s evidence', async (_label, corrupt) => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const settlementKey = await enterSettlementPending(repo, source, authorization);
    await corrupt(repo);
    await expectSettlementRecoveryBlocked(repo, authorization, settlementKey);
  });

  it.each([
    ['removed', async (repo: LocalDatabaseRepository, source: MutableAdapter) => deleteRaw(
      LOCAL_DATABASE_STORES.migrationState,
      ['k325:legacy-source-authority:v1', `authority:${source.authorityId}`],
    ), 'CORRUPT_PERSISTED_RECORD'],
    ['revoked', async (repo: LocalDatabaseRepository, source: MutableAdapter) => {
      await repo.revokeLegacyNotesSourceAuthority(source.authorityId, T2);
    }, 'LEGACY_SOURCE_AUTHORITY_REVOKED'],
    ['malformed', async (_repo: LocalDatabaseRepository, source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState,
      ['k325:legacy-source-authority:v1', `authority:${source.authorityId}`],
      value => ({ ...value, unknown: true }),
    ), 'CORRUPT_PERSISTED_RECORD'],
    ['digest-mismatched', async (_repo: LocalDatabaseRepository, source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState,
      ['k325:legacy-source-authority:v1', `authority:${source.authorityId}`],
      value => ({ ...value, authorityDigest: '0'.repeat(64) }),
    ), 'CORRUPT_PERSISTED_RECORD'],
    ['source-identity-mismatched', async (_repo: LocalDatabaseRepository, source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState,
      ['k325:legacy-source-authority:v1', `authority:${source.authorityId}`],
      value => ({ ...value, sourceInstanceId: 'different-source' }),
    ), 'CORRUPT_PERSISTED_RECORD'],
    ['root-binding-missing', async (_repo: LocalDatabaseRepository, source: MutableAdapter) => deleteRaw(
      LOCAL_DATABASE_STORES.migrationState,
      ['k325:legacy-source-authority:v1', `root:${source.externalRootDigest}`],
    ), 'CORRUPT_PERSISTED_RECORD'],
    ['namespace-mismatched', async (_repo: LocalDatabaseRepository, source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState,
      ['k325:legacy-source-authority:v1', `authority:${source.authorityId}`],
      value => ({ ...value, userId: 'other-user' }),
    ), 'CORRUPT_PERSISTED_RECORD'],
  ] as const)('blocks settlement when K-325 source authority is %s', async (_label, corrupt, code) => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const settlementKey = await enterSettlementPending(repo, source, authorization);
    await corrupt(repo, source);
    await expectSettlementRecoveryBlocked(repo, authorization, settlementKey, code);
  });

  it('rejects a validly encoded K-326 plan that no longer matches current K-325 evidence', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const settlementKey = await enterSettlementPending(repo, source, authorization);
    await mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => {
        const { planDigest: _oldDigest, ...oldCore } = value.plan;
        const core = { ...oldCore, targetEntryCount: 2 };
        const planDigest = sha256Hex(canonical(['absinthe-local-first-cutover-plan-v2', core]));
        return { ...value, plan: { ...core, planDigest }, fence: { ...value.fence, planDigest } };
      },
    );
    await expectSettlementRecoveryBlocked(repo, authorization, settlementKey, 'CUTOVER_PRECONDITION_FAILED');
  });

  it.each([
    ['target entity', async (repo: LocalDatabaseRepository, _source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A],
      value => ({ ...value, record: { ...value.record, title: 'corrupt-after-physical-append' } }),
    )],
    ['manifest', async (repo: LocalDatabaseRepository, _source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k325:legacy-notes:verified'],
      value => ({ ...value, manifest: { ...value.manifest, unknown: true } }),
    )],
    ['migration session', async (repo: LocalDatabaseRepository, _source: MutableAdapter) => mutateRaw(
      LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k325:legacy-notes:verified'],
      value => ({ ...value, status: 'staged' }),
    )],
    ['authority revocation', async (repo: LocalDatabaseRepository, source: MutableAdapter) => {
      await repo.revokeLegacyNotesSourceAuthority(source.authorityId, T2);
    }],
  ] as const)('preserves physical settlement but blocks durable finalization after post-append %s mutation', async (_label, corrupt) => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const settlementKey = await enterSettlementPending(repo, source, authorization);
    await expect(repo.recoverFailedPrecommitCutoverFence(
      'cutover-1', authorization, T2, 'after_physical_settlement_append',
    )).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'failed_precommit_settling', fence: { phase: 'settlement_pending' },
    });
    await corrupt(repo, source);
    repo.close();
    const restarted = await reopenRepository();
    const restartedAuthorization = restarted.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(restarted.recoverFailedPrecommitCutoverFence('cutover-1', restartedAuthorization, T2))
      .rejects.toMatchObject({ code: expect.stringMatching(/^(CORRUPT_PERSISTED_RECORD|LEGACY_SOURCE_AUTHORITY_REVOKED)$/) });
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
    expect(await restarted.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'failed_precommit_settling', fence: { phase: 'settlement_pending' },
    });
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('finalizes an existing exact settlement after restart only when K-325 evidence remains unchanged', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const settlementKey = await enterSettlementPending(repo, source, authorization);
    await expect(repo.recoverFailedPrecommitCutoverFence(
      'cutover-1', authorization, T2, 'after_physical_settlement_append',
    )).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
    repo.close();
    const restarted = await reopenRepository();
    const restartedAuthorization = restarted.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(restarted.recoverFailedPrecommitCutoverFence('cutover-1', restartedAuthorization, T2))
      .resolves.toMatchObject({ status: 'failed', fence: { phase: 'settled' } });
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
  });

  it('rejects failed-precommit fence recovery for the wrong session and after activation commit', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    const originalSet = localStorage.setItem.bind(localStorage);
    const cleanup = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) throw new Error('synthetic storage failure');
      originalSet(key, value);
    });
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    cleanup.mockRestore();
    const wrong = repo.createLocalFirstCutoverAuthorization('other-cutover', 'verified', 'test');
    await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', wrong, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_RECOVERY_AUTHORIZATION_REQUIRED' });
    const otherNamespace = await repository({
      ...base, userId: 'user-b', deviceId: 'device-b', generationId: 'generation-b',
    });
    const crossNamespace = otherNamespace.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', crossNamespace, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_RECOVERY_AUTHORIZATION_REQUIRED' });
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'active' });

    repositories.splice(0).forEach(closeLocalDatabase); authorities.clear();
    await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
    clearLegacyNotesCutoverFenceForTest();
    const committedRepo = await repository(); const committedSource = sourceAdapter(committedRepo);
    await prepareVerified(committedRepo, committedSource);
    const committed = await plan(committedRepo, committedSource);
    await committedRepo.activateLocalFirstCutover(committedSource, 'cutover-1', {
      authorization: committed.authorization, now: T2,
    });
    const activated = await committedRepo.getLocalFirstCutoverSession('cutover-1');
    await expect(committedRepo.recoverFailedPrecommitCutoverFence('cutover-1', committed.authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_ALREADY_ACTIVATED' });
    expect(readLegacyNotesCutoverFence()).toMatchObject({ version: 4 });
    const settlementKey = deriveLegacyNotesCutoverFenceSettlementKey(activated!.fence!.identity);
    expect(localStorage.getItem(settlementKey)).toBeNull();
    expect((recoverySafetyPolicy as Record<string, unknown>).settleLegacyNotesCutoverFence).toBeUndefined();
    expect((recoverySafetyPolicy as Record<string, unknown>).issuePrecommitSettlementAuthority).toBeUndefined();
    const forgedPostCommitSettlement = buildLegacyNotesCutoverSettlementArtifact(activated!.fence!.identity);
    localStorage.setItem(forgedPostCommitSettlement.key, forgedPostCommitSettlement.raw);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'operationally_clear' });
    expect(mayWriteLegacyNotes()).toBe(false);
    expect(await committedRepo.getLocalFirstCutoverSession('cutover-1'))
      .toMatchObject({ status: 'confirmed', fence: { phase: 'committed' } });
    expect(await committedRepo.getLocalFirstRuntimeMode()).toMatchObject({
      mode: 'local_first', activeGenerationId: 'migration-verified',
    });
    expect(await committedRepo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'migration-verified' });
  });

  it('keeps exact own fence and settlement restart-safe without foreign misclassification', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    const failed = await repo.getLocalFirstCutoverSession('cutover-1');
    expect(failed).toMatchObject({ status: 'failed', fence: { phase: 'settled' } });
    expect(readLegacyNotesCutoverFence()).toBeNull();

    const identity = failed!.fence!.identity;
    const fenceKey = deriveLegacyNotesCutoverFenceKey(identity);
    const settlementKey = deriveLegacyNotesCutoverFenceSettlementKey(identity);
    expect(localStorage.getItem(fenceKey)).not.toBeNull();
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
    repo.close();
    const restarted = await repository();
    const restartedAuthorization = restarted.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(restarted.recoverFailedPrecommitCutoverFence('cutover-1', restartedAuthorization, T2))
      .resolves.toMatchObject({ status: 'failed', fence: { phase: 'settled', vaultState: 'operationally_clear' } });
    expect(readLegacyNotesCutoverFence()).toBeNull();
    expect(localStorage.getItem(fenceKey)).not.toBeNull();
    expect(localStorage.getItem(settlementKey)).not.toBeNull();
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('keeps a same-key malformed overwrite append-only and never reports operational clearance', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    const originalSet = localStorage.setItem.bind(localStorage);
    const firstWrite = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) throw new Error('defer settlement');
      originalSet(key, value);
    });
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    firstWrite.mockRestore();
    const pending = await repo.getLocalFirstCutoverSession('cutover-1');
    const fenceKey = deriveLegacyNotesCutoverFenceKey(pending!.fence!.identity);
    const remove = vi.spyOn(localStorage, 'removeItem');
    const mutate = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) originalSet(fenceKey, '{malformed-race');
      originalSet(key, value);
    });
    await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_FENCE_ARTIFACT_MALFORMED' });
    mutate.mockRestore();
    expect(localStorage.getItem(fenceKey)).toBe('{malformed-race');
    expect(remove).not.toHaveBeenCalled();
    remove.mockRestore();
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1'))
      .toMatchObject({ status: 'failed_precommit_settling', fence: { phase: 'settlement_pending' } });
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('rejects a settlement changed after its private append and retains pending recovery evidence', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    const originalSet = localStorage.setItem.bind(localStorage);
    const defer = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) throw new Error('defer settlement');
      originalSet(key, value);
    });
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    defer.mockRestore();

    const mutateAfterAppend = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      originalSet(key, value);
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_SETTLEMENT_PREFIX)) originalSet(key, '{mutated-after-append');
    });
    await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_FENCE_SETTLEMENT_CONFLICT' });
    mutateAfterAppend.mockRestore();
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'malformed' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1'))
      .toMatchObject({ status: 'failed_precommit_settling', fence: { phase: 'settlement_pending' } });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({
      mode: 'legacy', activeGenerationId: 'generation-1',
    });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('does not adopt or erase a newer same-session fence after repository restart', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    const staleEpoch = captureOperationEpoch();
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    const failed = await repo.getLocalFirstCutoverSession('cutover-1');
    expect(failed).toMatchObject({ status: 'failed', fence: { phase: 'settled' } });
    const original = failed!.fence!.identity;
    setPhysicalFence({
      namespaceKey: original.namespaceKey, cutoverSessionId: original.cutoverSessionId,
      targetGenerationId: original.targetGenerationId, fenceNonce: 'f'.repeat(32),
      fenceEpoch: original.fenceEpoch + 10,
    });
    repo.close();
    const restarted = await repository();
    const restartedAuthorization = restarted.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(restarted.recoverFailedPrecommitCutoverFence('cutover-1', restartedAuthorization, T2))
      .resolves.toMatchObject({ status: 'failed', fence: { phase: 'settled' } });
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'active', activeFences: [expect.objectContaining({
      fenceNonce: 'f'.repeat(32), fenceEpoch: original.fenceEpoch + 10,
    })] });
    expect(mayWriteLegacyNotes()).toBe(false);
    expect(isOperationEpochCurrent(staleEpoch)).toBe(false);
  });

  it.each(['foreign', 'malformed'] as const)('never removes or accepts a %s late fence', async kind => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    const failed = await repo.getLocalFirstCutoverSession('cutover-1');
    const identity = failed!.fence!.identity;
    if (kind === 'malformed') localStorage.setItem(`${K326_LEGACY_WRITE_FENCE_PREFIX}malformed`, '{malformed');
    else setPhysicalFence({ ...identity, namespaceKey: 'e'.repeat(64) });
    if (kind === 'malformed') {
      await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
        .rejects.toMatchObject({ code: 'CUTOVER_FENCE_ARTIFACT_MALFORMED' });
    } else {
      await expect(repo.recoverFailedPrecommitCutoverFence('cutover-1', authorization, T2))
        .resolves.toMatchObject({ status: 'failed', fence: { phase: 'settled' } });
    }
    expect(scanLegacyNotesCutoverFences().status).not.toBe('operationally_clear');
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it('requires a separate exact settlement for every additional fence and never deletes either', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    const failed = await repo.getLocalFirstCutoverSession('cutover-1');
    const identity = failed!.fence!.identity;
    const ownKey = deriveLegacyNotesCutoverFenceKey(identity);
    const foreignIdentity = { ...identity, namespaceKey: 'd'.repeat(64), fenceNonce: 'd'.repeat(32),
      fenceEpoch: identity.fenceEpoch + 1 };
    const foreign = physicalFence(foreignIdentity);
    localStorage.setItem(foreign.key, JSON.stringify(foreign.value));
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'active' });
    const foreignAuthorization = createRecoveryCutoverAuthorization({
      namespaceKey: foreign.value.namespaceKey,
      cutoverSessionId: foreign.value.cutoverSessionId,
      targetGenerationId: foreign.value.targetGenerationId,
      purpose: 'test',
    });
    const foreignSettlement = buildLegacyNotesCutoverSettlementArtifact(foreignIdentity);
    localStorage.setItem(foreignSettlement.key, foreignSettlement.raw);
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'operationally_clear' });
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'operationally_clear' });
    expect(localStorage.getItem(ownKey)).not.toBeNull();
    expect(localStorage.getItem(foreign.key)).not.toBeNull();
  });

  it('preserves both exact keys and blocks activation when B appears between A scan and write', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    const originalSet = localStorage.setItem.bind(localStorage); let foreignKey: string | null = null;
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith(K326_LEGACY_WRITE_FENCE_PREFIX) && foreignKey === null) {
        const own = JSON.parse(String(value)) as LegacyCutoverFenceIdentity;
        const foreign = physicalFence({
          namespaceKey: '9'.repeat(64), cutoverSessionId: own.cutoverSessionId,
          targetGenerationId: own.targetGenerationId, fenceNonce: '9'.repeat(32),
          fenceEpoch: own.fenceEpoch + 1,
        });
        foreignKey = foreign.key; originalSet(foreign.key, JSON.stringify(foreign.value));
      }
      originalSet(key, value);
    });
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'CUTOVER_MULTIPLE_FENCES_PRESENT' });
    set.mockRestore();
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'multiple_active' });
    expect(localStorage.getItem(foreignKey!)).not.toBeNull();
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({
      status: 'activating', fence: { phase: 'installing', vaultState: 'indeterminate' },
    });
    expect(mayWriteLegacyNotes()).toBe(false);
  });

  it.each<CutoverFailurePoint>([
    'before_activation_transaction', 'pointer_write', 'mode_write', 'session_transition', 'transaction_completion',
  ])('rolls back every activation write at %s', async failurePoint => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2, testOnlyFailAt: failurePoint,
    })).rejects.toMatchObject({ code: expect.stringMatching(/TRANSACTION/) });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    expect(await repo.getGeneration('generation-1')).toMatchObject({ status: 'active' });
    expect(await repo.getGeneration('migration-verified')).toMatchObject({ status: 'preparing' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'legacy', activeGenerationId: 'generation-1' });
    const session = await repo.getLocalFirstCutoverSession('cutover-1');
    expect(session).toMatchObject({ status: 'activating', fence: { phase: 'installed', installedAt: T2 } });
    expect(readLegacyNotesCutoverFence()).toMatchObject({
      ...session!.fence!.identity, version: 4,
    });
  });

  it('resumes confirmation after a crash immediately following activation commit', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2, testOnlyFailAt: 'after_activation_commit',
    })).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'activated' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'local_first' });
    repo.close();
    const restarted = await repository({ ...base, generationId: 'migration-verified' });
    const restartedAuthorization = restarted.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
    await expect(restarted.resumeLocalFirstCutover(source, 'cutover-1', {
      authorization: restartedAuthorization, now: T2,
    }))
      .resolves.toMatchObject({ status: 'confirmed' });
  });

  it('makes repeated plan, activation, and confirmation idempotent', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const first = await plan(repo, source);
    const second = await repo.planLocalFirstCutover(source, {
      cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization: first.authorization, now: T2,
    });
    expect(second.plan.planDigest).toBe(first.session.plan.planDigest);
    const activated = await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization: first.authorization, now: T2 });
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization: first.authorization, now: T2 }))
      .resolves.toEqual(activated);
    await expect(repo.confirmLocalFirstCutover(source, 'cutover-1', first.authorization, T2)).resolves.toEqual(activated);
    expect((await rawStoreValues(LOCAL_DATABASE_STORES.generations)).filter(value => value.status === 'active')).toHaveLength(1);
  });

  it('allows cancellation only before activation and preserves all evidence', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    const beforeEntities = await rawStoreValues(LOCAL_DATABASE_STORES.entities);
    const cancelled = await repo.cancelLocalFirstCutover('cutover-1', authorization, T2);
    expect(cancelled).toMatchObject({ status: 'cancelled', failure: { code: 'CUTOVER_CANCELLED' } });
    expect(await rawStoreValues(LOCAL_DATABASE_STORES.entities)).toEqual(beforeEntities);
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
    await expect(repo.resumeLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'CUTOVER_CANCELLED' });
  });

  it('blocks post-cutover and stale-epoch legacy IndexedDB writes', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const originalLocalStorage = JSON.stringify([note()]);
    localStorage.setItem(NOTES_KEY, originalLocalStorage);
    localStorage.setItem(FOLDERS_KEY, '[{"id":"folder-original","name":"Original"}]');
    localStorage.setItem(ACTIVE_KEY, 'original-active');
    localStorage.setItem(NOTES_IDB_MIGRATION_FLAG, 'original-migration-state');
    localStorage.setItem(NOTES_IDB_REV_KEY, '7');
    localStorage.setItem(NOTES_SEEDED_KEY, '1');
    await expect(saveNotesToIndexedDb([note() as any])).resolves.toBe(true);
    const originalIndexedDb = await loadNotesFromIndexedDb();
    const staleEpoch = captureOperationEpoch();
    await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 });
    expect(isOperationEpochCurrent(staleEpoch)).toBe(false);
    await expect(saveNotesToIndexedDb([note() as any], () => isOperationEpochCurrent(staleEpoch))).resolves.toBe(false);
    expect(await loadNotesFromIndexedDb()).toEqual(originalIndexedDb);
    expect(saveNotes([{ ...note(), title: 'changed' } as any])).toBe(false);
    expect(saveFolders([])).toBe(false);
    saveActiveNoteId('changed-active');
    markIndexedDbMigrationComplete();
    bumpNotesIndexedDbRevision();
    clearNotesOnboardingMarker();
    markNotesOnboardingComplete();
    clearNotesStorage();
    expect(localStorage.getItem(NOTES_KEY)).toBe(originalLocalStorage);
    expect(localStorage.getItem(FOLDERS_KEY)).toBe('[{"id":"folder-original","name":"Original"}]');
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('original-active');
    expect(localStorage.getItem(NOTES_IDB_MIGRATION_FLAG)).toBe('original-migration-state');
    expect(localStorage.getItem(NOTES_IDB_REV_KEY)).toBe('8');
    expect(localStorage.getItem(NOTES_SEEDED_KEY)).toBe('1');
    expect(scanLegacyNotesCutoverFences()).toMatchObject({ status: 'active' });
  });

  it('fails closed when the cross-tab cutover fence record is malformed', async () => {
    localStorage.setItem(`${K326_LEGACY_WRITE_FENCE_PREFIX}malformed`, '{malformed');
    await expect(saveNotesToIndexedDb([note() as any])).resolves.toBe(false);
    expect(readLegacyNotesCutoverFence()).toBe('corrupt');
  });

  it('rejects malformed durable cutover session evidence without normalization', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => ({
      ...value, unknown: 'payload-free-but-invalid',
    }));
    await expect(repo.getLocalFirstCutoverSession('cutover-1')).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    const [raw] = (await rawStoreValues(LOCAL_DATABASE_STORES.migrationState))
      .filter(value => value.migrationId === 'k326:cutover:cutover-1');
    expect(raw.unknown).toBe('payload-free-but-invalid');
  });

  it('rejects pre-production K-326A session shapes instead of synthesizing fence identity', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => {
      const { fence: _fence, ...legacy } = value;
      return { ...legacy, kind: 'local_first_cutover_session_v1', version: 1 };
    });
    await expect(repo.getLocalFirstCutoverSession('cutover-1'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects K-326B durable v2 session shapes instead of treating them as exact-key evidence', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => ({
      ...value, kind: 'local_first_cutover_session_v2', version: 2,
    }));
    await expect(repo.getLocalFirstCutoverSession('cutover-1'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects K-326C delete-based v3 sessions instead of inferring settlement', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    await plan(repo, source);
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => ({
      ...value, kind: 'local_first_cutover_session_v3', version: 3,
    }));
    await expect(repo.getLocalFirstCutoverSession('cutover-1'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects impossible v4 settled session graphs without normalization', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    await mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k326:cutover:cutover-1'], value => ({
      ...value, fence: { ...value.fence, phase: 'settled', vaultState: 'blocked_by_own_active' },
    }));
    await expect(repo.getLocalFirstCutoverSession('cutover-1'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
  });

  it('rejects missing target generation, target mutation, and malformed manifest evidence', async () => {
    const cases: Array<(repo: LocalDatabaseRepository) => Promise<void>> = [
      async repo => deleteRaw(LOCAL_DATABASE_STORES.generations, [repo.namespaceKey, 'migration-verified']),
      async repo => mutateRaw(LOCAL_DATABASE_STORES.entities, [repo.namespaceKey, 'migration-verified', 'notes', A], value => ({
        ...value, record: { ...value.record, title: 'tampered' },
      })),
      async repo => mutateRaw(LOCAL_DATABASE_STORES.migrationState, [repo.namespaceKey, 'k325:legacy-notes:verified'], value => ({
        ...value, manifest: { ...value.manifest, unknown: true },
      })),
    ];
    for (const corrupt of cases) {
      repositories.splice(0).forEach(closeLocalDatabase);
      await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
      authorities.clear();
      const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
      const authorization = repo.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
      await corrupt(repo);
      await expect(repo.planLocalFirstCutover(source, {
        cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization, now: T1,
      })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    }
  });

  it('rejects any target outbox or checkpoint evidence', async () => {
    for (const storeName of [LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints]) {
      repositories.splice(0).forEach(closeLocalDatabase);
      await deleteDatabase(LOCAL_DATABASE_NAME).catch(() => undefined);
      authorities.clear();
      const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
      if (storeName === LOCAL_DATABASE_STORES.outbox) {
        await putRaw(storeName, { namespaceKey: repo.namespaceKey, generationId: 'migration-verified', mutationId: 'unexpected' });
      } else {
        await putRaw(storeName, { namespaceKey: repo.namespaceKey, generationId: 'migration-verified', provider: 'unexpected', stream: 'notes' });
      }
      const authorization = repo.createLocalFirstCutoverAuthorization('cutover-1', 'verified', 'test');
      await expect(repo.planLocalFirstCutover(source, {
        cutoverSessionId: 'cutover-1', migrationSessionId: 'verified', authorization, now: T1,
      })).rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    }
  });

  it('serializes duplicate concurrent activation to one exact winner and one idempotent observer', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    const results = await Promise.all([
      repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }),
      repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ status: 'confirmed', activeGenerationId: 'migration-verified' });
    expect((await rawStoreValues(LOCAL_DATABASE_STORES.generations)).filter(value => value.status === 'active')).toHaveLength(1);
    const session = await repo.getLocalFirstCutoverSession('cutover-1');
    expect(session).toMatchObject({ status: 'confirmed', fence: { phase: 'committed' } });
    expect(readLegacyNotesCutoverFence()).toMatchObject({ ...session!.fence!.identity, version: 4 });
  });

  it('rejects a competing cutover session for the same namespace', async () => {
    const repo = await repository(); const firstSource = sourceAdapter(repo); await prepareVerified(repo, firstSource, 'verified-one');
    await plan(repo, firstSource, 'cutover-one', 'verified-one');
    const secondSource = sourceAdapter(repo, [note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')]);
    await prepareVerified(repo, secondSource, 'verified-two');
    const authorization = repo.createLocalFirstCutoverAuthorization('cutover-two', 'verified-two', 'test');
    await expect(repo.planLocalFirstCutover(secondSource, {
      cutoverSessionId: 'cutover-two', migrationSessionId: 'verified-two', authorization, now: T1,
    })).rejects.toMatchObject({ code: 'CUTOVER_SESSION_CONFLICT' });
  });

  it('rejects an active restore session and an unexpected predecessor change', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await repo.preflightLocalFirstCutover(source, 'cutover-1', authorization, T1);
    await putRaw(LOCAL_DATABASE_STORES.restoreSessions, {
      namespaceKey: repo.namespaceKey, sessionId: 'restore-race', packageId: 'package-race', protocolVersion: 1,
      expectedActiveGenerationId: 'generation-1', sourceGenerationId: 'generation-1',
      stagingGenerationId: 'restore-restore-race', targetGenerationId: null, status: 'created',
      packageDigest: 'a'.repeat(64), entityCount: 0, createdAt: T0, updatedAt: T0, committedAt: null,
      failedAt: null, failureCode: null, blockingState: null, applicationManifest: null,
      summary: { inserted: 0, replaced: 0, skipped: 0, resurrected: 0, conflicts: 0 },
    });
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 }))
      .rejects.toMatchObject({ code: 'CUTOVER_SESSION_CONFLICT' });
    expect(await repo.readDatabaseMetadata()).toMatchObject({ activeGenerationId: 'generation-1' });
  });

  it('does not permit cancellation after activation commit', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2, testOnlyFailAt: 'after_activation_commit',
    })).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    await expect(repo.cancelLocalFirstCutover('cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'CUTOVER_ALREADY_ACTIVATED' });
  });

  it('keeps activated state diagnosable when post-activation source confirmation fails', async () => {
    const repo = await repository(); const source = sourceAdapter(repo); await prepareVerified(repo, source);
    const { authorization } = await plan(repo, source);
    await expect(repo.activateLocalFirstCutover(source, 'cutover-1', {
      authorization, now: T2, testOnlyFailAt: 'after_activation_commit',
    })).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    source.records = [{ legacyKey: 'changed', value: note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      ownership: { kind: 'bound', namespaceKey: repo.namespaceKey } }];
    await expect(repo.confirmLocalFirstCutover(source, 'cutover-1', authorization, T2))
      .rejects.toMatchObject({ code: 'MIGRATION_SOURCE_CHANGED' });
    expect(await repo.getLocalFirstCutoverSession('cutover-1')).toMatchObject({ status: 'activated' });
    expect(await repo.getLocalFirstRuntimeMode()).toMatchObject({ mode: 'local_first' });
  });

  it('preserves unrelated migration records and never creates outbox/checkpoint/network state', async () => {
    const repo = await repository();
    const unrelated = {
      namespaceKey: repo.namespaceKey, migrationId: 'unrelated', sourceDatabase: 'legacy', sourceSchemaVersion: 1,
      targetDatabase: LOCAL_DATABASE_NAME, targetSchemaVersion: 1, sourceGenerationId: 'generation-1',
      expectedActiveGenerationId: 'generation-1', targetGenerationId: 'future-generation', phase: 'planned',
      lastDurableStep: 'none', counts: {}, verificationState: 'pending', rollbackEligibility: true,
      createdAt: T0, updatedAt: T0,
    };
    await putRaw(LOCAL_DATABASE_STORES.migrationState, unrelated);
    const source = sourceAdapter(repo); await prepareVerified(repo, source); const { authorization } = await plan(repo, source);
    await repo.activateLocalFirstCutover(source, 'cutover-1', { authorization, now: T2 });
    expect((await rawStoreValues(LOCAL_DATABASE_STORES.migrationState)).find(value => value.migrationId === 'unrelated'))
      .toEqual(unrelated);
    expect(await rawStoreValues(LOCAL_DATABASE_STORES.outbox)).toEqual([]);
    expect(await rawStoreValues(LOCAL_DATABASE_STORES.syncCheckpoints)).toEqual([]);
  });

  it('has no production caller, startup, UI, worker, service-worker, or network reachability', () => {
    const root = join(process.cwd(), 'src');
    const allowed = new Set([
      join(root, 'lib', 'localDatabase', 'localFirstCutover.ts'),
      join(root, 'lib', 'localDatabase', 'repository.ts'),
      join(root, 'lib', 'localDatabase', 'index.ts'),
    ]);
    const entrypointPattern = /\.(?:plan|preflight|activate|resume|confirm|cancel)LocalFirstCutover\s*\(/;
    const reachable = sourceFiles(root).filter(path => !allowed.has(path))
      .filter(path => entrypointPattern.test(readFileSync(path, 'utf8')));
    expect(reachable).toEqual([]);
    const implementation = readFileSync(join(root, 'lib', 'localDatabase', 'localFirstCutover.ts'), 'utf8');
    expect(implementation).not.toMatch(/fetch\s*\(|supabase|serviceWorker|BroadcastChannel|setInterval|setTimeout/);
    expect(implementation).not.toMatch(/export\s+(?:interface|type|const|function)\s+(?:PrecommitSettlementAuthority|issuePrecommitSettlementAuthority|appendPrecommitSettlement)/);
    expect(implementation.match(/appendPrecommitSettlement\s*\(/g)).toHaveLength(2);
    expect(implementation.match(/issuePrecommitSettlementAuthority\s*\(/g)).toHaveLength(2);
    const policy = readFileSync(join(root, 'lib', 'recoverySafetyPolicy.ts'), 'utf8');
    expect(policy).not.toMatch(/export\s+function\s+settleLegacyNotesCutoverFence/);
  });
});
