// @vitest-environment happy-dom
import { createElement, useEffect, useLayoutEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DeferredVoid = Readonly<{ promise: Promise<void>; resolve: () => void }>;

const mocks = vi.hoisted(() => ({
  saving: undefined as boolean | undefined,
  locked: undefined as boolean | undefined,
  baselineSavingLine: -1,
  baselineLockedLine: -1,
  candidateSavingLine: -1,
  candidateLockedLine: -1,
  subject: null as any,
  verifiedLegacyProjection: false,
  selectDate: null as null | ((date: Date) => void),
  latestDraft: null as any,
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
  dispatches: [] as any[],
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

// Transparent named-state observation. Delegates both value and setter unchanged;
// the normal oracle never creates state or supplies a production observer API.
vi.mock('react', async importOriginal => {
  const real = await importOriginal<typeof import('react')>();
  const fs = await import('node:fs');
  const source = fs.readFileSync('src/components/views/HealthView.tsx', 'utf8').split(/\r?\n/);
  const saving = source.findIndex(line => line.includes('const [isSaving, setIsSaving] = useState')) + 1;
  const locked = source.findIndex(line => line.includes('const [isWorkoutLocked, setIsWorkoutLocked] = useState')) + 1;
  return { ...real, useState: ((...args: any[]) => {
    const result = (real.useState as any)(...args);
    const stack = new Error().stack;
    const line = Number(stack?.match(/HealthView\.tsx:(\d+):/)?.[1]);
    const baselineLine = Number(stack?.match(/HealthViewBaseline\.js:(\d+):/)?.[1]);
    const candidateLine = Number(stack?.match(/HealthViewCandidate\.js:(\d+):/)?.[1]);
    if (candidateLine === mocks.candidateSavingLine) mocks.saving = result[0];
    if (candidateLine === mocks.candidateLockedLine) mocks.locked = result[0];
    if (line === saving || baselineLine === mocks.baselineSavingLine) mocks.saving = result[0];
    if (line === locked || baselineLine === mocks.baselineLockedLine) mocks.locked = result[0];
    return result;
  }) as typeof real.useState };
});

vi.mock('./views/HealthView', async importOriginal => {
  const real = await importOriginal<typeof import('./views/HealthView')>();
  return { ...real, HealthView: (props: Parameters<typeof real.HealthView>[0]) =>
    createElement(mocks.subject ?? real.HealthView, props) };
});

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
vi.mock('./views/features/health/selectedDayLegacySnapshot', async importOriginal => {
  const real = await importOriginal<typeof import('./views/features/health/selectedDayLegacySnapshot')>();
  return { loadVerifiedSelectedDayLegacySnapshot: (accountId: string, localDate = '2026-09-29') => {
    const version = mocks.accountVersions.get(accountId) ?? 0;
    const workouts = structuredClone(mocks.accountWorkouts.get(accountId) ?? [])
      .filter(row => (row.date ?? '2026-09-29') === localDate);
    const held = mocks.holdNextSelectedRead;
    mocks.holdNextSelectedRead = false;
    mocks.selectedReads.push({ accountId, version, count: workouts.length, held });
    mocks.events.push(`selected-read:${accountId}:v${version}:${held ? 'held' : 'live'}`);
    const value = mocks.verifiedLegacyProjection ? real.projectVerifiedSelectedDayLegacySnapshot({
      exercise_blocks: [{ id: 'bench', user_id: accountId, name: 'Bench', type: 'strength', tags: [] }],
      workout_logs: workouts.map((row, index) => ({ id: row.id, user_id: accountId, date: localDate,
        block_id: row.block_id, sort_order: index, sets: structuredClone(row.sets ?? []), version: row.local_version })),
      inbody_logs: [], health_routines: [], routines: [], routine_logs: [], protein_profiles: [],
      protein_sources: [], protein_intake_logs: [], workout_memos: [],
    }, accountId, localDate) : {
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
  } };
});
vi.mock('./views/features/health/useHealthWorkoutDraft', async importOriginal => {
  const real = await importOriginal<typeof import('./views/features/health/useHealthWorkoutDraft')>();
  return { ...real, useHealthWorkoutDraft: (options: Parameters<typeof real.useHealthWorkoutDraft>[0]) => {
    const state = real.useHealthWorkoutDraft(options);
    useLayoutEffect(() => { mocks.latestDraft = state; });
    return state;
  } };
});
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
vi.mock('../lib/healthLocalRuntime', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/healthLocalRuntime')>();
  return { ...real,
  createLocalHealthRepository: async (accountId: string) => ({
    saveWorkouts: async (rows: Array<Record<string, unknown>>) => {
      mocks.dispatches.push({ kind: 'save', accountId, rows: structuredClone(rows) });
      mocks.repositoryEvents.push(`save-start:${accountId}`);
      mocks.events.push(`save-start:${accountId}`);
      await mocks.mutationGate?.promise;
      const nextVersion = (mocks.accountVersions.get(accountId) ?? 0) + 1;
      const previous = mocks.accountWorkouts.get(accountId) ?? [];
      const saved = rows.map((row, index) => ({
        id: row.id ?? previous[index]?.id ?? `00000000-0000-4000-8000-00000000000${index + 1}`,
        block_id: row.blockId,
        date: row.date,
        exercise_blocks: previous[index]?.exercise_blocks ?? { id: row.blockId, name: 'Bench', type: 'strength', tags: [] },
        sets: structuredClone(row.sets ?? []),
        local_version: `v${nextVersion}`,
      }));
      mocks.accountWorkouts.set(accountId, [...previous.filter(row => row.date && row.date !== rows[0]?.date), ...saved]);
      mocks.accountVersions.set(accountId, nextVersion);
      mocks.repositoryEvents.push(`save-commit:${accountId}:v${nextVersion}`);
      mocks.events.push(`save-commit:${accountId}:v${nextVersion}`);
      return saved.map(row => ({ id: row.id, version: row.local_version }));
    },
    deleteWorkout: async (workoutId: string, expectedVersion: string) => {
      mocks.dispatches.push({ kind: 'delete', accountId, workoutId, expectedVersion });
      mocks.repositoryEvents.push(`delete-start:${accountId}`);
      mocks.events.push(`delete-start:${accountId}`);
      await mocks.mutationGate?.promise;
      const nextVersion = (mocks.accountVersions.get(accountId) ?? 0) + 1;
      mocks.accountWorkouts.set(accountId, (mocks.accountWorkouts.get(accountId) ?? []).filter(row => row.id !== workoutId));
      mocks.accountVersions.set(accountId, nextVersion);
      mocks.repositoryEvents.push(`delete-commit:${accountId}:v${nextVersion}`);
      mocks.events.push(`delete-commit:${accountId}:v${nextVersion}`);
    },
  }),
  readLocalHealthWorkoutRange: vi.fn(async () => []),
  readLocalPreviousWorkoutRows: vi.fn(async () => []),
  };
});
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
vi.mock('./views/features/health/HealthSupportingPanels', () => ({ HealthSupportingPanels: ({ workoutCalendarActivity, setSelectedDate }: {
  workoutCalendarActivity?: { phase: string; knownPresentDates: Set<string> }; setSelectedDate: (date: Date) => void;
}) => {
  mocks.selectDate = setSelectedDate;
  return createElement('div', { 'data-testid': 'range-state' }, workoutCalendarActivity
    ? `${workoutCalendarActivity.phase}:${workoutCalendarActivity.knownPresentDates.size}` : 'legacy');
} }));
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
  if (!mocks.subject) {
    const { loadCandidateHealthView } = await import('../../test-support/healthWorkoutExactMain');
    const loaded = await loadCandidateHealthView(specifier => import(/* @vite-ignore */
      specifier.startsWith('.') ? './views/' + specifier : specifier));
    mocks.subject = loaded.HealthView;
    mocks.candidateSavingLine = loaded.savingLine; mocks.candidateLockedLine = loaded.lockedLine;
  }
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
    if (mocks.verifiedLegacyProjection) expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toMatch(/^settled:account-a:/);
    else expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toBe('settled:account-a:v1');
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

function resetIntegratedFixture() {
  mocks.saving = undefined; mocks.locked = undefined;
  mocks.baselineSavingLine = -1; mocks.baselineLockedLine = -1;
  mocks.candidateSavingLine = -1; mocks.candidateLockedLine = -1; mocks.subject = null;
  mocks.verifiedLegacyProjection = false; mocks.selectDate = null; mocks.latestDraft = null;
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  mocks.accountWorkouts = new Map();
  mocks.accountWorkouts.set('account-a', [structuredClone(persistedWorkout)]);
  mocks.accountWorkouts.set('account-b', []);
  mocks.accountVersions = new Map();
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
  mocks.dispatches.length = 0;
  mocks.homeModels.length = 0;
  mocks.showToast.mockReset();
  mocks.mutateDaily.mockReset();
  mocks.mutateStatic.mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = null;
}
beforeEach(resetIntegratedFixture);

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host.remove();
  vi.unstubAllGlobals();
});

async function editMountedKg(kg: string) {
  const input = host.querySelector<HTMLInputElement>('[data-k126-workout-exercise-card] input[inputmode="decimal"]');
  if (!input) throw new Error('Mounted editable weight input absent');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, kg);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function integratedH08(operation: 'save' | 'delete', control: 'editable' | 'pending' | 'acknowledged', side: 'baseline' | 'candidate' = 'candidate') {
  const { localHealthDraftKey } = await import('../lib/healthBackfillUiSafety');
  const writes: Array<{ key: string; value: string | null }> = [];
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); writes.push({ key, value }); },
    removeItem: key => { values.delete(key); writes.push({ key, value: null }); }, clear: () => values.clear(),
  };
  const x = '2026-09-29', y = '2026-09-30';
  const drafts = [
    { account: 'account-a', date: x, kg: '31', id: persistedWorkout.id },
    { account: 'account-a', date: y, kg: '41', id: '22222222-2222-4222-8222-222222222222' },
    { account: 'account-b', date: y, kg: '51', id: '33333333-3333-4333-8333-333333333333' },
  ].map(({ account, date, kg, id }) => ({ key: localHealthDraftKey(account, date), bytes: JSON.stringify([
    { ...persistedWorkout, id, sets: [{ ...persistedWorkout.sets[0], kg }] },
  ]) }));
  drafts.forEach(({ key, bytes }) => storage.setItem(key, bytes)); writes.length = 0;
  vi.stubGlobal('localStorage', storage);
  mocks.verifiedLegacyProjection = true;
  const checkpoints: any[] = [];
  const observed = () => {
    if (mocks.saving === undefined || mocks.locked === undefined) throw new Error('H08_STATE_OBSERVER_ABSENT');
    return { saving: mocks.saving, locked: mocks.locked,
      rows: structuredClone(mocks.latestDraft.localWorkouts),
      dirty: mocks.latestDraft.isDirty, dirtyRef: mocks.latestDraft.isDirtyRef.current,
      bytes: [...values.entries()], history: structuredClone(writes),
      toasts: structuredClone(mocks.showToast.mock.calls),
      cache: [mocks.mutateDaily.mock.calls.length, mocks.mutateStatic.mock.calls.length],
      savedStatus: host.textContent?.includes('healthSessionSaved') ?? false };
  };
  const restored = (kg: string) => {
    expect(observed()).toMatchObject({ saving: false, locked: false, dirty: true, dirtyRef: true });
    expect(mocks.latestDraft.localWorkouts[0]?.sets[0]?.kg).toBe(kg);
    drafts.forEach(({ key, bytes }) => {
      expect(storage.getItem(key)).toBe(bytes);
      expect(writes.filter(write => write.key === key).every(write => write.value === bytes)).toBe(true);
    });
    checkpoints.push({ label: 'restored-' + kg, ...observed() });
  };
  await mountHealth(); restored('31');
  const x1 = mocks.mutationGate!;
  await act(async () => {
    if (operation === 'save') host.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click();
    else deleteButton().click();
  });
  expect(mocks.dispatches).toHaveLength(1);
  expect(mocks.dispatches[0]).toMatchObject(operation === 'save'
    ? { kind: operation, accountId: 'account-a', rows: [expect.objectContaining({ date: x, expectedVersion: 'v1', id: persistedWorkout.id })] }
    : { kind: operation, accountId: 'account-a', workoutId: persistedWorkout.id, expectedVersion: 'v1' });
  if (operation === 'save') expect(observed().saving).toBe(true);
  await act(async () => mocks.selectDate!(new Date(y + 'T12:00:00Z'))); restored('41');
  await act(async () => mocks.selectDate!(new Date(x + 'T12:00:00Z'))); restored('31');
  await editMountedKg('47');
  expect(observed()).toMatchObject({ saving: false, locked: false, dirty: true, dirtyRef: true });
  expect(mocks.latestDraft.localWorkouts[0].sets[0].kg).toBe('47');
  expect(storage.getItem(drafts[0].key)).toBe(JSON.stringify(mocks.latestDraft.localWorkouts));
  expect(storage.getItem(drafts[0].key)).not.toBe(drafts[0].bytes);
  const x2 = deferredVoid();
  if (control !== 'editable') {
    mocks.mutationGate = x2;
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="health-save-workout"]')!.click());
    expect(observed()).toMatchObject({ saving: true, locked: false });
    if (control === 'acknowledged') {
      await act(async () => x2.resolve()); await settle();
      expect(observed()).toMatchObject({ saving: false, locked: true, dirty: false, dirtyRef: false });
      expect(storage.getItem(drafts[0].key)).toBeNull();
      // Hold the independent, legitimate clean hydration separately from the
      // stale operation continuation. Releasing it later is not an X1 UI ACK.
      mocks.holdNextSelectedRead = true;
    }
  }
  const before = observed(), version = mocks.accountVersions.get('account-a')! + 1;
  mocks.events.length = 0;
  await act(async () => x1.resolve()); await settle();
  const after = observed();
  if (side === 'baseline') {
    expect(after).toMatchObject({ saving: false, dirty: false, dirtyRef: false, locked: operation === 'save' });
    expect(storage.getItem(drafts[0].key)).toBeNull();
    if (operation === 'delete') expect(after.rows).toEqual([]);
    else {
      // The real verified projection may already have hydrated the clean old
      // ACK with its collection-version evidence, not the repository's row v2.
      expect(JSON.parse(after.rows[0].local_version)).toEqual([expect.objectContaining({ id: persistedWorkout.id, version: 'v2' })]);
      expect(Number(after.rows[0].sets[0].kg)).toBe(31);
      expect(after.toasts.length).toBe(before.toasts.length + 1);
    }
  } else {
    if (after.saving !== before.saving) throw new Error('H08_STATE_ORACLE:saving');
    if (after.locked !== before.locked) throw new Error('H08_STATE_ORACLE:locked');
    if (control === 'acknowledged') {
      // The independent B1 refresh intentionally enters loading while its read is
      // held, hiding the settled status panel. That is not a stale UI transition.
      expect(host.querySelector('[data-testid="selected-state"]')?.textContent).toMatch(/^loading:/);
      expect(before.savedStatus).toBe(true); expect(after.savedStatus).toBe(false);
      expect({ ...after, savedStatus: before.savedStatus }).toEqual(before);
    } else expect(after).toEqual(before);
  }
  const commit = mocks.events.indexOf(operation + '-commit:account-a:v' + version);
  const range = mocks.events.indexOf('range-invalidate:account-a');
  const b1 = mocks.events.findIndex(event => event.startsWith('selected-read:account-a:v' + version + ':'));
  expect(commit).toBeGreaterThanOrEqual(0); expect(range).toBeGreaterThan(commit); expect(b1).toBeGreaterThan(range);
  expect(mocks.selectedReads.at(-1)).toMatchObject({ accountId: 'account-a', version });
  expect(mocks.accountWorkouts.get('account-a')).toHaveLength(operation === 'save' ? 1 : 0);
  if (operation === 'save') expect(mocks.accountWorkouts.get('account-a')![0].sets).toEqual(JSON.parse(drafts[0].bytes)[0].sets);
  if (control === 'pending') {
    await act(async () => x2.resolve()); await settle();
    expect(observed()).toMatchObject({ saving: false, locked: true, dirty: false, dirtyRef: false });
    expect(storage.getItem(drafts[0].key)).toBeNull();
    expect(Number(mocks.latestDraft.localWorkouts[0].sets[0].kg)).toBe(47);
  }
  if (control === 'acknowledged') {
    drafts.slice(1).forEach(({ key, bytes }) => expect(storage.getItem(key)).toBe(bytes));
    await act(async () => mocks.heldSelectedReads.splice(0).forEach(release => release())); await settle();
    if (operation === 'save') {
      expect(observed().locked).toBe(true);
      await act(async () => buttonWithText('editBtn').click());
      await editMountedKg('59');
      expect(observed()).toMatchObject({ dirty: true, dirtyRef: true, saving: false, locked: false });
      expect(mocks.latestDraft.localWorkouts[0].sets[0].kg).toBe('59');
    } else {
      // Independently qualified EMPTY source legitimately resets lock. Navigate
      // through the real date control and edit the normally restored Y draft.
      expect(observed()).toMatchObject({ rows: [], locked: false, saving: false });
      await act(async () => mocks.selectDate!(new Date(y + 'T12:00:00Z')));
      expect(mocks.latestDraft.localWorkouts[0].sets[0].kg).toBe('41');
      await editMountedKg('59');
      expect(observed()).toMatchObject({ dirty: true, dirtyRef: true, saving: false, locked: false });
      expect(storage.getItem(drafts[1].key)).toBe(JSON.stringify(mocks.latestDraft.localWorkouts));
    }
  }
  if (control !== 'acknowledged') drafts.slice(1).forEach(({ key, bytes }) => expect(storage.getItem(key)).toBe(bytes));
  return { input: { operation, control, account: 'account-a', x, y, drafts, edit: '47', source: 'verified-paired-legacy', gateMode: 'test-only-ID' },
    checkpoints, before, after, dispatches: structuredClone(mocks.dispatches),
    durable: structuredClone(mocks.accountWorkouts.get('account-a')),
    fanout: { commit, range, b1, events: [...mocks.events], reads: structuredClone(mocks.selectedReads),
      rangeInvalidations: [...mocks.rangeInvalidations] }, allowedDelta: 'stale-X1-UI-only' };
}

describe('REL-05G5B2B2B fully mounted save/delete ABA races', () => {
  it.each(['save', 'delete'] as const)('R02_ID_PAIR %s: paired actual parent durable effect, range -> B1, and edited X2 state', async operation => {
    const run = async (side: 'baseline' | 'candidate') => {
      if (root) { act(() => root!.unmount()); root = null; }
      host.remove(); vi.resetModules(); resetIntegratedFixture();
      const fixture = await import('../../test-support/healthWorkoutExactMain');
      const loaded = await (side === 'baseline' ? fixture.loadExactMainHealthView : fixture.loadCandidateHealthView)(
        specifier => import(/* @vite-ignore */ specifier.startsWith('.') ? './views/' + specifier : specifier));
      mocks.subject = loaded.HealthView;
      if (side === 'baseline') {
        mocks.baselineSavingLine = loaded.savingLine; mocks.baselineLockedLine = loaded.lockedLine;
      } else {
        mocks.candidateSavingLine = loaded.savingLine; mocks.candidateLockedLine = loaded.lockedLine;
      }
      try { return await integratedH08(operation, 'editable', side); }
      catch (error) { throw new Error('R02_ID_ORACLE:' + side + ': ' + String(error), { cause: error }); }
      finally { act(() => root!.unmount()); root = null; }
    };
    const baseline = await run('baseline'), candidate = await run('candidate');
    expect(candidate.input).toEqual(baseline.input);
    expect(candidate.checkpoints).toEqual(baseline.checkpoints);
    expect(candidate.before).toEqual(baseline.before);
    expect(candidate.dispatches).toEqual(baseline.dispatches);
    expect(candidate.durable).toEqual(baseline.durable);
    expect(candidate.fanout).toEqual(baseline.fanout);
    expect(candidate.after).toEqual(candidate.before);
    expect(baseline.after.dirty).toBe(false); // sole documented X1 UI defect
  }, 30_000);
  it.each(['save', 'delete'] as const)('S06/D06/H08 %s editable X2: actual edit and independent saving/lock oracle', async operation => {
    await integratedH08(operation, 'editable');
  });
  it.each(['save', 'delete'] as const)('S06/D06/H08 %s pending X2: stale completion cannot clear saving', async operation => {
    await integratedH08(operation, 'pending');
  });
  it.each(['save', 'delete'] as const)('S06/D06/H08 %s acknowledged X2: stale completion cannot unlock', async operation => {
    await integratedH08(operation, 'acknowledged');
  });
  it('R01 sensitivity: the SAME integrated oracle detects stale relock, unsaving and unlock', async () => {
    const { runCandidateStateFault } = await import('../../test-support/healthWorkoutExactMain');
    for (const [fault, control, field] of [
      ['relock', 'editable', 'locked'], ['unsaving', 'pending', 'saving'], ['unlock', 'acknowledged', 'locked'],
    ]) {
      const output = await runCandidateStateFault('src/components/healthWorkoutFullMountedRace.integration.test.ts',
        'S06/D06/H08 .* ' + control + ' X2', fault);
      expect(output).toContain('H08_STATE_ORACLE:' + field);
      expect(output).toMatch(/2 failed/);
      expect(output).toContain('H08 save ' + control);
      expect(output).toContain('H08 delete ' + control);
    }
  }, 120_000);
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
