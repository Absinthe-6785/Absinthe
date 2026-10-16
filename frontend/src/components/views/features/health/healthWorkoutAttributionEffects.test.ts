// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IDBFactory, IDBKeyRange, IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import { setTimeout as taskDelay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEALTH_RECOVERY_DATASETS, buildHealthRecoveryExport,
  type HealthRecoveryDatasetName, type HealthRecoveryDatasets } from '../../../../lib/healthRecoveryExport';
import { createLocalHealthDriver, HealthRepository, IndexedDbLocalHealthDriver,
  computeLocalHealthSnapshotPayloadSha256, HEALTH_LOCAL_DATABASE_NAME, HEALTH_LOCAL_IMPORT_STATE_STORE,
  type PendingLocalHealthImportState, type VerifiedLocalHealthImportState } from '../../../../lib/healthLocalRepository';
import { createLocalHealthRepository, resetLocalHealthRuntimeForTests } from '../../../../lib/healthLocalRuntime';
import { createDormantLocalDatabaseCapability, openLocalDatabase, closeLocalDatabase } from '../../../../lib/localDatabase';
import { LocalDatabaseRepository } from '../../../../lib/localDatabase/repository';
import { WorkoutSelectedDayReader } from '../../../../lib/workoutSelectedDayReader';
import { WorkoutRangeReader } from '../../../../lib/workoutRangeReader';
import { HEALTH_ROUTINE_DEVICE_ID_KEY as KEY, HEALTH_ROUTINE_PROJECT_REF,
  HEALTH_ROUTINE_GENERATION_ID } from '../../../../lib/workoutLocalReaderAuthority';
import { useHealthSelectedDayComposite } from './useHealthSelectedDayComposite';
import { useHealthWorkoutRangeSnapshot } from './useHealthWorkoutRangeSnapshot';

vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({ HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'p1-effects-bootstrap' }));
const ACCOUNT = '44444444-4444-4444-8444-444444444444';
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DATE = '2026-10-15';
const bounds = { startDate: '2026-10-01', endDate: '2026-10-31' };
type Owner = 'B1' | 'RANGE';
let root: Root | null, host: HTMLDivElement;
let day: ReturnType<typeof useHealthSelectedDayComposite>, range: ReturnType<typeof useHealthWorkoutRangeSnapshot>;
function Harness({ owner }: { owner: Owner }) {
  day = useHealthSelectedDayComposite(owner === 'B1', ACCOUNT, DATE, { managedLifecycle: true });
  range = useHealthWorkoutRangeSnapshot(owner === 'RANGE', ACCOUNT, bounds, bounds);
  return null;
}
async function mount(owner: Owner) {
  await act(async () => { root = createRoot(host); root.render(createElement(Harness, { owner })); });
  const deadline = Date.now() + 5_000;
  while ((owner === 'B1' ? day : range).phase !== 'settled' && Date.now() < deadline) {
    await act(async () => { await taskDelay(5); });
  }
  expect((owner === 'B1' ? day : range).phase).toBe('settled');
}
function datasets(name: string): HealthRecoveryDatasets {
  const data = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(k => [k, []])) as unknown as HealthRecoveryDatasets;
  data.exercise_blocks.push({ id: '11111111-1111-4111-8111-111111111111', user_id: ACCOUNT,
    name, type: 'strength', tags: [], cardio_mode: null });
  return data;
}
async function pending(data: HealthRecoveryDatasets, snapshotId: string): Promise<PendingLocalHealthImportState> {
  const packet = await buildHealthRecoveryExport({ sourceAccount: { userId: ACCOUNT, email: 'fixture@example.invalid' },
    exportedAt: '2026-10-16T00:00:00.000Z', datasets: data });
  const datasetCounts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(k => [k, data[k].length])) as Record<HealthRecoveryDatasetName, number>;
  return { accountId: ACCOUNT, status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId,
    importedAt: '2026-10-16T00:00:00.000Z', sourceFileSha256: '1'.repeat(64),
    sourceContentSha256: packet.checksum.value, sourceExportedAt: packet.exportedAt,
    totalRowCount: Object.values(datasetCounts).reduce((a, b) => a + b, 0), datasetCounts, diagnostics: packet.diagnostics };
}
async function seed(state: 'verified' | 'pending' | 'pending-null' | 'absent', warm: boolean) {
  const driver = await createLocalHealthDriver();
  const prior = state === 'pending-null' ? Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(k => [k, []])) as unknown as HealthRecoveryDatasets : datasets('PRIOR');
  let priorState: VerifiedLocalHealthImportState | null = null;
  if (state === 'verified' || state === 'pending') {
    const first = await pending(prior, 'p1-prior');
    await driver.commitPendingImportAtomically({ accountId: ACCOUNT, datasets: prior, expectedImportState: null, pendingImportState: first });
    await driver.finalizePendingIfStillCurrent({ accountId: ACCOUNT, expectedSnapshotId: first.snapshotId });
    priorState = await driver.readImportState(ACCOUNT) as VerifiedLocalHealthImportState;
  }
  if (state === 'pending' || state === 'pending-null') {
    const withoutHash = { snapshotId: 'p1-pending', accountId: ACCOUNT, createdAt: '2026-10-16T00:00:00.000Z',
      datasets: prior, priorImportState: priorState };
    await driver.persistSnapshot({ ...withoutHash, payloadSha256: await computeLocalHealthSnapshotPayloadSha256(withoutHash) });
    await driver.commitPendingImportAtomically({ accountId: ACCOUNT, datasets: datasets('CANDIDATE'),
      expectedImportState: priorState, pendingImportState: await pending(datasets('CANDIDATE'), 'p1-pending') });
  }
  driver.close();
  if (warm) {
    const canonical = await openLocalDatabase({ userId: ACCOUNT, projectRef: HEALTH_ROUTINE_PROJECT_REF,
      deviceId: DEVICE, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 },
    { capability: createDormantLocalDatabaseCapability('p1-effects-test') });
    await canonical.initializeNamespace(); closeLocalDatabase(canonical);
  }
}
function instrument() {
  const transactions: Array<{ db: string; mode: string; stores: string[] }> = [];
  const writes: Array<{ db: string; store: string; operation: string }> = [];
  const transaction = IDBDatabase.prototype.transaction;
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
    transactions.push({ db: this.name, mode: args[1] ?? 'readonly', stores: typeof args[0] === 'string' ? [args[0]] : Array.from(args[0]) });
    return transaction.apply(this, args);
  });
  for (const operation of ['put', 'add', 'delete', 'clear'] as const) {
    const original = IDBObjectStore.prototype[operation];
    vi.spyOn(IDBObjectStore.prototype, operation).mockImplementation(function (this: IDBObjectStore, ...args: unknown[]) {
      writes.push({ db: this.transaction.db.name, store: this.name, operation });
      return (original as (...a: unknown[]) => IDBRequest).apply(this, args);
    });
  }
  // Match one explicit interleaving across exact-base and candidate probes:
  // let legacy finish (including any legitimate restoration) before canonical
  // open proceeds. Both source promises still participate in the real owner.
  let legacyFinished!: () => void;
  const legacyCompletion = new Promise<void>(resolve => { legacyFinished = resolve; });
  const readAll = HealthRepository.prototype.readAll;
  const reads = vi.spyOn(HealthRepository.prototype, 'readAll').mockImplementation(async function (this: HealthRepository) {
    try { return await readAll.call(this); } finally { legacyFinished(); }
  });
  const dayOpen = WorkoutSelectedDayReader.open, rangeOpen = WorkoutRangeReader.open;
  vi.spyOn(WorkoutSelectedDayReader, 'open').mockImplementation(async (...args) => {
    await legacyCompletion; return dayOpen(...args);
  });
  vi.spyOn(WorkoutRangeReader, 'open').mockImplementation(async (...args) => {
    await legacyCompletion; return rangeOpen(...args);
  });
  return { transactions, writes,
    reads,
    recovery: vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'recoverPendingImport'),
    restore: vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'restorePendingIfStillCurrent'),
    initialize: vi.spyOn(LocalDatabaseRepository.prototype, 'initializeNamespace'),
    save: vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'saveWorkouts'),
    remove: vi.spyOn(IndexedDbLocalHealthDriver.prototype, 'deleteWorkout'),
    fetch: vi.spyOn(globalThis, 'fetch'),
  };
}
beforeEach(() => {
  resetLocalHealthRuntimeForTests();
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.localStorage.clear(); window.localStorage.setItem(KEY, DEVICE);
  root = null; host = document.createElement('div'); document.body.append(host);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  resetLocalHealthRuntimeForTests(); host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear();
});

describe('P1 matched baseline effect probes: real owner / repositories / fake IDB', () => {
  it.each((['B1', 'RANGE'] as const).flatMap(owner =>
    (['verified', 'pending', 'pending-null', 'absent'] as const).flatMap(state =>
      [false, true].map(warm => ({ owner, state, warm })))))(
    'P1-C24/C26/C27/C28 baseline parity $owner $state warm=$warm', async ({ owner, state, warm }) => {
      await seed(state, warm);
      const p = instrument(); await mount(owner);
      expect(p.reads).toHaveBeenCalledTimes(1);
      expect(p.recovery).toHaveBeenCalledTimes(1);
      expect(p.initialize).toHaveBeenCalledTimes(1);
      const restoring = state === 'pending' || state === 'pending-null';
      expect(p.restore).toHaveBeenCalledTimes(restoring ? 1 : 0);
      const legacyWrites = p.writes.filter(w => w.db === HEALTH_LOCAL_DATABASE_NAME);
      const stateWrites = legacyWrites.filter(w => w.store === HEALTH_LOCAL_IMPORT_STATE_STORE);
      expect(stateWrites.map(w => w.operation)).toEqual(restoring ? [state === 'pending' ? 'put' : 'delete'] : []);
      const datasetWrites = legacyWrites.filter(w => (HEALTH_RECOVERY_DATASETS as readonly string[]).includes(w.store));
      expect(datasetWrites.map(w => [w.store, w.operation])).toEqual(restoring
        ? [['exercise_blocks', 'delete'], ...(state === 'pending' ? [['exercise_blocks', 'add']] : [])] : []);
      const restorationTransactions = p.transactions.filter(t => t.db === HEALTH_LOCAL_DATABASE_NAME && t.mode === 'readwrite');
      expect(restorationTransactions).toHaveLength(restoring ? 1 : 0);
      if (restoring) expect(new Set(restorationTransactions[0]!.stores)).toEqual(new Set([...HEALTH_RECOVERY_DATASETS, HEALTH_LOCAL_IMPORT_STATE_STORE]));
      expect(p.transactions).toHaveLength((owner === 'B1' ? 13 : 17) + (warm ? 0 : 1) + (restoring ? 3 : 0));
      expect(p.transactions.filter(t => t.mode === 'readwrite')).toHaveLength(restoring ? 2 : 1);
      // Canonical writes/initialization are counted separately, not hidden in writer=0.
      const canonicalWrites = p.writes.filter(w => w.db !== HEALTH_LOCAL_DATABASE_NAME);
      if (warm) expect(canonicalWrites).toEqual([]);
      else expect(canonicalWrites.length).toBeGreaterThan(0);
      expect(p.save).not.toHaveBeenCalled(); expect(p.remove).not.toHaveBeenCalled(); expect(p.fetch).not.toHaveBeenCalled();
      expect(await p.recovery.mock.results[0]!.value).toBe(restoring ? 'RESTORED' : 'NO_PENDING');
      if (restoring) expect(await p.restore.mock.results[0]!.value).toBe('APPLIED');
      const before = [p.reads.mock.calls.length, p.recovery.mock.calls.length, p.restore.mock.calls.length,
        p.transactions.length, p.writes.length, p.initialize.mock.calls.length];
      const get = vi.spyOn(window.localStorage, 'getItem');
      const model = owner === 'B1' ? day : range;
      for (let n = 0; n < 20; n++) expect(model.captureOwnerEvidence!()).not.toBeNull();
      expect([p.reads.mock.calls.length, p.recovery.mock.calls.length, p.restore.mock.calls.length,
        p.transactions.length, p.writes.length, p.initialize.mock.calls.length]).toEqual(before);
      expect(get).toHaveBeenCalledTimes(owner === 'RANGE' ? 20 : 0); // inherited fence cost, not a new probe
      process.stdout.write(`P1_MATCHED_EFFECTS ${JSON.stringify({ owner, state, warm, reads: before[0],
        recovery: before[1], restore: before[2], transactions: p.transactions.length,
        readwrite: p.transactions.filter(t => t.mode === 'readwrite').length,
        transactionFingerprint: createHash('sha256').update(JSON.stringify(p.transactions)).digest('hex'), writes: p.writes })}\n`);
    });

  it.each(['B1', 'RANGE'] as const)('P1-N11 actual extra observation readAll is detected for %s, even after NO_PENDING', async owner => {
    await seed('verified', true); const p = instrument(); await mount(owner);
    const oracle = () => { expect(p.reads).toHaveBeenCalledTimes(1); expect(p.recovery).toHaveBeenCalledTimes(1); };
    (owner === 'B1' ? day : range).captureOwnerEvidence!(); oracle();
    // Faulty test-only observation adds a REAL unchanged repository read/recovery.
    await (await createLocalHealthRepository(ACCOUNT)).readAll();
    expect(await p.recovery.mock.results[1]!.value).toBe('NO_PENDING');
    expect(() => oracle()).toThrow();
  });
  it('P1-N12 the persistence oracle detects omitted REAL restoration effects despite zero explicit writers', async () => {
    await seed('pending', true); const p = instrument(); await mount('B1');
    expect(p.save).not.toHaveBeenCalled(); expect(p.remove).not.toHaveBeenCalled();
    const observed = p.writes.filter(w => w.db === HEALTH_LOCAL_DATABASE_NAME);
    const oracle = (writes: typeof observed) => expect(writes).toEqual([
      { db: HEALTH_LOCAL_DATABASE_NAME, store: 'exercise_blocks', operation: 'delete' },
      { db: HEALTH_LOCAL_DATABASE_NAME, store: 'exercise_blocks', operation: 'add' },
      { db: HEALTH_LOCAL_DATABASE_NAME, store: HEALTH_LOCAL_IMPORT_STATE_STORE, operation: 'put' },
    ]);
    oracle(observed);
    expect(() => oracle([])).toThrow(); // synthetic omitted-counter report of real applied writes
  });
  it.each(['B1', 'RANGE'] as const)('P1-C26 %s keeps inherited conditional device creation, never repairs malformed bytes', async owner => {
    await seed('verified', false); window.localStorage.removeItem(KEY);
    const set = vi.spyOn(window.localStorage, 'setItem'); await mount(owner);
    expect(set.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
    const id = window.localStorage.getItem(KEY); expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const before = set.mock.calls.length;
    for (let i = 0; i < 10; i++) (owner === 'B1' ? day : range).captureOwnerEvidence!();
    expect(set).toHaveBeenCalledTimes(before);
    await act(async () => root!.unmount()); root = null; resetLocalHealthRuntimeForTests();
    window.localStorage.setItem(KEY, 'malformed-existing-value'); set.mockClear();
    await mount(owner); expect(window.localStorage.getItem(KEY)).toBe('malformed-existing-value');
    expect(set).not.toHaveBeenCalled();
  });
});
