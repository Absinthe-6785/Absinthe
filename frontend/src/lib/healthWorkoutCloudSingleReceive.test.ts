import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), auth: vi.fn(), from: vi.fn(), limit: vi.fn(), fetch: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: m.session, getUser: m.user, onAuthStateChange: m.auth }, from: m.from } }));
import { createLocalHealthDriver, computeLocalHealthLogicalVersion, IndexedDbLocalHealthDriver, HEALTH_LOCAL_DATABASE_NAME, HEALTH_LOCAL_IMPORT_STATE_STORE, type LocalWorkoutReceiveInput } from './healthLocalRepository';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryRecord } from './healthRecoveryExport';
import { createWorkoutCloudSingleReceive } from './healthWorkoutCloudSingleReceive';
import { createWorkoutCloudComparison } from './healthWorkoutCloudComparison';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BLOCK = '22222222-2222-4222-8222-222222222222';
let serial = 0, id: string, driver: IndexedDbLocalHealthDriver, remote: HealthRecoveryRecord, block: HealthRecoveryRecord;
let callbacks: ((event: string, session: unknown) => void)[];
const record = (): HealthRecoveryRecord => ({ id, user_id: A, date: '2026-11-01', block_id: BLOCK, sort_order: 2,
  sets: [{ type: 'strength', set: 1, kg: '50', reps: 5, assisted_reps: 1, done: true }] });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const owner = () => createWorkoutCloudSingleReceive(A, record(), () => true);
const state = async () => (await driver.captureWorkoutAdoptionSource(A)).importState;
const input = async (): Promise<LocalWorkoutReceiveInput> => ({ accountId: A, record: record(), exerciseBlock: block,
  expectedImportState: await state(), isCurrent: () => true, signal: new AbortController().signal });
async function marker(value: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(HEALTH_LOCAL_DATABASE_NAME); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try { const tx = db.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readwrite'); tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(value);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
  } finally { db.close(); }
}
beforeEach(async () => {
  vi.resetAllMocks(); callbacks = []; id = `${String(++serial).padStart(8, '0')}-1111-4111-8111-111111111111`;
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange); vi.stubGlobal('navigator', { onLine: true }); vi.stubGlobal('fetch', m.fetch);
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon');
  remote = record(); block = { id: BLOCK, user_id: A, name: 'Squat', type: 'strength', tags: [], cardio_mode: null };
  m.session.mockImplementation(async () => ({ error: null, data: { session: { user: { id: A }, access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 600 } } }));
  m.user.mockResolvedValue({ error: null, data: { user: { id: A } } });
  m.auth.mockImplementation(cb => { callbacks.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  m.from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit: m.limit }) }) }) });
  m.limit.mockImplementation(async () => ({ data: [structuredClone(remote)], count: 1, error: null }));
  m.fetch.mockImplementation(async url => json([structuredClone(String(url).includes('exercise_blocks') ? block : remote)]));
  driver = await createLocalHealthDriver();
  await driver.putRecord('exercise_blocks', A, block);
  await marker({ accountId: A, status: 'VERIFIED_IMPORT_COMPLETE', importedAt: '2026-10-30', sourceFileSha256: 'fixture',
    sourceContentSha256: 'fixture', sourceExportedAt: '2026-10-30', totalRowCount: 1, diagnostics: {},
    datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'exercise_blocks' ? 1 : 0])) });
});
afterEach(() => { driver.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('single remoteOnly workout receipt using the real local owner', () => {
  it('preserves the exact row, existing data, account namespace and verified counts; every remote request is GET', async () => {
    const before = structuredClone(record()), originalBlock = structuredClone(block);
    expect(await owner().receive()).toBe('LOCAL_CREATE_CONFIRMED');
    const snapshot = await driver.readAccountSnapshot(A);
    expect(snapshot.datasets.workout_logs).toEqual([before]); expect(snapshot.datasets.exercise_blocks).toEqual([originalBlock]);
    expect(snapshot.importState).toMatchObject({ status: 'VERIFIED_IMPORT_COMPLETE', totalRowCount: 2, datasetCounts: { workout_logs: 1, exercise_blocks: 1 } });
    expect(await driver.readAuthoritativeDatasets(A)).toEqual(snapshot.datasets);
    expect((await driver.readDatasets(B)).workout_logs).toEqual([]);
    for (const [url, init] of m.fetch.mock.calls) { expect(init.method).toBe('GET'); expect(String(url)).toContain('user_id=eq.' + A); expect(init.headers.Authorization).toBe('Bearer test-token'); }
    expect(m.fetch.mock.calls.filter(([url]) => String(url).includes('workout_logs'))).toHaveLength(3);
  });
  it('returns one attempt for repeated calls, blocks a second owner, and lets the atomic owner reject cross-context collisions', async () => {
    const a = owner(), b = owner(); const first = a.receive();
    expect(a.receive()).toBe(first); expect(await b.receive()).toBe('DENIED');
    expect(await first).toBe('LOCAL_CREATE_CONFIRMED');
    expect(await owner().receive()).toBe('CONFLICT');
    expect((await driver.readAuthoritativeDatasets(A)).workout_logs).toHaveLength(1);
  });
  it.each(['id', 'logical'] as const)('does not replace an existing %s collision', async mode => {
    await driver.saveWorkout({ accountId: A, id: mode === 'id' ? id : '33333333-3333-4333-8333-333333333333',
      date: '2026-11-01', blockId: BLOCK, sortOrder: 5, sets: [], expectedVersion: null });
    const before = await driver.readAccountSnapshot(A);
    expect(await owner().receive()).toBe('CONFLICT'); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it.each([{ name: 'Different' }, { user_id: B }, { type: 'cardio' }, { unknown: true }])('denies divergent/foreign/unsupported exercise block %s', async change => {
    block = { ...block, ...change };
    expect(await owner().receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).workout_logs).toEqual([]);
  });
  it('does not create a missing local block or fabricate verified authority', async () => {
    await driver.deleteRecord('exercise_blocks', A, BLOCK);
    const old = await driver.readImportState(A); await marker({ ...old, datasetCounts: { ...old!.datasetCounts, exercise_blocks: 0 }, totalRowCount: 0 });
    expect(await owner().receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).exercise_blocks).toEqual([]);
  });
  it.each(['unknown', 'sets', 'foreign', 'changed'] as const)('denies %s remote row without local mutation', async mode => {
    if (mode === 'unknown') remote.extra = 'not silently dropped';
    if (mode === 'sets') remote.sets = [{ type: 'strength', set: 1, done: true, kg: 5, reps: 2, assisted_reps: -1 }];
    if (mode === 'foreign') remote.user_id = B;
    if (mode === 'changed') m.fetch.mockImplementation(async url => json([String(url).includes('exercise_blocks') ? block : { ...remote, sort_order: 9 }]));
    const before = await driver.readAccountSnapshot(A);
    expect(await owner().receive()).toBe('DENIED'); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it.each(['incomplete', 'duplicate', 'error'])('denies a %s full snapshot', async mode => {
    m.limit.mockResolvedValue({ data: mode === 'duplicate' ? [remote, remote] : [remote], count: 2, error: mode === 'error' ? {} : null });
    expect(await owner().receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).workout_logs).toEqual([]);
  });
  it('rejects logout and A/B/A before write, even when the ID string returns to A', async () => {
    m.user.mockImplementation(async () => { callbacks.forEach(cb => { cb('SIGNED_OUT', null); cb('SIGNED_IN', { user: { id: B } }); cb('SIGNED_IN', { user: { id: A } }); }); return { data: { user: { id: A } } }; });
    expect(await owner().receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).workout_logs).toEqual([]);
  });
  it.each(['expired', 'server-denied', 'cancelled'] as const)('denies %s authority', async mode => {
    const transfer = owner();
    if (mode === 'expired') m.session.mockResolvedValue({ data: { session: { user: { id: A }, access_token: 'test-token', expires_at: 1 } } });
    if (mode === 'server-denied') m.user.mockResolvedValue({ data: { user: null }, error: {} });
    if (mode === 'cancelled') transfer.cancel();
    expect(await transfer.receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).workout_logs).toEqual([]);
  });
  it('keeps the committed row and reports uncertainty when the remote changes afterward; never retries', async () => {
    let reads = 0;
    m.fetch.mockImplementation(async url => { if (String(url).includes('exercise_blocks')) return json([block]); return json([{ ...remote, sort_order: ++reads >= 3 ? 9 : 2 }]); });
    expect(await owner().receive()).toBe('INDETERMINATE');
    expect((await driver.readAuthoritativeDatasets(A)).workout_logs).toEqual([record()]);
    const calls = m.fetch.mock.calls.length;
    expect(await owner().receive()).toBe('DENIED'); expect(m.fetch).toHaveBeenCalledTimes(calls);
  });
  it('never calls a failed readback confirmed or rolls back the committed row', async () => {
    vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'verifyReceivedWorkout').mockRejectedValue(new Error('storage read failed'));
    expect(await owner().receive()).toBe('INDETERMINATE');
    expect((await driver.readDatasets(A)).workout_logs).toEqual([record()]);
  });
  it('reports an unprovable transaction result as indeterminate, not a retryable denial', async () => {
    vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'createReceivedWorkout').mockRejectedValue(new Error('unknown outcome'));
    expect(await owner().receive()).toBe('INDETERMINATE');
  });
  it('does not initialize an absent device database', async () => {
    driver.close(); vi.stubGlobal('indexedDB', new IDBFactory());
    expect(await owner().receive()).toBe('DENIED'); expect(await indexedDB.databases()).toEqual([]);
  });
  it('rejects authority replacement between the complete comparison and the later remote reads', async () => {
    let replaced = false;
    m.fetch.mockImplementation(async url => {
      if (!replaced) { replaced = true; await marker({ ...await state(), importedAt: 'replacement-episode' }); }
      return json([String(url).includes('exercise_blocks') ? block : remote]);
    });
    expect(await owner().receive()).toBe('DENIED');
    expect((await driver.readDatasets(A)).workout_logs).toEqual([]);
    expect((await state()).importedAt).toBe('replacement-episode');
  });
  it('can commit the 500-to-501 local boundary but cannot pretend the refreshed comparison is complete', async () => {
    const locals = Array.from({ length: 500 }, (_, i) => ({ ...record(),
      id: `${String(i + 10000).padStart(8, '0')}-1111-4111-8111-111111111111`,
      date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10) }));
    for (const row of locals) await driver.putRecord('workout_logs', A, row);
    const initial = await driver.readImportState(A);
    await marker({ ...initial, totalRowCount: 501, datasetCounts: { ...initial!.datasetCounts, workout_logs: 500 } });
    m.limit.mockResolvedValue({ data: [...locals.slice(0, 499), remote], count: 500, error: null });
    expect(await owner().receive()).toBe('LOCAL_CREATE_CONFIRMED');
    expect((await driver.readAuthoritativeDatasets(A)).workout_logs).toHaveLength(501);
    const comparison = createWorkoutCloudComparison(A, () => true, vi.fn());
    try { await expect(comparison.compare()).rejects.toThrow('workout_comparison_limit'); } finally { comparison.cancel(); }
  });
  it('never repairs or activates a pending Restore/import state', async () => {
    await marker({ ...await state(), status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'do-not-restore' });
    const before = await driver.readAccountSnapshot(A);
    expect(await owner().receive()).toBe('DENIED'); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('preserves unrelated existing workouts and other-account data', async () => {
    await driver.saveWorkout({ accountId: A, id: '33333333-3333-4333-8333-333333333333', date: '2026-10-01',
      blockId: BLOCK, sets: [], sortOrder: 1, expectedVersion: null });
    await driver.putRecord('workout_logs', B, { ...record(), id: '44444444-4444-4444-8444-444444444444', user_id: B });
    const before = await driver.readDatasets(B), original = (await driver.readDatasets(A)).workout_logs[0];
    expect(await owner().receive()).toBe('LOCAL_CREATE_CONFIRMED');
    expect((await driver.readDatasets(A)).workout_logs).toContainEqual(original); expect(await driver.readDatasets(B)).toEqual(before);
  });
  it.each(['logout', 'expiry', 'newer-save'] as const)('never acknowledges %s after commit and before final readback', async mode => {
    const original = IndexedDbLocalHealthDriver.prototype.verifyReceivedWorkout;
    vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'verifyReceivedWorkout').mockImplementation(async function(this: IndexedDbLocalHealthDriver, value, marker) {
      if (mode === 'logout') callbacks.forEach(cb => cb('SIGNED_OUT', null));
      if (mode === 'expiry') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 700_000);
      if (mode === 'newer-save') await driver.saveWorkout({ accountId: A, id, date: String(remote.date), blockId: BLOCK,
        sets: [], sortOrder: 8, expectedVersion: computeLocalHealthLogicalVersion([record()]) });
      return original.call(this, value, marker);
    });
    expect(await owner().receive()).toBe('INDETERMINATE');
    expect((await driver.readDatasets(A)).workout_logs).toHaveLength(1);
    if (mode === 'newer-save') expect((await driver.readDatasets(A)).workout_logs[0].sort_order).toBe(8);
  });
});

describe('create-only IDB transaction admission', () => {
  it('rolls back all queued requests on an asynchronous uniqueness failure', async () => {
    const original = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<typeof original>) {
      const request = original.apply(this, args);
      if (this.name === 'workout_logs') original.apply(this, args);
      return request;
    });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedWorkout(await input())).toEqual({ status: 'DENIED' });
    expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('aborts on cancellation after add, before transaction completion', async () => {
    const candidate = await input(), abort = new AbortController(); candidate.signal = abort.signal;
    const original = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<typeof original>) {
      const request = original.apply(this, args); if (this.name === 'workout_logs') queueMicrotask(() => abort.abort()); return request;
    });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedWorkout(candidate)).toEqual({ status: 'DENIED' });
    expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('serializes two connections: one create and one conflict, with only one count increment', async () => {
    const other = await createLocalHealthDriver({ existingOnly: true });
    try {
      const original = await input();
      const results = await Promise.all([driver.createReceivedWorkout(original), other.createReceivedWorkout(original)]);
      expect(results.map(value => value.status).sort()).toEqual(['CONFLICT', 'CREATED']);
      expect((await state()).datasetCounts.workout_logs).toBe(1);
    } finally { other.close(); }
  });
  it('aborts the row and count together after an injected failure following add', async () => {
    const failing = await createLocalHealthDriver({ testHooks: { failReceivedWorkoutAfterAdd: true } });
    try {
      const before = await driver.readAccountSnapshot(A);
      expect(await failing.createReceivedWorkout(await input())).toEqual({ status: 'DENIED' });
      expect(await driver.readAccountSnapshot(A)).toEqual(before);
    } finally { failing.close(); }
  });
  it('aborts all mutations on a real marker request failure', async () => {
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<typeof original>) {
      if (this.name === HEALTH_LOCAL_IMPORT_STATE_STORE) throw new Error('marker quota');
      return original.apply(this, args);
    });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedWorkout(await input())).toEqual({ status: 'DENIED' });
    expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('fails closed on replaced authority, broken counts and stale currentness', async () => {
    const candidate = await input();
    await marker({ ...candidate.expectedImportState, sourceFileSha256: 'new episode' });
    expect(await driver.createReceivedWorkout(candidate)).toEqual({ status: 'DENIED' });
    candidate.expectedImportState = await state(); candidate.isCurrent = () => false;
    expect(await driver.createReceivedWorkout(candidate)).toEqual({ status: 'DENIED' });
    await marker({ ...candidate.expectedImportState, totalRowCount: 10 });
    expect(await driver.createReceivedWorkout(candidate)).toEqual({ status: 'DENIED' });
    expect((await driver.readDatasets(A)).workout_logs).toEqual([]);
  });
  it('preserves a newer ordinary writer and does not overwrite on receipt', async () => {
    const candidate = await input();
    await driver.saveWorkout({ accountId: A, id: '33333333-3333-4333-8333-333333333333', date: String(remote.date),
      blockId: BLOCK, sets: [], sortOrder: 7, expectedVersion: null });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedWorkout(candidate)).toEqual({ status: 'CONFLICT' });
    expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('uses cancellation at the write boundary, without a partial counter update', async () => {
    const candidate = await input(); const abort = new AbortController(); candidate.signal = abort.signal;
    let checks = 0; candidate.isCurrent = () => { if (++checks === 2) abort.abort(); return !abort.signal.aborted; };
    expect(await driver.createReceivedWorkout(candidate)).toEqual({ status: 'DENIED' });
    expect((await state()).datasetCounts.workout_logs).toBe(0);
  });
});
