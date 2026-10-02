// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { IDBFactory, IDBIndex as FakeIndex } from 'fake-indexeddb';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { openLocalDatabase, createDormantLocalDatabaseCapability,
  LOCAL_DATABASE_STORES, type LocalDatabaseRepository } from '../../../../lib/localDatabase';
import { WorkoutSessionRepository } from '../../../../lib/workoutSessionRepository';
import { HEALTH_ROUTINE_PROJECT_REF, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_DEVICE_ID_KEY } from '../../../../lib/healthRoutineSync';
import { useHealthWorkoutRangeSnapshot, type HealthWorkoutRangeReadModel } from '../health/useHealthWorkoutRangeSnapshot';
import { buildSearchWorkoutPreview } from './searchWorkoutCompositeProjection';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const h = vi.hoisted(() => ({ reads: vi.fn() }));
vi.mock('../../../../lib/healthLocalRuntime', () => ({ createLocalHealthRepository: async () => ({ readAll: h.reads }) }));
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DATE = '2026-09-30';
const scope = { localDate: DATE, lifetime: {}, isCurrent: () => true };
const bounds = { startDate: DATE, endDate: DATE };
let latest: HealthWorkoutRangeReadModel;
function Harness() {
  latest = useHealthWorkoutRangeSnapshot(true, 'a', bounds, bounds, undefined, scope);
  return null;
}
let db: LocalDatabaseRepository; let root: Root; let host: HTMLDivElement;
async function flush() {
  for (let attempt = 0; attempt < 12; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    if (latest.previewRead?.phase === 'settled') return;
  }
}
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, DEVICE);
  h.reads.mockReset().mockResolvedValue({ workout_logs: [{ id: 'row', user_id: 'a', date: DATE, block_id: 'bench', sort_order: 0, sets: [] }],
    exercise_blocks: [{ id: 'bench', user_id: 'a', name: 'Bench', type: 'strength' }] });
  db = await openLocalDatabase({ userId: 'a', projectRef: HEALTH_ROUTINE_PROJECT_REF, deviceId: DEVICE,
    generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 }, { capability: createDormantLocalDatabaseCapability('D1-test') });
  await db.initializeNamespace();
  await new WorkoutSessionRepository(db).createWorkoutSession({ version: 1, id: '11111111-1111-4111-8111-111111111111', localDate: DATE,
    entries: [{ id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: null, name: 'Bench', type: 'bodyweight', tags: [], cardioMode: null },
      sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, done: false, kind: 'bodyweight',
        loadKind: 'bodyweight', reps: 5, assistedReps: null, dropset: false }] }] });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(createElement(Harness))); await flush();
  expect(buildSearchWorkoutPreview('Bench', latest.previewRead!).results).toHaveLength(2);
});
afterEach(() => { act(() => root?.unmount()); host?.remove(); db?.close(); vi.restoreAllMocks(); localStorage.clear(); });

function fault(patch: Record<string, unknown>) {
  const actual = FakeIndex.prototype.getAll;
  const reached = vi.fn();
  vi.spyOn(FakeIndex.prototype, 'getAll').mockImplementation(function (this: IDBIndex, ...args) {
    const request = actual.apply(this, args);
    if (this.objectStore.name === LOCAL_DATABASE_STORES.entities && this.name === 'by_namespace_generation_domain') {
      request.addEventListener('success', () => {
        reached();
        for (const entity of request.result) Object.assign(entity, patch);
      });
    }
    return request;
  });
  return reached;
}
describe('D1 real persisted repository -> reader -> coordinator -> hook -> Search', () => {
  it.each([
    { accountId: 'foreign' }, { namespaceKey: 'foreign' }, { generationId: 'foreign' },
    { accountId: 'foreign', revision: 0 },
  ])('untrusted persisted scope %j removes paired publication, not partial-zero', async patch => {
    const old = latest.previewRead!;
    const reached = fault(patch);
    await act(async () => { latest.invalidateAndReload(); expect(old.isCurrent()).toBe(false); }); await flush();
    expect(reached).toHaveBeenCalledTimes(1);
    expect(latest.previewRead?.isolationError).toBe(true);
    expect(buildSearchWorkoutPreview('Bench', latest.previewRead!)).toMatchObject({ state: 'isolation_error', results: [] });
    expect(buildSearchWorkoutPreview('Bench', old).results).toEqual([]);
  });
  it('trusted envelope invalid content is whole canonical error with valid legacy partial retained', async () => {
    const reached = fault({ record: { version: 1, entries: [] } });
    await act(async () => latest.invalidateAndReload()); await flush();
    expect(reached).toHaveBeenCalledTimes(1);
    const preview = buildSearchWorkoutPreview('Bench', latest.previewRead!);
    expect(preview).toMatchObject({ state: 'partial', legacyStatus: 'success', canonicalStatus: 'error', legacyMatches: 1, canonicalMatches: 0 });
  });
});
