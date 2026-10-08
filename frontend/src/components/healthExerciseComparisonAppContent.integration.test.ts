// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createElement, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DeferredVoid = Readonly<{ promise: Promise<void>; resolve: () => void }>;

const mocks = vi.hoisted(() => ({
  childEnabled: true, rangeEnabled: true, healthProps: [] as Array<import('../types').HealthProps>,
  legacyReads: vi.fn(), canonicalReads: vi.fn(), commitInputs: [] as unknown[],
  sourceGate: null as DeferredVoid | null, afterStorageCommit: null as null | (() => void),
  accountWorkouts: new Map<string, Array<Record<string, unknown>>>(),
  accountVersions: new Map<string, number>(),
  mutationGate: null as DeferredVoid | null,
  holdNextSelectedRead: false,
  holdNextRangeRead: false,
  heldSelectedReads: [] as Array<() => void>,
  heldRangeReads: [] as Array<() => void>,
  selectedReads: [] as Array<{ accountId: string; version: number; count: number; held: boolean }>,
  rangeLoads: [] as Array<{ accountId: string; version: number; count: number; held: boolean }>,
  rangeDerives: [] as Array<{ accountId: string; version: number; startDate: string; endDate: string }>,
  rangeInvalidations: [] as string[],
  events: [] as string[],
  repositoryEvents: [] as string[],
  homeModels: [] as Array<{ phase: string; accountId: string; legacyDaily?: { workouts?: Array<{ local_version?: string }> } | null }>,
  showToast: vi.fn(),
  mutateDaily: vi.fn(),
  mutateStatic: vi.fn(),
  mutateTodos: vi.fn(),
  mutateRoutines: vi.fn(),
  updateSetting: vi.fn(),
  confirmModal: { current: null as null | { onConfirm: () => void | Promise<void>; onCancel: () => void } },
  notesState: { notes: [] as unknown[], createNote: vi.fn(), updateNote: vi.fn() },
}));

vi.mock('./views/features/health/healthSelectedDayCompositeConfig', () => ({
  HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED: true,
}));
vi.mock('./views/features/home/homeWorkoutCompositeConfig', () => ({
  HOME_WORKOUT_COMPOSITE_READER_ENABLED: false,
  isHomeWorkoutCompositeEnabled: ({ homeActive, accountPresent }: { homeActive: boolean; accountPresent: boolean }) => homeActive && accountPresent,
}));
vi.mock('./views/features/health/healthWorkoutRangeCompositeConfig', () => ({
  HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED: true,
  isHealthWorkoutRangeCompositeEnabled: ({ healthActive, accountPresent }: { healthActive: boolean; accountPresent: boolean }) => mocks.rangeEnabled && healthActive && accountPresent,
}));
vi.mock('../lib/workoutSelectedDayReader', () => {
  class WorkoutSelectedDayReader {
    accountId: string;
    deviceId = 'device-test';
    scope: { accountId: string; deviceId: string; namespaceKey: string; generationId: string };
    constructor(accountId: string) {
      this.accountId = accountId;
      this.scope = { accountId, deviceId: this.deviceId, namespaceKey: `ns-${accountId}`, generationId: `g-${accountId}` };
    }
    static async open(accountId: string) { return new WorkoutSelectedDayReader(accountId); }
    async read() { return []; }
    async verifyCurrentScope() { return undefined; }
    close() { return undefined; }
  }
  return { WorkoutSelectedDayReader, readEstablishedWorkoutDeviceId: () => 'device-test' };
});
vi.mock('./views/features/health/selectedDayLegacySnapshot', () => ({
  loadVerifiedSelectedDayLegacySnapshot: (accountId: string, localDate: string) => {
    const version = mocks.accountVersions.get(accountId) ?? 0;
    const workouts = structuredClone(mocks.accountWorkouts.get(accountId) ?? []);
    const held = mocks.holdNextSelectedRead;
    mocks.holdNextSelectedRead = false;
    mocks.selectedReads.push({ accountId, version, count: workouts.length, held });
    mocks.events.push(`selected-read:${accountId}:v${version}:${held ? 'held' : 'live'}`);
    const value = {
      persistedRows: workouts.filter(workout => workout.block_id !== '__session__').map((workout, index) => ({
        accountId, rowId: String(workout.id), localDate, blockId: String(workout.block_id), sortOrder: index,
        exerciseDisplay: { kind: 'historical_fallback', name: 'Bench' }, sets: structuredClone(workout.sets ?? []),
      })),
      daily: { workouts, inbody: { weight: null, smm: null, pbf: null }, routines: [] },
    };
    if (!held) return Promise.resolve(value);
    return new Promise<typeof value>(resolve => {
      mocks.heldSelectedReads.push(() => resolve(value));
    });
  },
}));
vi.mock('../lib/syncAuthority', () => ({ domainUsesLocalWorkingCopy: () => true }));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.test' }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } }, authFetch: vi.fn() }));
vi.mock('../lib/remoteBoundary', () => ({ remoteSWRKey: () => null }));
vi.mock('../lib/fetcher', () => ({ fetcher: vi.fn(async () => []) }));
vi.mock('../lib/noteNavigation', () => ({ registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined, openWorkspaceSearch: vi.fn(), openHealthDayNote: vi.fn(), openNote: vi.fn(), switchToTab: vi.fn() }));
vi.mock('../store/useAppStore', () => ({ useAppStore: () => ({
  appSettings: { language: 'en', darkMode: false }, updateSetting: mocks.updateSetting,
  weightUnits: {}, toggleWeightUnit: vi.fn(),
}) }));
vi.mock('../store/useNotesStore', () => {
  const state = { ...mocks.notesState, folders: [], notesAuthorityState: 'LOADED_EMPTY', foldersAuthorityState: 'LOADED_EMPTY', syncError: null,
    initNotesStorage: vi.fn(async () => undefined), bootstrapFromSupabase: vi.fn(async () => undefined), detachNotesStorage: vi.fn() };
  return { useNotesStore: Object.assign((select: (value: typeof state) => unknown) => select(state), { getState: () => state }) };
});
vi.mock('../hooks/useNow', () => ({ useNow: () => ({
  now: { toJSDate: () => new Date('2026-09-29T12:00:00Z') },
  formatDate: (date: Date) => date.toISOString().slice(0, 10), isToday: () => true,
}) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast: null, showToast: mocks.showToast }) }));
vi.mock('../hooks/useDaily', () => ({ useDailyData: () => ({ schedules: [], todos: [], todosState: {}, routines: [], workouts: [],
  inbody: { weight: null, smm: null, pbf: null }, mutate: mocks.mutateDaily, mutateTodos: mocks.mutateTodos,
  mutateRoutines: mocks.mutateRoutines, isLoading: false }) }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: () => ({ markedDates: [],
  healthBlocks: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Bench', type: 'strength', tags: [] }], healthBlocksState: {}, healthRoutines: [],
  healthRoutinesState: { status: 'READY_EMPTY', validating: false }, weeklySchedules: [], mutate: mocks.mutateStatic }) }));
vi.mock('../hooks/useEscapeKey', () => ({ useEscapeKey: vi.fn() }));
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../hooks/useSwipeNavigation', () => ({ useSwipeNavigation: () => ({ onTouchStart: vi.fn(), onTouchEnd: vi.fn() }) }));
vi.mock('../hooks/useApiMutation', () => ({ useApiMutation: () => ({ api: vi.fn() }) }));
vi.mock('../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: null, showConfirm: vi.fn(), clearConfirm: vi.fn(), handleConfirm: vi.fn() }) }));
vi.mock('../theme', () => ({ buildThemeClasses: () => ({ card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' }) }));
vi.mock('./common/Sidebar', () => ({ Sidebar: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) =>
  createElement('div', null, ...['health', 'home', 'note'].map(tab => createElement('button', {
    key: tab, type: 'button', 'data-testid': `nav-${tab}`, onClick: () => setActiveTab(tab),
  }, tab))) }));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => null }));
vi.mock('./common/ConfirmModal', () => ({ ConfirmModal: ({ onConfirm, onCancel }: { onConfirm: () => void | Promise<void>; onCancel: () => void }) => {
  mocks.confirmModal.current = { onConfirm, onCancel };
  useEffect(() => () => { mocks.confirmModal.current = null; }, [onConfirm, onCancel]);
  return null;
} }));
vi.mock('./common/WorkspaceCardSkeleton', () => ({ WorkspaceCardSkeleton: () => null }));
vi.mock('./common/WorkspaceErrorBoundary', () => ({ WorkspaceErrorBoundary: ({ children }: { children: unknown }) => children }));
vi.mock('./common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));
vi.mock('./common/WorkspaceToolbar', () => ({
  WorkspaceToolbar: ({ children }: { children: unknown }) => createElement('div', null, children),
  WorkspaceToolbarPrimary: ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) =>
    createElement('button', { type: 'button', 'data-testid': 'health-save-workout', onClick, disabled }, label),
}));
vi.mock('./views/HealthView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/HealthView')>();
  return { ...actual, HealthView: (props: import('../types').HealthProps) => {
    mocks.healthProps.push(props); return createElement(actual.HealthView, props);
  } };
});
vi.mock('./views/HomeView', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/HomeView')>();
  return { ...actual, HomeView: (props: import('./views/HomeView').HomeViewProps) => {
    if (props.homeWorkoutComposite) mocks.homeModels.push(props.homeWorkoutComposite);
    return createElement(actual.HomeView, props);
  } };
});
vi.mock('./views/features/planner/calendar-ui/usePlannerCalendarProjection', () => ({ usePlannerCalendarProjection: () => ({ projection: {}, presentation: {} }) }));
vi.mock('./views/features/planner/calendar/buildPlannerProjection', () => ({ buildPlannerProjection: () => ({ todayItems: [], timetableToday: [] }) }));
vi.mock('./views/features/planner/hooks/useCountdownReviewed', () => ({ useCountdownReviewed: () => ({ isReviewed: () => false }) }));
vi.mock('./views/features/archive/hooks/useArchiveProjection', () => ({ useArchiveProjection: () => ({ projection: { historyItems: { groups: [] } } }) }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: () => null }));
vi.mock('./views/features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: vi.fn() }));
vi.mock('./views/features/health/HealthWorkspaceNav', () => ({ HEALTH_WORKSPACE_SECTIONS: [{ id: 'workout' }], HealthWorkspaceNav: () => null }));
vi.mock('./views/features/health/HealthBlockLibrary', () => ({ HealthBlockLibrary: () => null }));
vi.mock('./views/features/health/HealthSupportingPanels', () => ({ HealthSupportingPanels: ({ workoutCalendarActivity }: { workoutCalendarActivity?: { phase: string; knownPresentDates: Set<string> } }) =>
  createElement('div', { 'data-testid': 'range-state' }, workoutCalendarActivity
    ? `${workoutCalendarActivity.phase}:${workoutCalendarActivity.knownPresentDates.size}` : 'legacy') }));
vi.mock('./views/features/health/HealthSelectedDayCompositePanel', () => ({ HealthSelectedDayCompositePanel: ({ model }: { model: { phase: string; accountId: string; legacyDaily?: { workouts?: Array<{ local_version?: string }> } | null } }) =>
  createElement('div', { 'data-testid': 'selected-state' }, `${model.phase}:${model.accountId}:${model.legacyDaily?.workouts?.[0]?.local_version ?? 'empty'}`) }));
vi.mock('./views/features/health/nutrition', () => ({ ProteinTracker: () => null }));
vi.mock('./views/features/health/PreviousWorkoutView', () => ({ PreviousWorkoutView: () => null }));
vi.mock('./views/features/health/PreviousWorkoutSheet', () => ({ PreviousWorkoutSheet: () => null }));
vi.mock('./views/features/health/HealthMobileWorkoutActions', () => ({ HealthMobileWorkoutActions: () => null }));
vi.mock('./views/features/health/prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: vi.fn(async () => ({
  [BLOCK]: { prev_sets: [{ type: 'strength', set: 1, kg: 10, reps: 5, done: true }], prev_date: '2026-09-25', pr_kg: 10 },
})) }));
vi.mock('./views/features/health/recovery/recoveryNotes', () => ({ getRecoveryEntry: () => null }));
vi.mock('./views/features/health/healthSectionPrefs', () => ({ readHealthSectionPrefs: () => ({}) }));
vi.mock('./views/features/health/buildHealthProjection', () => ({ buildHealthProjection: () => ({ workoutDates: [] }) }));
vi.mock('./views/k102DateFormat', () => ({ formatAbsoluteDateKey: (value: Date | string) => value instanceof Date ? value.toISOString().slice(0, 10) : value,
  formatLongDate: (value: Date) => value.toISOString().slice(0, 10) }));
vi.mock('../lib/healthRoutineSync', () => ({ productionHealthRoutinePersistence: {
  bootstrap: async ({ legacyState }: { legacyState: unknown }) => legacyState,
  commitState: async (_accountId: string, _previous: unknown, next: unknown) => next,
  sync: async () => null, snapshot: async () => null, reset: async () => null, recover: async (_accountId: string, recovered: unknown) => recovered,
} }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/i18n', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/i18n')>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key, lang: 'en' }) };
});
vi.mock('../lib/healthSupabaseBootstrap', () => ({ bootstrapHealthFromSupabase: vi.fn(async () => undefined),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete' }));
vi.mock('../lib/workoutRuntimeAuthority', () => ({ createProductionWorkoutRuntimeAuthorityController: () => ({
  start: vi.fn(async () => ({ kind: 'retry_later' })), cancel: vi.fn(),
}) }));
vi.mock('swr', () => ({
  default: () => ({ data: [], mutate: vi.fn(), isLoading: false, error: undefined }),
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));


vi.mock('./views/features/health/healthExerciseComparisonPreviewConfig', () => ({
  HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED: false,
  isHealthExerciseComparisonPreviewEnabled: (parent: boolean) => parent && mocks.childEnabled,
}));
vi.mock('../lib/workoutRangeReader', () => ({
  WorkoutRangeReader: { open: async (account: string) => ({
    scope: { accountId: account, namespaceKey: 'ns', generationId: 'g1' },
    readAllActive: async () => {
      mocks.canonicalReads(account);
      return [{ accountId: account, namespaceKey: 'ns', generationId: 'g1', entityId: SESSION, localRevision: 1,
        session: { version: 1, id: SESSION, localDate: '2026-09-27', entries: [{ id: ENTRY,
          exercise: { id: BLOCK, name: 'Bench', type: 'strength', tags: [], cardioMode: null },
          sets: [{ id: SET, ordinal: 1, kind: 'strength', loadKind: 'external_weight', weightKg: account === A ? '900' : '777',
            sourceValue: account === A ? '900' : '777', sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false, done: true }] }] } }];
    },
    verifyCurrentScope: async () => undefined, close: () => undefined,
  }) },
}));
vi.mock('../lib/healthLocalRuntime', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/healthLocalRuntime')>();
  return { ...actual, createLocalHealthRepository: async (accountId: string) => {
    const repo = await actual.createLocalHealthRepository(accountId);
    return {
      readAll: async () => { mocks.legacyReads(accountId); await mocks.sourceGate?.promise; return repo.readAll(); },
      saveWorkouts: async (rows: Parameters<typeof repo.saveWorkouts>[0]) => {
        mocks.commitInputs.push(structuredClone(rows));
        await mocks.mutationGate?.promise;
        const result = await repo.saveWorkouts(rows); // REAL durable IndexedDB transaction
        const previous = mocks.accountWorkouts.get(accountId) ?? [];
        mocks.accountWorkouts.set(accountId, rows.map((row, n) => ({
          ...previous[n], id: result[n]!.id, local_version: result[n]!.version, sets: structuredClone(row.sets),
        })));
        mocks.accountVersions.set(accountId, 2);
        mocks.afterStorageCommit?.();
        return result;
      },
      deleteWorkout: async (id: string, version: string) => {
        await mocks.mutationGate?.promise;
        await repo.deleteWorkout(id, version); // REAL durable IndexedDB transaction
        mocks.accountWorkouts.set(accountId, []); mocks.accountVersions.set(accountId, 2);
        mocks.afterStorageCommit?.();
      },
    };
  } };
});

import {
  HEALTH_RECOVERY_DATASETS, buildHealthRecoveryExport, type HealthRecoveryDatasets,
} from '../lib/healthRecoveryExport';
import { createLocalHealthDriver, HealthRepository, computeLocalHealthLogicalVersion, type PendingLocalHealthImportState } from '../lib/healthLocalRepository';
import { createLocalHealthRepository, resetLocalHealthRuntimeForTests } from '../lib/healthLocalRuntime';
import { WorkoutExerciseComparisonOwner, type WorkoutExerciseComparisonPublication } from '../lib/workoutExerciseComparisonOwner';
import { WorkoutReadSnapshotCoordinator } from './views/features/health/verifiedWorkoutRangeSnapshot';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BLOCK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION = '11111111-1111-4111-8111-111111111111';
const ENTRY = '22222222-2222-4222-8222-222222222222', SET = '33333333-3333-4333-8333-333333333333';
const ROW = '44444444-4444-4444-8444-444444444444', PRIOR = '55555555-5555-4555-8555-555555555555';
const KEY = { id: BLOCK, name: 'Bench', type: 'strength' };
const persistedWorkout = { id: ROW, block_id: BLOCK, local_version: '',
  exercise_blocks: { id: BLOCK, name: 'Bench', type: 'strength', tags: [] },
  sets: [{ type: 'strength', set: 1, kg: '20', reps: '5', done: true }] };
const user = (id: string) => ({ id, email: `${id}@example.test` } as never);
function deferredVoid(): DeferredVoid {
  let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
let root: Root | null, host: HTMLDivElement;
const publications: WorkoutExerciseComparisonPublication[] = [];
async function seed() {
  const datasets = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
  datasets.exercise_blocks.push({ ...persistedWorkout.exercise_blocks, user_id: A, cardio_mode: null });
  datasets.workout_logs.push({ id: ROW, user_id: A, block_id: BLOCK, date: '2026-09-29', sort_order: 0,
    sets: structuredClone(persistedWorkout.sets) }, { id: PRIOR, user_id: A, block_id: BLOCK,
    date: '2026-09-25', sort_order: 0, sets: [{ type: 'strength', set: 1, kg: 30, reps: 6, done: true }] });
  const built = await buildHealthRecoveryExport({ sourceAccount: { userId: A, email: 'test@example.test' },
    exportedAt: '2026-09-29T00:00:00.000Z', datasets });
  const counts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, datasets[name].length])) as PendingLocalHealthImportState['datasetCounts'];
  const driver = await createLocalHealthDriver();
  const pending: PendingLocalHealthImportState = { accountId: A, status: 'IMPORT_COMMITTED_PENDING_READBACK',
    snapshotId: 'mounted-comparison-fixture', importedAt: built.exportedAt, sourceExportedAt: built.exportedAt,
    sourceFileSha256: '1'.repeat(64), sourceContentSha256: built.checksum.value,
    totalRowCount: Object.values(counts).reduce((a, b) => a + b, 0), datasetCounts: counts, diagnostics: built.diagnostics };
  await driver.commitPendingImportAtomically({ accountId: A, datasets, expectedImportState: null, pendingImportState: pending });
  await driver.finalizePendingIfStillCurrent({ accountId: A, expectedSnapshotId: pending.snapshotId });
  const rows = (await new HealthRepository(driver, A).readAll()).workout_logs.filter(row => row.id === ROW);
  driver.close();
  // Hydration uses the REAL durable version for optimistic local writes.
  mocks.accountWorkouts.set(A, [{ ...structuredClone(persistedWorkout), local_version: computeLocalHealthLogicalVersion(rows) }]);
}
async function settle() {
  await act(async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); await new Promise(done => setTimeout(done, 0)); });
}
async function waitFor(assertion: () => void) {
  let failure: unknown;
  for (let n = 0; n < 50; n++) { await settle(); try { assertion(); return; } catch (error) { failure = error; } }
  throw failure;
}
const comparison = () => host.querySelector('[data-health-exercise-comparison]');
const range = () => mocks.healthProps.at(-1)!.workoutRangeComposite!;
const btn = (label: string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.trim() === label)!;
async function mount() {
  await import('./views/HealthView');
  const { AppContent } = await import('./AppContent');
  await act(async () => { root = createRoot(host); root.render(createElement(AppContent, { authUser: user(A) })); });
  await waitFor(() => expect(host.querySelector('[data-testid="nav-health"]')).not.toBeNull());
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
  await waitFor(() => expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(1));
  if (mocks.childEnabled && mocks.rangeEnabled) await waitFor(() => expect(comparison()?.getAttribute('data-excomp-status')).toBe('complete'));
  return AppContent;
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await resetLocalHealthRuntimeForTests(); globalThis.indexedDB = new IDBFactory();
  localStorage.clear(); mocks.childEnabled = true; mocks.rangeEnabled = true;
  mocks.accountWorkouts.clear(); mocks.accountWorkouts.set(B, []);
  mocks.accountVersions.clear(); mocks.accountVersions.set(A, 1); mocks.accountVersions.set(B, 0);
  mocks.mutationGate = deferredVoid(); mocks.sourceGate = null; mocks.afterStorageCommit = null;
  mocks.selectedReads.length = 0; mocks.heldSelectedReads.length = 0; mocks.holdNextSelectedRead = false;
  mocks.healthProps.length = 0; mocks.commitInputs.length = 0;
  mocks.legacyReads.mockClear(); mocks.canonicalReads.mockClear(); publications.length = 0;
  mocks.showToast.mockClear(); mocks.mutateDaily.mockClear(); mocks.mutateStatic.mockClear();
  host = document.createElement('div'); document.body.appendChild(host); root = null;
  await seed();
  const derive = WorkoutExerciseComparisonOwner.prototype.derive;
  vi.spyOn(WorkoutExerciseComparisonOwner.prototype, 'derive').mockImplementation(async function (key) {
    const publication = await derive.call(this, key);
    if (publication) publications.push(publication);
    return publication;
  });
});
afterEach(async () => {
  if (root) act(() => root?.unmount()); root = null; host.remove();
  await resetLocalHealthRuntimeForTests(); vi.restoreAllMocks();
});

describe('C29 real AppContent → HealthView → durable Health repository → shared source fence', () => {
  it.each(['save', 'delete'] as const)('%s commit synchronously revokes old publication, refreshes once, and never consumes canonical evidence as writer input', async operation => {
    await mount();
    expect(comparison()?.textContent).toContain('900 kg');
    const old = publications.at(-1)!; expect(old.isCurrent()).toBe(true);
    const beforeLegacy = mocks.legacyReads.mock.calls.length, beforeCanonical = mocks.canonicalReads.mock.calls.length;
    await act(async () => btn('editBtn').click());
    let observedFence = false;
    let durableCommitted = false;
    mocks.afterStorageCommit = () => { durableCommitted = true; };
    const invalidate = WorkoutReadSnapshotCoordinator.prototype.invalidate;
    vi.spyOn(WorkoutReadSnapshotCoordinator.prototype, 'invalidate').mockImplementation(function () {
      invalidate.call(this);
      if (durableCommitted) { expect(old.isCurrent()).toBe(false); observedFence = true; }
    });
    mocks.sourceGate = deferredVoid();
    await act(async () => {
      if (operation === 'save') host.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click();
      else host.querySelector<HTMLButtonElement>('[data-k126-workout-exercise-card] button.absolute')!.click();
    });
    await act(async () => mocks.mutationGate!.resolve());
    await waitFor(() => expect(observedFence).toBe(true));
    expect(await old.publish(vi.fn())).toBe(false);
    expect(host.querySelector('[data-excomp-source]')).toBeNull();
    mocks.sourceGate.resolve(); mocks.sourceGate = null;
    await waitFor(() => expect(range().phase).toBe('settled'));
    const fresh = await range().exerciseComparison!.port.derive(KEY);
    expect(await fresh!.publish(vi.fn())).toBe(true);
    expect(mocks.legacyReads).toHaveBeenCalledTimes(beforeLegacy + 1);
    expect(mocks.canonicalReads).toHaveBeenCalledTimes(beforeCanonical + 1);
    const real = await createLocalHealthRepository(A);
    const all = await real.readAll();
    expect(all.workout_logs.some(row => row.id === ROW)).toBe(operation === 'save');
    expect(all.workout_logs.some(row => row.id === PRIOR)).toBe(true);
    if (operation === 'save') {
      const input = mocks.commitInputs[0] as Array<{ sets: unknown[] }>;
      expect(input[0]!.sets).toEqual(persistedWorkout.sets);
      expect(JSON.stringify(input)).not.toContain('900');
      expect(host.querySelector('[data-k107-workout-pr-badge]')?.textContent).toContain('PR');
    }
  });
  it('default-OFF editor DOM/cues/PR/planning are identical; ON adds only subordinate read-only comparison', async () => {
    mocks.childEnabled = false; await mount();
    const card = () => host.querySelector('[data-k126-workout-exercise-card]')!;
    const original = card().innerHTML;
    const sourceReads = mocks.legacyReads.mock.calls.length;
    const { AppContent } = await import('./AppContent');
    mocks.childEnabled = true;
    await act(async () => root!.render(createElement(AppContent, { authUser: user(A) })));
    await waitFor(() => expect(comparison()?.getAttribute('data-excomp-status')).toBe('complete'));
    const clone = card().cloneNode(true) as HTMLElement;
    clone.querySelector('[data-health-exercise-comparison]')!.remove();
    expect(clone.innerHTML).toBe(original);
    act(() => root!.unmount()); root = null;
    expect(sourceReads).toBe(1);
  });
  it('parent-OFF/child-ON fails closed in the REAL shell and creates no range read', async () => {
    mocks.childEnabled = true; mocks.rangeEnabled = false; await mount();
    expect(comparison()).toBeNull(); expect(range()).toBeUndefined();
    expect(mocks.legacyReads).not.toHaveBeenCalled(); expect(mocks.canonicalReads).not.toHaveBeenCalled();
  });
  it('Health unmount/re-entry closes old borrower; cached publications cannot rebind', async () => {
    await mount(); const old = publications.at(-1)!;
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-note"]')!.click());
    expect(await old.publish(vi.fn())).toBe(false); expect(comparison()).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
    await waitFor(() => expect(comparison()?.getAttribute('data-excomp-status')).toBe('complete'));
    expect(await old.publish(vi.fn())).toBe(false);
  });
  it('C26 real mounted Health account A→B→A keeps source payload and owner identities separate', async () => {
    const AppContent = await mount(); const old = publications.at(-1)!;
    mocks.accountWorkouts.set(B, [structuredClone(persistedWorkout)]);
    await act(async () => root!.render(createElement(AppContent, { authUser: user(B) })));
    await waitFor(() => expect(comparison()?.textContent).toContain('777 kg'));
    expect(comparison()?.textContent).not.toContain('900 kg');
    await act(async () => root!.render(createElement(AppContent, { authUser: user(A) })));
    await waitFor(() => expect(comparison()?.textContent).toContain('900 kg'));
    expect(comparison()?.textContent).not.toContain('777 kg');
    expect(await old.publish(vi.fn())).toBe(false);
    expect(mocks.legacyReads).toHaveBeenCalledTimes(3); expect(mocks.canonicalReads).toHaveBeenCalledTimes(3);
  });
  it('C27 real Health selectedDate ABA changes comparison boundary without source re-read', async () => {
    await mount(); const old = publications.at(-1)!;
    await act(async () => mocks.healthProps.at(-1)!.setSelectedDate(new Date('2026-09-24T12:00:00Z')));
    await waitFor(() => expect(host.querySelectorAll('[data-excomp-no-match]')).toHaveLength(2));
    expect(host.querySelector('[data-excomp-source="canonical"]')?.textContent).not.toContain('900');
    await act(async () => mocks.healthProps.at(-1)!.setSelectedDate(new Date('2026-09-29T12:00:00Z')));
    await waitFor(() => expect(comparison()?.textContent).toContain('900 kg'));
    expect(await old.publish(vi.fn())).toBe(false);
    expect(mocks.legacyReads).toHaveBeenCalledTimes(1); expect(mocks.canonicalReads).toHaveBeenCalledTimes(1);
  });
});
