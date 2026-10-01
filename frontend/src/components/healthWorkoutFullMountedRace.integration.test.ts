// @vitest-environment happy-dom
import { createElement, useEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DeferredVoid = Readonly<{ promise: Promise<void>; resolve: () => void }>;

const mocks = vi.hoisted(() => ({
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
  isHealthWorkoutRangeCompositeEnabled: ({ healthActive, accountPresent }: { healthActive: boolean; accountPresent: boolean }) => healthActive && accountPresent,
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
  loadVerifiedSelectedDayLegacySnapshot: (accountId: string) => {
    const version = mocks.accountVersions.get(accountId) ?? 0;
    const workouts = structuredClone(mocks.accountWorkouts.get(accountId) ?? []);
    const held = mocks.holdNextSelectedRead;
    mocks.holdNextSelectedRead = false;
    mocks.selectedReads.push({ accountId, version, count: workouts.length, held });
    mocks.events.push(`selected-read:${accountId}:v${version}:${held ? 'held' : 'live'}`);
    const value = {
      persistedRows: workouts.filter(workout => workout.block_id !== '__session__').map((workout, index) => ({
        accountId, rowId: String(workout.id), localDate: '2026-09-29', blockId: String(workout.block_id), sortOrder: index,
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
vi.mock('./views/features/health/verifiedWorkoutRangeSnapshot', () => {
  class WorkoutReadSnapshotCoordinator {
    accountId: string;
    currentSnapshot: null | { version: number; workouts: Array<Record<string, unknown>> } = null;
    constructor(accountId: string) { this.accountId = accountId; }
    load() {
      const snapshot = {
        version: mocks.accountVersions.get(this.accountId) ?? 0,
        workouts: structuredClone(mocks.accountWorkouts.get(this.accountId) ?? []),
      };
      const held = mocks.holdNextRangeRead;
      mocks.holdNextRangeRead = false;
      mocks.rangeLoads.push({ accountId: this.accountId, version: snapshot.version, count: snapshot.workouts.length, held });
      mocks.events.push(`range-load:${this.accountId}:v${snapshot.version}:${held ? 'held' : 'live'}`);
      if (!held) {
        this.currentSnapshot = snapshot;
        return Promise.resolve({ accountId: this.accountId, scope: null, result: { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records: [] } });
      }
      return new Promise<object>(resolve => {
        mocks.heldRangeReads.push(() => resolve({ accountId: this.accountId, scope: null, result: { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records: [] } }));
      });
    }
    deriveRange(startDate: string, endDate: string) {
      const snapshot = this.currentSnapshot;
      if (!snapshot) return Promise.resolve(null);
      mocks.rangeDerives.push({ accountId: this.accountId, version: snapshot.version, startDate, endDate });
      const localDate = '2026-09-29';
      const inRange = localDate >= startDate && localDate <= endDate && snapshot.workouts.length > 0;
      const records = inRange ? snapshot.workouts.map((workout, index) => ({
        source: 'legacy', readId: JSON.stringify(['legacy', this.accountId, workout.id ?? index]), localDate,
        capability: 'read_only', legacy: { accountId: this.accountId, rowId: String(workout.id ?? index), localDate,
          blockId: String(workout.block_id ?? 'bench'), sortOrder: index,
          exerciseDisplay: { kind: 'historical_fallback', name: String((workout.exercise_blocks as { name?: string })?.name ?? 'Bench') },
          sets: structuredClone(workout.sets ?? []) },
      })) : [];
      return Promise.resolve({
        accountId: this.accountId, scope: null, startDate, endDate,
        result: { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records },
        dates: inRange ? [{ localDate, legacyRows: records, canonicalSessions: [] }] : [],
      });
    }
    invalidate() {
      this.currentSnapshot = null;
      mocks.rangeInvalidations.push(this.accountId);
      mocks.events.push(`range-invalidate:${this.accountId}`);
    }
    close() { this.currentSnapshot = null; }
  }
  return { WorkoutReadSnapshotCoordinator };
});
vi.mock('../lib/healthLocalRuntime', () => ({
  createLocalHealthRepository: async (accountId: string) => ({
    saveWorkouts: async (rows: Array<Record<string, unknown>>) => {
      mocks.repositoryEvents.push(`save-start:${accountId}`);
      await mocks.mutationGate?.promise;
      const nextVersion = (mocks.accountVersions.get(accountId) ?? 0) + 1;
      const previous = mocks.accountWorkouts.get(accountId) ?? [];
      const saved = rows.map((row, index) => ({
        id: row.id ?? previous[index]?.id ?? `00000000-0000-4000-8000-00000000000${index + 1}`,
        block_id: row.blockId,
        exercise_blocks: previous[index]?.exercise_blocks ?? { id: row.blockId, name: 'Bench', type: 'strength', tags: [] },
        sets: structuredClone(row.sets ?? []),
        local_version: `v${nextVersion}`,
      }));
      mocks.accountWorkouts.set(accountId, saved);
      mocks.accountVersions.set(accountId, nextVersion);
      mocks.repositoryEvents.push(`save-commit:${accountId}:v${nextVersion}`);
      return saved.map(row => ({ id: row.id, version: row.local_version }));
    },
    deleteWorkout: async (workoutId: string) => {
      mocks.repositoryEvents.push(`delete-start:${accountId}`);
      await mocks.mutationGate?.promise;
      const nextVersion = (mocks.accountVersions.get(accountId) ?? 0) + 1;
      mocks.accountWorkouts.set(accountId, (mocks.accountWorkouts.get(accountId) ?? []).filter(row => row.id !== workoutId));
      mocks.accountVersions.set(accountId, nextVersion);
      mocks.repositoryEvents.push(`delete-commit:${accountId}:v${nextVersion}`);
    },
  }),
  readLocalHealthWorkoutRange: vi.fn(async () => []),
  readLocalPreviousWorkoutRows: vi.fn(async () => []),
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
  healthBlocks: [{ id: 'bench', name: 'Bench', type: 'strength', tags: [] }], healthBlocksState: {}, healthRoutines: [],
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
vi.mock('./views/features/health/WorkoutPrBadge', () => ({ WorkoutPrBadge: () => null }));
vi.mock('./views/features/health/PreviousWorkoutView', () => ({ PreviousWorkoutView: () => null }));
vi.mock('./views/features/health/PreviousWorkoutSheet', () => ({ PreviousWorkoutSheet: () => null }));
vi.mock('./views/features/health/HealthMobileWorkoutActions', () => ({ HealthMobileWorkoutActions: () => null }));
vi.mock('./views/features/health/prevWorkoutFetch', () => ({ fetchPrevWorkoutForBlocks: vi.fn(async () => ({})) }));
vi.mock('./views/features/health/recovery/recoveryNotes', () => ({ getRecoveryEntry: () => null }));
vi.mock('./views/features/health/healthSectionPrefs', () => ({ readHealthSectionPrefs: () => ({}) }));
vi.mock('./views/features/health/buildHealthProjection', () => ({ buildHealthProjection: () => ({ workoutDates: [] }) }));
vi.mock('./views/features/health/computeWorkoutPrBadge', () => ({ computeWorkoutPrBadgeMap: () => ({}) }));
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

const persistedWorkout = {
  id: '11111111-1111-4111-8111-111111111111', block_id: 'bench', local_version: 'v1',
  exercise_blocks: { id: 'bench', name: 'Bench', type: 'strength', tags: [] },
  sets: [{ type: 'strength', set: 1, kg: '20', reps: '5', done: true }],
};
const user = (id: string) => ({ id, email: `${id}@example.com` } as never);

function deferredVoid(): DeferredVoid {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

let root: Root | null;
let host: HTMLDivElement;

async function settle() {
  await act(async () => {
    for (let index = 0; index < 16; index += 1) await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function waitFor(assertion: () => void) {
  let failure: unknown;
  for (let index = 0; index < 40; index += 1) {
    await settle();
    try { assertion(); return; } catch (error) { failure = error; }
  }
  throw failure;
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button')).find(candidate => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`Button not rendered: ${text}`);
  return button;
}

function deleteButton(): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>('[data-k126-workout-exercise-card] button.absolute');
  if (!button) throw new Error('Workout delete button not rendered');
  return button;
}

async function mountHealth() {
  // Preload the real lazy target so timing measures the mounted lifecycle,
  // not the test transformer's first-module compilation.
  await import('./views/HealthView');
  const { AppContent } = await import('./AppContent');
  await act(async () => {
    root = createRoot(host);
    root.render(createElement(AppContent, { authUser: user('account-a') }));
  });
  await waitFor(() => expect(host.querySelector('[data-testid="nav-health"]')).not.toBeNull());
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
  await waitFor(() => {
    expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:v1');
    expect(host.querySelector('[data-testid="range-state"]')?.textContent).toBe('settled:1');
  });
  return AppContent;
}

async function transitionToA2(AppContent: Awaited<ReturnType<typeof mountHealth>>) {
  await act(async () => root!.render(createElement(AppContent, { authUser: user('account-b') })));
  await waitFor(() => expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-b:empty'));
  await act(async () => root!.render(createElement(AppContent, { authUser: user('account-a') })));
  await waitFor(() => {
    expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:v1');
    expect(host.querySelector('[data-testid="range-state"]')?.textContent).toBe('settled:1');
  });
}

async function startHeldA2Reads() {
  mocks.holdNextSelectedRead = true;
  mocks.holdNextRangeRead = true;
  await act(async () => window.dispatchEvent(new Event('focus')));
  await waitFor(() => {
    expect(mocks.heldSelectedReads).toHaveLength(1);
    expect(mocks.heldRangeReads).toHaveLength(1);
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.accountWorkouts.clear();
  mocks.accountWorkouts.set('account-a', [structuredClone(persistedWorkout)]);
  mocks.accountWorkouts.set('account-b', []);
  mocks.accountVersions.clear();
  mocks.accountVersions.set('account-a', 1);
  mocks.accountVersions.set('account-b', 0);
  mocks.mutationGate = deferredVoid();
  mocks.holdNextSelectedRead = false;
  mocks.holdNextRangeRead = false;
  mocks.heldSelectedReads.length = 0;
  mocks.heldRangeReads.length = 0;
  mocks.selectedReads.length = 0;
  mocks.rangeLoads.length = 0;
  mocks.rangeDerives.length = 0;
  mocks.rangeInvalidations.length = 0;
  mocks.events.length = 0;
  mocks.repositoryEvents.length = 0;
  mocks.homeModels.length = 0;
  mocks.showToast.mockReset();
  mocks.mutateDaily.mockReset();
  mocks.mutateStatic.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = null;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host.remove();
});

describe('REL-05G5B2B2B fully mounted save/delete ABA races', () => {
  it('routes an A1 save commit into settled A2 readers and fences old pending reads and UI continuation', async () => {
    const AppContent = await mountHealth();
    await act(async () => buttonWithText('editBtn').click());
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click();
      await Promise.resolve();
    });
    expect(mocks.repositoryEvents).toContain('save-start:account-a');

    await transitionToA2(AppContent);
    expect(mocks.selectedReads.at(-1)).toMatchObject({ accountId: 'account-a', version: 1, count: 1 });
    expect(mocks.rangeDerives.at(-1)).toMatchObject({ accountId: 'account-a', version: 1 });
    await startHeldA2Reads();
    const invalidationsBeforeCommit = mocks.rangeInvalidations.filter(account => account === 'account-a').length;

    await act(async () => {
      mocks.mutationGate!.resolve();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    await waitFor(() => {
      expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:v2');
      expect(mocks.rangeDerives.some(read => read.accountId === 'account-a' && read.version === 2)).toBe(true);
    });
    expect(mocks.rangeInvalidations.filter(account => account === 'account-a').length).toBeGreaterThan(invalidationsBeforeCommit);
    expect(mocks.showToast.mock.calls.map(call => call[0])).not.toContain('workoutSaved');

    await act(async () => {
      mocks.heldSelectedReads.splice(0).forEach(release => release());
      mocks.heldRangeReads.splice(0).forEach(release => release());
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:v2');
    expect(host.querySelector('[data-testid="range-state"]')?.textContent).toBe('settled:1');
    expect(mocks.selectedReads.filter(read => read.held && read.version === 1)).toHaveLength(1);
    expect(mocks.rangeLoads.filter(read => read.held && read.version === 1)).toHaveLength(1);
  });

  it('routes an A1 delete commit into settled A2 readers and prevents stale pre-delete resurrection', async () => {
    const AppContent = await mountHealth();
    await act(async () => buttonWithText('editBtn').click());
    await act(async () => {
      deleteButton().click();
      await Promise.resolve();
    });
    expect(mocks.repositoryEvents).toContain('delete-start:account-a');

    await transitionToA2(AppContent);
    expect(host.querySelectorAll('[data-k126-workout-exercise-card]')).toHaveLength(1);
    await startHeldA2Reads();
    const invalidationsBeforeCommit = mocks.rangeInvalidations.filter(account => account === 'account-a').length;

    await act(async () => {
      mocks.mutationGate!.resolve();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    await waitFor(() => {
      expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:empty');
      expect(host.querySelector('[data-testid="range-state"]')?.textContent).toBe('settled:0');
    });
    expect(mocks.rangeInvalidations.filter(account => account === 'account-a').length).toBeGreaterThan(invalidationsBeforeCommit);
    expect(mocks.showToast.mock.calls.map(call => call[0])).not.toContain('workoutSaved');

    await act(async () => {
      mocks.heldSelectedReads.splice(0).forEach(release => release());
      mocks.heldRangeReads.splice(0).forEach(release => release());
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    });
    expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:empty');
    expect(host.querySelector('[data-testid="range-state"]')?.textContent).toBe('settled:0');
  });
});

describe('REL-05G5B2B2C real Health-origin commits into real Home', () => {
  it.each(['save', 'delete'] as const)('routes late A1 %s to A2 Home and discards pre-commit pair/UI', async operation => {
    const AppContent = await mountHealth();
    await act(async () => buttonWithText('editBtn').click());
    await act(async () => {
      if (operation === 'save') host.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click();
      else deleteButton().click();
      await Promise.resolve();
    });
    expect(mocks.repositoryEvents).toContain(`${operation}-start:account-a`);
    await act(async () => root!.render(createElement(AppContent, { authUser: user('account-b') })));
    await waitFor(() => expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-b:empty'));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-home"]')!.click());
    await act(async () => root!.render(createElement(AppContent, { authUser: user('account-a') })));
    await waitFor(() => {
      expect(host.querySelector('[data-home-workout-presence="present"]')).not.toBeNull();
      expect(mocks.homeModels.at(-1)?.legacyDaily?.workouts?.[0]?.local_version).toBe('v1');
    });
    mocks.holdNextSelectedRead = true;
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(mocks.heldSelectedReads).toHaveLength(1));
    expect(host.querySelector('[data-home-workout-composite="loading"]')).not.toBeNull();
    expect(host.querySelector('[data-home-workout-legacy]')).toBeNull();
    const rangeBefore = mocks.rangeInvalidations.length;
    await act(async () => mocks.mutationGate!.resolve());
    await waitFor(() => {
      expect(mocks.selectedReads.at(-1)).toMatchObject({ accountId: 'account-a', version: 2, held: false });
      expect(host.querySelector('[data-home-workout-presence]')?.getAttribute('data-home-workout-presence'))
        .toBe(operation === 'save' ? 'present' : 'absent');
      expect(mocks.homeModels.at(-1)?.phase).toBe('settled');
    });
    expect(mocks.rangeInvalidations).toHaveLength(rangeBefore); // Range is still Health-only.
    const settled = mocks.homeModels.at(-1);
    await act(async () => mocks.heldSelectedReads.splice(0).forEach(release => release()));
    await settle();
    expect(mocks.homeModels.at(-1)?.legacyDaily).toBe(settled?.legacyDaily);
    expect(host.querySelector('[data-testid="selected-state"]')).toBeNull();
    expect(mocks.showToast.mock.calls.map(call => call[0])).not.toContain('workoutSaved');
  });

  it.each(['save', 'delete'] as const)('late A %s cannot invalidate current B Home', async operation => {
    const AppContent = await mountHealth();
    await act(async () => buttonWithText('editBtn').click());
    await act(async () => {
      if (operation === 'save') host.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click();
      else deleteButton().click();
      await Promise.resolve();
    });
    await act(async () => root!.render(createElement(AppContent, { authUser: user('account-b') })));
    await waitFor(() => expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-b:empty'));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-home"]')!.click());
    await waitFor(() => expect(host.querySelector('[data-home-workout-presence="absent"]')).not.toBeNull());
    const reads = mocks.selectedReads.length, invalidations = mocks.rangeInvalidations.length;
    await act(async () => mocks.mutationGate!.resolve()); await settle();
    expect(mocks.selectedReads).toHaveLength(reads); expect(mocks.rangeInvalidations).toHaveLength(invalidations);
    expect(mocks.homeModels.at(-1)?.accountId).toBe('account-b');
    expect(host.querySelector('[data-home-workout-legacy]')).toBeNull();
  });
});
