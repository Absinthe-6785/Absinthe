import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: auth.getSession } } }));
import { HEALTH_RECOVERY_DATASETS, buildHealthRecoveryExport, type HealthRecoveryDatasetName, type HealthRecoveryDatasets } from './healthRecoveryExport';
import { createLocalHealthDriver, computeLocalHealthLogicalVersion, HEALTH_LOCAL_IMPORT_STATE_STORE, type IndexedDbLocalHealthDriver } from './healthLocalRepository';
import { persistReadOnlyHealthBootstrap } from './healthRecoveryImport';
import { bootstrapHealthFromSupabase, HEALTH_BOOTSTRAP_LOCAL_PRESERVED } from './healthSupabaseBootstrap';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444';
const BLOCK = '55555555-5555-4555-8555-555555555555', OTHER_BLOCK = '66666666-6666-4666-8666-666666666666';
const NOW = '2026-11-01T00:00:00.000Z';
let factory: IDBFactory, driver: IndexedDbLocalHealthDriver;

// Existing recovery-import fixture shape, with real driver/import/validation.
function datasets(accountId: string, blockId: string, ids: string[]): HealthRecoveryDatasets {
  const rows = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, []])) as unknown as HealthRecoveryDatasets;
  rows.exercise_blocks = [{ id: blockId, user_id: accountId, name: 'Synthetic strength exercise', type: 'strength', tags: [], cardio_mode: null }];
  rows.workout_logs = ids.map((id, index) => ({ id, user_id: accountId, date: `2026-10-${28 + index}`, block_id: blockId, sort_order: 0,
    sets: [{ type: 'strength', set: 1, kg: 50, reps: 5, done: true }] }));
  return rows;
}
async function seed(accountId: string, rows: HealthRecoveryDatasets) {
  const source = await buildHealthRecoveryExport({ sourceAccount: { userId: accountId, email: 'synthetic@example.test' }, exportedAt: NOW, datasets: rows });
  return persistReadOnlyHealthBootstrap({ export: source, driver, accountId, now: () => NOW });
}
function bootstrap(remote: HealthRecoveryDatasets) {
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    expect(url.origin).toBe('https://synthetic.invalid'); expect(init?.method).toBe('GET');
    expect(url.searchParams.get('user_id')).toBe(`eq.${ACCOUNT}`); expect(url.searchParams.get('offset')).toBe('0');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer synthetic-token');
    const dataset = url.pathname.split('/').at(-1) as HealthRecoveryDatasetName;
    expect(HEALTH_RECOVERY_DATASETS).toContain(dataset);
    const rows = remote[dataset];
    return { ok: true, status: 200, json: async () => structuredClone(rows),
      headers: new Headers({ 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }) };
  });
  return bootstrapHealthFromSupabase({ accountId: ACCOUNT, driver, endpoint: 'https://synthetic.invalid', apiKey: 'synthetic-anon', fetchImpl, now: () => NOW });
}
beforeEach(async () => {
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  factory = new IDBFactory(); driver = await createLocalHealthDriver({ indexedDBFactory: factory, databaseName: 'isolated-bootstrap-preservation' });
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: ACCOUNT, email: 'synthetic@example.test' }, access_token: 'synthetic-token' } }, error: null });
});
afterEach(() => { driver.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['larger-missing-id', 'same-count-different-id', 'divergent-workout', 'divergent-exercise', 'dropped-extra-field'] as const)('preserves exact verified local state for %s', async mode => {
  const local = datasets(ACCOUNT, BLOCK, [A]);
  if (mode === 'dropped-extra-field') local.workout_logs[0].original_extra = 'retain authored source';
  const remote = datasets(ACCOUNT, BLOCK, mode === 'larger-missing-id' ? [B, C] : mode === 'same-count-different-id' ? [B] : [A]);
  if (mode === 'divergent-workout') remote.workout_logs[0].sets = [{ type: 'strength', set: 1, kg: 75, reps: 5, done: true }];
  if (mode === 'divergent-exercise') remote.exercise_blocks[0].name = 'Remote different name';
  await seed(ACCOUNT, local); await seed(OTHER, datasets(OTHER, OTHER_BLOCK, [D]));
  const before = await driver.readAccountSnapshot(ACCOUNT), foreign = await driver.readAccountSnapshot(OTHER);
  const deletes = vi.spyOn(IDBObjectStore.prototype, 'delete'), adds = vi.spyOn(IDBObjectStore.prototype, 'add');
  const result = await bootstrap(remote);
  expect(result).toMatchObject({ disposition: 'READY_FROM_PRESERVED_LOCAL', reason: HEALTH_BOOTSTRAP_LOCAL_PRESERVED });
  expect(await driver.readAccountSnapshot(ACCOUNT)).toEqual(before);
  expect(await driver.readAuthoritativeDatasets(ACCOUNT)).toEqual(local);
  expect(await driver.readAccountSnapshot(OTHER)).toEqual(foreign);
  expect(deletes).not.toHaveBeenCalled();
  // At most the ordinary pre-import snapshot is saved; no dataset writes.
  expect(adds.mock.instances.every(store => store.name === 'health_recovery_snapshots')).toBe(true);
});

it.each(['no-authority', 'verified-empty', 'exact-superset'] as const)('retains legitimate %s bootstrap and source fidelity', async mode => {
  if (mode !== 'no-authority') await seed(ACCOUNT, datasets(ACCOUNT, BLOCK, mode === 'exact-superset' ? [A] : []));
  const remote = datasets(ACCOUNT, BLOCK, mode === 'exact-superset' ? [A, B] : [B, C]);
  const result = await bootstrap(remote);
  expect(result).toMatchObject({ disposition: 'READY_FROM_BOOTSTRAP', sourceFidelity: 'PASS', remoteMutationCount: 0 });
  expect(await driver.readAuthoritativeDatasets(ACCOUNT)).toEqual(remote);
});

it.each(['same-count-edit', 'new-workout', 'delete', 'delete-and-create'] as const)('preserves a concurrent %s after snapshot capture', async mode => {
  const local = datasets(ACCOUNT, BLOCK, [A]); await seed(ACCOUNT, local);
  const other = await createLocalHealthDriver({ indexedDBFactory: factory, databaseName: 'isolated-bootstrap-preservation', existingOnly: true });
  const priorState = await driver.readImportState(ACCOUNT);
  let newer!: HealthRecoveryDatasets;
  const original = driver.persistSnapshot.bind(driver);
  vi.spyOn(driver, 'persistSnapshot').mockImplementation(async snapshot => {
    await original(snapshot);
    if (mode === 'delete' || mode === 'delete-and-create') await other.deleteWorkout(ACCOUNT, A, computeLocalHealthLogicalVersion(local.workout_logs));
    if (mode !== 'delete') await other.saveWorkout({ accountId: ACCOUNT, id: mode === 'same-count-edit' ? A : D,
      date: mode === 'same-count-edit' ? '2026-10-28' : '2026-10-30', blockId: BLOCK, sortOrder: 0,
      sets: [{ type: 'strength', set: 1, kg: 90, reps: 5, done: true }], expectedVersion: mode === 'same-count-edit' ? computeLocalHealthLogicalVersion(local.workout_logs) : null });
    newer = await other.readAuthoritativeDatasets(ACCOUNT);
  });
  try {
    const result = await bootstrap(datasets(ACCOUNT, BLOCK, [A, B]));
    expect(result.disposition).toBe('READY_FROM_PRESERVED_LOCAL'); expect(await driver.readAuthoritativeDatasets(ACCOUNT)).toEqual(newer);
    if (mode === 'same-count-edit' || mode === 'delete-and-create') expect(await driver.readImportState(ACCOUNT)).toEqual(priorState);
    expect(newer.workout_logs.some(row => row.id === B)).toBe(false);
  } finally { other.close(); }
});

it('does not treat preexisting unverified rows as a clean first device', async () => {
  await driver.putRecord('exercise_blocks', ACCOUNT, datasets(ACCOUNT, BLOCK, []).exercise_blocks[0]);
  const before = await driver.readAccountSnapshot(ACCOUNT);
  await expect(bootstrap(datasets(ACCOUNT, BLOCK, [B, C]))).rejects.toThrow('health_bootstrap_local_authority_invalid');
  expect(await driver.readAccountSnapshot(ACCOUNT)).toEqual(before);
});

it('fails closed instead of claiming preserved readiness if local authority becomes invalid', async () => {
  await seed(ACCOUNT, datasets(ACCOUNT, BLOCK, [A]));
  const original = driver.persistSnapshot.bind(driver);
  vi.spyOn(driver, 'persistSnapshot').mockImplementation(async snapshot => {
    await original(snapshot);
    const db = await new Promise<IDBDatabase>(resolve => { const request = factory.open('isolated-bootstrap-preservation'); request.onsuccess = () => resolve(request.result); });
    try { const tx = db.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readwrite'); tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).delete(ACCOUNT);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
    } finally { db.close(); }
  });
  await expect(bootstrap(datasets(ACCOUNT, BLOCK, [A, B]))).rejects.toThrow('health_local_data_not_verified');
  expect((await driver.readDatasets(ACCOUNT)).workout_logs.map(row => row.id)).toEqual([A]);
});

it('never recovers or rolls back a competing pending import while verifying preserved readiness', async () => {
  await seed(ACCOUNT, datasets(ACCOUNT, BLOCK, [A]));
  const original = driver.readAuthoritativeDatasets.bind(driver);
  vi.spyOn(driver, 'readAuthoritativeDatasets').mockImplementation(async (accountId, options) => {
    expect(options).toEqual({ recoverPending: false });
    const state = await driver.readImportState(ACCOUNT);
    const db = await new Promise<IDBDatabase>(resolve => { const request = factory.open('isolated-bootstrap-preservation'); request.onsuccess = () => resolve(request.result); });
    try { const tx = db.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readwrite');
      tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put({ ...state, status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'competing-do-not-recover' });
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
    } finally { db.close(); }
    return original(accountId, options);
  });
  const restore = vi.spyOn(driver, 'restorePendingIfStillCurrent');
  await expect(bootstrap(datasets(ACCOUNT, BLOCK, [B, C]))).rejects.toThrow('health_local_data_not_verified');
  expect(restore).not.toHaveBeenCalled();
  expect(await driver.readImportState(ACCOUNT)).toMatchObject({ status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'competing-do-not-recover' });
  expect((await driver.readDatasets(ACCOUNT)).workout_logs.map(row => row.id)).toEqual([A]);
});
