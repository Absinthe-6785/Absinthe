// @vitest-environment happy-dom
import * as React from 'react';
import { act, createElement, Suspense, StrictMode, startTransition, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ModuleKind, transpileModule } from 'typescript';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryDatasets } from '../../../../lib/healthRecoveryExport';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';
import { LocalDatabaseError } from '../../../../lib/localDatabase/errors';
import { useHealthSelectedDayComposite } from './useHealthSelectedDayComposite';
import { useHealthWorkoutRangeSnapshot } from './useHealthWorkoutRangeSnapshot';
import { useLegacyPreviousCurrentness, type PreviousParentTrust } from './useLegacyPreviousCurrentness';
import { useHealthWorkoutOperationLifetime } from './useHealthWorkoutOperationLifetime';
import { deriveHealthWorkoutParentAvailability } from './healthWorkoutParentAvailability';
import { buildWorkoutCalendarActivity } from './workoutCalendarActivity';
import { WorkoutReadSnapshotCoordinator } from './verifiedWorkoutRangeSnapshot';
import { LegacyPreviousCurrentness } from './legacyPreviousCurrentness';
import * as adapters from './healthWorkoutOwnerAdapters';
import * as dayReaderModule from '../../../../lib/workoutSelectedDayReader';
import * as projectionModule from './compositeWorkoutReadProjection';
import * as legacySnapshotModule from './selectedDayLegacySnapshot';
import * as comparisonBorrowerModule from './healthExerciseComparisonBorrower';

const mocks = vi.hoisted(() => ({ repo: vi.fn(), readAll: vi.fn(), dayOpen: vi.fn(), rangeOpen: vi.fn(),
  dayCanonical: vi.fn(), rangeCanonical: vi.fn(), previous: vi.fn() }));
vi.mock('../../../../lib/healthLocalRuntime', async original => ({
  ...await original<typeof import('../../../../lib/healthLocalRuntime')>(), createLocalHealthRepository: mocks.repo,
}));
vi.mock('../../../../lib/workoutSelectedDayReader', async original => ({
  ...await original<typeof import('../../../../lib/workoutSelectedDayReader')>(),
  WorkoutSelectedDayReader: { open: mocks.dayOpen },
}));
vi.mock('../../../../lib/workoutRangeReader', () => ({ WorkoutRangeReader: { open: mocks.rangeOpen } }));
vi.mock('./prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: mocks.previous }));
vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({ HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'owner-adapter-bootstrap' }));

const X = '2026-10-15', Y = '2026-10-16';
const DEVICE = '99999999-9999-4999-8999-999999999999';
const ID = '11111111-1111-4111-8111-111111111111';
const scope = (accountId = 'a') => ({ accountId, deviceId: DEVICE, namespaceKey: `namespace-${accountId}`, generationId: 'g1' });
function canonical(accountId = 'a', date = X) {
  return [{ accountId, namespaceKey: `namespace-${accountId}`, generationId: 'g1', entityId: ID, localRevision: 1,
    session: { version: 1, id: ID, localDate: date, entries: [{ id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: 'bench', name: 'Bench', type: 'strength', tags: [], cardioMode: null },
      sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, done: true, kind: 'strength',
        loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8,
        assistedReps: null, dropset: false }] }] } }];
}
function datasets(accountId = 'a'): HealthRecoveryDatasets {
  const data = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as unknown as HealthRecoveryDatasets;
  data.exercise_blocks.push({ id: 'bench', user_id: accountId, name: 'Bench', type: 'strength', tags: ['UPPER'] });
  for (const [index, date] of [X, Y].entries()) data.workout_logs.push({
    id: index ? '55555555-5555-4555-8555-555555555555' : '44444444-4444-4444-8444-444444444444',
    user_id: accountId, date, block_id: 'bench', sort_order: 0,
    sets: [{ type: 'strength', set: 1, kg: '10', reps: 8, done: true }],
  });
  return data;
}
function reader(accountId: string, range = false) {
  return { accountId, deviceId: DEVICE, scope: scope(accountId), close: vi.fn(),
    verifyCurrentScope: vi.fn(async () => undefined),
    read: (date: string) => mocks.dayCanonical(accountId, date),
    readAllActive: () => range ? mocks.rangeCanonical(accountId) : Promise.resolve([]) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
type Props = { enabled?: boolean; accountId?: string; date?: string; generation?: number;
  trust?: PreviousParentTrust; cutoff?: string; rejected?: boolean };
let root: Root | null, host: HTMLDivElement;
const routeLifetime = Object.freeze({}), shellLifetime = Object.freeze({}), draftLifetime = Object.freeze({});
function Harness({ enabled = true, accountId = 'a', date = X, generation = 1, trust, cutoff, rejected = false }: Props) {
  const lifetime = useHealthWorkoutOperationLifetime(accountId, generation, date);
  const currentParent = () => { const current = lifetime.getCurrent();
    return current ? { ...current, routeLifetime, shellLifetime } : null; };
  const parent = lifetime.publication ? { ...lifetime.publication, routeLifetime, shellLifetime } : null;
  const context = { boundScope: enabled ? parent : null, getCurrentScope: currentParent };
  const previousBounds = { startDate: '2025-10-15', endDate: date === X ? '2026-10-14' : X };
  const monthBounds = { startDate: '2026-10-01', endDate: '2026-10-31' };
  const day = useHealthSelectedDayComposite(enabled, accountId, date, { managedLifecycle: true });
  // Real existing coordinator and projection; only its repository/reader seams are mocked.
  const range = useHealthWorkoutRangeSnapshot(enabled, accountId, previousBounds, monthBounds);
  const identity = JSON.stringify([accountId, `namespace-${accountId}`, 'g1']);
  const previous = useLegacyPreviousCurrentness(enabled, { accountId, beforeDate: cutoff ?? date,
    authority: 'local', parentIdentity: identity, rejected }, trust ?? {
    selectedDay: 'recovered', range: 'recovered', rangeIdentity: identity,
  });
  const b1 = adapters.adaptSelectedDayOwner(day, context);
  const r = adapters.adaptRangeOwner(range, { ...context, previousBounds, monthBounds });
  const d = adapters.adaptPreviousOwner(previous, context);
  const modelInput = { gates: { selectedDay: enabled, range: enabled }, committedHealthRoute: true,
    authenticated: true, boundScope: context.boundScope, currentScope: currentParent(),
    selectedDay: b1.input, range: r.input, history: d.input,
    draft: { scope: parent, lifetime: draftLifetime, currentLifetime: draftLifetime, isDirty: false },
    workflow: { locked: false, saving: false, hasNonSeparatorWorkout: true, deleteTarget: null },
    retry: { B1: b1.retry, RANGE: r.retry, D: d.retry } };
  latest = { day, range, previous, b1, r, d, context, rangeContext: { ...context, previousBounds, monthBounds },
    modelInput, model: deriveHealthWorkoutParentAvailability(modelInput) };
  return createElement('div', { 'data-state': latest.model.selectedDay.state });
}
let latest: {
  day: ReturnType<typeof useHealthSelectedDayComposite>; range: ReturnType<typeof useHealthWorkoutRangeSnapshot>;
  previous: ReturnType<typeof useLegacyPreviousCurrentness>;
  b1: ReturnType<typeof adapters.adaptSelectedDayOwner>; r: ReturnType<typeof adapters.adaptRangeOwner>;
  d: ReturnType<typeof adapters.adaptPreviousOwner>; context: adapters.WorkoutAdapterContext;
  rangeContext: adapters.RangeAdapterContext; modelInput: Parameters<typeof deriveHealthWorkoutParentAvailability>[0];
  model: ReturnType<typeof deriveHealthWorkoutParentAvailability>;
};
async function render(props: Props = {}) { await act(async () => {
  root ??= createRoot(host); root.render(createElement(Harness, props));
}); }
async function tick() { await act(async () => { for (let n = 0; n < 15; n++) await Promise.resolve(); }); }
const counts = () => [mocks.repo.mock.calls.length, mocks.readAll.mock.calls.length, mocks.dayOpen.mock.calls.length,
  mocks.rangeOpen.mock.calls.length, mocks.dayCanonical.mock.calls.length, mocks.rangeCanonical.mock.calls.length, mocks.previous.mock.calls.length];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = null;
  window.localStorage.setItem('absinthe-health-routine-device-id:v1', DEVICE);
  mocks.readAll.mockReset().mockImplementation(async account => datasets(account));
  mocks.repo.mockReset().mockImplementation(async account => ({ readAll: () => mocks.readAll(account) }));
  mocks.dayCanonical.mockReset().mockImplementation(async (account, date) => canonical(account, date));
  mocks.rangeCanonical.mockReset().mockImplementation(async account => canonical(account));
  mocks.dayOpen.mockReset().mockImplementation(async account => reader(account));
  mocks.rangeOpen.mockReset().mockImplementation(async account => reader(account, true));
  mocks.previous.mockReset().mockResolvedValue({});
});
afterEach(() => { if (root) act(() => root!.unmount()); root = null; host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe('Slice B real-owner publication observations (not runtime activation)', () => {
  it('P1-C01/C02 reproduces lost lane attribution at the actual B1 catches', async () => {
    mocks.readAll.mockRejectedValueOnce(new Error('sensitive legacy error'));
    await render(); await tick();
    expect(latest.day.captureOwnerEvidence!()!.data).toMatchObject({ sourceFailures: [
      { owner: 'B1', source: 'LEGACY', boundary: 'READ', disposition: { kind: 'UNCLASSIFIED', reasonCode: 'UNKNOWN' } },
    ] });
    mocks.dayCanonical.mockRejectedValueOnce(new LocalDatabaseError('OPEN_FAILED', 'sensitive operation'));
    act(() => latest.day.retry()); await tick();
    expect(latest.day.captureOwnerEvidence!()!.data).toMatchObject({ sourceFailures: [
      { owner: 'B1', source: 'CANONICAL', boundary: 'READ', disposition: { kind: 'UNCLASSIFIED', reasonCode: 'OPEN_FAILED' } },
    ] });
  });

  it('P1-C09/C10 reproduces ordinary RANGE allSettled cause loss at the actual coordinator', async () => {
    mocks.readAll.mockRejectedValue(new Error('sensitive legacy error'));
    mocks.rangeCanonical.mockRejectedValueOnce(new LocalDatabaseError('OPEN_FAILED', 'sensitive operation'));
    await render(); await tick();
    expect(latest.range.captureOwnerEvidence!()!.data).toMatchObject({ sourceFailures: [
      { owner: 'RANGE', source: 'LEGACY', boundary: 'READ', disposition: { kind: 'UNCLASSIFIED', reasonCode: 'UNKNOWN' } },
      { owner: 'RANGE', source: 'CANONICAL', boundary: 'READ', disposition: { kind: 'UNCLASSIFIED', reasonCode: 'OPEN_FAILED' } },
    ] });
    expect(latest.range.monthView?.result.status).toBe('error');
  });

  it('B01/B29 accepts current B1 and supplies Slice A without changing its immutable output boundary', async () => {
    await render(); await tick();
    expect(latest.b1.input.publication).not.toBeNull(); expect(latest.b1.isCurrent()).toBe(true);
    expect(latest.model.selectedDay.state).toBe('COMPLETE'); expect(latest.model.editor.state).toBe('EDITOR_INTERACTIVE');
    if (latest.model.editor.state !== 'EDITOR_INTERACTIVE') throw Error('fixture');
    expect(Reflect.set(latest.model.editor.legacyDaily.workouts[0]!.sets[0]!, 'reps', 999)).toBe(false);
    expect(latest.day.legacyDaily!.workouts[0]!.sets[0]).toMatchObject({ reps: 8 });
  });
  it('B02 revokes held B1 publication synchronously before a retry can publish', async () => {
    await render(); await tick(); const old = latest.day, adapter = latest.b1, context = latest.context;
    act(() => old.retry());
    expect(old.captureOwnerEvidence!()).toBeNull(); expect(adapter.isCurrent()).toBe(false);
    expect(adapters.adaptSelectedDayOwner(old, context).input.result).toBeNull(); await tick();
    expect(latest.b1.ownerPublication).not.toBe(adapter.ownerPublication);
  });
  it('held Slice A inputs cannot replay revoked source authority without recapture', async () => {
    await render(); await tick(); const old = latest.modelInput;
    act(() => { latest.day.retry(); latest.range.invalidateAndReload(); latest.previous.owner.invalidate('unknown', false); });
    expect(old.selectedDay.currentPublication).toBeNull(); expect(old.range.currentPublication).toBeNull();
    expect(old.history.currentPublication).toBeNull();
    const model = deriveHealthWorkoutParentAvailability(old);
    expect(model.selectedDay.state).toBe('UNAVAILABLE'); expect(model.range.state).toBe('UNAVAILABLE');
    expect(model.editor.state).toBe('EDITOR_HIDDEN'); await tick();
  });
  it.each(['account', 'date'] as const)('B03/B25 %s ABA cannot revive an old owner or shared date lifetime', async kind => {
    await render(); await tick(); const old = latest.b1, parent = latest.context.boundScope!, oldPort = latest.day;
    await render(kind === 'account' ? { accountId: 'b', generation: 2 } : { date: Y }); await tick();
    await render(kind === 'account' ? { generation: 3 } : {}); await tick();
    expect(latest.context.boundScope!.dateLifetime).not.toBe(parent.dateLifetime);
    expect(old.isCurrent()).toBe(false); expect(oldPort.captureOwnerEvidence!()).toBeNull();
    expect(latest.b1.isCurrent()).toBe(true);
  });
  it.each(['legacy', 'canonical'] as const)('B04 retains only the successful source when %s fails', async source => {
    if (source === 'legacy') mocks.readAll.mockRejectedValue(new Error('ordinary legacy failure'));
    else mocks.dayOpen.mockRejectedValue(new Error('ordinary canonical failure'));
    await render(); await tick();
    expect(latest.b1.input.result?.status).toBe('partial_data');
    expect(latest.model.selectedDay.state).toBe(source === 'legacy' ? 'PARTIAL_CANONICAL' : 'PARTIAL_LEGACY');
    expect(latest.model.editor.state).toBe(source === 'legacy' ? 'EDITOR_HIDDEN' : 'EDITOR_INTERACTIVE');
    expect(latest.b1.retry.disposition.state).toBe('UNKNOWN');
  });
  it('B05 typed B1 isolation withholds the entire pair', async () => {
    mocks.dayCanonical.mockRejectedValue(new CompositeWorkoutReadIsolationError('GENERATION_MISMATCH'));
    await render(); await tick();
    expect(latest.b1.input).toMatchObject({ isolationError: true, result: null, legacyDaily: null });
    expect(latest.b1.retryClassification.state).toBe('ISOLATION_BLOCKED');
  });
  it('B06 ordinary unavailable never becomes complete empty', async () => {
    mocks.readAll.mockRejectedValue(new Error('legacy')); mocks.dayOpen.mockRejectedValue(new Error('canonical'));
    await render(); await tick(); expect(latest.model.selectedDay.state).toBe('UNAVAILABLE');
    expect(latest.b1.input.result?.status).toBe('error'); expect(latest.b1.input.legacyDaily).toBeNull();
  });
  it('B07 accepts current independent range with the exact established namespace/generation', async () => {
    await render(); await tick(); expect(latest.r.isCurrent()).toBe(true);
    expect(latest.r.input.publication?.canonicalScope).toEqual(scope());
    expect(latest.r.input.monthView?.result.status).toBe('complete');
  });
  it('B08 invalidation immediately retires old range evidence without borrowing a fresh publication', async () => {
    await render(); await tick(); const old = latest.range, adapter = latest.r;
    act(() => old.invalidateAndReload());
    expect(old.captureOwnerEvidence!()).toBeNull(); expect(adapter.isCurrent()).toBe(false);
    expect(adapters.adaptRangeOwner(old, latest.rangeContext).input.monthView).toBeNull(); await tick();
    expect(latest.r.ownerPublication).not.toBe(adapter.ownerPublication);
  });
  it.each(['accountId', 'namespaceKey', 'generationId'] as const)('B09/B12 rejects persisted foreign %s before publishing range records', async key => {
    mocks.rangeCanonical.mockImplementation(async () => canonical().map(row => ({ ...row, [key]: 'foreign' })));
    await render(); await tick();
    expect(latest.r.input).toMatchObject({ isolationError: true, previousView: null, monthView: null });
    expect(latest.r.retryClassification.state).toBe('ISOLATION_BLOCKED');
  });
  it.each([false, true])('B10 covered absence versus unknown, canonicalUnavailable=%s', async partial => {
    if (partial) mocks.rangeOpen.mockRejectedValue(new Error('ordinary canonical failure'));
    await render(); await tick();
    const input = latest.r.input;
    const activity = buildWorkoutCalendarActivity({ phase: 'settled', view: input.monthView,
      monthStart: '2026-10-01', monthEnd: '2026-10-31', isolationError: input.isolationError, onRetry: vi.fn() });
    expect(activity.stateForDate(X)).toBe('present');
    expect(activity.stateForDate('2026-10-10')).toBe(partial ? 'unknown' : 'absent');
    expect(activity.stateForDate('2026-11-01')).toBe('unknown');
  });
  it('B11 independent range survives B1/D rejection only on its own proof', async () => {
    mocks.dayCanonical.mockRejectedValue(new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH'));
    await render({ rejected: true }); await tick();
    expect(latest.model.selectedDay.state).toBe('ISOLATION'); expect(latest.model.range.state).toBe('COMPLETE');
    expect(latest.r.isCurrent()).toBe(true);
  });
  it('B13 retains current D rejection, including denial observed through a held port', async () => {
    await render(); await tick(); const held = latest.previous, old = latest.modelInput;
    await render({ rejected: true }); await tick();
    expect(latest.d.input.rejected).toBe(true);
    expect(adapters.adaptPreviousOwner(held, latest.context).input.rejected).toBe(true);
    expect(old.history.rejected).toBe(true);
    expect(deriveHealthWorkoutParentAvailability(old).history).toBe('REJECTED');
    expect(latest.model.editor.state).toBe('EDITOR_HIDDEN');
  });
  it('B14 B1 complete recovery cannot clear the range-origin D latch', async () => {
    const identity = JSON.stringify(['a', 'namespace-a', 'g1']);
    await render({ trust: { selectedDay: 'recovered', range: 'rejected', rangeIdentity: identity } }); await tick();
    await render({ trust: { selectedDay: 'recovered', range: 'unknown', rangeIdentity: null } }); await tick();
    expect(latest.b1.input.result?.status).toBe('complete'); expect(latest.d.input.rejected).toBe(true);
  });
  it('B15 missing matching D cutoff proof is unavailable, never NO_MATCH or history authority', async () => {
    await render({ cutoff: Y }); await tick();
    await act(async () => { await latest.previous.owner.ensure(['bench']); });
    expect(latest.d.input.publication).toBeNull(); expect(latest.d.input.entries).toEqual([]);
    expect(latest.model.history).toBe('UNAVAILABLE');
  });
  it('B16 query retirement revokes D evidence permanently', async () => {
    await render(); await act(async () => { await latest.previous.owner.ensure(['bench']); }); await tick();
    const old = latest.d, port = latest.previous;
    await render({ date: Y }); await tick(); await render(); await tick();
    expect(old.isCurrent()).toBe(false); expect(port.captureOwnerEvidence()).toBeNull();
  });
  it.each([false, true])('B17 D ordinary failure differs from injected typed rejection (not a claimed legacy production path): typed=%s', async typed => {
    mocks.previous.mockRejectedValue(typed ? new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH') : new Error('ordinary'));
    await render(); await act(async () => { await latest.previous.owner.ensure(['bench']); }); await tick();
    expect(latest.d.input.rejected).toBe(typed);
    if (!typed) { expect(latest.d.input.entries[0]?.evidence.state).toBe('UNAVAILABLE'); expect(latest.d.retry.disposition.state).toBe('UNKNOWN'); }
    else expect(latest.d.input.entries).toEqual([]);
  });
  it('B18 current APIs cannot prove finite eligible retry: do not manufacture a permit from raw retry', async () => {
    mocks.dayOpen.mockRejectedValue(new Error('unclassified open failure'));
    await render(); await tick(); expect(latest.b1.retryClassification).toEqual({ state: 'UNKNOWN', reason: 'FINITE_PERMIT_NOT_EXPOSED' });
    expect(latest.model.retry.owners.B1.state).toBe('UNSUPPORTED_CLASSIFICATION');
    expect(latest.b1.retry.disposition).not.toHaveProperty('permit');
  });
  it('retains deterministic non-payload codes at the actual B1/range/D catch boundaries', async () => {
    const error = new LocalDatabaseError('MALFORMED_METADATA', 'private_payload_operation');
    mocks.dayOpen.mockRejectedValue(error);
    mocks.rangeOpen.mockImplementation(async account => ({ ...reader(account, true),
      verifyCurrentScope: vi.fn().mockRejectedValue(error) }));
    mocks.previous.mockRejectedValue(error);
    await render(); await act(async () => { await latest.previous.owner.ensure(['bench']); }); await tick();
    for (const lane of [latest.b1, latest.r, latest.d]) {
      expect(lane.retryClassification).toEqual({ state: 'DETERMINISTICALLY_BLOCKED', reasonCode: 'MALFORMED_METADATA' });
      expect(lane.retry.disposition).toEqual({ state: 'BLOCKED', reasonCode: 'MALFORMED_METADATA' });
      expect(JSON.stringify(lane.retry)).not.toContain('private_payload');
    }
    for (const port of [latest.day, latest.range, latest.previous])
      expect(port.captureOwnerEvidence!()!.data.failures).toEqual([{ kind: 'DETERMINISTIC', reasonCode: 'MALFORMED_METADATA' }]);
    // No invented legacy isolation path: an ordinary typed failure does not set D rejection.
    expect(latest.d.input.rejected).toBe(false);
  });
  it('non-deterministic typed codes remain unclassified, never transient finite authority', () => {
    expect(adapters.observeOwnerFailure(new LocalDatabaseError('OPEN_FAILED', 'private')))
      .toEqual({ kind: 'UNCLASSIFIED', reasonCode: 'OPEN_FAILED' });
    expect(adapters.observeOwnerFailure({ code: 'MALFORMED_METADATA', message: 'private' }))
      .toEqual({ kind: 'UNCLASSIFIED', reasonCode: 'UNKNOWN' });
  });
  it('B19 current active flights deny another retry for all three owners', async () => {
    const read = deferred<HealthRecoveryDatasets>(), previous = deferred<Record<string, never>>();
    mocks.readAll.mockReturnValue(read.promise); mocks.previous.mockReturnValue(previous.promise);
    await render(); await act(async () => { void latest.previous.owner.ensure(['bench']); }); await tick();
    for (const lane of [latest.b1, latest.r, latest.d]) {
      expect(lane.retryClassification.state).toBe('CURRENT_FLIGHT_ACTIVE'); expect(lane.retry.disposition.state).toBe('IN_FLIGHT');
    }
    await act(async () => { read.resolve(datasets()); previous.resolve({}); }); await tick();
  });
  it('B20 consumed/remaining user permit is not observable: repeated classification remains denied, never resets a budget', async () => {
    mocks.dayOpen.mockRejectedValue(new Error('unknown'));
    await render(); await tick(); const before = counts(), publication = latest.b1.ownerPublication;
    for (let n = 0; n < 20; n++) {
      const result = adapters.adaptSelectedDayOwner(latest.day, latest.context);
      expect(result.retry.disposition.state).toBe('UNKNOWN'); expect(result.ownerPublication).toBe(publication);
    }
    expect(counts()).toEqual(before);
  });
  it('B21 UNKNOWN source failure cannot acquire eligibility from a healthy sibling', async () => {
    mocks.dayOpen.mockRejectedValue(new Error('unknown')); await render(); await tick();
    expect(latest.r.retryClassification.state).toBe('RECOVERED'); expect(latest.b1.retry.disposition.state).toBe('UNKNOWN');
  });
  it('B22 retired/unmounted owners cannot return current observations', async () => {
    await render(); await tick(); const { day, range, previous } = latest;
    act(() => root!.unmount()); root = null;
    expect(day.captureOwnerEvidence!()).toBeNull(); expect(range.captureOwnerEvidence!()).toBeNull(); expect(previous.captureOwnerEvidence()).toBeNull();
  });
  it('B23 owner mismatch is denied even if the attached data looks valid', async () => {
    await render(); await tick(); const e = latest.day.captureOwnerEvidence!()!;
    const port = { captureOwnerEvidence: () => ({ ...e, owner: 'RANGE' }) } as unknown as Parameters<typeof adapters.adaptSelectedDayOwner>[0];
    const result = adapters.adaptSelectedDayOwner(port, latest.context);
    expect(result.retryClassification.state).toBe('OWNER_MISMATCH'); expect(result.input.result).toBeNull();
  });
  it('B24 observations have no executable retry/consume route and do not invalidate or read', async () => {
    await render(); await tick(); const before = counts();
    for (let n = 0; n < 20; n++) {
      for (const value of [adapters.adaptSelectedDayOwner(latest.day, latest.context),
        adapters.adaptRangeOwner(latest.range, latest.rangeContext), adapters.adaptPreviousOwner(latest.previous, latest.context)]) {
        expect(value).not.toHaveProperty('request'); expect(value).not.toHaveProperty('consumePermit');
        expect(value.isCurrent()).toBe(true);
      }
    }
    expect(counts()).toEqual(before);
  });
  it('B26 late pre-retirement completion cannot publish over the new date', async () => {
    const gate = deferred<HealthRecoveryDatasets>(); mocks.readAll.mockReturnValueOnce(gate.promise);
    await render(); const old = latest.day;
    await render({ date: Y }); await tick();
    await act(async () => gate.resolve(datasets())); await tick();
    expect(old.captureOwnerEvidence!()).toBeNull(); expect(latest.b1.input.localDate).toBe(Y);
    expect(latest.b1.input.result?.records.every(row => row.localDate === Y)).toBe(true);
  });
  it('B27 owner publications are independent; B1 retry does not renew range or D', async () => {
    await render(); await tick(); const range = latest.r.ownerPublication, d = latest.d.ownerPublication;
    expect(new Set([latest.b1.ownerPublication, range, d]).size).toBe(3);
    act(() => latest.day.retry()); await tick(); expect(latest.r.ownerPublication).toBe(range); expect(latest.d.ownerPublication).toBe(d);
  });
  it('B28 consumer payload/booleans cannot fabricate owner or parent authority', async () => {
    await render(); await tick();
    const forged = { ...latest.day, result: null, legacyDaily: null, isolationError: false };
    expect(adapters.adaptSelectedDayOwner(forged, latest.context).input.result).toBe(latest.day.result);
    expect(adapters.adaptSelectedDayOwner({ ...latest.day, captureOwnerEvidence: undefined }, latest.context).input.result).toBeNull();
    expect(adapters.adaptSelectedDayOwner(latest.day, { ...latest.context, boundScope: null }).input.publication).toBeNull();
  });
  it('B30 OFF creates zero new source/listener/retry activity', async () => {
    const win = vi.spyOn(window, 'addEventListener'), doc = vi.spyOn(document, 'addEventListener');
    await render({ enabled: false }); await tick();
    expect(counts()).toEqual([0, 0, 0, 0, 0, 0, 0]); expect(latest.model.shell).toBe('DISABLED');
    expect(win.mock.calls.filter(([name]) => ['focus', 'owner-adapter-bootstrap'].includes(name))).toHaveLength(0);
    expect(doc.mock.calls.filter(([name]) => name === 'visibilitychange')).toHaveLength(0);
    expect(latest.day.captureOwnerEvidence!()).toBeNull(); expect(latest.range.captureOwnerEvidence!()).toBeNull();
  });
  it('observation budget probe: existing reads/listeners/invalidations/storage writes remain exact', async () => {
    const win = vi.spyOn(window, 'addEventListener'), doc = vi.spyOn(document, 'addEventListener');
    const write = vi.spyOn(window.localStorage, 'setItem');
    const rangeInvalidation = vi.spyOn(WorkoutReadSnapshotCoordinator.prototype, 'invalidate');
    const dInvalidation = vi.spyOn(LegacyPreviousCurrentness.prototype, 'invalidate');
    await render(); await act(async () => { await latest.previous.owner.ensure(['bench']); }); await tick();
    const initial = counts();
    expect(initial).toEqual([2, 2, 1, 1, 1, 1, 1]);
    const before = [rangeInvalidation.mock.calls.length, dInvalidation.mock.calls.length];
    expect(before).toEqual([1, 0]);
    for (let n = 0; n < 20; n++) {
      adapters.adaptSelectedDayOwner(latest.day, latest.context);
      adapters.adaptRangeOwner(latest.range, latest.rangeContext);
      adapters.adaptPreviousOwner(latest.previous, latest.context);
    }
    expect(counts()).toEqual(initial);
    expect([rangeInvalidation.mock.calls.length, dInvalidation.mock.calls.length]).toEqual(before);
    act(() => { latest.day.retry(); latest.range.invalidateAndReload(); latest.previous.owner.invalidate(); }); await tick();
    expect(counts()).toEqual([4, 4, 1, 2, 2, 2, 2]);
    expect([rangeInvalidation.mock.calls.length, dInvalidation.mock.calls.length]).toEqual([3, 1]);
    expect(win.mock.calls.filter(([name]) => name === 'focus')).toHaveLength(1);
    expect(win.mock.calls.filter(([name]) => name === 'owner-adapter-bootstrap')).toHaveLength(1);
    expect(doc.mock.calls.filter(([name]) => name === 'visibilitychange')).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('F1-P1 source evidence at real mounted owner/coordinator boundaries', () => {
  // Rejected source seams below are deliberate faults, NOT proof of a production
  // transient producer. Legacy projection/isolation and orchestration run normally.
  const observations = (owner: 'B1' | 'RANGE') => owner === 'B1'
    ? latest.day.captureOwnerEvidence!()!.data.sourceFailures!
    : latest.range.captureOwnerEvidence!()!.data.sourceFailures!;
  const failure = (owner: 'B1' | 'RANGE', source: 'LEGACY' | 'CANONICAL', reasonCode = 'UNKNOWN', kind = 'UNCLASSIFIED') => (
    { owner, source, boundary: 'READ', disposition: { kind, reasonCode } }
  );
  function exactEvidence(actual: unknown, expected: unknown) { expect(actual).toEqual(expected); }

  it('P1-C03/C04 keeps simultaneous B1 failures, and healthy partial canonical never clears legacy failure', async () => {
    mocks.readAll.mockRejectedValue(new Error('private'));
    mocks.dayCanonical.mockRejectedValueOnce(new LocalDatabaseError('MALFORMED_METADATA', 'private'));
    await render(); await tick();
    exactEvidence(observations('B1'), [failure('B1', 'LEGACY'), failure('B1', 'CANONICAL', 'MALFORMED_METADATA', 'DETERMINISTIC')]);
    expect(latest.b1.retryClassification.state).toBe('DETERMINISTICALLY_BLOCKED');
    act(() => latest.day.retry()); await tick();
    exactEvidence(observations('B1'), [failure('B1', 'LEGACY')]);
    expect(latest.day.result).toMatchObject({ status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success' });
    expect(latest.b1.retryClassification.state).toBe('UNKNOWN');
  });
  it('P1-C05 actual legacy row account-check preserves typed isolation and whole-pair veto', async () => {
    mocks.readAll.mockResolvedValueOnce(datasets('foreign-account'));
    await render(); await tick();
    exactEvidence(observations('B1'), [failure('B1', 'LEGACY', 'ACCOUNT_MISMATCH', 'ISOLATION')]);
    expect(latest.day).toMatchObject({ isolationError: true, result: null, legacyDaily: null });
    expect(latest.b1.retryClassification.state).toBe('ISOLATION_BLOCKED');
    expect(latest.day.captureOwnerEvidence!()!.data.canonicalScope).toBeNull();
  });
  it('P1-C06/C11/C18 plain/forged/open errors remain UNCLASSIFIED, never positive', async () => {
    const plain = Object.assign(new Error('payload'), { code: 'MALFORMED_METADATA', retryEligible: true });
    mocks.readAll.mockRejectedValue(plain);
    mocks.dayCanonical.mockRejectedValue(new LocalDatabaseError('OPEN_FAILED', 'private'));
    mocks.rangeCanonical.mockRejectedValue(new LocalDatabaseError('OPEN_BLOCKED', 'private'));
    await render(); await tick();
    expect(observations('B1').map(o => o.disposition)).toEqual([
      { kind: 'UNCLASSIFIED', reasonCode: 'UNKNOWN' }, { kind: 'UNCLASSIFIED', reasonCode: 'OPEN_FAILED' },
    ]);
    expect(observations('RANGE').map(o => o.disposition)).toEqual([
      { kind: 'UNCLASSIFIED', reasonCode: 'UNKNOWN' }, { kind: 'UNCLASSIFIED', reasonCode: 'OPEN_BLOCKED' },
    ]);
    expect([latest.b1.retryClassification.state, latest.r.retryClassification.state]).toEqual(['UNKNOWN', 'UNKNOWN']);
  });
  it('P1-C07 B1 whole-pair currentness recovery remains exactly two pairs, no invented error', async () => {
    mocks.dayOpen.mockImplementation(async account => ({ ...reader(account),
      verifyCurrentScope: vi.fn(async () => { throw new LocalDatabaseError('STALE_GENERATION', 'scope'); }) }));
    await render(); await tick();
    expect(mocks.dayOpen).toHaveBeenCalledTimes(2); expect(mocks.dayCanonical).toHaveBeenCalledTimes(2);
    expect(latest.day).toMatchObject({ phase: 'settled', result: null });
    exactEvidence(observations('B1'), []);
    expect(mocks.rangeCanonical).toHaveBeenCalledTimes(1);
  });
  it('P1-C08 late pre-retry failure cannot append evidence to the new B1 publication', async () => {
    const old = deferred<HealthRecoveryDatasets>(); mocks.readAll.mockReturnValueOnce(old.promise);
    await render(); const held = latest.day.captureOwnerEvidence!()!;
    act(() => latest.day.retry()); await tick();
    const current = latest.day.captureOwnerEvidence!()!;
    expect(held.isCurrent()).toBe(false);
    await act(async () => old.reject(new Error('old private error'))); await tick();
    expect(latest.day.captureOwnerEvidence!()!.publication).toBe(current.publication);
    exactEvidence(observations('B1'), []);
  });
  it('P1-C12 RANGE scope distrust is still a terminal negative, not salvaged source success', async () => {
    mocks.rangeOpen.mockImplementation(async account => ({ ...reader(account, true),
      verifyCurrentScope: vi.fn(async () => { throw new LocalDatabaseError('MALFORMED_METADATA', 'scope'); }) }));
    await render(); await tick();
    expect(latest.range).toMatchObject({ phase: 'settled', previousView: null, monthView: null });
    expect(latest.r.retryClassification.state).toBe('DETERMINISTICALLY_BLOCKED');
    exactEvidence(observations('RANGE'), [{ owner: 'RANGE', source: 'PAIR_OWNER', boundary: 'LOAD',
      disposition: { kind: 'DETERMINISTIC', reasonCode: 'MALFORMED_METADATA' } }]);
  });
  it('P1-C13/C16 diagnostic metadata cannot change partial coverage, absence or existing retry precedence', async () => {
    mocks.rangeCanonical.mockRejectedValue(new LocalDatabaseError('MALFORMED_METADATA', 'private'));
    await render(); await tick();
    exactEvidence(observations('RANGE'), [failure('RANGE', 'CANONICAL', 'MALFORMED_METADATA', 'DETERMINISTIC')]);
    expect(latest.range.monthView?.result).toMatchObject({ status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error' });
    // Diagnostics intentionally do not retroactively change the old retry input.
    expect(latest.range.captureOwnerEvidence!()!.data.failures).toEqual([]);
    expect(latest.r.retryClassification.state).toBe('UNKNOWN');
    expect(latest.range.monthView?.result.records.every(r => r.source === 'legacy')).toBe(true);
  });
  it('P1-C14 allSettled still waits for both lanes and keeps LEGACY/CANONICAL order, not completion order', async () => {
    const legacy = deferred<HealthRecoveryDatasets>(); mocks.readAll.mockReturnValue(legacy.promise);
    mocks.rangeCanonical.mockRejectedValue(new Error('canonical first'));
    await render(); await tick(); expect(latest.range.phase).toBe('loading');
    await act(async () => legacy.reject(new Error('legacy later'))); await tick();
    exactEvidence(observations('RANGE'), [failure('RANGE', 'LEGACY'), failure('RANGE', 'CANONICAL')]);
    expect(mocks.readAll).toHaveBeenCalledTimes(2); expect(mocks.rangeCanonical).toHaveBeenCalledTimes(1);
  });
  it('P1-C15 existing B1 opening coalesces and RANGE bounds derivation does not rescan', async () => {
    const open = deferred<ReturnType<typeof reader>>(); mocks.dayOpen.mockReturnValueOnce(open.promise);
    await render(); act(() => latest.day.retry()); await tick(); expect(mocks.dayOpen).toHaveBeenCalledTimes(1);
    await act(async () => open.resolve(reader('a'))); await tick();
    const before = [mocks.readAll.mock.calls.length, mocks.rangeCanonical.mock.calls.length];
    await render({ date: Y }); await tick();
    expect(mocks.rangeCanonical).toHaveBeenCalledTimes(before[1]!);
    expect(mocks.readAll.mock.calls.length).toBe(before[0]! + 1); // B1 date pair only
  });
  it('P1-C17 D keeps its old interface, rejection and unavailable semantics; no sibling evidence', async () => {
    mocks.readAll.mockRejectedValue(new Error('B1/RANGE failure'));
    mocks.previous.mockRejectedValue(new Error('LOCAL D failure'));
    await render(); await act(async () => { await latest.previous.owner.ensure(['bench']); }); await tick();
    const evidence = latest.previous.captureOwnerEvidence!()!;
    expect(evidence.data).not.toHaveProperty('sourceFailures');
    expect(evidence.data.entries[0]?.state).toBe('UNAVAILABLE');
    expect(latest.d.retryClassification.state).toBe('UNKNOWN');
    await render({ rejected: true }); await tick(); expect(latest.d.input.rejected).toBe(true);
  });
  it('P1-C19/C20/C24/C25/C29 observations are frozen bounded descriptions, not identities, payload or execution', async () => {
    const error = new LocalDatabaseError('OPEN_FAILED', 'account/user payload');
    Object.defineProperties(error, { message: { get: () => { throw Error('must not inspect message'); } },
      stack: { get: () => { throw Error('must not inspect stack'); } } });
    mocks.dayCanonical.mockRejectedValue(error); await render(); await tick();
    const observed = observations('B1'), before = counts();
    for (let n = 0; n < 20; n++) {
      expect(latest.day.captureOwnerEvidence!()!.data.sourceFailures).toBe(observed);
      expect(adapters.observeSourceFailure('B1', 'CANONICAL', 'READ', error)).toEqual(observed[0]);
    }
    expect(counts()).toEqual(before);
    expect(Object.keys(observed[0]!).sort()).toEqual(['boundary', 'disposition', 'owner', 'source']);
    expect(Object.keys(observed[0]!.disposition).sort()).toEqual(['kind', 'reasonCode']);
    expect(Object.isFrozen(observed)).toBe(true); expect(Object.isFrozen(observed[0])).toBe(true);
    expect(Object.isFrozen(observed[0]!.disposition)).toBe(true);
    expect(JSON.stringify(observed)).not.toMatch(/account\/user|message|stack|permit|allowance|episode|causeRef|retryEligible/i);
  });
  it.each(['account', 'date'] as const)('P1-C21 %s ABA retires old observation binding, including equal values', async kind => {
    mocks.readAll.mockRejectedValue(new Error('ordinary source failure'));
    await render(); await tick(); const held = latest.day.captureOwnerEvidence!()!;
    await render(kind === 'account' ? { accountId: 'b', generation: 2 } : { date: Y }); await tick();
    await render(kind === 'account' ? { generation: 3 } : {}); await tick();
    expect(held.isCurrent()).toBe(false);
    expect(latest.day.captureOwnerEvidence!()!.lifetime).not.toBe(held.lifetime);
    expect(observations('B1')).not.toBe(held.data.sourceFailures);
  });
  it('P1-C22 RANGE observed device retirement is permanent; unobserved ABA is still not causal proof', async () => {
    mocks.rangeCanonical.mockRejectedValue(new Error('unknown')); await render(); await tick();
    const held = latest.range.captureOwnerEvidence!()!, before = counts();
    const key = 'absinthe-health-routine-device-id:v1';
    window.localStorage.setItem(key, 'different-device'); window.localStorage.setItem(key, DEVICE);
    expect(held.isCurrent()).toBe(true); // wholly unobserved round trip remains the existing limitation
    expect(latest.r.retryClassification.state).toBe('UNKNOWN');
    window.localStorage.setItem(key, 'different-device'); expect(held.isCurrent()).toBe(false);
    window.localStorage.setItem(key, DEVICE); expect(held.isCurrent()).toBe(false);
    expect(counts()).toEqual(before);
  });
  it('P1-C23 detach plus late failure never revives the old owner observation', async () => {
    const old = deferred<HealthRecoveryDatasets>(); mocks.readAll.mockReturnValueOnce(old.promise);
    await render(); const held = latest.day.captureOwnerEvidence!()!;
    await act(async () => root!.unmount()); root = null;
    await act(async () => old.reject(new Error('late after detach'))); await tick();
    expect(held.isCurrent()).toBe(false);
    await render(); await tick(); exactEvidence(observations('B1'), []);
  });
  it('P1-C30 all five literal production reader gates remain OFF', () => {
    const gates = [
      ['health/healthSelectedDayCompositeConfig', 'HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED'],
      ['health/healthWorkoutRangeCompositeConfig', 'HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED'],
      ['health/healthExerciseComparisonPreviewConfig', 'HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED'],
      ['home/homeWorkoutCompositeConfig', 'HOME_WORKOUT_COMPOSITE_READER_ENABLED'],
      ['search/searchWorkoutCompositeConfig', 'SEARCH_WORKOUT_COMPOSITE_READER_ENABLED'],
    ];
    for (const [file, name] of gates) expect(readFileSync(resolve(`src/components/views/features/${file}.ts`), 'utf8'))
      .toContain(`export const ${name} = false;`);
  });

  // These are explicitly synthetic corruptions of observations captured from the
  // actual mounted pipeline. They test oracle sensitivity, not producer provenance.
  it.each(['N01', 'N02', 'N04', 'N05', 'N06', 'N07', 'N10', 'N14', 'N15', 'N16'] as const)(
    'P1-%s bounded evidence oracle rejects the named corruption', async id => {
      mocks.readAll.mockRejectedValue(new Error('private legacy'));
      mocks.dayCanonical.mockRejectedValue(new LocalDatabaseError('OPEN_FAILED', 'private canonical'));
      if (id === 'N06') mocks.rangeCanonical.mockRejectedValue(new LocalDatabaseError('OPEN_FAILED', 'private canonical'));
      await render(); await tick();
      const owner = id === 'N06' ? 'RANGE' : 'B1';
      const expected = [failure(owner, 'LEGACY'), failure(owner, 'CANONICAL', 'OPEN_FAILED')];
      exactEvidence(observations(owner), expected);
      const bad = structuredClone(observations(owner)) as Array<Record<string, any>>;
      if (id === 'N01') bad[0]!.source = 'CANONICAL';
      if (id === 'N02') bad[1]!.source = 'LEGACY';
      if (id === 'N04') bad[0]!.disposition.kind = 'TRANSIENT';
      if (id === 'N05') bad[1]!.disposition.kind = 'TRANSIENT';
      if (id === 'N06') delete bad[0]!.source;
      if (id === 'N07') bad[1] = structuredClone(bad[0]!);
      if (id === 'N10') bad[0]!.message = 'private legacy';
      if (id === 'N14') bad[0]!.causalEpisodeId = {};
      if (id === 'N15') bad[0]!.retryEligible = true;
      if (id === 'N16') bad[0]!.owner = 'RANGE';
      expect(() => exactEvidence(bad, expected)).toThrow();
    });
  it('P1-N03 partial success cannot erase its sibling observation', async () => {
    mocks.readAll.mockRejectedValueOnce(new Error('legacy only')); await render(); await tick();
    const expected = [failure('B1', 'LEGACY')]; exactEvidence(observations('B1'), expected);
    expect(latest.day.result?.canonicalStatus).toBe('success');
    expect(() => exactEvidence([], expected)).toThrow();
  });
  it('P1-N08/N09 retired proof or ABA-reused observation fails the same lifetime oracle', async () => {
    mocks.readAll.mockRejectedValue(new Error('unknown')); await render(); await tick();
    const old = latest.day.captureOwnerEvidence!()!;
    await render({ date: Y }); await render({}); await tick(); const current = latest.day.captureOwnerEvidence!()!;
    const oracle = (isCurrent: boolean, observed: unknown) => {
      expect(isCurrent).toBe(false); expect(observed).not.toBe(old.data.sourceFailures);
    };
    oracle(old.isCurrent(), current.data.sourceFailures);
    expect(() => oracle(true, current.data.sourceFailures)).toThrow();
    expect(() => oracle(false, old.data.sourceFailures)).toThrow();
  });
  it('P1-N13 diagnostic metadata cannot upgrade existing source coverage or trust', async () => {
    mocks.rangeCanonical.mockRejectedValue(new Error('canonical')); await render(); await tick();
    const oracle = (canonicalStatus: string | undefined, status: string | undefined) => {
      expect(canonicalStatus).toBe('error'); expect(status).toBe('partial_data');
    };
    oracle(latest.range.monthView?.result.canonicalStatus, latest.range.monthView?.result.status);
    expect(() => oracle('success', 'complete_empty')).toThrow();
  });
});

describe('R01/R02 real coordinator and committed-layout proof boundaries', () => {
  const pb = { startDate: '2025-10-15', endDate: '2026-10-14' };
  const mb = { startDate: '2026-10-01', endDate: '2026-10-31' };
  const realHooks = { day: useHealthSelectedDayComposite, range: useHealthWorkoutRangeSnapshot };
  type Hooks = typeof realHooks;
  // Candidate-only in-memory mutations. No faulty source is written to disk.
  function faultyHook<K extends keyof Hooks>(key: K, needle: string, replacement: string): Hooks[K] {
    const file = key === 'day' ? 'useHealthSelectedDayComposite' : 'useHealthWorkoutRangeSnapshot';
    const source = readFileSync(resolve(`src/components/views/features/health/${file}.ts`), 'utf8').replace(/\r\n/g, '\n');
    expect(source.split(needle)).toHaveLength(2);
    const code = transpileModule(source.replace(needle, replacement), {
      compilerOptions: { module: ModuleKind.CommonJS },
    }).outputText;
    const exports: Record<string, unknown> = {};
    const modules: Record<string, unknown> = {
      react: React,
      '../../../../lib/healthSupabaseBootstrap': { HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'owner-adapter-bootstrap' },
      '../../../../lib/localDatabase/errors': { LocalDatabaseError },
      '../../../../lib/workoutSelectedDayReader': dayReaderModule,
      './compositeWorkoutReadProjection': projectionModule,
      './selectedDayLegacySnapshot': legacySnapshotModule,
      './healthExerciseComparisonBorrower': comparisonBorrowerModule,
      './verifiedWorkoutRangeSnapshot': { WorkoutReadSnapshotCoordinator },
      './healthWorkoutOwnerAdapters': adapters,
    };
    new Function('exports', 'require', code)(exports, (id: string) => {
      if (!(id in modules)) throw Error(`unexpected hook mutation import: ${id}`);
      return modules[id];
    });
    return exports[file] as Hooks[K];
  }
  async function lifecycle(hooks = realHooks, strict = false) {
    const wait = deferred<void>();
    let ports!: Pick<typeof latest, 'day' | 'range' | 'previous'>;
    let parentCurrent = false, speculativeAttempt = false;
    let atLayout: boolean[] = [], nullAtLayout: boolean[] = [];
    let passiveCleaned = false, passiveAtLayout = true;
    const evidence = () => [ports.day.captureOwnerEvidence!(), ports.range.captureOwnerEvidence!(), ports.previous.captureOwnerEvidence()];
    function Sources({ suspend, date }: { suspend: boolean; date: string }) {
      const day = hooks.day(true, 'a', date, { managedLifecycle: true });
      const range = hooks.range(true, 'a', { ...pb, endDate: date === X ? pb.endDate : X }, mb);
      const previous = useLegacyPreviousCurrentness(true, {
        accountId: 'a', beforeDate: X, authority: 'local', parentIdentity: null, rejected: false,
      });
      useLayoutEffect(() => () => {
        passiveAtLayout = passiveCleaned;
        atLayout = held.map(value => value.isCurrent());
        nullAtLayout = evidence().map(value => value === null);
      }, []);
      React.useEffect(() => () => { passiveCleaned = true; }, []);
      if (suspend) { speculativeAttempt = true; throw wait.promise; }
      ports = { day, range, previous };
      return createElement('div', null, 'sources');
    }
    function Parent({ show, suspend, date }: { show: boolean; suspend: boolean; date: string }) {
      const parent = useHealthWorkoutOperationLifetime('a', 1, X);
      parentCurrent = parent.getCurrent() !== null;
      return createElement(Suspense, { fallback: createElement('div', null, 'fallback') },
        show ? createElement(Sources, { suspend, date }) : null);
    }
    const draw = (show = true, suspend = false, date = X) => {
      const tree = createElement(Parent, { show, suspend, date });
      root ??= createRoot(host);
      root.render(strict ? createElement(StrictMode, null, tree) : tree);
    };
    // StrictMode's initial cleanup runs before any source result exists.
    let held: NonNullable<ReturnType<typeof evidence>[number]>[] = [];
    await act(async () => draw()); await tick();
    held = evidence().map(value => { expect(value).not.toBeNull(); return value!; });
    expect(held.map(value => value.isCurrent())).toEqual([true, true, true]);
    passiveCleaned = false;
    return { draw, wait, held, evidence,
      state: () => ({ parentCurrent, speculativeAttempt, atLayout, nullAtLayout, passiveAtLayout }) };
  }
  it('R01-C01–C06 consumes exact existing device fence without external proof checks or extra metadata IO', async () => {
    await render(); await tick();
    const held = latest.r, port = latest.range;
    const fence = vi.spyOn(WorkoutReadSnapshotCoordinator.prototype, 'captureCurrentSnapshot');
    const get = vi.spyOn(window.localStorage, 'getItem');
    const before = counts();
    expect(held.isCurrent()).toBe(true);
    expect(get.mock.calls).toEqual([['absinthe-health-routine-device-id:v1']]);
    expect(fence).not.toHaveBeenCalled(); // Already captured once at source publication.
    window.localStorage.setItem('absinthe-health-routine-device-id:v1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(held.isCurrent()).toBe(false);
    expect(port.captureOwnerEvidence!()).toBeNull();
    window.localStorage.setItem('absinthe-health-routine-device-id:v1', DEVICE);
    expect(held.isCurrent()).toBe(false); expect(port.captureOwnerEvidence!()).toBeNull();
    expect(counts()).toEqual(before);
  });
  it('R02-C01/C02/C03/C07 rejects all held source closures in child layout cleanup with parent still mounted', async () => {
    const run = await lifecycle();
    await act(async () => run.draw(false));
    expect(run.state()).toMatchObject({ parentCurrent: true, passiveAtLayout: false,
      atLayout: [false, false, false], nullAtLayout: [true, true, true] });
  });
  it.each([false, true])('R02-C04/C05/C06/C10 Suspense reconnect retires permanently and issues fresh proof; StrictMode=%s', async strict => {
    const run = await lifecycle(realHooks, strict), before = counts();
    act(() => flushSync(() => run.draw(true, true)));
    expect(host.textContent).toContain('fallback');
    expect(run.state().atLayout).toEqual([false, false, false]);
    expect(run.state().passiveAtLayout).toBe(false);
    expect(run.held.map(value => value.isCurrent())).toEqual([false, false, false]);
    await act(async () => { run.draw(); run.wait.resolve(); }); await tick();
    expect(run.held.map(value => value.isCurrent())).toEqual([false, false, false]);
    const fresh = run.evidence();
    for (let i = 0; i < 2; i++) {
      expect(fresh[i]!.isCurrent()).toBe(true);
      expect(fresh[i]!.lifetime).not.toBe(run.held[i]!.lifetime);
      expect(fresh[i]!.publication).not.toBe(run.held[i]!.publication);
    }
    // Normal reconnection binds proof without IO. Development StrictMode also
    // replays the EXISTING passive source effects: one paired source episode.
    expect(counts()).toEqual(strict ? before.map((value, i) => value + [2, 2, 1, 1, 1, 1, 0][i]!) : before);
  });
  it('R02-C08 late completion while layout-disconnected cannot restore the retired proof', async () => {
    const pending = deferred<HealthRecoveryDatasets>(); mocks.readAll.mockReturnValue(pending.promise);
    const run = await lifecycle();
    act(() => flushSync(() => run.draw(true, true)));
    await act(async () => pending.resolve(datasets())); await tick();
    expect(run.held.map(value => value.isCurrent())).toEqual([false, false, false]);
    await act(async () => { run.draw(); run.wait.resolve(); }); await tick();
    expect(run.held.map(value => value.isCurrent())).toEqual([false, false, false]);
    expect(run.evidence().slice(0, 2).map(value => value!.isCurrent())).toEqual([true, true]);
  });
  it('R02-C09 abandoned speculative date render cannot revoke committed proof or start source IO', async () => {
    const run = await lifecycle(), before = counts();
    act(() => startTransition(() => run.draw(true, true, Y))); await tick();
    expect(run.state().speculativeAttempt).toBe(true);
    expect(host.textContent).not.toContain('fallback');
    expect(run.held.map(value => value.isCurrent())).toEqual([true, true, true]);
    await act(async () => { run.draw(); run.wait.resolve(); }); await tick();
    expect(run.held.map(value => value.isCurrent())).toEqual([true, true, true]);
    expect(counts()).toEqual(before);
  });
  it('negative control: removing coordinator fence fails the same device authority oracle', async () => {
    const range = faultyHook('range', '&& bound.coordinatorPublication.isCurrent()', '&& true');
    const run = await lifecycle({ ...realHooks, range });
    window.localStorage.setItem('absinthe-health-routine-device-id:v1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const oracle = () => expect(run.held[1]!.isCurrent()).toBe(false);
    expect(run.held[1]!.isCurrent()).toBe(true); expect(oracle).toThrow(/false/);
  });
  it.each(['passive', 'revival'] as const)('negative control: %s retirement fails the matching real layout authority oracle', async mode => {
    const mutate = <K extends keyof Hooks>(key: K) => mode === 'revival'
      ? faultyHook(key, 'connectionRef.current === connection', '!!connectionRef.current')
      : faultyHook(key, key === 'day' ? 'useLayoutEffect(() => {\n    // Proof authority' : 'useLayoutEffect(() => {\n    // Revoke proof',
        key === 'day' ? 'useEffect(() => {\n    // Proof authority' : 'useEffect(() => {\n    // Revoke proof');
    const run = await lifecycle({ day: mutate('day'), range: mutate('range') });
    act(() => flushSync(() => run.draw(true, true)));
    if (mode === 'revival') {
      await act(async () => { run.draw(); run.wait.resolve(); }); await tick();
    }
    const actual = run.held.slice(0, 2).map(value => value.isCurrent());
    const oracle = () => expect(actual).toEqual([false, false]);
    expect(actual).toEqual([true, true]); expect(oracle).toThrow(/false/);
  });
});

describe('targeted same-oracle negative controls', () => {
  function fault(needle: string, replacement: string): typeof adapters {
    const source = readFileSync(resolve('src/components/views/features/health/healthWorkoutOwnerAdapters.ts'), 'utf8');
    expect(source.split(needle)).toHaveLength(2);
    const code = transpileModule(source.replace(needle, replacement), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('exports', 'require', code)(exports, (id: string) => {
      if (id === './compositeWorkoutReadProjection') return { CompositeWorkoutReadIsolationError };
      if (id === '../../../../lib/localDatabase/errors') return { LocalDatabaseError };
      throw Error(`unexpected negative-control import: ${id}`);
    });
    return exports as typeof adapters;
  }
  it('detects stale publication acceptance using real retired B1 evidence', async () => {
    await render(); await tick(); const e = latest.day.captureOwnerEvidence!()!, context = latest.context;
    act(() => latest.day.retry()); await tick(); const held = { captureOwnerEvidence: () => e };
    const oracle = (module: typeof adapters) => expect(module.adaptSelectedDayOwner(held, context).input.result).toBeNull();
    oracle(adapters);
    const mutant = fault('evidence.owner === owner && evidence.isCurrent()', 'evidence.owner === owner');
    expect(mutant.adaptSelectedDayOwner(held, context).input.result).not.toBeNull();
    expect(() => oracle(mutant)).toThrow(/null/);
  });
  it('detects cross-owner authority promotion independently of the data values', async () => {
    await render(); await tick(); const e = latest.day.captureOwnerEvidence!()!;
    const held = { captureOwnerEvidence: () => ({ ...e, owner: 'RANGE' }) } as unknown as Parameters<typeof adapters.adaptSelectedDayOwner>[0];
    const oracle = (module: typeof adapters) => expect(module.adaptSelectedDayOwner(held, latest.context).input.result).toBeNull();
    oracle(adapters);
    const mutant = fault('evidence.owner === owner && evidence.isCurrent()', 'evidence.isCurrent()');
    expect(mutant.adaptSelectedDayOwner(held, latest.context).input.result).not.toBeNull();
    expect(() => oracle(mutant)).toThrow(/null/);
  });
  it('detects UNKNOWN-to-finite-permit promotion with an actual unknown owner failure', async () => {
    mocks.dayOpen.mockRejectedValue(new Error('unclassified')); await render(); await tick();
    const oracle = (module: typeof adapters) => expect(module.adaptSelectedDayOwner(latest.day, latest.context).retry.disposition.state).toBe('UNKNOWN');
    oracle(adapters);
    const mutant = fault("{ state: 'UNKNOWN' as const },", "{ state: 'TRANSIENT' as const, episode: evidence!.request!, permit: evidence!.publication, currentPermit: evidence!.publication },");
    expect(mutant.adaptSelectedDayOwner(latest.day, latest.context).retry.disposition.state).toBe('TRANSIENT');
    expect(() => oracle(mutant)).toThrow(/UNKNOWN/);
  });
  it('P1-N15 same retry oracle detects promoting retained observation into episode/permit authority', async () => {
    mocks.dayOpen.mockRejectedValue(new Error('unclassified source')); await render(); await tick();
    expect(latest.day.captureOwnerEvidence!()!.data.sourceFailures).toHaveLength(1);
    const oracle = (module: typeof adapters) => expect(module.adaptSelectedDayOwner(latest.day, latest.context).retry.disposition.state).toBe('UNKNOWN');
    oracle(adapters);
    const mutant = fault("{ state: 'UNKNOWN' as const },",
      "((evidence?.data as SelectedDayOwnerData | undefined)?.sourceFailures?.length ? { state: 'TRANSIENT' as const, episode: (evidence!.data as SelectedDayOwnerData).sourceFailures![0], permit: evidence!.publication, currentPermit: evidence!.publication } : { state: 'UNKNOWN' as const }),");
    expect(mutant.adaptSelectedDayOwner(latest.day, latest.context).retry.disposition.state).toBe('TRANSIENT');
    expect(() => oracle(mutant)).toThrow(/UNKNOWN/);
  });
});
