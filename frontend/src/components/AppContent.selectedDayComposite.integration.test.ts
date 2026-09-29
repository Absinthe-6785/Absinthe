// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  healthBootstrap: vi.fn(), dailyReadiness: [] as boolean[], staticReadiness: [] as boolean[],
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
  return { schedules: [], todos: [], todosState: {}, routines: [], workouts: [], inbody: {},
    mutate: mocks.mutateDaily, mutateTodos: mocks.mutateTodos, mutateRoutines: mocks.mutateRoutines, isLoading: false };
} }));
vi.mock('../hooks/useStatic', () => ({ useStaticData: (...args: unknown[]) => {
  mocks.staticReadiness.push(Boolean(args[4]));
  return { markedDates: [], healthBlocks: [], healthRoutines: [], weeklySchedules: [], mutate: mocks.mutateStatic };
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
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: () => null }));
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
    expect(mocks.selectedRead).toHaveBeenCalledWith(true, 'account-a', '2026-09-29');
    await act(async () => remote.reject(new Error('offline')));
    expect(host!.querySelector('[data-testid="health-view"]')).not.toBeNull();
    expect(host!.textContent).toContain('startupHealthFailed');
  });
});
