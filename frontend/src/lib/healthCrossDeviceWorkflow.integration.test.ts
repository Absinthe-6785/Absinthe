import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), auth: vi.fn(), from: vi.fn() }));
// Only authentication and remote I/O are synthetic. Bootstrap, comparison,
// create/receive owners, import, IDB transactions and authoritative reads are real.
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: m.session, getUser: m.user, onAuthStateChange: m.auth }, from: m.from } }));
import { createLocalHealthDriver, HealthRepository, type IndexedDbLocalHealthDriver } from './healthLocalRepository';
import { HEALTH_RECOVERY_DATASETS, buildHealthRecoveryExport, type HealthRecoveryDatasetName, type HealthRecoveryDatasets, type HealthRecoveryRecord } from './healthRecoveryExport';
import { persistReadOnlyHealthBootstrap } from './healthRecoveryImport';
import { bootstrapHealthFromSupabase, HEALTH_BOOTSTRAP_LOCAL_PRESERVED } from './healthSupabaseBootstrap';
import { createWorkoutCloudComparison } from './healthWorkoutCloudComparison';
import { createWorkoutCloudSingleCreate } from './healthWorkoutCloudSingleCreate';
import { createWorkoutCloudSingleReceive } from './healthWorkoutCloudSingleReceive';
import { createExerciseBlockCloudSingleReceive } from './healthExerciseBlockCloudSingleReceive';
import { readLocalHealthDaily, resetLocalHealthRuntimeForTests } from './healthLocalRuntime';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', FOREIGN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const BLOCK = id(90), LOCAL_BLOCK = id(91), DATE = '2026-11-01', NOW = '2026-11-01T00:00:00.000Z';
const ORIGIN = 'https://synthetic.invalid';
const block = (blockId = BLOCK, account = ACCOUNT): HealthRecoveryRecord => ({ id: blockId, user_id: account,
  name: '스쿼트 / スクワット', type: 'strength', tags: ['하체', 'legs'], cardio_mode: null });
const workout = (n: number, blockId = BLOCK, account = ACCOUNT): HealthRecoveryRecord => ({ id: id(n), user_id: account,
  date: DATE, block_id: blockId, sort_order: 2, sets: [
    { type: 'strength', set: 1, kg: '50', reps: 5, assisted_reps: 1, done: true },
    { type: 'strength', set: 2, kg: 45, reps: 8, is_dropset: true, done: false },
  ] });
const datasets = (blocks: HealthRecoveryRecord[], workouts: HealthRecoveryRecord[]) => Object.fromEntries(
  HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'exercise_blocks' ? blocks : key === 'workout_logs' ? workouts : []]),
) as HealthRecoveryDatasets;
type Device = { factory: IDBFactory; driver: IndexedDbLocalHealthDriver };
let devices: Device[], remote: HealthRecoveryDatasets, currentAccount: string, expiresAt: number;
let listeners: Set<(event: string, session: unknown) => void>;
let requests: { method: string; table: string; row?: HealthRecoveryRecord }[];
let losePostAcknowledgement: boolean;
let transport: ReturnType<typeof vi.fn>;
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status,
  headers: { 'Content-Type': 'application/json', ...headers } });
const activate = (device: Device) => vi.stubGlobal('indexedDB', device.factory);
async function device(): Promise<Device> {
  const factory = new IDBFactory();
  const value = { factory, driver: await createLocalHealthDriver({ indexedDBFactory: factory }) };
  devices.push(value); return value;
}
async function seed(value: Device, rows: HealthRecoveryDatasets, accountId = ACCOUNT) {
  const source = await buildHealthRecoveryExport({ sourceAccount: { userId: accountId, email: 'synthetic@example.test' }, exportedAt: NOW, datasets: rows });
  await persistReadOnlyHealthBootstrap({ export: source, driver: value.driver, accountId, now: () => NOW });
}
async function startup(value: Device) {
  activate(value);
  return bootstrapHealthFromSupabase({ accountId: ACCOUNT, driver: value.driver, endpoint: ORIGIN, apiKey: 'synthetic-anon',
    fetchImpl: transport, now: () => NOW });
}
async function verified(value: Device, expected: HealthRecoveryDatasets, accountId = ACCOUNT) {
  const actual = await new HealthRepository(value.driver, accountId).readAll();
  // Dataset enumeration order is not record identity. Keep every row and nested
  // set byte-value intact while comparing ID-addressed records independently.
  const byId = (a: HealthRecoveryRecord, b: HealthRecoveryRecord) => String(a.id ?? a.user_id).localeCompare(String(b.id ?? b.user_id));
  for (const key of HEALTH_RECOVERY_DATASETS) expect([...actual[key]].sort(byId)).toEqual([...expected[key]].sort(byId));
  const state = await value.driver.readImportState(accountId);
  expect(state).toMatchObject({ accountId, status: 'VERIFIED_IMPORT_COMPLETE',
    totalRowCount: HEALTH_RECOVERY_DATASETS.reduce((n, key) => n + expected[key].length, 0),
    datasetCounts: Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, expected[key].length])) });
}
async function restart(value: Device) {
  resetLocalHealthRuntimeForTests(); value.driver.close(); activate(value);
  value.driver = await createLocalHealthDriver({ existingOnly: true });
}
function transition(account: string) {
  currentAccount = account;
  for (const callback of [...listeners]) callback('SIGNED_IN', { user: { id: account } });
}
beforeEach(() => {
  vi.resetAllMocks(); devices = []; listeners = new Set(); requests = [];
  currentAccount = ACCOUNT; expiresAt = Math.floor(Date.now() / 1000) + 600; losePostAcknowledgement = false;
  // Remote has more workouts, but is not a superset of either device's local rows.
  remote = datasets([block()], [workout(20), { ...workout(21), date: '2026-10-30' }, { ...workout(22), date: '2026-10-29' }]);
  const foreign = workout(70, BLOCK, FOREIGN);
  remote.workout_logs.push(foreign); // must never leak through account-filtered reads
  vi.stubGlobal('IDBKeyRange', IDBKeyRange); vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('VITE_SUPABASE_URL', ORIGIN); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'synthetic-anon');
  m.session.mockImplementation(async () => ({ error: null, data: { session: {
    user: { id: currentAccount, email: 'synthetic@example.test' }, access_token: `synthetic-${currentAccount}`, expires_at: expiresAt } } }));
  m.user.mockImplementation(async () => ({ error: null, data: { user: { id: currentAccount } } }));
  m.auth.mockImplementation(callback => {
    listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
  });
  // Existing SDK SELECT boundary and HTTP boundary share one deterministic remote.
  m.from.mockImplementation(table => ({ select: (fields: string, options: unknown) => {
    expect(table).toBe('workout_logs'); expect(fields).toBe('*'); expect(options).toEqual({ count: 'exact' });
    return { eq: (field: string, account: string) => {
      expect(field).toBe('user_id'); expect(account).toBe(currentAccount);
      return { order: (column: string) => { expect(column).toBe('id'); return { limit: async (limit: number) => {
        expect(limit).toBe(500); requests.push({ method: 'SELECT', table });
        const rows = remote.workout_logs.filter(row => row.user_id === account);
        return { error: null, data: structuredClone(rows).sort((a, b) => String(a.id).localeCompare(String(b.id))), count: rows.length };
      } }; } };
    } };
  } }));
  transport = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input); expect(url.origin).toBe(ORIGIN);
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer synthetic-${currentAccount}`);
    const table = url.pathname.slice('/rest/v1/'.length) as HealthRecoveryDatasetName;
    expect(HEALTH_RECOVERY_DATASETS).toContain(table);
    const method = init?.method ?? 'GET';
    if (method === 'POST') {
      expect(table).toBe('workout_logs'); expect(init?.signal?.aborted).toBe(false);
      expect(new Headers(init?.headers).get('Prefer')).toBe('return=minimal');
      const row = JSON.parse(String(init?.body)) as HealthRecoveryRecord;
      expect(row.user_id).toBe(currentAccount); requests.push({ method, table, row: structuredClone(row) });
      if (remote.workout_logs.some(existing => existing.id === row.id)) return json({ code: '23505' }, 409);
      expect(remote.exercise_blocks.some(item => item.id === row.block_id && item.user_id === row.user_id)).toBe(true);
      remote.workout_logs.push(structuredClone(row));
      if (losePostAcknowledgement) throw new TypeError('synthetic acknowledgement lost after commit');
      return new Response(null, { status: 201 });
    }
    expect(method).toBe('GET'); requests.push({ method, table });
    expect(url.searchParams.get('user_id')).toBe(`eq.${currentAccount}`);
    const all = remote[table].filter(row => row.user_id === currentAccount
      && (!url.searchParams.has('id') || `eq.${row.id}` === url.searchParams.get('id')));
    const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 500);
    return json(structuredClone(all.slice(offset, offset + limit)), 200, { 'content-range': `${offset}-${Math.max(offset, all.length - 1)}/${all.length}` });
  });
  vi.stubGlobal('fetch', transport);
});
afterEach(() => { resetLocalHealthRuntimeForTests(); for (const value of devices) value.driver.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('transfers A to independent B through real owners, preserving local-only rows through bootstrap and restart', async () => {
  const a = await device(), b = await device();
  expect(a.factory).not.toBe(b.factory);
  const selected = workout(1), unrelatedA = { ...workout(2), date: '2026-10-31' }, unrelatedB = workout(3, LOCAL_BLOCK);
  const localA = datasets([block()], [selected, unrelatedA]), localB = datasets([block(LOCAL_BLOCK)], [unrelatedB]);
  const foreign = datasets([block(LOCAL_BLOCK, FOREIGN)], [workout(71, LOCAL_BLOCK, FOREIGN)]);
  await seed(a, localA); await seed(b, localB); await seed(a, foreign, FOREIGN); await seed(b, foreign, FOREIGN);
  const originalRemote = structuredClone(remote);
  expect(await startup(a)).toMatchObject({ disposition: 'READY_FROM_PRESERVED_LOCAL', reason: HEALTH_BOOTSTRAP_LOCAL_PRESERVED });
  await verified(a, localA); await verified(b, localB);
  expect(remote).toEqual(originalRemote); expect(requests.every(row => row.method === 'GET')).toBe(true);

  const upload = createWorkoutCloudSingleCreate(ACCOUNT, selected, () => currentAccount === ACCOUNT);
  expect(await upload.transfer()).toBe('REMOTE_INSERT_CONFIRMED');
  expect(remote).toEqual({ ...originalRemote, workout_logs: [...originalRemote.workout_logs, selected] });
  expect(requests.filter(row => row.method === 'POST')).toEqual([{ method: 'POST', table: 'workout_logs', row: selected }]);
  await verified(a, localA); await verified(b, localB); // uploading A did not populate B's IDB

  const requestCount = requests.length;
  expect(await startup(b)).toMatchObject({ disposition: 'READY_FROM_PRESERVED_LOCAL', reason: HEALTH_BOOTSTRAP_LOCAL_PRESERVED });
  await verified(b, localB);
  const comparison = createWorkoutCloudComparison(ACCOUNT, () => currentAccount === ACCOUNT, () => undefined);
  const report = await comparison.compare();
  expect(report.details.remoteOnly.map(row => row.id)).toContain(selected.id);
  expect(Object.values(report.details).flat().some(row => row.id === id(70))).toBe(false);
  const intended = comparison.remoteOnlyRecord(String(selected.id)); expect(intended).toEqual(selected); comparison.cancel();
  // A missing exercise cannot be silently imported by workout receipt.
  expect(await createWorkoutCloudSingleReceive(ACCOUNT, intended!, () => true).receive()).toBe('DENIED');
  await verified(b, localB);
  const exercise = createExerciseBlockCloudSingleReceive(ACCOUNT, intended!, () => true);
  expect(await exercise.inspect()).toEqual(block()); await verified(b, localB);
  expect(await exercise.receive()).toBe('LOCAL_CREATE_CONFIRMED');
  await verified(b, datasets([block(), block(LOCAL_BLOCK)], [unrelatedB]));
  expect(await createWorkoutCloudSingleReceive(ACCOUNT, intended!, () => true).receive()).toBe('LOCAL_CREATE_CONFIRMED');
  const finalB = datasets([block(), block(LOCAL_BLOCK)], [selected, unrelatedB]);
  await verified(b, finalB);
  expect((await readLocalHealthDaily(ACCOUNT, DATE)).workouts)
    .toContainEqual(expect.objectContaining({ id: selected.id, block_id: BLOCK, sort_order: 2, sets: selected.sets,
      exercise_blocks: expect.objectContaining({ id: BLOCK, name: block().name, tags: block().tags }) }));
  expect(requests.slice(requestCount).every(row => ['GET', 'SELECT'].includes(row.method))).toBe(true);
  const afterTransfer = structuredClone(remote);
  await restart(b); await verified(b, finalB);
  expect((await readLocalHealthDaily(ACCOUNT, DATE)).workouts)
    .toContainEqual(expect.objectContaining({ id: selected.id, block_id: BLOCK, sort_order: 2, sets: selected.sets }));
  expect((await startup(b)).disposition).toBe('READY_FROM_PRESERVED_LOCAL'); await verified(b, finalB);
  await restart(a); expect((await startup(a)).disposition).toBe('READY_FROM_PRESERVED_LOCAL'); await verified(a, localA);
  await verified(a, foreign, FOREIGN); await verified(b, foreign, FOREIGN);
  expect(remote).toEqual(afterTransfer); // no retry, DELETE, overwrite, or merge on restart
});

it('initializes a fresh independent device from a complete remote snapshot and retains verified authority on reopen', async () => {
  const fresh = await device(); expect(await fresh.driver.readImportState(ACCOUNT)).toBeNull();
  const expected = structuredClone(remote); expected.workout_logs = expected.workout_logs.filter(row => row.user_id === ACCOUNT);
  const before = structuredClone(remote);
  expect(await startup(fresh)).toMatchObject({ disposition: 'READY_FROM_BOOTSTRAP', sourceFidelity: 'PASS' });
  await verified(fresh, expected); await restart(fresh); await verified(fresh, expected);
  expect((await fresh.driver.readDatasets(FOREIGN)).workout_logs).toEqual([]);
  expect(remote).toEqual(before); expect(requests.every(row => row.method === 'GET')).toBe(true);
});

it.each(['aba', 'expired', 'offline'] as const)('does not receive after %s authority loss following exercise inspection', async mode => {
  const b = await device(), local = datasets([block(LOCAL_BLOCK)], [workout(4, LOCAL_BLOCK)]);
  await seed(b, local); activate(b);
  const op = createExerciseBlockCloudSingleReceive(ACCOUNT, workout(20), () => currentAccount === ACCOUNT);
  expect(await op.inspect()).toEqual(block());
  if (mode === 'aba') { transition(FOREIGN); transition(ACCOUNT); }
  if (mode === 'expired') expiresAt = 1;
  if (mode === 'offline') vi.stubGlobal('navigator', { onLine: false });
  const before = await b.driver.readAccountSnapshot(ACCOUNT), cloud = structuredClone(remote), count = requests.length;
  expect(await op.receive()).toBe('DENIED'); expect(requests).toHaveLength(count);
  expect(await b.driver.readAccountSnapshot(ACCOUNT)).toEqual(before); expect(remote).toEqual(cloud);
});

it('retains both sources after an ambiguous committed upload and never retries the uncertain row', async () => {
  const a = await device(), selected = workout(5), local = datasets([block()], [selected]);
  await seed(a, local); activate(a); losePostAcknowledgement = true;
  const before = structuredClone(remote);
  expect(await createWorkoutCloudSingleCreate(ACCOUNT, selected, () => true).transfer()).toBe('INDETERMINATE');
  expect(remote).toEqual({ ...before, workout_logs: [...before.workout_logs, selected] });
  await verified(a, local);
  const count = requests.length;
  expect(await createWorkoutCloudSingleCreate(ACCOUNT, selected, () => true).transfer()).toBe('DENIED');
  expect(requests).toHaveLength(count); expect(requests.filter(row => row.method === 'POST')).toHaveLength(1);
  await restart(a); await verified(a, local);
});
