// @vitest-environment happy-dom
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IDBFactory, IDBKeyRange, IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as taskDelay } from 'node:timers/promises';
import { ModuleKind, transpileModule } from 'typescript';
import { HEALTH_RECOVERY_DATASETS, buildHealthRecoveryExport, type HealthRecoveryDatasets,
  type HealthRecoveryDatasetName } from '../../../../lib/healthRecoveryExport';
import { createLocalHealthDriver, HealthRepository } from '../../../../lib/healthLocalRepository';
import { openLocalDatabase, closeLocalDatabase, createDormantLocalDatabaseCapability } from '../../../../lib/localDatabase';
import { LocalDatabaseRepository } from '../../../../lib/localDatabase/repository';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import { WorkoutRangeReader } from '../../../../lib/workoutRangeReader';
import { HEALTH_ROUTINE_PROJECT_REF, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_DEVICE_ID_KEY as KEY } from '../../../../lib/workoutLocalReaderAuthority';
import { LocalDatabaseError } from '../../../../lib/localDatabase/errors';
import { useHealthWorkoutOperationLifetime } from './useHealthWorkoutOperationLifetime';
import { useHealthWorkoutRangeSnapshot } from './useHealthWorkoutRangeSnapshot';
import * as coordinatorModule from './verifiedWorkoutRangeSnapshot';
import * as borrowerModule from './healthExerciseComparisonBorrower';
import * as projectionModule from './compositeWorkoutReadProjection';
import * as adapters from './healthWorkoutOwnerAdapters';

// No real user database or remote service is accessed by this fixture.
vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({ HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'binding-test-bootstrap' }));
const { WorkoutReadSnapshotCoordinator: Coordinator } = coordinatorModule;
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DATE = '2026-10-15', ACCOUNT = '44444444-4444-4444-8444-444444444444';
const previousBounds = { startDate: '2025-10-15', endDate: '2026-10-14' };
const monthBounds = { startDate: '2026-10-01', endDate: '2026-10-31' };
type Hook = typeof useHealthWorkoutRangeSnapshot;
type Configure = (coordinator: coordinatorModule.WorkoutReadSnapshotCoordinator) => void;
let root: Root | null, host: HTMLDivElement;
let latest: ReturnType<Hook>, adapter: ReturnType<typeof adapters.adaptRangeOwner>;
let coordinator: coordinatorModule.WorkoutReadSnapshotCoordinator;
let publications: Array<{ device: string | undefined; current: boolean }>;
let renders: number;
const routeLifetime = {}, shellLifetime = {};
async function settle() {
  // IDB completion is task-based, not a fixed number of immediate turns. Await
  // the actual terminal state, including the hook's ONE recovery when required.
  const deadline = Date.now() + 4_000;
  do {
    await act(async () => { await taskDelay(5); });
  } while (latest.phase !== 'settled' && Date.now() < deadline);
  expect(latest.phase, 'the actual source/recovery episode must finish before authority assertions').toBe('settled');
}
async function mount(configure?: Configure, hook: Hook = useHealthWorkoutRangeSnapshot) {
  const createCoordinator = (account: string, storage: Storage) => {
    coordinator = new Coordinator(account, storage); configure?.(coordinator); return coordinator;
  };
  function Harness() {
    renders++;
    const lifetime = useHealthWorkoutOperationLifetime(ACCOUNT, 1, DATE);
    latest = hook(true, ACCOUNT, previousBounds, monthBounds, { createCoordinator, deviceStorage: window.localStorage });
    const boundScope = lifetime.publication ? { ...lifetime.publication, routeLifetime, shellLifetime } : null;
    adapter = adapters.adaptRangeOwner(latest, { boundScope, getCurrentScope: () => {
      const current = lifetime.getCurrent(); return current ? { ...current, routeLifetime, shellLifetime } : null;
    }, previousBounds, monthBounds });
    if (latest.monthView) publications.push({ device: latest.monthView.scope?.deviceId, current: adapter.isCurrent() });
    return null;
  }
  await act(async () => { root = createRoot(host); root.render(createElement(Harness)); }); await settle();
}
function afterPair(c: coordinatorModule.WorkoutReadSnapshotCoordinator, action: () => void, repeat = false) {
  const derive = c.deriveRange.bind(c); let completed = 0;
  vi.spyOn(c, 'deriveRange').mockImplementation((...args) => {
    const promise = derive(...args);
    // Attach before Promise.all observes these SAME actual promises. No fabricated views.
    void promise.then(view => { if (view && ++completed % 2 === 0 && (repeat || completed === 2)) action(); });
    return promise;
  });
}
function bypassHook(): Hook {
  let source = readFileSync(resolve('src/components/views/features/health/useHealthWorkoutRangeSnapshot.ts'), 'utf8').replace(/\r\n/g, '\n');
  const guard = /      \/\/ Success requires the exact live source proof,[\s\S]*?      \/\/ Only an admitted success replenishes the existing bounded recovery budget\.\n/;
  expect(source.match(guard)).not.toBeNull(); source = source.replace(guard, '');
  const predicate = '!hasDerivedViews || (!!bound.snapshot\n      &&';
  expect(source.split(predicate)).toHaveLength(2); source = source.replace(predicate, '!bound.snapshot || (');
  const exports: Record<string, unknown> = {};
  const modules: Record<string, unknown> = { react: React, './verifiedWorkoutRangeSnapshot': coordinatorModule,
    './healthExerciseComparisonBorrower': borrowerModule, './healthWorkoutOwnerAdapters': adapters,
    './compositeWorkoutReadProjection': projectionModule };
  const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'require', code)(exports, (id: string) => {
    if (!(id in modules)) throw Error(`unexpected mutation import: ${id}`); return modules[id];
  });
  return exports.useHealthWorkoutRangeSnapshot as Hook;
}
async function seed() {
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange);
  window.localStorage.clear(); window.localStorage.setItem(KEY, A);
  const driver = await createLocalHealthDriver();
  const data = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(k => [k, []])) as unknown as HealthRecoveryDatasets;
  const exported = await buildHealthRecoveryExport({ sourceAccount: { userId: ACCOUNT, email: 'fixture@example.invalid' },
    exportedAt: '2026-10-16T00:00:00.000Z', datasets: data });
  const datasetCounts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(k => [k, 0])) as Record<HealthRecoveryDatasetName, number>;
  await driver.commitPendingImportAtomically({ accountId: ACCOUNT, datasets: data, expectedImportState: null,
    pendingImportState: { accountId: ACCOUNT, status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'binding-seed',
      importedAt: '2026-10-16T00:00:00.000Z', sourceFileSha256: '1'.repeat(64), sourceContentSha256: exported.checksum.value,
      sourceExportedAt: exported.exportedAt, totalRowCount: 0, datasetCounts, diagnostics: exported.diagnostics } });
  await driver.finalizePendingIfStillCurrent({ accountId: ACCOUNT, expectedSnapshotId: 'binding-seed' }); driver.close();
  const db = await openLocalDatabase({ userId: ACCOUNT, projectRef: HEALTH_ROUTINE_PROJECT_REF, deviceId: A,
    generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 }, { capability: createDormantLocalDatabaseCapability('test') });
  await db.initializeNamespace();
  await new WorkoutSessionRepository(db).createWorkoutSession({ version: 1, id: '11111111-1111-4111-8111-111111111111', localDate: DATE,
    entries: [{ id: '22222222-2222-4222-8222-222222222222', exercise: { id: 'bench', name: 'Bench', type: 'strength', tags: [], cardioMode: null },
      sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength', loadKind: 'external_weight',
        weightKg: '12', sourceValue: '12', sourceUnit: 'kg', reps: 7, assistedReps: null, dropset: false, done: true }] }] });
  closeLocalDatabase(db);
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); root = null; renders = 0; publications = [];
  host = document.createElement('div'); document.body.append(host); await seed();
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); root = null;
  host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear();
});

describe('R01-C11–C22 successful owner binding, actual coordinator/repositories/fake IDB', () => {
  it('C11/C12/C17/C18 rejects derivation-to-binding device retirement and recovers to B, never stale A', async () => {
    await mount(c => afterPair(c, () => {
      const proof = c.captureCurrentSnapshot()!; window.localStorage.setItem(KEY, B); expect(proof.isCurrent()).toBe(false);
    }));
    expect(publications.some(p => p.device === A && p.current)).toBe(false);
    expect(latest.monthView?.scope?.deviceId).toBe(B); expect(adapter.isCurrent()).toBe(true);
    const bProof = latest.captureOwnerEvidence!()!; window.localStorage.setItem(KEY, A);
    expect(adapter.isCurrent()).toBe(false); expect(bProof.isCurrent()).toBe(false);
    window.localStorage.setItem(KEY, B); expect(bProof.isCurrent()).toBe(false);
  });
  it.each(['null', 'mismatch', 'retired'] as const)('C13/C14/C15 rejects %s publication instead of qualifying derived A views', async kind => {
    const rejected: coordinatorModule.WorkoutReadSnapshotPublication[] = [];
    await mount(c => {
      const capture = c.captureCurrentSnapshot.bind(c);
      afterPair(c, () => {
        const proof = capture()!;
        vi.spyOn(c, 'captureCurrentSnapshot').mockImplementation(() => {
          if (kind === 'null') return null;
          if (kind === 'mismatch') return { ...proof, snapshot: { ...proof.snapshot } };
          // Retire AFTER the hook reads its non-null snapshot and captures the
          // matching proof: identity alone is insufficient at final binding.
          const captured = capture()!; c.invalidate(); rejected.push(captured); return captured;
        });
      });
    });
    expect(latest.previousView).toBeNull(); expect(latest.monthView).toBeNull();
    expect(publications).toEqual([]); expect(latest.captureOwnerEvidence!()).toBeNull();
    for (const proof of rejected) expect(proof.isCurrent()).toBe(false);
  });
  it('C18 device A-B-A before attempted binding cannot revive the rejected source, even when recovery returns to A', async () => {
    let retired!: coordinatorModule.WorkoutReadSnapshotPublication;
    const loads = vi.spyOn(Coordinator.prototype, 'load');
    await mount(c => afterPair(c, () => {
      retired = c.captureCurrentSnapshot()!; window.localStorage.setItem(KEY, B);
      expect(retired.isCurrent()).toBe(false); window.localStorage.setItem(KEY, A);
      expect(retired.isCurrent()).toBe(false);
    }));
    expect(retired.isCurrent()).toBe(false); expect(loads).toHaveBeenCalledTimes(2);
    expect(coordinator.currentSnapshot).not.toBe(retired.snapshot);
    expect(latest.monthView?.scope?.deviceId).toBe(A); expect(adapter.isCurrent()).toBe(true);
  });
  it('C16 exact current proof admits normal success and C19/C20 adapter-first observation retires it permanently', async () => {
    await mount(); expect(latest.monthView?.result.status).toBe('complete'); expect(adapter.isCurrent()).toBe(true);
    const held = adapter, port = latest;
    const get = vi.spyOn(window.localStorage, 'getItem');
    window.localStorage.setItem(KEY, B);
    // FIRST post-transition observation is the retained ADAPTER, not owner proof/coordinator.
    expect(held.isCurrent()).toBe(false); expect(get).toHaveBeenCalledTimes(1);
    expect(port.captureOwnerEvidence!()).toBeNull();
    window.localStorage.setItem(KEY, A); expect(held.isCurrent()).toBe(false);
  });
  it.each([
    [new Error('ordinary failure'), 'UNKNOWN'],
    [new projectionModule.CompositeWorkoutReadIsolationError('GENERATION_MISMATCH'), 'BLOCKED'],
    [new LocalDatabaseError('MALFORMED_METADATA', 'binding-test'), 'BLOCKED'],
  ] as const)('C21 failure reporting is not subject to successful-snapshot admission: %s', async (error, disposition) => {
    await mount(c => { vi.spyOn(c, 'deriveRange').mockRejectedValue(error); });
    expect(latest.phase).toBe('settled'); expect(latest.previousView).toBeNull(); expect(latest.monthView).toBeNull();
    const evidence = latest.captureOwnerEvidence!()!;
    expect(evidence).not.toBeNull(); expect(evidence.data.failures).toHaveLength(1);
    expect(adapter.retry.disposition.state).toBe(disposition);
    expect(adapter.input.previousView).toBeNull(); expect(adapter.input.monthView).toBeNull();
    expect(evidence.isCurrent()).toBe(true); // Failure metadata is valid; no successful payload is qualified.
  });
  it('C22 repeated binding retirement exhausts ONE existing recovery, does not replenish budget or mint retry authority', async () => {
    const load = vi.spyOn(Coordinator.prototype, 'load');
    const read = vi.spyOn(HealthRepository.prototype, 'readAll');
    const scans = vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive');
    await mount(c => afterPair(c, () => c.invalidate(), true));
    expect(load).toHaveBeenCalledTimes(2); expect(read).toHaveBeenCalledTimes(2); expect(scans).toHaveBeenCalledTimes(2);
    expect(latest.phase).toBe('settled'); expect(publications).toEqual([]); expect(latest.captureOwnerEvidence!()).toBeNull();
    expect(adapter.retry.disposition.state).not.toBe('TRANSIENT');
    const before = renders;
    for (let i = 0; i < 10; i++) await act(async () => { await taskDelay(5); });
    expect(load).toHaveBeenCalledTimes(2); expect(renders).toBe(before);
  });
  it('negative control restores correction-01 null-snapshot bypass and fails the SAME real race authority oracle', async () => {
    await mount(c => afterPair(c, () => {
      const proof = c.captureCurrentSnapshot()!; window.localStorage.setItem(KEY, B); expect(proof.isCurrent()).toBe(false);
    }), bypassHook());
    expect(latest.monthView?.scope?.deviceId).toBe(A); expect(coordinator.currentSnapshot).toBeNull();
    expect(adapter.isCurrent()).toBe(true);
    const oracle = () => expect(adapter.isCurrent()).toBe(false);
    expect(oracle).toThrow(/false/); // Valid fixture, failure specifically at stale-authority assertion.
  });
  it('nominal binding guard adds only existing synchronous fence work, not new repository/metadata/scan/IO ownership', async () => {
    const measure = async (hook: Hook) => {
      const gets = vi.spyOn(window.localStorage, 'getItem'); const legacy = vi.spyOn(HealthRepository.prototype, 'readAll');
      const scans = vi.spyOn(WorkoutRangeReader.prototype, 'readAllActive'); const metadata = vi.spyOn(LocalDatabaseRepository.prototype, 'readDatabaseMetadata');
      const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction'); const storeGets = vi.spyOn(IDBObjectStore.prototype, 'get');
      const opens = vi.spyOn(WorkoutRangeReader, 'open'); const closes = vi.spyOn(WorkoutRangeReader.prototype, 'close');
      const load = vi.spyOn(Coordinator.prototype, 'load'); const writer = vi.spyOn(LocalDatabaseRepository.prototype, 'commitLocalMutation');
      const win = vi.spyOn(window, 'addEventListener'); const doc = vi.spyOn(document, 'addEventListener');
      await mount(undefined, hook);
      const initial = gets.mock.calls.length;
      const current = adapter; for (let i = 0; i < 10; i++) expect(current.isCurrent()).toBe(true);
      await act(async () => latest.retry()); await settle();
      const result = { gets: gets.mock.calls.length, initial, legacy: legacy.mock.calls.length, scans: scans.mock.calls.length,
        metadata: metadata.mock.calls.length, transactions: transactions.mock.calls.length, storeGets: storeGets.mock.calls.length,
        opens: opens.mock.calls.length, closes: closes.mock.calls.length, load: load.mock.calls.length, writer: writer.mock.calls.length,
        listeners: win.mock.calls.length + doc.mock.calls.length };
      await act(async () => root!.unmount()); root = null; vi.restoreAllMocks(); return result;
    };
    const base = await measure(bypassHook()), correction = await measure(useHealthWorkoutRangeSnapshot);
    expect(correction.initial - base.initial).toBe(1);
    expect(correction.gets - base.gets).toBe(2); // One explicit final binding fence per successful episode.
    expect({ ...correction, gets: 0, initial: 0 }).toEqual({ ...base, gets: 0, initial: 0 });
    expect(correction.writer).toBe(0); expect(correction.listeners).toBe(0);
    process.stdout.write(`CORRECTION_02_BOUNDARY_BUDGET ${JSON.stringify({ base, correction })}\n`);
  });
});
