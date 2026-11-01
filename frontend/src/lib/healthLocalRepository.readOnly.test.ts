import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalHealthDriver, HEALTH_LOCAL_DATABASE_NAME, HEALTH_LOCAL_IMPORT_STATE_STORE,
  type IndexedDbLocalHealthDriver,
} from './healthLocalRepository';
import { HEALTH_RECOVERY_DATASETS } from './healthRecoveryExport';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID = '11111111-1111-4111-8111-111111111111';
const BLOCK = '22222222-2222-4222-8222-222222222222';
const drivers: IndexedDbLocalHealthDriver[] = [];
const databases: IDBDatabase[] = [];
afterEach(() => {
  for (const driver of drivers.splice(0)) driver.close();
  for (const db of databases.splice(0)) db.close();
  vi.restoreAllMocks();
});
async function raw(factory: IDBFactory, version = 1, initialize?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(HEALTH_LOCAL_DATABASE_NAME, version);
    request.onupgradeneeded = () => initialize?.(request.result);
    request.onsuccess = () => { databases.push(request.result); resolve(request.result); };
    request.onerror = () => reject(request.error);
  });
}
async function write(db: IDBDatabase, store: string, value: unknown) {
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

describe('existing-only local Health opening', () => {
  it('leaves an absent database absent instead of initializing its schema', async () => {
    const factory = new IDBFactory();
    expect(await factory.databases()).toEqual([]);
    await expect(createLocalHealthDriver({ indexedDBFactory: factory, existingOnly: true }))
      .rejects.toThrow('health_indexeddb_existing_required');
    // Queue another DB task to observe the aborted versionchange fully settled.
    expect(await factory.databases()).toEqual([]);
  });

  it('preserves default creation for existing Health writers', async () => {
    const factory = new IDBFactory();
    const driver = await createLocalHealthDriver({ indexedDBFactory: factory });
    drivers.push(driver);
    expect(await factory.databases()).toEqual([{ name: HEALTH_LOCAL_DATABASE_NAME, version: 1 }]);
    await driver.putRecord('workout_logs', OWNER, { id: ID, user_id: OWNER });
    expect((await driver.readDatasets(OWNER)).workout_logs).toEqual([{ id: ID, user_id: OWNER }]);
  });

  it('does not repair an existing database with missing stores', async () => {
    const factory = new IDBFactory();
    const db = await raw(factory, 1, value => value.createObjectStore('preserved', { keyPath: 'id' }));
    await write(db, 'preserved', { id: 'original', value: 'unchanged' });
    db.close();
    const before = await factory.databases();
    await expect(createLocalHealthDriver({ indexedDBFactory: factory, existingOnly: true })).rejects.toThrow('store_missing');
    expect(await factory.databases()).toEqual(before);
    const after = await raw(factory);
    expect(Array.from(after.objectStoreNames)).toEqual(['preserved']);
    const request = after.transaction('preserved', 'readonly').objectStore('preserved').get('original');
    await expect(new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }))
      .resolves.toEqual({ id: 'original', value: 'unchanged' });
  });

  it('rejects an incompatible newer version without changing it', async () => {
    const factory = new IDBFactory();
    const db = await raw(factory, 2, value => value.createObjectStore('future'));
    db.close();
    const before = await factory.databases();
    await expect(createLocalHealthDriver({ indexedDBFactory: factory, existingOnly: true })).rejects.toMatchObject({ name: 'VersionError' });
    expect(await factory.databases()).toEqual(before);
    expect(Array.from((await raw(factory, 2)).objectStoreNames)).toEqual(['future']);
  });

  it('captures a verified source using readonly transactions with identical records and marker afterward', async () => {
    const factory = new IDBFactory();
    const seed = await createLocalHealthDriver({ indexedDBFactory: factory });
    drivers.push(seed);
    await seed.putRecord('workout_logs', OWNER, { id: ID, user_id: OWNER, date: '2026-10-30', block_id: BLOCK, sort_order: 0, sets: [{ type: 'strength', set: 1, kg: 50, reps: 5, assisted_reps: 1, done: true }] });
    await seed.putRecord('exercise_blocks', OWNER, { id: BLOCK, user_id: OWNER, name: 'Squat', type: 'strength', tags: [], cardio_mode: null });
    const db = await raw(factory);
    await write(db, HEALTH_LOCAL_IMPORT_STATE_STORE, {
      accountId: OWNER, status: 'VERIFIED_IMPORT_COMPLETE', importedAt: '', sourceFileSha256: '',
      sourceContentSha256: '', sourceExportedAt: '', totalRowCount: 2, diagnostics: {},
      datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'workout_logs' || key === 'exercise_blocks' ? 1 : 0])),
    });
    const before = await seed.readAccountSnapshot(OWNER);
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const reader = await createLocalHealthDriver({ indexedDBFactory: factory, existingOnly: true });
    drivers.push(reader);
    expect((await reader.captureWorkoutAdoptionSource(OWNER)).workouts).toHaveLength(1);
    expect(transaction).toHaveBeenCalledOnce();
    expect(transaction.mock.calls[0][1]).toBe('readonly');
    transaction.mockRestore();
    expect(await seed.readAccountSnapshot(OWNER)).toEqual(before);
  });

  it('does not repair a pending import when capture fails', async () => {
    const factory = new IDBFactory();
    const seed = await createLocalHealthDriver({ indexedDBFactory: factory });
    drivers.push(seed);
    const db = await raw(factory);
    await write(db, HEALTH_LOCAL_IMPORT_STATE_STORE, {
      accountId: OWNER, status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'pending',
      importedAt: '', sourceFileSha256: '', sourceContentSha256: '', sourceExportedAt: '',
      totalRowCount: 0, diagnostics: {}, datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, 0])),
    });
    const before = await seed.readAccountSnapshot(OWNER);
    const reader = await createLocalHealthDriver({ indexedDBFactory: factory, existingOnly: true });
    drivers.push(reader);
    await expect(reader.captureWorkoutAdoptionSource(OWNER)).rejects.toThrow('source_unstable');
    expect(await seed.readAccountSnapshot(OWNER)).toEqual(before);
  });
  it('runs synchronous dispatch before a queued competing writer can change the verified source', async () => {
    const factory = new IDBFactory();
    const seed = await createLocalHealthDriver({ indexedDBFactory: factory }); drivers.push(seed);
    const original = { id: ID, user_id: OWNER, date: '2026-10-30', block_id: BLOCK, sort_order: 0, sets: [] };
    await seed.putRecord('workout_logs', OWNER, original);
    const db = await raw(factory);
    await write(db, HEALTH_LOCAL_IMPORT_STATE_STORE, {
      accountId: OWNER, status: 'VERIFIED_IMPORT_COMPLETE', importedAt: '', sourceFileSha256: '',
      sourceContentSha256: '', sourceExportedAt: '', totalRowCount: 1, diagnostics: {},
      datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'workout_logs' ? 1 : 0])),
    });
    const events: string[] = [];
    const pending = seed.captureWorkoutAdoptionSource(OWNER, source => {
      expect(source.workouts[0].record).toEqual(original);
      events.push('dispatch');
    });
    const tx = db.transaction('workout_logs', 'readwrite');
    tx.objectStore('workout_logs').put({ storageKey: `${OWNER}:workout_logs:${ID}`, accountId: OWNER, record: { ...original, sort_order: 9 } });
    await Promise.all([pending, new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { events.push('newer-save'); resolve(); };
      tx.onerror = () => reject(tx.error);
    })]);
    expect(events).toEqual(['dispatch', 'newer-save']);
    expect((await seed.captureWorkoutAdoptionSource(OWNER)).workouts[0].record.sort_order).toBe(9);
  });
});
