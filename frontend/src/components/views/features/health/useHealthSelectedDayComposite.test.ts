// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import { LocalDatabaseError } from '../../../../lib/localDatabase/errors';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';
import type { HealthSelectedDayReadModel } from './useHealthSelectedDayComposite';

const mocks = vi.hoisted(() => ({
  legacy: vi.fn(), open: vi.fn(), device: vi.fn(() => 'device-1'),
}));
vi.mock('./selectedDayLegacySnapshot', () => ({ loadVerifiedSelectedDayLegacySnapshot: mocks.legacy }));
vi.mock('../../../../lib/workoutSelectedDayReader', () => ({
  WorkoutSelectedDayReader: { open: mocks.open },
  readEstablishedWorkoutDeviceId: mocks.device,
}));
vi.mock('../../../../lib/healthSupabaseBootstrap', () => ({
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete',
}));

import { selectedDayCompositeKey, useHealthSelectedDayComposite } from './useHealthSelectedDayComposite';

const DATE = '2026-09-29';
const ID = '11111111-1111-4111-8111-111111111111';
const session: WorkoutSessionV1 = { version: 1, id: ID, localDate: DATE, entries: [{
  id: '22222222-2222-4222-8222-222222222222',
  exercise: { id: 'old', name: 'Frozen', type: 'strength', tags: [], cardioMode: null },
  sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength',
    loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8,
    assistedReps: null, dropset: false, done: true }],
}] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(value => { resolve = value; });
  return { promise, resolve };
}

function paired(rowId = 'legacy-1', accountId = 'account-a', localDate = DATE) {
  return { daily: { workouts: [{ id: rowId, block_id: 'old', exercise_blocks: {
    id: 'old', name: 'Legacy', type: 'strength', tags: [],
  }, sets: [] }], inbody: { weight: null, smm: null, pbf: null }, routines: [] },
  persistedRows: [{ accountId, rowId, localDate, blockId: 'old', sortOrder: 0,
    exerciseDisplay: { kind: 'current_catalog', block: { id: 'old', name: 'Legacy', type: 'strength', tags: [] } },
    sets: [] }],
  };
}

function reader(accountId = 'account-a') {
  return { accountId, deviceId: 'device-1',
    scope: { accountId, deviceId: 'device-1', namespaceKey: `namespace-${accountId}`, generationId: 'g1' },
    read: vi.fn(async () => [{ accountId, namespaceKey: `namespace-${accountId}`, generationId: 'g1',
      entityId: ID, localRevision: 1, session }]), verifyCurrentScope: vi.fn(async () => undefined), close: vi.fn() };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let latest: HealthSelectedDayReadModel;
function Harness({ enabled = true, accountId = 'account-a', date = DATE, managedLifecycle = false }: {
  enabled?: boolean; accountId?: string; date?: string; managedLifecycle?: boolean;
}) {
  latest = useHealthSelectedDayComposite(enabled, accountId, date, { managedLifecycle });
  return createElement('div', { 'data-phase': latest.phase });
}
async function render(props: Parameters<typeof Harness>[0]) {
  await act(async () => {
    root ??= createRoot(host!);
    root.render(createElement(Harness, props));
  });
}
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host);
  mocks.legacy.mockReset().mockResolvedValue(paired());
  mocks.open.mockReset().mockResolvedValue(reader());
  mocks.device.mockReset().mockReturnValue('device-1');
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null; host?.remove(); host = null;
});

describe('gated selected-day composite orchestration', () => {
  it('does not start local reads when the static gate is OFF', async () => {
    await render({ enabled: false });
    await flush();
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('publishes mixed source-qualified records and reuses the fixed scope key on retry', async () => {
    await render({}); await flush();
    expect(latest.result?.status).toBe('complete');
    expect(latest.result?.records.map(record => record.source)).toEqual(['canonical', 'legacy']);
    const key = latest.cacheKey;
    expect(key).toEqual(selectedDayCompositeKey(reader().scope, DATE));
    await act(async () => latest.retry()); await flush();
    expect(latest.cacheKey).toEqual(key);
    expect(mocks.open).toHaveBeenCalledTimes(1);
    expect(mocks.legacy).toHaveBeenCalledTimes(2);
  });

  it('keeps valid canonical data when legacy fails and valid legacy data when canonical fails', async () => {
    mocks.legacy.mockRejectedValueOnce(new Error('legacy unavailable'));
    await render({}); await flush();
    expect(latest.result).toMatchObject({ status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success' });
    expect(latest.legacyDaily).toBeNull();
    const current = await mocks.open.mock.results[0]!.value;
    current.read.mockRejectedValueOnce(new Error('canonical unavailable'));
    await act(async () => latest.retry()); await flush();
    expect(latest.result).toMatchObject({ status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error' });
    expect(latest.legacyDaily?.workouts).toHaveLength(1);
  });

  it('never turns both-source errors into complete empty or a legacy draft', async () => {
    mocks.legacy.mockRejectedValue(new Error('legacy unavailable'));
    mocks.open.mockRejectedValue(new Error('canonical unavailable'));
    await render({}); await flush();
    expect(latest.result).toMatchObject({ status: 'error', legacyStatus: 'error', canonicalStatus: 'error', records: [] });
    expect(latest.legacyDaily).toBeNull();
  });

  it('discards a pre-save request after synchronous invalidation, including its daily projection', async () => {
    const first = deferred<ReturnType<typeof paired>>();
    mocks.legacy.mockReturnValueOnce(first.promise).mockResolvedValue(paired('new-row'));
    await render({});
    await act(async () => latest.retry()); await flush();
    expect(latest.legacyDaily?.workouts[0]?.id).toBe('new-row');
    await act(async () => first.resolve(paired('stale-row'))); await flush();
    expect(latest.legacyDaily?.workouts[0]?.id).toBe('new-row');
    expect(latest.result?.records.some(record => record.source === 'legacy' && record.legacy.rowId === 'stale-row')).toBe(false);
  });

  it('discards late A after date change, and refreshes after bootstrap completion', async () => {
    const first = deferred<ReturnType<typeof paired>>();
    mocks.legacy.mockReturnValueOnce(first.promise).mockResolvedValue(paired('new-row', 'account-a', '2026-09-30'));
    await render({});
    await render({ date: '2026-09-30' }); await flush();
    expect(latest.localDate).toBe('2026-09-30');
    await act(async () => first.resolve(paired('stale-row'))); await flush();
    expect(latest.localDate).toBe('2026-09-30');
    const before = mocks.legacy.mock.calls.length;
    await act(async () => window.dispatchEvent(new Event('health-bootstrap-complete'))); await flush();
    expect(mocks.legacy.mock.calls.length).toBe(before + 1);
  });

  it('fences A→B→A even when the first A resolves last', async () => {
    const firstA = deferred<ReturnType<typeof paired>>();
    let aCalls = 0;
    mocks.legacy.mockImplementation((owner: string) => owner === 'account-b'
      ? Promise.resolve(paired('b-row', 'account-b'))
      : ++aCalls === 1 ? firstA.promise : Promise.resolve(paired('new-a-row')));
    mocks.open.mockImplementation(async (owner: string) => reader(owner));
    await render({ accountId: 'account-a' });
    await render({ accountId: 'account-b' }); await flush();
    expect(latest.accountId).toBe('account-b');
    await render({ accountId: 'account-a' }); await flush();
    expect(latest.legacyDaily?.workouts[0]?.id).toBe('new-a-row');
    await act(async () => firstA.resolve(paired('old-a-row'))); await flush();
    expect(latest.legacyDaily?.workouts[0]?.id).toBe('new-a-row');
  });

  it('never downgrades a true source identity mismatch to partial data', async () => {
    const wrong = reader();
    wrong.read.mockResolvedValueOnce([{ accountId: 'account-b', namespaceKey: 'namespace-account-a',
      generationId: 'g1', entityId: ID, localRevision: 1, session }]);
    mocks.open.mockResolvedValueOnce(wrong);
    await render({}); await flush();
    expect(latest.isolationError).toBe(true);
    expect(latest.result).toBeNull();
    expect(latest.legacyDaily).toBeNull();
  });

  it('fails closed when the reader itself detects an envelope identity mismatch', async () => {
    const wrong = reader();
    wrong.read.mockRejectedValueOnce(new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH'));
    mocks.open.mockResolvedValueOnce(wrong);
    await render({}); await flush();
    expect(latest.isolationError).toBe(true);
    expect(latest.result).toBeNull();
  });

  it('reopens after a generation switch before publishing a slow legacy pair', async () => {
    const firstLegacy = deferred<ReturnType<typeof paired>>();
    mocks.legacy.mockReturnValueOnce(firstLegacy.promise).mockResolvedValue(paired('g2-row'));
    const g1 = reader();
    const g2 = reader();
    g2.scope.generationId = 'g2';
    g2.read.mockResolvedValue([{ accountId: 'account-a', namespaceKey: 'namespace-account-a',
      generationId: 'g2', entityId: ID, localRevision: 1, session }]);
    g1.verifyCurrentScope.mockRejectedValueOnce(new LocalDatabaseError('STALE_GENERATION', 'test'));
    mocks.open.mockResolvedValueOnce(g1).mockResolvedValueOnce(g2);
    await render({});
    await act(async () => firstLegacy.resolve(paired('g1-row'))); await flush();
    expect(g1.close).toHaveBeenCalled();
    expect(latest.cacheKey).toEqual(['health-selected-day-composite', 'account-a',
      'namespace-account-a', 'g2', DATE]);
    expect(latest.legacyDaily?.workouts[0]?.id).toBe('g2-row');
  });

  it('revalidates on focus without creating a new key or reopening the same reader', async () => {
    await render({}); await flush();
    const key = latest.cacheKey;
    await act(async () => window.dispatchEvent(new Event('focus'))); await flush();
    expect(mocks.legacy).toHaveBeenCalledTimes(2);
    expect(mocks.open).toHaveBeenCalledTimes(1);
    expect(latest.cacheKey).toEqual(key);
  });

  it('suppresses its bootstrap/focus/visibility listeners under AppContent-managed lifecycle', async () => {
    const windowAdd = vi.spyOn(window, 'addEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    await render({ managedLifecycle: true }); await flush();
    expect(windowAdd.mock.calls.filter(([event]) => event === 'focus' || event === 'health-bootstrap-complete')).toHaveLength(0);
    expect(documentAdd.mock.calls.filter(([event]) => event === 'visibilitychange')).toHaveLength(0);
    const before = mocks.legacy.mock.calls.length;
    await act(async () => window.dispatchEvent(new Event('focus'))); await flush();
    expect(mocks.legacy).toHaveBeenCalledTimes(before);
  });
});
