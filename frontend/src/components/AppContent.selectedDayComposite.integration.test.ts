// @vitest-environment happy-dom
import { createElement, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHealthSearchResults, buildPlannerSearchResults } from './views/features/search/buildSearchDomainResults';

const mocks = vi.hoisted(() => ({
  healthBootstrap: vi.fn(), dailyReadiness: [] as boolean[], staticReadiness: [] as boolean[],
  routineActivation: [] as boolean[], routineStatus: 'LOADING' as 'LOADING' | 'READY_EMPTY' | 'READY_WITH_RESULTS' | 'ERROR',
  selectedRead: vi.fn(), healthRender: vi.fn(), showToast: vi.fn(), updateSetting: vi.fn(),
  mutateDaily: vi.fn(), mutateStatic: vi.fn(), mutateTodos: vi.fn(), mutateRoutines: vi.fn(),
  notesState: { notes: [], folders: [], notesAuthorityState: 'LOADED_EMPTY',
    foldersAuthorityState: 'LOADED_EMPTY', syncError: null },
}));

vi.mock('./views/features/health/healthSelectedDayCompositeConfig', () => ({
  HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED: true,
}));
vi.mock('./views/features/health/useHealthSelectedDayComposite', () => ({
  useHealthSelectedDayComposite: (...args: unknown[]) => mocks.selectedRead(...args),
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../lib/noteNavigation', () => ({ registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined, openWorkspaceSearch: vi.fn() }));
vi.mock('../store/useAppStore', () => ({ useAppStore: () => ({
  appSettings: { language: 'en', darkMode: false }, updateSetting: mocks.updateSetting,
}) }));
vi.mock('../store/useNotesStore', () => {
  const state = { ...mocks.notesState, initNotesStorage: vi.fn(async () => undefined),
    bootstrapFromSupabase: vi.fn(async () => undefined), detachNotesStorage: vi.fn() };
  const useNotesStore = Object.assign((select: (value: typeof state) => unknown) => select(state),
    { getState: () => state });
  return { useNotesStore };
});
vi.mock('../hooks/useNow', () => ({ useNow: () => ({
  now: { toJSDate: () => new Date('2026-09-29T12:00:00Z') },
  formatDate: (value: Date) => value.toISOString().slice(0, 10), isToday: () => true,
}) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast: null, showToast: mocks.showToast }) }));
vi.mock('../hooks/useDaily', () => ({ useDailyData: (...args: unknown[]) => {
  mocks.dailyReadiness.push(Boolean(args[3]));
  return { schedules: [], todos: [], todosState: {},
    routines: args[3] ? [{ id: 'routine-1', text: 'Morning routine', done: false, is_active: true }] : [],
    workouts: args[3] ? [{ id: 'search-workout', block_id: 'bench',
      exercise_blocks: { id: 'bench', name: 'Bench Press', type: 'strength', tags: [] }, sets: [] }] : [],
    inbody: {},
    mutate: mocks.mutateDaily, mutateTodos: mocks.mutateTodos, mutateRoutines: mocks.mutateRoutines, isLoading: false };
} }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: (...args: unknown[]) => {
  mocks.staticReadiness.push(Boolean(args[4]));
  mocks.routineActivation.push(Boolean(args[7]));
  return { markedDates: [], healthBlocks: [],
    healthRoutines: args[7] && mocks.routineStatus === 'READY_WITH_RESULTS'
      ? [{ id: 'local-routine-1', day_name: 'Day 1', blocks: ['bench'] }] : [],
    healthRoutinesState: { status: args[7] ? mocks.routineStatus : 'NOT_READY', validating: false },
    weeklySchedules: [], mutate: mocks.mutateStatic };
} }));
vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('./common/Sidebar', () => ({ Sidebar: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) =>
  createElement('button', { type: 'button', 'data-testid': 'nav-health', onClick: () => setActiveTab('health') }, 'Health') }));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => createElement('div', { 'data-testid': 'loading' }) }));
vi.mock('./views/HomeView', () => ({ HomeView: () => null }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: (props: unknown) => {
  mocks.healthRender(props);
  return createElement('div', { 'data-testid': 'health-view' });
} }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: (props: {
  onSearchHasQueryChange: (active: boolean) => void;
  routines: { id: string; text: string }[];
  workouts: { id: string; exercise_blocks: { name: string } }[];
}) => {
  const [query, setQuery] = useState('');
  const planner = buildPlannerSearchResults(query, [], [], props.routines as never, [], new Date());
  const health = buildHealthSearchResults(query, props.workouts as never, [], new Date());
  return createElement('div', null,
    createElement('button', { type: 'button', 'data-testid': 'search-routine', onClick: () => {
      setQuery('Morning routine'); props.onSearchHasQueryChange(true);
    } }, 'Search routine'),
    createElement('button', { type: 'button', 'data-testid': 'search-workout', onClick: () => {
      setQuery('Bench Press'); props.onSearchHasQueryChange(true);
    } }, 'Search workout'),
    createElement('button', { type: 'button', 'data-testid': 'search-canonical', onClick: () => {
      setQuery('Canonical Session'); props.onSearchHasQueryChange(true);
    } }, 'Search canonical'),
    createElement('div', { 'data-testid': 'search-results' },
      [...planner, ...health].map(result => `${result.kind}:${result.title}`).join('|')),
  );
} }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: vi.fn(async () => undefined) }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, lang: 'en' }) }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: (...args: unknown[]) => mocks.healthBootstrap(...args),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete',
}));
vi.mock('../lib/workoutRuntimeAuthority', () => ({ createProductionWorkoutRuntimeAuthorityController: () => ({
  start: vi.fn(async () => ({ kind: 'retry_later' })), cancel: vi.fn(),
}) }));

function deferred<T>() {
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((_resolve, fail) => { reject = fail; });
  return { promise, reject };
}

describe('gated Health selected-day startup split', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  beforeEach(() => {
    host = document.createElement('div'); document.body.appendChild(host);
    mocks.dailyReadiness.length = 0; mocks.staticReadiness.length = 0;
    mocks.routineActivation.length = 0; mocks.routineStatus = 'LOADING';
    mocks.healthRender.mockReset(); mocks.healthBootstrap.mockReset();
    mocks.selectedRead.mockReset().mockImplementation((_enabled: boolean, accountId: string, localDate: string) => ({
      phase: 'settled', accountId, localDate, cacheKey: ['health-selected-day-composite', accountId, 'ns', 'g', localDate],
      result: { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success', records: [] },
      legacyDaily: { workouts: [], inbody: { weight: null, smm: null, pbf: null }, routines: [] },
      isolationError: false, retry: vi.fn(),
    }));
  });
  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null; host?.remove(); host = null;
  });

  it('renders verified local selected-day content before remote bootstrap and after remote failure', async () => {
    const remote = deferred<void>();
    mocks.healthBootstrap.mockReturnValue(remote.promise);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(AppContent, { authUser: { id: 'account-a', email: 'a@example.com' } as never }));
    });
    await act(async () => host!.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
    expect(host!.querySelector('[data-testid="health-view"]')).not.toBeNull();
    expect(host!.querySelector('[data-health-remote-bootstrap="pending"]')).not.toBeNull();
    expect(mocks.dailyReadiness.at(-1)).toBe(false);
    expect(mocks.staticReadiness.at(-1)).toBe(true);
    expect(mocks.routineActivation.at(-1)).toBe(true);
    expect((mocks.healthRender.mock.lastCall?.[0] as { healthRoutinesState: { status: string } }).healthRoutinesState.status).toBe('LOADING');
    expect(mocks.selectedRead).toHaveBeenCalledWith(true, 'account-a', '2026-09-29');
    mocks.routineStatus = 'READY_WITH_RESULTS';
    await act(async () => root?.render(createElement(AppContent, { authUser: { id: 'account-a', email: 'a@example.com' } as never })));
    expect((mocks.healthRender.mock.lastCall?.[0] as { healthRoutines: unknown[] }).healthRoutines).toHaveLength(1);
    await act(async () => remote.reject(new Error('offline')));
    expect(host!.querySelector('[data-testid="health-view"]')).not.toBeNull();
    expect(host!.textContent).toContain('startupHealthFailed');
    expect((mocks.healthRender.mock.lastCall?.[0] as { healthRoutines: unknown[] }).healthRoutines).toHaveLength(1);
  });

  it('keeps legacy-only routine and saved Workout search results deferred while Health uses its paired editor snapshot', async () => {
    const remote = deferred<void>();
    mocks.healthBootstrap.mockReturnValue(remote.promise);
    mocks.selectedRead.mockImplementation((_enabled: boolean, accountId: string, localDate: string) => ({
      phase: 'settled', accountId, localDate, cacheKey: null,
      result: { status: 'complete', legacyStatus: 'success', canonicalStatus: 'success',
        records: [{ sessionId: 'canonical-only', title: 'Canonical Session' }] },
      legacyDaily: { workouts: [{ id: 'editor-only', block_id: 'editor', sets: [] }],
        inbody: { weight: null, smm: null, pbf: null }, routines: [] },
      isolationError: false, retry: vi.fn(),
    }));
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(AppContent, { authUser: { id: 'account-a', email: 'a@example.com' } as never }));
    });
    await act(async () => host!.querySelector<HTMLButtonElement>('[data-testid="nav-health"]')!.click());
    expect(mocks.dailyReadiness.at(-1)).toBe(false);
    expect((mocks.healthRender.mock.lastCall?.[0] as { workouts: { id: string }[] }).workouts[0]?.id).toBe('editor-only');

    await act(async () => host!.querySelector<HTMLButtonElement>('[data-testid="search-routine"]')!.click());
    expect(mocks.dailyReadiness.at(-1)).toBe(true);
    expect(host!.querySelector('[data-testid="search-results"]')?.textContent).toContain('routine:Morning routine');
    expect((mocks.healthRender.mock.lastCall?.[0] as { workouts: { id: string }[] }).workouts[0]?.id).toBe('editor-only');

    await act(async () => host!.querySelector<HTMLButtonElement>('[data-testid="search-workout"]')!.click());
    expect(host!.querySelector('[data-testid="search-results"]')?.textContent).toContain('workout:Bench Press');
    expect((mocks.healthRender.mock.lastCall?.[0] as { workouts: { id: string }[] }).workouts[0]?.id).toBe('editor-only');

    await act(async () => host!.querySelector<HTMLButtonElement>('[data-testid="search-canonical"]')!.click());
    expect(host!.querySelector('[data-testid="search-results"]')?.textContent).toBe('');
  });
});
