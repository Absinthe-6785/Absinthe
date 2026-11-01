import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), auth: vi.fn(), from: vi.fn(), limit: vi.fn(), fetch: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: m.session, getUser: m.user, onAuthStateChange: m.auth }, from: m.from } }));
import { createLocalHealthDriver, IndexedDbLocalHealthDriver, HEALTH_LOCAL_DATABASE_NAME, HEALTH_LOCAL_IMPORT_STATE_STORE, type LocalExerciseBlockReceiveInput } from './healthLocalRepository';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryRecord } from './healthRecoveryExport';
import { createExerciseBlockCloudSingleReceive } from './healthExerciseBlockCloudSingleReceive';
import { createWorkoutCloudSingleReceive } from './healthWorkoutCloudSingleReceive';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EXISTING = '22222222-2222-4222-8222-222222222222', OLD = '33333333-3333-4333-8333-333333333333';
let serial = 0, id: string, blockId: string, driver: IndexedDbLocalHealthDriver, remote: HealthRecoveryRecord, block: HealthRecoveryRecord;
let callbacks: ((event: string, session: unknown) => void)[];
const workout = (): HealthRecoveryRecord => ({ id, user_id: A, date: '2026-11-01', block_id: blockId, sort_order: 2,
  sets: [{ type: 'strength', set: 1, kg: '50', reps: 5, done: true }] });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const owner = () => createExerciseBlockCloudSingleReceive(A, workout(), () => true);
const state = async () => (await driver.captureWorkoutAdoptionSource(A)).importState;
const input = async (): Promise<LocalExerciseBlockReceiveInput> => ({ accountId: A, record: block, workout: workout(),
  expectedImportState: await state(), isCurrent: () => true, signal: new AbortController().signal });
async function marker(value: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(HEALTH_LOCAL_DATABASE_NAME); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try { const tx = db.transaction(HEALTH_LOCAL_IMPORT_STATE_STORE, 'readwrite'); tx.objectStore(HEALTH_LOCAL_IMPORT_STATE_STORE).put(value);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
  } finally { db.close(); }
}
beforeEach(async () => {
  vi.resetAllMocks(); callbacks = []; const n = String(++serial).padStart(8, '0');
  id = `${n}-1111-4111-8111-111111111111`; blockId = `${n}-2222-4222-8222-222222222222`;
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange); vi.stubGlobal('navigator', { onLine: true }); vi.stubGlobal('fetch', m.fetch);
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon');
  remote = workout(); block = { id: blockId, user_id: A, name: '스쿼트 / スクワット', type: 'strength', tags: ['legs', '하체'], cardio_mode: null };
  m.session.mockImplementation(async () => ({ error: null, data: { session: { user: { id: A }, access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 600 } } }));
  m.user.mockResolvedValue({ error: null, data: { user: { id: A } } });
  m.auth.mockImplementation(cb => { callbacks.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  m.from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit: m.limit }) }) }) });
  m.limit.mockImplementation(async () => ({ data: [structuredClone(remote)], count: 1, error: null }));
  m.fetch.mockImplementation(async url => json([structuredClone(String(url).includes('exercise_blocks') ? block : remote)]));
  driver = await createLocalHealthDriver();
  await driver.putRecord('exercise_blocks', A, { ...block, id: EXISTING });
  await driver.putRecord('workout_logs', A, { ...workout(), id: OLD, block_id: EXISTING, date: '2026-10-01' });
  await driver.putRecord('exercise_blocks', B, { ...block, user_id: B });
  await marker({ accountId: A, status: 'VERIFIED_IMPORT_COMPLETE', importedAt: '2026-10-30', sourceFileSha256: 'fixture',
    sourceContentSha256: 'fixture', sourceExportedAt: '2026-10-30', totalRowCount: 2, diagnostics: {},
    datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, ['exercise_blocks', 'workout_logs'].includes(key) ? 1 : 0])) });
});
afterEach(() => { driver.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function receive() { const operation = owner(); expect(await operation.inspect()).toEqual(block); return operation.receive(); }

describe('explicit missing exercise receipt with the real local owner', () => {
  it('never offers a cardio block for a workout containing strength-only assisted reps', async () => {
    remote = { ...workout(), sets: [{ type: 'strength', set: 1, kg: 50, reps: 5, assisted_reps: 1, done: true }] };
    block = { ...block, type: 'cardio', cardio_mode: 'time' };
    const before = await driver.readAccountSnapshot(A);
    const op = createExerciseBlockCloudSingleReceive(A, remote, () => true);
    expect(await op.inspect()).toBeNull();
    expect(await op.receive()).toBe('DENIED');
    expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it.each(['strength', 'bodyweight', 'cardio'])('preserves exact %s content and counters, never receives the workout or changes existing records', async type => {
    block.type = type; if (type === 'cardio') block.cardio_mode = 'time';
    const before = await driver.readAccountSnapshot(A), foreign = await driver.readDatasets(B);
    const operation = owner(); const inspected = await operation.inspect(); expect(inspected).toEqual(block);
    inspected!.name = 'mutated outside';
    expect(await driver.readAccountSnapshot(A)).toEqual(before);
    expect(await operation.receive()).toBe('LOCAL_CREATE_CONFIRMED');
    const after = await driver.readAccountSnapshot(A);
    expect(after.datasets.exercise_blocks).toHaveLength(2); expect(after.datasets.exercise_blocks).toContainEqual(block);
    expect(after.datasets.exercise_blocks).toContainEqual(before.datasets.exercise_blocks[0]);
    expect(after.datasets.workout_logs).toEqual(before.datasets.workout_logs); expect(await driver.readDatasets(B)).toEqual(foreign);
    expect(after.importState).toEqual({ ...before.importState, totalRowCount: 3, datasetCounts: { ...before.importState!.datasetCounts, exercise_blocks: 2 } });
    expect(await driver.readAuthoritativeDatasets(A)).toEqual(after.datasets);
    for (const [url, init] of m.fetch.mock.calls) { expect(init.method).toBe('GET'); expect(String(url)).toContain('user_id=eq.' + A); expect(init.headers.Authorization).toBe('Bearer test-token'); }
    expect(m.from.mock.calls.every(([table]) => table === 'workout_logs')).toBe(true);
  });
  it('requires inspection and a separate workout receive; exercise names never bind identity', async () => {
    expect(await owner().receive()).toBe('DENIED');
    expect(await receive()).toBe('LOCAL_CREATE_CONFIRMED');
    expect((await driver.readDatasets(A)).workout_logs.map(row => row.id)).toEqual([OLD]);
    expect(await createWorkoutCloudSingleReceive(A, workout(), () => true).receive()).toBe('LOCAL_CREATE_CONFIRMED');
    expect((await driver.readDatasets(A)).workout_logs).toContainEqual(workout());
  });
  it.each([false, true])('does not offer an already existing exact ID, divergent=%s', async divergent => {
    await driver.putRecord('exercise_blocks', A, { ...block, ...(divergent ? { name: 'different' } : {}) });
    await marker({ ...await state().catch(() => driver.readImportState(A)), totalRowCount: 3,
      datasetCounts: { ...(await driver.readImportState(A))!.datasetCounts, exercise_blocks: 2 } });
    const before = await driver.readAccountSnapshot(A), op = owner();
    expect(await op.inspect()).toBeNull(); expect(await op.receive()).toBe('DENIED'); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('reports a post-confirmation same-ID conflict without replacing divergent content', async () => {
    const op = owner(); expect(await op.inspect()).toEqual(block);
    await driver.putRecord('exercise_blocks', A, { ...block, name: 'newer local' });
    await marker({ ...await driver.readImportState(A), totalRowCount: 3, datasetCounts: { ...(await driver.readImportState(A))!.datasetCounts, exercise_blocks: 2 } });
    const before = await driver.readAccountSnapshot(A);
    expect(await op.receive()).toBe('CONFLICT'); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it.each(['missing-workout', 'missing-block', 'changed-reference', 'changed-workout', 'changed-block', 'unsupported-block', 'unsupported-workout', 'wrong-owner', 'duplicate-block'] as const)('denies %s without mutation', async mode => {
    const before = await driver.readAccountSnapshot(A), op = owner(); expect(await op.inspect()).toEqual(block);
    m.fetch.mockImplementation(async url => {
      const isBlock = String(url).includes('exercise_blocks');
      if (mode === 'missing-workout' && !isBlock || mode === 'missing-block' && isBlock) return json([]);
      const row = structuredClone(isBlock ? block : remote);
      if (mode === 'changed-reference' && !isBlock) row.block_id = EXISTING;
      if (mode === 'changed-workout' && !isBlock) row.sort_order = 9;
      if (mode === 'changed-block' && isBlock) row.name = 'remote renamed';
      if (mode === 'unsupported-block' && isBlock || mode === 'unsupported-workout' && !isBlock) row.unknown = true;
      if (mode === 'wrong-owner') row.user_id = B;
      return json(mode === 'duplicate-block' && isBlock ? [row, row] : [row]);
    });
    expect(await op.receive()).toBe('DENIED'); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it.each(['incomplete', 'duplicate', 'error'])('rejects %s full comparison', async mode => {
    m.limit.mockResolvedValue({ data: mode === 'duplicate' ? [remote, remote] : [remote], count: 2, error: mode === 'error' ? {} : null });
    const op = owner(); expect(await op.inspect()).toBeNull(); expect(await op.receive()).toBe('DENIED');
  });
  it.each(['expired', 'server-denied', 'foreign-session', 'cancelled', 'aba', 'logout'] as const)('denies %s authority before creation', async mode => {
    const op = owner(); expect(await op.inspect()).toEqual(block);
    if (mode === 'expired') m.session.mockResolvedValue({ data: { session: { user: { id: A }, access_token: 'test-token', expires_at: 1 } } });
    if (mode === 'server-denied') m.user.mockResolvedValue({ data: { user: null }, error: {} });
    if (mode === 'foreign-session') m.session.mockResolvedValue({ data: { session: { user: { id: B }, access_token: 'test-token', expires_at: Date.now() / 1000 + 600 } } });
    if (mode === 'cancelled') op.cancel();
    if (mode === 'aba') callbacks.forEach(cb => { cb('SIGNED_IN', { user: { id: B } }); cb('SIGNED_IN', { user: { id: A } }); });
    if (mode === 'logout') callbacks.forEach(cb => cb('SIGNED_OUT', null));
    expect(await op.receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).exercise_blocks).toHaveLength(1);
  });
  it('deduplicates inspection/confirmation and rejects another in-flight owner', async () => {
    const a = owner(), b = owner(); const inspection = a.inspect(); expect(a.inspect()).toBe(inspection); await inspection; await b.inspect();
    const first = a.receive(); expect(a.receive()).toBe(first); expect(await b.receive()).toBe('DENIED');
    expect(await first).toBe('LOCAL_CREATE_CONFIRMED');
  });
  it.each(['absent', 'pending', 'bad-count', 'stale-episode'] as const)('fails closed on %s local authority without bootstrap or recovery', async mode => {
    const op = owner(); expect(await op.inspect()).toEqual(block);
    if (mode === 'absent') { driver.close(); vi.stubGlobal('indexedDB', new IDBFactory()); }
    else await marker({ ...await state(), ...(mode === 'pending' ? { status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'preserve' }
      : mode === 'bad-count' ? { totalRowCount: 99 } : { importedAt: 'new-episode' }) });
    expect(await op.receive()).toBe('DENIED');
    if (mode === 'absent') expect(await indexedDB.databases()).toEqual([]);
    else expect((await driver.readDatasets(A)).exercise_blocks).toHaveLength(1);
  });
  it('rejects an authority change during later remote reads', async () => {
    const op = owner(); await op.inspect(); let changed = false;
    m.fetch.mockImplementation(async url => { if (!changed) { changed = true; await marker({ ...await state(), importedAt: 'later-episode' }); }
      return json([String(url).includes('exercise_blocks') ? block : remote]); });
    expect(await op.receive()).toBe('DENIED'); expect((await driver.readDatasets(A)).exercise_blocks).toHaveLength(1);
  });
  it.each(['remote-workout', 'remote-block', 'readback', 'logout', 'expiry', 'unknown-commit'] as const)('preserves the local row and reports %s uncertainty without retry', async mode => {
    const op = owner(); await op.inspect();
    const originalCreate = IndexedDbLocalHealthDriver.prototype.createReceivedExerciseBlock;
    vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'createReceivedExerciseBlock').mockImplementation(async function(this: IndexedDbLocalHealthDriver, value) {
      const result = await originalCreate.call(this, value);
      if (mode === 'remote-workout') remote.sort_order = 10;
      if (mode === 'remote-block') block.name = 'changed after commit';
      if (mode === 'logout') callbacks.forEach(cb => cb('SIGNED_OUT', null));
      if (mode === 'expiry') vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 700_000);
      if (mode === 'unknown-commit') throw new Error('lost terminal acknowledgement');
      return result;
    });
    const verify = IndexedDbLocalHealthDriver.prototype.verifyExerciseBlockReceive;
    if (mode === 'readback') vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'verifyExerciseBlockReceive').mockImplementation(function(this: IndexedDbLocalHealthDriver, value, received) {
      return received ? Promise.reject(new Error('readback failed')) : verify.call(this, value);
    });
    expect(await op.receive()).toBe('INDETERMINATE'); expect((await driver.readAuthoritativeDatasets(A)).exercise_blocks).toHaveLength(2);
    expect((await driver.readDatasets(A)).workout_logs.map(row => row.id)).toEqual([OLD]);
    const calls = m.fetch.mock.calls.length, next = owner(); expect(await next.inspect()).toBeNull(); expect(await next.receive()).toBe('DENIED'); expect(m.fetch).toHaveBeenCalledTimes(calls);
  });
});

describe('exercise-only atomic local transaction', () => {
  it('serializes two connections with one add and one conflict, incrementing only once', async () => {
    const other = await createLocalHealthDriver({ existingOnly: true });
    try { const value = await input(); const results = await Promise.all([driver.createReceivedExerciseBlock(value), other.createReceivedExerciseBlock(value)]);
      expect(results.map(row => row.status).sort()).toEqual(['CONFLICT', 'CREATED']); expect((await state()).datasetCounts.exercise_blocks).toBe(2);
    } finally { other.close(); }
  });
  it.each(['async-add', 'marker', 'abort-after-add'] as const)('rolls back all counters and data on %s', async mode => {
    const value = await input(), abort = new AbortController(); value.signal = abort.signal;
    const add = IDBObjectStore.prototype.add, put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<typeof add>) {
      const request = add.apply(this, args);
      if (this.name === 'exercise_blocks') { if (mode === 'async-add') add.apply(this, args); if (mode === 'abort-after-add') queueMicrotask(() => abort.abort()); }
      return request;
    });
    if (mode === 'marker') vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args: Parameters<typeof put>) {
      if (this.name === HEALTH_LOCAL_IMPORT_STATE_STORE) throw new Error('quota'); return put.apply(this, args);
    });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedExerciseBlock(value)).toEqual({ status: 'DENIED' }); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it.each(['unsupported', 'mismatched-reference', 'foreign', 'stale', 'aborted', 'authority'] as const)('denies %s at the writer boundary', async mode => {
    const value = await input();
    if (mode === 'unsupported') value.record = { ...block, unknown: true };
    if (mode === 'mismatched-reference') value.workout = { ...remote, block_id: EXISTING };
    if (mode === 'foreign') value.record = { ...block, user_id: B };
    if (mode === 'stale') value.isCurrent = () => false;
    if (mode === 'aborted') value.signal = AbortSignal.abort();
    if (mode === 'authority') await marker({ ...await state(), importedAt: 'newer' });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedExerciseBlock(value)).toEqual({ status: 'DENIED' }); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
  it('preserves a concurrent ordinary workout save and denies stale count authority', async () => {
    const value = await input();
    await driver.saveWorkout({ accountId: A, id: '55555555-5555-4555-8555-555555555555', date: '2026-10-02', blockId: EXISTING, sets: [], sortOrder: 0, expectedVersion: null });
    const before = await driver.readAccountSnapshot(A);
    expect(await driver.createReceivedExerciseBlock(value)).toEqual({ status: 'DENIED' }); expect(await driver.readAccountSnapshot(A)).toEqual(before);
  });
});
