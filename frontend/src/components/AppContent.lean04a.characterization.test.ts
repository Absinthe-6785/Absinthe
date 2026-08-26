// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  dailyMutate: vi.fn(),
  mutateTodos: vi.fn(),
  mutateRoutines: vi.fn(),
  staticMutate: vi.fn(),
  healthBootstrap: vi.fn(),
  initNotesStorage: vi.fn(),
  bootstrapFromSupabase: vi.fn(),
  detachNotesStorage: vi.fn(),
  showToast: vi.fn(),
  homeProps: null as Record<string, unknown> | null,
}));

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock('../lib/noteNavigation', () => ({
  registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined,
  openWorkspaceSearch: vi.fn(),
}));
vi.mock('../store/useAppStore', () => ({
  useAppStore: () => ({ appSettings: { language: 'en', darkMode: false }, updateSetting: vi.fn() }),
}));
vi.mock('../store/useNotesStore', () => {
  const state = {
    notes: [], folders: [], notesAuthorityState: 'LOADED_EMPTY', foldersAuthorityState: 'LOADED_EMPTY', syncError: null,
    initNotesStorage: mocks.initNotesStorage,
    bootstrapFromSupabase: mocks.bootstrapFromSupabase,
    detachNotesStorage: mocks.detachNotesStorage,
  };
  const useNotesStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { useNotesStore };
});
vi.mock('../hooks/useNow', () => ({
  useNow: () => ({
    now: { toJSDate: () => new Date('2026-08-18T00:00:00.000Z') },
    formatDate: (date: Date) => date.toISOString().slice(0, 10),
    isToday: () => true,
  }),
}));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast: null, showToast: mocks.showToast }) }));
vi.mock('../hooks/useDaily', () => ({
  useDailyData: (...args: unknown[]) => {
    (mocks as typeof mocks & { dailyArgs?: unknown[] }).dailyArgs = args;
    return {
      schedules: [], todos: [], routines: [], workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 },
      mutate: mocks.dailyMutate,
      mutateTodos: mocks.mutateTodos,
      mutateRoutines: mocks.mutateRoutines,
      isLoading: false,
    };
  },
}));
vi.mock('../hooks/useStatic', () => ({
  useStaticData: (...args: unknown[]) => {
    (mocks as typeof mocks & { staticArgs?: unknown[] }).staticArgs = args;
    return { markedDates: [], healthBlocks: [], healthRoutines: [], weeklySchedules: [], mutate: mocks.staticMutate };
  },
}));
vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('./common/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => null }));
vi.mock('./views/NoteView', () => ({ NoteView: () => null }));
vi.mock('./views/HomeView', () => ({
  HomeView: (props: Record<string, unknown>) => {
    mocks.homeProps = props;
    return createElement('div', { 'data-testid': 'lean04a-home' });
  },
}));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: () => null }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: () => null }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: async () => undefined }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, lang: 'en' }) }));
vi.mock('../lib/remoteBoundary', () => ({ shouldUseRemoteData: () => true }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: (...args: unknown[]) => mocks.healthBootstrap(...args),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'lean04a-health-bootstrap-complete',
}));
vi.mock('../lib/healthBootstrapSingleFlight', () => ({
  runHealthBootstrapSingleFlight: (_accountId: string, start: () => Promise<unknown>) => start(),
}));

const accountUser = (id: string) => ({ id, email: `${id}@example.com` }) as never;

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('LEAN_04A AppContent shell/event characterization', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    mocks.dailyMutate.mockReset();
    mocks.mutateTodos.mockReset();
    mocks.mutateRoutines.mockReset();
    mocks.staticMutate.mockReset();
    mocks.healthBootstrap.mockReset().mockResolvedValue(undefined);
    mocks.initNotesStorage.mockReset().mockResolvedValue(undefined);
    mocks.bootstrapFromSupabase.mockReset().mockResolvedValue(undefined);
    mocks.detachNotesStorage.mockReset();
    mocks.showToast.mockReset();
    mocks.homeProps = null;
    delete (mocks as typeof mocks & { dailyArgs?: unknown[] }).dailyArgs;
    delete (mocks as typeof mocks & { staticArgs?: unknown[] }).staticArgs;
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('proves shell ownership, current Home eager wiring, and bootstrap-complete revalidation', async () => {
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(AppContent, { authUser: accountUser('account-a') }));
    });
    await flush();

    expect(host?.querySelector('[data-testid="lean04a-home"]')).not.toBeNull();
    expect((mocks as typeof mocks & { dailyArgs?: unknown[] }).dailyArgs?.[0]).toBe('2026-08-18');
    expect((mocks as typeof mocks & { dailyArgs?: unknown[] }).dailyArgs?.[2]).toBe('account-a');
    expect((mocks as typeof mocks & { dailyArgs?: unknown[] }).dailyArgs?.[3]).toBe(true);
    expect((mocks as typeof mocks & { staticArgs?: unknown[] }).staticArgs?.[3]).toBe('account-a');
    expect(mocks.homeProps?.mutateDaily).toBe(mocks.dailyMutate);
    expect(mocks.homeProps?.mutateStatic).toBe(mocks.staticMutate);
    expect(mocks.homeProps?.mutateTodos).toBe(mocks.mutateTodos);
    expect(mocks.homeProps?.mutateRoutines).toBe(mocks.mutateRoutines);

    window.dispatchEvent(new Event('lean04a-health-bootstrap-complete'));
    expect(mocks.dailyMutate).toHaveBeenCalledOnce();
    expect(mocks.staticMutate).toHaveBeenCalledOnce();
    expect(mocks.healthBootstrap).toHaveBeenCalledOnce();
  });
});
