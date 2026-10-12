// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createElement, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DeferredVoid = Readonly<{ promise: Promise<void>; resolve: () => void }>;

const mocks = vi.hoisted(() => ({
  parentEnabled: true, childEnabled: true, rangeEnabled: true, healthProps: [] as Array<import('../types').HealthProps>,
  realPrevious: false, previousReads: vi.fn(), previousGate: null as DeferredVoid | null, previousFailure: false,
  extraBlocks: [] as Array<import('../types').ExerciseBlock>,
  selectedFailure: null as unknown, rangeFailure: null as unknown,
  rangeGate: null as DeferredVoid | null, alignedRangeIdentity: false,
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
  get HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED() { return mocks.parentEnabled; },
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
    const failure = mocks.selectedFailure;
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
    if (!held) return failure ? Promise.reject(failure) : Promise.resolve(value);
    return new Promise<typeof value>((resolve, reject) => {
      mocks.heldSelectedReads.push(() => failure ? reject(failure) : resolve(value));
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
vi.mock('../hooks/useDaily', () => ({ useDailyData: () => ({ schedules: [], todos: [], todosState: {}, routines: [],
  workouts: mocks.parentEnabled ? [] : mocks.accountWorkouts.get(A) ?? [],
  inbody: { weight: null, smm: null, pbf: null }, mutate: mocks.mutateDaily, mutateTodos: mocks.mutateTodos,
  mutateRoutines: mocks.mutateRoutines, isLoading: false }) }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: () => ({ markedDates: [],
  healthBlocks: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Bench', type: 'strength', tags: [] }, ...mocks.extraBlocks], healthBlocksState: {}, healthRoutines: [],
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
vi.mock('./views/features/health/HealthBlockLibrary', () => ({ HealthBlockLibrary: ({ blocks, onAddToToday }: {
  blocks: Array<import('../types').ExerciseBlock>; onAddToToday: (block: import('../types').ExerciseBlock) => void;
}) => mocks.realPrevious ? createElement('div', null, ...blocks.map(block => createElement('button', {
  key: block.id, 'data-test-add-block': block.id, onClick: () => onAddToToday(block),
}, block.name))) : null }));
vi.mock('./views/features/health/HealthSupportingPanels', () => ({ HealthSupportingPanels: ({ workoutCalendarActivity }: { workoutCalendarActivity?: { phase: string; knownPresentDates: Set<string> } }) =>
  createElement('div', { 'data-testid': 'range-state' }, workoutCalendarActivity
    ? `${workoutCalendarActivity.phase}:${workoutCalendarActivity.knownPresentDates.size}` : 'legacy') }));
vi.mock('./views/features/health/HealthSelectedDayCompositePanel', () => ({ HealthSelectedDayCompositePanel: ({ model }: { model: { phase: string; accountId: string; isolationError?: boolean; legacyDaily?: { workouts?: Array<{ local_version?: string }> } | null } }) =>
  createElement('div', { 'data-testid': 'selected-state', 'data-test-parent-rejected': String(!!model.isolationError) }, `${model.phase}:${model.accountId}:${model.legacyDaily?.workouts?.[0]?.local_version ?? 'empty'}`) }));
vi.mock('./views/features/health/nutrition', () => ({ ProteinTracker: () => null }));
vi.mock('./views/features/health/PreviousWorkoutView', () => ({ PreviousWorkoutView: () => null }));
vi.mock('./views/features/health/PreviousWorkoutSheet', () => ({ PreviousWorkoutSheet: () => null }));
vi.mock('./views/features/health/HealthMobileWorkoutActions', () => ({ HealthMobileWorkoutActions: () => null }));
vi.mock('./views/features/health/prevWorkoutFetch', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/health/prevWorkoutFetch')>();
  return { ...actual, fetchPrevWorkoutForBlocks: vi.fn(async (...args: Parameters<typeof actual.fetchPrevWorkoutForBlocks>) => {
    if (!mocks.realPrevious) return { [BLOCK]: { prev_sets: [{ type: 'strength', set: 1, kg: 10, reps: 5, done: true }], prev_date: '2026-09-25', pr_kg: 10 } };
    mocks.previousReads(...args);
    const result = await actual.fetchPrevWorkoutForBlocks(...args); // REAL verified all-history adapter
    await mocks.previousGate?.promise;
    if (mocks.previousFailure) throw new Error('previous-read-failed');
    return result;
  }) };
});
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
  return { ...actual, useTranslation: () => ({ t: (key: string) => mocks.realPrevious && key.startsWith('previous')
    ? actual.getTranslator('en')(key as never) : key, lang: 'en' }) };
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
    scope: { accountId: account, namespaceKey: mocks.alignedRangeIdentity ? `ns-${account}` : 'ns',
      generationId: mocks.alignedRangeIdentity ? `g-${account}` : 'g1' },
    readAllActive: async () => {
      mocks.canonicalReads(account);
      const gate = mocks.rangeGate, failure = mocks.rangeFailure;
      await gate?.promise;
      if (failure) throw failure;
      return [{ accountId: account, namespaceKey: mocks.alignedRangeIdentity ? `ns-${account}` : 'ns',
        generationId: mocks.alignedRangeIdentity ? `g-${account}` : 'g1', entityId: SESSION, localRevision: 1,
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
  const expectedCards = mocks.accountWorkouts.get(A)?.length ?? 0;
  await waitFor(() => expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(expectedCards));
  if (expectedCards && mocks.childEnabled && mocks.rangeEnabled) await waitFor(() => expect(comparison()?.getAttribute('data-excomp-status')).toBe('complete'));
  return AppContent;
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await resetLocalHealthRuntimeForTests(); globalThis.indexedDB = new IDBFactory();
  localStorage.clear(); mocks.parentEnabled = true; mocks.childEnabled = true; mocks.rangeEnabled = true;
  mocks.realPrevious = false; mocks.previousReads.mockClear(); mocks.previousGate = null; mocks.previousFailure = false;
  mocks.extraBlocks = []; mocks.selectedFailure = null; mocks.rangeFailure = null;
  mocks.rangeGate = null; mocks.alignedRangeIdentity = false;
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

describe('D real previous adapter + mounted Health + durable local mutation', () => {
  const cue = () => host.querySelector('[data-health-previous-micro-cue]');
  const add = () => host.querySelector<HTMLButtonElement>(`[data-test-add-block="${BLOCK}"]`)!;
  const loadRoutine = () => {
    const select = [...host.querySelectorAll('select')].find(item => item.querySelector('option[value="__load__"]'))!;
    select.value = 'Day 1'; select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  it('B1 parent OFF preserves legacy DOM, read count, planning and focus/bootstrap behavior', async () => {
    mocks.parentEnabled = false; mocks.childEnabled = false; mocks.rangeEnabled = false; mocks.realPrevious = true;
    await mount(); await waitFor(() => expect(cue()?.textContent).toContain('30'));
    const card = host.querySelector('[data-k126-workout-exercise-card]')!;
    const before = card.innerHTML, count = mocks.previousReads.mock.calls.length;
    expect(host.querySelector('[data-health-previous-state]')).toBeNull();
    act(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('health-bootstrap-complete')); });
    await settle(); expect(card.innerHTML).toBe(before); expect(mocks.previousReads).toHaveBeenCalledTimes(count);
    expect(mocks.canonicalReads).not.toHaveBeenCalled();
  });
  it('C12 add withholds failed history (not default 1); verified no-match restores exact default 1', async () => {
    mocks.realPrevious = true; mocks.accountWorkouts.set(A, []); mocks.previousFailure = true;
    await mount(); await act(async () => add().click());
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('healthPreviousSuppressed', 'info'));
    expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(0);
    mocks.previousFailure = false;
    act(() => mocks.healthProps.at(-1)!.setSelectedDate(new Date('2026-09-01T12:00:00Z')));
    await settle(); await act(async () => add().click());
    await waitFor(() => expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(1));
    expect(host.querySelectorAll('[data-k126-workout-exercise-card] input[inputmode="decimal"]')).toHaveLength(1);
    expect(host.querySelector('[data-health-previous-state="NO_MATCH"]')).not.toBeNull();
  });
  it.each([undefined, 7])('C12 routine failure cannot seed default 3; explicit preset %s stays usable', async explicit => {
    const { createRoutinePresetState, writeRoutinePresetState } = await import('./views/features/health/routinePresets');
    writeRoutinePresetState(localStorage, A, createRoutinePresetState({
      splitCount: 1, routines: [{ id: 'routine', day_name: 'Day 1', blocks: [BLOCK] }],
      plannedSetsByDay: explicit ? { 'Day 1': { [BLOCK]: explicit } } : {},
    }));
    mocks.realPrevious = true; mocks.accountWorkouts.set(A, []); mocks.previousFailure = true;
    await mount(); await settle(); await act(async () => loadRoutine()); await settle();
    expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(explicit ? 1 : 0);
    if (explicit) expect(host.querySelectorAll('[data-k126-workout-exercise-card] input[inputmode="decimal"]')).toHaveLength(explicit);
    else {
      mocks.previousFailure = false;
      act(() => mocks.healthProps.at(-1)!.setSelectedDate(new Date('2026-09-01T12:00:00Z')));
      await settle(); await act(async () => loadRoutine());
      await waitFor(() => expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(1));
      expect(host.querySelectorAll('[data-k126-workout-exercise-card] input[inputmode="decimal"]')).toHaveLength(3);
    }
  });
  it('C12 assembly has no stale/default initialization; a user-entered manual count remains usable', async () => {
    const { createRoutinePresetState, writeRoutinePresetState, readRoutinePresetState } = await import('./views/features/health/routinePresets');
    writeRoutinePresetState(localStorage, A, createRoutinePresetState({ splitCount: 1,
      routines: [{ id: 'routine', day_name: 'Day 1', blocks: [BLOCK] }] }));
    mocks.realPrevious = true; mocks.accountWorkouts.set(A, []); mocks.previousFailure = true;
    await mount(); await settle(); await act(async () => btn('assembleBtn').click());
    const input = host.querySelector<HTMLInputElement>('[data-routine-idx] input[type="number"]')!;
    expect(input.value).toBe('');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '4');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(input.value).toBe('4'); await act(async () => btn('saveRoutine').click());
    await waitFor(() => expect(readRoutinePresetState(localStorage, A)?.presets[0].days[0].plannedSets[BLOCK]).toBe(4));
    await act(async () => loadRoutine()); await settle();
    expect(host.querySelectorAll('[data-k126-workout-exercise-card] input[inputmode="decimal"]')).toHaveLength(4);
  });
  it('fresh legacy survives range retry/canonical comparison; focus withholds without reseeding edited draft', async () => {
    mocks.realPrevious = true; await mount();
    await waitFor(() => expect(cue()?.textContent).toContain('30'));
    const before = mocks.previousReads.mock.calls.length;
    expect(before).toBe(1);
    act(() => range().retry()); await waitFor(() => expect(range().phase).toBe('settled'));
    expect(mocks.previousReads).toHaveBeenCalledTimes(before); expect(cue()?.textContent).toContain('30');
    await act(async () => btn('editBtn').click());
    const input = () => host.querySelector<HTMLInputElement>('[data-k126-workout-exercise-card] input[inputmode="decimal"]')!;
    expect(input()).not.toBeNull(); const original = input().value;
    mocks.previousGate = deferredVoid();
    act(() => window.dispatchEvent(new Event('focus')));
    expect(cue()).toBeNull(); expect(host.querySelector('[data-k107-workout-pr-badge]')).toBeNull();
    await waitFor(() => expect(host.querySelector('[data-health-previous-state="REFRESHING"]')).not.toBeNull());
    expect(input().value).toBe(original);
    mocks.previousGate.resolve(); mocks.previousGate = null;
    await waitFor(() => expect(cue()?.textContent).toContain('30'));
    expect(input().value).toBe(original);
    expect(mocks.previousReads).toHaveBeenCalledTimes(before + 1);
  });
  it('real historical max deletion crosses held read, fences synchronously, then restores unchanged PR arithmetic', async () => {
    const repo = await createLocalHealthRepository(A);
    const fixtureDriver = await createLocalHealthDriver();
    const [older] = await new HealthRepository(fixtureDriver, A).saveWorkouts([{ date: '2025-01-01', blockId: BLOCK, expectedVersion: null, sortOrder: 0,
      sets: [{ type: 'strength', set: 1, kg: 300, reps: 5, done: true }] }]);
    fixtureDriver.close();
    mocks.accountWorkouts.set(A, [{ ...mocks.accountWorkouts.get(A)![0], sets: [{ type: 'strength', set: 1, kg: 100, reps: 5, done: true }] }]);
    mocks.realPrevious = true; await mount(); await waitFor(() => expect(cue()?.textContent).toContain('30'));
    expect(host.querySelector('[data-k107-workout-pr-badge]')?.textContent).not.toContain('PR');
    const previousGate = deferredVoid(); mocks.previousGate = previousGate;
    act(() => window.dispatchEvent(new Event('focus'))); await settle();
    const { deleteHealthWorkout } = await import('./views/features/health/healthWorkoutPersistence');
    const old = (await repo.readAll()).workout_logs.find(row => row.id === older.id)!;
    let deletion!: Promise<unknown>;
    act(() => { deletion = deleteHealthWorkout({ mode: 'local', accountId: A, workoutId: older.id,
      expectedVersion: computeLocalHealthLogicalVersion([old])! }); });
    await settle(); expect(cue()).toBeNull();
    mocks.previousGate = null;
    await act(async () => { mocks.mutationGate!.resolve(); await deletion; });
    await waitFor(() => expect(host.querySelector('[data-k107-workout-pr-badge]')?.textContent).toContain('PR'));
    previousGate.resolve(); await settle();
    expect(cue()?.textContent).toContain('30'); expect(host.querySelector('[data-k107-workout-pr-badge]')?.textContent).toContain('PR');
    expect((await repo.readAll()).workout_logs.some(row => row.id === older.id)).toBe(false);
    expect((await repo.readAll()).workout_logs.some(row => row.id === PRIOR)).toBe(true);
    expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(1); // current draft unchanged
  });
  it('real historical save changes latest row/count, preserves current draft and never copies canonical 900kg', async () => {
    mocks.realPrevious = true; await mount(); await waitFor(() => expect(cue()?.textContent).toContain('30'));
    const heldPrevious = deferredVoid(); mocks.previousGate = heldPrevious;
    act(() => window.dispatchEvent(new Event('focus'))); await settle();
    const { saveHealthWorkouts } = await import('./views/features/health/healthWorkoutPersistence');
    const repo = await createLocalHealthRepository(A);
    const prior = (await repo.readAll()).workout_logs.find(row => row.id === PRIOR)!;
    let saving!: Promise<unknown>;
    act(() => { saving = saveHealthWorkouts({ mode: 'local', accountId: A, date: '2026-09-25',
      workouts: [{ ...persistedWorkout, id: PRIOR, local_version: computeLocalHealthLogicalVersion([prior])!,
        sets: [{ type: 'strength', set: 1, kg: 70, reps: 5, done: true }, { type: 'strength', set: 2, kg: 60, reps: 5, done: false }] }] }); });
    await settle(); expect(cue()).toBeNull();
    mocks.previousGate = null;
    await act(async () => { mocks.mutationGate!.resolve(); await saving; });
    await waitFor(() => expect(cue()?.textContent).toContain('70'));
    await act(async () => { heldPrevious.resolve(); }); await settle(); expect(cue()?.textContent).toContain('70');
    expect(host.querySelectorAll('[data-k126-workout-exercise-card] input[inputmode="decimal"]')).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>('[data-k126-workout-exercise-card] input[inputmode="decimal"]')!.value).toBe('20');
    expect(host.querySelector('[data-health-workout-editor]')?.textContent ?? host.textContent).not.toContain('healthPreviousUnavailable');
    expect(host.querySelectorAll('[data-k126-workout-exercise-card] input')).not.toHaveLength(0);
    const stored = (await repo.readAll()).workout_logs.find(row => row.id === PRIOR)!;
    expect(JSON.stringify(stored)).not.toContain('900');
  });
  it('local read failure has explicit unavailable status, never false NO_MATCH; bootstrap can recover', async () => {
    mocks.realPrevious = true; await mount(); await waitFor(() => expect(cue()?.textContent).toContain('30'));
    mocks.previousFailure = true;
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(host.querySelector('[data-health-previous-state="UNAVAILABLE"]')).not.toBeNull());
    expect(cue()).toBeNull(); expect(host.querySelector('[data-health-previous-state="NO_MATCH"]')).toBeNull();
    mocks.previousFailure = false;
    act(() => window.dispatchEvent(new Event('health-bootstrap-complete')));
    await waitFor(() => expect(cue()?.textContent).toContain('30'));
  });
  it('failed real delete attempt requalifies unchanged history, not absence; current draft survives', async () => {
    mocks.realPrevious = true; await mount(); await waitFor(() => expect(cue()?.textContent).toContain('30'));
    const { deleteHealthWorkout } = await import('./views/features/health/healthWorkoutPersistence');
    const before = mocks.previousReads.mock.calls.length;
    let deletion!: Promise<unknown>;
    act(() => { deletion = deleteHealthWorkout({ mode: 'local', accountId: A, workoutId: PRIOR, expectedVersion: 'incorrect' }).catch(error => error); });
    await settle(); expect(cue()).toBeNull();
    await act(async () => { mocks.mutationGate!.resolve(); await deletion; });
    await waitFor(() => expect(cue()?.textContent).toContain('30'));
    expect(mocks.previousReads).toHaveBeenCalledTimes(before + 1);
    expect(host.querySelectorAll('[data-k126-workout-exercise-card] input[inputmode="decimal"]')).toHaveLength(1);
  });
});

describe('PR770 bounded correction: mounted workflow and trust regressions', () => {
  const SQUAT = '66666666-6666-4666-8666-666666666666';
  const PULL = '77777777-7777-4777-8777-777777777777';
  const PRESET_B = '88888888-8888-4888-8888-888888888888';
  const cards = () => [...host.querySelectorAll<HTMLElement>('[data-k126-workout-exercise-card]')];
  const cue = () => host.querySelector('[data-health-previous-micro-cue]');
  const rejected = () => host.querySelector('[data-test-parent-rejected]')?.getAttribute('data-test-parent-rejected');
  const input = () => host.querySelector<HTMLInputElement>('[data-routine-idx] input[type="number"]')!;
  const change = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
    const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
  };
  const load = (day = 'Day 1') => change([...host.querySelectorAll('select')]
    .find(item => item.querySelector('option[value="__load__"]'))!, day);
  async function routines(extraPreset = false) {
    const { createRoutinePresetState, writeRoutinePresetState } = await import('./views/features/health/routinePresets');
    const state = createRoutinePresetState({ splitCount: 2, routines: [
      { id: 'r-a', day_name: 'Day 1', blocks: [BLOCK, SQUAT] },
      { id: 'r-b', day_name: 'Day 2', blocks: [PULL] },
    ], plannedSetsByDay: { 'Day 2': { [PULL]: 4 } } });
    if (extraPreset) state.presets.push({ ...structuredClone(state.presets[0]), id: PRESET_B, name: 'B' });
    writeRoutinePresetState(localStorage, A, state);
    mocks.extraBlocks = [
      { id: SQUAT, name: 'Squat', type: 'strength', tags: [] },
      { id: PULL, name: 'Pull', type: 'strength', tags: [] },
    ];
    mocks.realPrevious = true;
    mocks.accountWorkouts.set(A, [{ ...mocks.accountWorkouts.get(A)![0], id: 'temp-edited-bench' }]);
    return state.activePresetId;
  }
  async function heldLoad() {
    await mount(); await settle();
    await act(async () => btn('editBtn')?.click());
    const gate = deferredVoid(); mocks.previousGate = gate;
    act(() => window.dispatchEvent(new Event('health-bootstrap-complete'))); await settle();
    await act(async () => load()); await settle();
    return async () => { mocks.previousGate = null; await act(async () => gate.resolve()); await settle(); };
  }
  it('R01-A held history never resurrects an edited row removed after capture', async () => {
    await routines(); const release = await heldLoad();
    await act(async () => cards()[0].querySelector<HTMLButtonElement>('button.absolute')!.click());
    expect(cards()).toHaveLength(0);
    await release();
    expect(cards()).toHaveLength(1); expect(cards()[0].textContent).toContain('Squat');
    expect(cards().some(card => card.textContent?.includes('Bench'))).toBe(false);
  });
  it('R01-B preset A → B → A does not revive an old load intention', async () => {
    const presetA = await routines(true); const release = await heldLoad();
    const select = () => host.querySelector<HTMLSelectElement>('select[aria-label="healthPresetLabel"]')!;
    await act(async () => change(select(), PRESET_B)); await settle();
    expect(select().value).toBe(PRESET_B);
    await act(async () => change(select(), presetA)); await settle(); expect(select().value).toBe(presetA);
    await release();
    expect(cards()).toHaveLength(1); expect(cards()[0].textContent).toContain('Bench');
  });
  it('R01-C later explicit-count routine B completes before held A, which cannot publish last', async () => {
    await routines(); const release = await heldLoad();
    await act(async () => load('Day 2')); await settle();
    expect(cards().some(card => card.textContent?.includes('Pull'))).toBe(true);
    await release();
    expect(cards().some(card => card.textContent?.includes('Pull'))).toBe(true);
    expect(cards().some(card => card.textContent?.includes('Squat'))).toBe(false);
  });
  it('R01-D current edits survive; R01-E a still-current genuinely new routine row is added', async () => {
    await routines(); const release = await heldLoad();
    const weight = cards()[0].querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    await act(async () => change(weight, '41'));
    await release();
    expect(cards()).toHaveLength(2);
    expect(cards()[0].querySelector<HTMLInputElement>('input[inputmode="decimal"]')!.value).toBe('41');
    expect(cards()[1].textContent).toContain('Squat');
    expect(cards()[1].querySelectorAll('input[inputmode="decimal"]')).toHaveLength(3);
  });

  async function history(count: number | null) {
    const driver = await createLocalHealthDriver(); const repo = new HealthRepository(driver, A);
    const row = (await repo.readAll()).workout_logs.find(value => value.id === PRIOR);
    if (count === null) {
      if (row) await repo.deleteWorkout(PRIOR, computeLocalHealthLogicalVersion([row])!);
    } else await repo.saveWorkouts([{ ...(row ? { id: PRIOR } : {}), date: '2026-09-25', blockId: BLOCK,
      sortOrder: 0, expectedVersion: row ? computeLocalHealthLogicalVersion([row])! : null,
      sets: Array.from({ length: count }, (_, n) => ({ type: 'strength', set: n + 1, kg: 30, reps: 6, done: true })) }]);
    driver.close();
  }
  async function assembly(count: number | null = 2, explicit?: number) {
    const { createRoutinePresetState, writeRoutinePresetState } = await import('./views/features/health/routinePresets');
    writeRoutinePresetState(localStorage, A, createRoutinePresetState({ splitCount: 1,
      routines: [{ id: 'routine', day_name: 'Day 1', blocks: [BLOCK] }],
      plannedSetsByDay: explicit ? { 'Day 1': { [BLOCK]: explicit } } : {} }));
    await history(count); mocks.realPrevious = true;
    await mount(); await settle(); await act(async () => btn('assembleBtn').click());
  }
  async function refreshHistory(count = 5, fail = false) {
    await history(count); const gate = deferredVoid(); mocks.previousGate = gate; mocks.previousFailure = fail;
    act(() => window.dispatchEvent(new Event('health-bootstrap-complete'))); await settle();
    return async () => {
      mocks.previousGate = null; await act(async () => gate.resolve());
      if (fail) await waitFor(() => expect(host.querySelector('[data-health-previous-state="UNAVAILABLE"]')).not.toBeNull());
      else await waitFor(() => expect(cue()?.textContent).toContain('30'));
    };
  }
  it.each([false, true])('R02-A/B initialized 2 survives refresh (failure=%s)', async fail => {
    await assembly(); expect(input().value).toBe('2');
    const release = await refreshHistory(5, fail); expect(input().value).toBe('2');
    await release(); expect(input().value).toBe('2');
  });
  it('R02-C manual 4 and explicit preset precedence survive replacement history', async () => {
    await assembly(2, 7); expect(input().value).toBe('7');
    await act(async () => change(input(), '4'));
    const release = await refreshHistory(); expect(input().value).toBe('4');
    await release(); expect(input().value).toBe('4');
  });
  it.each([false, true])('R02-D unavailable is not no-match; first qualification respects manual=%s', async manual => {
    mocks.previousFailure = true; await assembly(); expect(input().value).toBe('');
    if (manual) await act(async () => change(input(), '4'));
    mocks.previousFailure = false;
    act(() => window.dispatchEvent(new Event('health-bootstrap-complete')));
    await waitFor(() => expect(cue()?.textContent).toContain('30'));
    expect(input().value).toBe(manual ? '4' : '2');
  });
  it('R02-E verified no-match initializes exact default 3 once; R02-F a new modal lifetime may use 5', async () => {
    await assembly(null); expect(input().value).toBe('3');
    const release = await refreshHistory(); await release(); expect(input().value).toBe('3');
    const modal = btn('saveRoutine').closest('.fixed')!;
    await act(async () => modal.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.querySelector('[data-routine-idx]')).toBeNull();
    await act(async () => btn('assembleBtn').click()); await waitFor(() => expect(input().value).toBe('5'));
  });
  it('R02 new preset lifetime closes the old assembly and initializes its own explicit count', async () => {
    await routines(true); await history(2);
    const { readRoutinePresetState, writeRoutinePresetState } = await import('./views/features/health/routinePresets');
    const state = readRoutinePresetState(localStorage, A)!;
    state.presets.find(preset => preset.id === PRESET_B)!.days[0].plannedSets[BLOCK] = 7;
    writeRoutinePresetState(localStorage, A, state);
    await mount(); await settle(); await act(async () => btn('assembleBtn').click());
    expect(input().value).toBe('2'); await act(async () => change(input(), '4'));
    await act(async () => change(host.querySelector<HTMLSelectElement>('select[aria-label="healthPresetLabel"]')!, PRESET_B));
    await settle(); expect(host.querySelector('[data-routine-idx]')).toBeNull();
    await act(async () => btn('assembleBtn').click()); expect(input().value).toBe('7');
  });
  it('R02 selected-date history changes retain an already owned manual assembly count', async () => {
    await assembly(); expect(input().value).toBe('2');
    await act(async () => change(input(), '4')); await history(5);
    await act(async () => mocks.healthProps.at(-1)!.setSelectedDate(new Date('2026-09-28T12:00:00Z')));
    expect(input().value).toBe('4');
    await waitFor(() => expect(mocks.previousReads.mock.calls.some(args => args[1] === '2026-09-28')).toBe(true));
    await waitFor(() => expect(cue()?.textContent).toContain('30')); expect(input().value).toBe('4');
  });

  async function trust() {
    mocks.realPrevious = true; mocks.alignedRangeIdentity = true;
    await mount(); await waitFor(() => expect(cue()?.textContent).toContain('30'));
  }
  async function isolate(boundary: 'range' | 'b1') {
    const { CompositeWorkoutReadIsolationError } = await import('./views/features/health/compositeWorkoutReadProjection');
    const failure = new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH');
    if (boundary === 'range') { mocks.rangeFailure = failure; act(() => range().retry()); }
    else { mocks.selectedFailure = failure; act(() => mocks.healthProps.at(-1)!.selectedDayComposite!.retry()); }
    await waitFor(() => expect(rejected()).toBe('true'));
    expect(cue()).toBeNull(); expect(host.querySelector('[data-k107-workout-pr-badge]')).toBeNull();
  }
  it.each([false, true])('R03-A/B/C range isolation remains latched through held retry (ordinary failure=%s)', async fail => {
    await trust(); await isolate('range');
    const reads = mocks.previousReads.mock.calls.length, gate = deferredVoid();
    mocks.rangeFailure = fail ? new Error('ordinary-range-retry-failed') : null; mocks.rangeGate = gate;
    act(() => range().retry()); await settle();
    expect(range().phase).toBe('loading'); expect(rejected()).toBe('true'); expect(cue()).toBeNull();
    expect(mocks.previousReads).toHaveBeenCalledTimes(reads);
    mocks.rangeGate = null; await act(async () => gate.resolve()); await settle();
    if (fail) { expect(rejected()).toBe('true'); expect(cue()).toBeNull(); }
    else { await waitFor(() => expect(cue()?.textContent).toContain('30')); expect(rejected()).toBe('false'); }
  });
  it.each([false, true])('R03-D/E B1 isolation survives loading/null and requires affirmative success (ordinary failure=%s)', async fail => {
    await trust(); await isolate('b1');
    const reads = mocks.previousReads.mock.calls.length;
    mocks.selectedFailure = fail ? new Error('ordinary-b1-retry-failed') : null; mocks.holdNextSelectedRead = true;
    act(() => mocks.healthProps.at(-1)!.selectedDayComposite!.retry()); await settle();
    expect(mocks.healthProps.at(-1)!.selectedDayComposite!.phase).toBe('loading');
    expect(mocks.healthProps.at(-1)!.selectedDayComposite!.cacheKey).toBeNull();
    expect(rejected()).toBe('true'); expect(cue()).toBeNull(); expect(mocks.previousReads).toHaveBeenCalledTimes(reads);
    await act(async () => mocks.heldSelectedReads.shift()!()); await settle();
    if (fail) { expect(rejected()).toBe('true'); expect(cue()).toBeNull(); }
    else { await waitFor(() => expect(cue()?.textContent).toContain('30')); expect(rejected()).toBe('false'); }
  });
  it('R03-F ordinary canonical failure/loading without typed rejection retains qualified compatibility proof', async () => {
    await trust(); const reads = mocks.previousReads.mock.calls.length;
    const gate = deferredVoid(); mocks.rangeGate = gate; mocks.rangeFailure = new Error('ordinary');
    act(() => range().retry()); await settle(); expect(cue()?.textContent).toContain('30');
    mocks.rangeGate = null; await act(async () => gate.resolve()); await settle();
    expect(rejected()).toBe('false'); expect(cue()?.textContent).toContain('30');
    expect(mocks.previousReads).toHaveBeenCalledTimes(reads);
  });
  it('R03-G old rejection does not poison a newly admitted account/namespace or leak old evidence', async () => {
    await trust(); await isolate('range'); mocks.rangeFailure = null;
    // B's legacy absence must also be verified, not an unbootstrapped source.
    const datasets = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
    datasets.exercise_blocks.push({ ...persistedWorkout.exercise_blocks, user_id: B, cardio_mode: null });
    const built = await buildHealthRecoveryExport({ sourceAccount: { userId: B, email: 'b@example.test' },
      exportedAt: '2026-09-29T00:00:00.000Z', datasets });
    const counts = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, datasets[name].length])) as PendingLocalHealthImportState['datasetCounts'];
    const driver = await createLocalHealthDriver();
    await driver.commitPendingImportAtomically({ accountId: B, datasets, expectedImportState: null,
      pendingImportState: { accountId: B, status: 'IMPORT_COMMITTED_PENDING_READBACK', snapshotId: 'new-b-trust',
        importedAt: built.exportedAt, sourceExportedAt: built.exportedAt, sourceFileSha256: '2'.repeat(64),
        sourceContentSha256: built.checksum.value, totalRowCount: 1, datasetCounts: counts, diagnostics: built.diagnostics } });
    await driver.finalizePendingIfStillCurrent({ accountId: B, expectedSnapshotId: 'new-b-trust' }); driver.close();
    mocks.accountWorkouts.set(B, [{ ...structuredClone(persistedWorkout), id: 'temp-b', sets: [
      { type: 'strength', set: 1, kg: 55, reps: 5, done: true },
    ] }]);
    const { AppContent } = await import('./AppContent');
    await act(async () => root!.render(createElement(AppContent, { authUser: user(B) })));
    await waitFor(() => expect(mocks.healthProps.at(-1)!.selectedDayComposite?.accountId).toBe(B));
    await waitFor(() => expect(rejected()).toBe('false'));
    await waitFor(() => expect(host.querySelector('[data-health-previous-state="NO_MATCH"]')).not.toBeNull());
    expect(cue()).toBeNull(); expect(host.textContent).not.toContain('30 kg');
  });
});
