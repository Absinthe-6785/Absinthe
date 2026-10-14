// @vitest-environment happy-dom
import { createElement, useEffect, useLayoutEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DeferredVoid = Readonly<{ promise: Promise<void>; resolve: () => void }>;

const mocks = vi.hoisted(() => ({
  verifiedLegacyProjection: false,
  dailyReads: [] as Array<{ accountId: string; date: string; resolve: (value: any) => void }>,
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

vi.mock('./views/features/health/useHealthWorkoutDraft', async importOriginal => {
  const real = await importOriginal<typeof import('./views/features/health/useHealthWorkoutDraft')>();
  return { ...real, useHealthWorkoutDraft: (options: Parameters<typeof real.useHealthWorkoutDraft>[0]) => {
    const state = real.useHealthWorkoutDraft(options);
    useLayoutEffect(() => { mocks.latestDraft = state; });
    return state;
  } };
});
vi.mock('../lib/healthLocalRuntime', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/healthLocalRuntime')>();
  return { ...real,
  readLocalHealthDaily: (accountId: string, date: string) => new Promise<any>(resolve => {
    mocks.dailyReads.push({ accountId, date, resolve });
  }),
  readLocalHealthWorkoutRange: vi.fn(async () => []),
  readLocalPreviousWorkoutRows: vi.fn(async () => []),
  };
});
vi.mock('../lib/syncAuthority', () => ({ domainUsesLocalWorkingCopy: () => true }));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.test' }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } }, authFetch: vi.fn() }));
vi.mock('../lib/remoteBoundary', () => ({ remoteSWRKey: () => null }));
vi.mock('../lib/fetcher', () => ({ fetcher: vi.fn(async () => []), isLocalOnlyRemotePausedError: () => false }));
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
vi.mock('./views/features/health/HealthSupportingPanels', () => ({ HealthSupportingPanels: ({ setSelectedDate }: { setSelectedDate: (value: Date) => void }) => {
  mocks.selectDate = setSelectedDate; return createElement('div', { 'data-testid': 'legacy-parent' });
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


import { localHealthDraftKey } from '../lib/healthBackfillUiSafety';
import { projectLocalHealthDaily } from '../lib/healthLocalRuntime';

const X = '2026-09-29', Y = '2026-09-30', Z = '2026-10-01';
const workout = (id: string, kg: string) => ({ id, block_id: 'bench', local_version: 'v1',
  exercise_blocks: { id: 'bench', name: 'Bench', type: 'strength', tags: [] },
  sets: [{ type: 'strength', set: 1, kg, reps: '5', done: true }] });
const DX = [workout('11111111-1111-4111-8111-111111111111', '31')];
const DY = [workout('22222222-2222-4222-8222-222222222222', '41')];
const DZ = [workout('33333333-3333-4333-8333-333333333333', '51')];
let root: Root, host: HTMLDivElement, history: Array<{ key: string; value: string | null }>, values: Map<string, string>;
function source(date: string, kg: string) {
  return projectLocalHealthDaily({
    exercise_blocks: [{ id: 'bench', user_id: 'account-a', name: 'Bench', type: 'strength', tags: [] }],
    workout_logs: [{ id: '44444444-4444-4444-8444-444444444444', user_id: 'account-a', date,
      block_id: 'bench', sort_order: 0, sets: [{ type: 'strength', set: 1, kg, reps: '5', done: true }] }],
    inbody_logs: [], health_routines: [], routines: [], routine_logs: [], protein_profiles: [],
    protein_sources: [], protein_intake_logs: [], workout_memos: [],
  }, date);
}
async function deliver(date: string, kg: string) {
  const read = mocks.dailyReads.find(read => read.accountId === 'account-a' && read.date === date);
  expect(read, 'real useDailyData must request the account/date key').toBeDefined();
  await act(async () => read!.resolve(source(date, kg)));
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.selectDate = null; mocks.latestDraft = null; mocks.dailyReads.length = 0;
  mocks.showToast.mockReset(); values = new Map(); history = [];
  vi.stubGlobal('localStorage', {
    get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); history.push({ key, value }); },
    removeItem: (key: string) => { values.delete(key); history.push({ key, value: null }); },
    clear: () => values.clear(),
  });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
describe('gate-OFF real AppContent/useDailyData/SWR date ownership', () => {
  it.each([false, true])('H01-H04 qualified clean hydration and restored dirty protection (draft=%s)', async dirty => {
    const bytes = new Map<string, string>();
    for (const [account, date, rows] of [['account-a', X, DX], ['account-a', Y, DY], ['account-b', Z, DZ]] as const) {
      if (dirty || account === 'account-b') {
        const key = localHealthDraftKey(account, date), value = JSON.stringify(rows);
        values.set(key, value); bytes.set(key, value);
      }
    }
    const checkBytes = () => {
      bytes.forEach((value, key) => {
        expect(values.get(key)).toBe(value);
        expect(history.filter(write => write.key === key).every(write => write.value === value)).toBe(true);
      });
      if (!dirty) { expect(values.has(localHealthDraftKey('account-a', X))).toBe(false);
        expect(values.has(localHealthDraftKey('account-a', Y))).toBe(false); }
    };
    await import('./views/HealthView');
    const { AppContent } = await import('./AppContent');
    const cache = new Map();
    await act(async () => root.render(createElement(SWRConfig, { value: {
      provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false, revalidateOnReconnect: false,
    } }, createElement(AppContent, { authUser: { id: 'account-a', email: 'a@example.test' } as never }))));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
    expect(mocks.selectDate).not.toBeNull(); checkBytes();
    expect(mocks.latestDraft.isDirty).toBe(dirty);
    expect(mocks.latestDraft.localWorkouts).toEqual(dirty ? DX : []);
    await act(async () => mocks.selectDate!(new Date(Y + 'T12:00:00Z'))); checkBytes();
    expect(mocks.latestDraft.localWorkouts).toEqual(dirty ? DY : []);
    await deliver(X, '91'); // actual X SWR entry resolves AFTER the Y component committed.
    expect(mocks.latestDraft.localWorkouts).toEqual(dirty ? DY : []); checkBytes();
    await deliver(Y, '92');
    expect(mocks.latestDraft.localWorkouts[0].sets[0].kg).toBe(dirty ? '41' : '92');
    expect(mocks.latestDraft.isDirty).toBe(dirty); expect(mocks.latestDraft.isDirtyRef.current).toBe(dirty); checkBytes();
    await act(async () => mocks.selectDate!(new Date(X + 'T12:00:00Z'))); checkBytes();
    expect(mocks.latestDraft.localWorkouts[0].sets[0].kg).toBe(dirty ? '31' : '91');
    expect(mocks.latestDraft.isDirty).toBe(dirty);
    expect(mocks.dailyReads.every(read => read.accountId === 'account-a' && [X, Y].includes(read.date))).toBe(true);
    expect(mocks.showToast.mock.calls.some(call => String(call[0]).startsWith('Fetch failed'))).toBe(false);
  });
});
