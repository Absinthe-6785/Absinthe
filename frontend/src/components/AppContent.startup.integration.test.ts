// @vitest-environment happy-dom
import { createElement, StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const notesState = {
    notes: [],
    folders: [],
    notesAuthorityState: 'LOADED_EMPTY',
    foldersAuthorityState: 'LOADED_EMPTY',
    syncError: null,
  };
  return {
    notesState,
    initNotesStorage: vi.fn(),
    bootstrapFromSupabase: vi.fn(),
    detachNotesStorage: vi.fn(),
    healthBootstrap: vi.fn(),
    healthReadiness: [] as boolean[],
    dailyLoading: false,
    showToast: vi.fn(),
  };
});

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

vi.mock('../lib/noteNavigation', () => ({
  registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined,
  openWorkspaceSearch: vi.fn(),
}));

vi.mock('../store/useAppStore', () => ({
  useAppStore: () => ({
    appSettings: { language: 'en', darkMode: false },
    updateSetting: vi.fn(),
  }),
}));

vi.mock('../store/useNotesStore', () => {
  const useNotesStore = Object.assign(
    (selector: (state: typeof mocks.notesState) => unknown) => selector({
      ...mocks.notesState,
      initNotesStorage: mocks.initNotesStorage,
      bootstrapFromSupabase: mocks.bootstrapFromSupabase,
      detachNotesStorage: mocks.detachNotesStorage,
    }),
    { getState: () => ({ ...mocks.notesState }) },
  );
  return { useNotesStore };
});

vi.mock('../hooks/useNow', () => ({
  useNow: () => {
    const now = { toJSDate: () => new Date('2026-01-01T00:00:00.000Z') };
    const formatDate = (value: Date) => value.toISOString().slice(0, 10);
    return { now, formatDate, isToday: () => true };
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ toast: null, showToast: mocks.showToast }),
}));

vi.mock('../hooks/useDaily', () => ({
  useDailyData: (...args: unknown[]) => {
    mocks.healthReadiness.push(Boolean(args[3]));
    return {
      schedules: [], todos: [], routines: [], workouts: [], inbody: {},
      mutate: vi.fn(), mutateTodos: vi.fn(), mutateRoutines: vi.fn(), isLoading: mocks.dailyLoading,
    };
  },
}));

vi.mock('../hooks/useStatic', () => ({
  useStaticData: () => ({
    markedDates: [], healthBlocks: [], healthRoutines: [], weeklySchedules: [], mutate: vi.fn(),
  }),
}));

vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('./common/Sidebar', () => ({
  Sidebar: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => createElement(
    'div',
    null,
    createElement(
      'button',
      { type: 'button', 'data-testid': 'nav-health', onClick: () => setActiveTab('health') },
      'Health',
    ),
    createElement(
      'button',
      { type: 'button', 'data-testid': 'nav-notes', onClick: () => setActiveTab('note') },
      'Notes',
    ),
  ),
}));
vi.mock('./common/ViewLoadingFallback', () => ({
  ViewLoadingFallback: ({ label }: { label?: string }) => createElement('div', { 'data-testid': 'view-loading' }, label),
}));
vi.mock('./views/NoteView', () => ({ NoteView: () => null }));
vi.mock('./views/HomeView', () => ({ HomeView: () => createElement('div', { 'data-testid': 'home-view' }) }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: () => createElement('div', { 'data-testid': 'health-view' }) }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));
vi.mock('./views/features/search/GlobalSearchHost', () => ({ GlobalSearchHost: () => null }));
vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: async () => undefined }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: vi.fn() }));
vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));
vi.mock('../lib/remoteBoundary', () => ({ shouldUseRemoteData: () => false }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: (...args: unknown[]) => mocks.healthBootstrap(...args),
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'health-bootstrap-complete',
}));

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const user = (id: string) => ({ id, email: `${id}@example.com` }) as never;

async function flushStartup(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AppContent startup lifecycle integration', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    mocks.initNotesStorage.mockReset().mockResolvedValue(undefined);
    mocks.bootstrapFromSupabase.mockReset().mockResolvedValue(undefined);
    mocks.detachNotesStorage.mockReset();
    mocks.healthBootstrap.mockReset();
    mocks.healthReadiness.length = 0;
    mocks.dailyLoading = false;
    mocks.showToast.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it('does not restart either domain after startup state rerenders', async () => {
    const health = deferred();
    mocks.healthBootstrap.mockReturnValue(health.promise);
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement((await import('./AppContent')).AppContent, { authUser: user('rerender-account') }));
    });
    await flushStartup();

    expect(mocks.initNotesStorage).toHaveBeenCalledTimes(1);
    expect(mocks.healthBootstrap).toHaveBeenCalledTimes(1);
    health.resolve();
    await flushStartup();
  });

  it('shares one Health durable execution across StrictMode remounts', async () => {
    const health = deferred();
    mocks.healthBootstrap.mockReturnValue(health.promise);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(StrictMode, null, createElement(AppContent, { authUser: user('strict-account') })));
    });
    await flushStartup();

    expect(mocks.healthBootstrap).toHaveBeenCalledTimes(1);
    health.resolve();
    await flushStartup();
  });

  it('keeps account A and B Health flights independent after a switch', async () => {
    const accountA = deferred();
    const accountB = deferred();
    mocks.healthBootstrap.mockImplementation(({ accountId }: { accountId: string }) => (
      accountId === 'account-a' ? accountA.promise : accountB.promise
    ));
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('account-a') }));
    });
    await flushStartup();
    await act(async () => {
      root?.render(createElement(AppContent, { authUser: user('account-b') }));
    });
    await flushStartup();

    expect(mocks.healthBootstrap).toHaveBeenCalledTimes(2);
    accountA.resolve();
    await flushStartup();
    expect(mocks.healthReadiness.at(-1)).toBe(false);
    accountB.resolve();
    await flushStartup();
    expect(mocks.healthReadiness.at(-1)).toBe(true);
  });

  it('does not publish a pending Health completion after the account logs out', async () => {
    const health = deferred();
    mocks.healthBootstrap.mockReturnValue(health.promise);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('logout-account') }));
    });
    await flushStartup();
    const readinessBeforeLogout = [...mocks.healthReadiness];

    act(() => {
      root?.unmount();
      root = null;
    });
    health.resolve();
    await flushStartup();

    expect(mocks.healthReadiness).toEqual(readinessBeforeLogout);
  });

  it('keeps the unrelated Home surface clear while Health startup is pending', async () => {
    const health = deferred();
    mocks.healthBootstrap.mockReturnValue(health.promise);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('pending-account') }));
    });
    await flushStartup();

    expect(container?.querySelector('[data-testid="home-view"]')).not.toBeNull();
    expect(container?.querySelector('[data-testid="global-daily-spinner"]')).toBeNull();
    health.resolve();
    await flushStartup();
  });

  it('keeps genuine local daily fetch feedback on the Home surface', async () => {
    mocks.dailyLoading = true;
    const health = deferred();
    mocks.healthBootstrap.mockReturnValue(health.promise);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('daily-loading-account') }));
    });
    await flushStartup();

    expect(container?.querySelector('[data-testid="global-daily-spinner"]')).not.toBeNull();
    health.resolve();
    await flushStartup();
  });

  it('does not show daily fetch feedback on the unrelated Notes surface', async () => {
    mocks.dailyLoading = true;
    const health = deferred();
    mocks.healthBootstrap.mockReturnValue(health.promise);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('notes-surface-account') }));
    });
    await flushStartup();

    await act(async () => {
      (container?.querySelector('[data-testid="nav-notes"]') as HTMLButtonElement)?.click();
    });
    expect(container?.querySelector('[data-testid="global-daily-spinner"]')).toBeNull();
    health.resolve();
    await flushStartup();
  });

  it('keeps a fatal Health startup boundary while leaving Home without the global spinner', async () => {
    mocks.healthBootstrap.mockRejectedValue(new Error('health_bootstrap_authenticated_account_mismatch'));
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('fatal-account') }));
    });
    await flushStartup();

    expect(container?.querySelector('[data-testid="global-daily-spinner"]')).toBeNull();
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    expect(container?.querySelector('[role="alert"]')?.textContent).toContain('startupHealthFailed');
    expect(container?.querySelector('[data-testid="health-view"]')).toBeNull();
  });

  it('mounts Health after the remote bootstrap is safely rejected but local authority is preserved', async () => {
    mocks.healthBootstrap.mockResolvedValue({
      disposition: 'READY_FROM_PRESERVED_LOCAL',
      reason: 'health_bootstrap_incomplete_remote_preserved_local',
    });
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('preserved-account') }));
    });
    await flushStartup();

    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    expect(container?.querySelector('[data-testid="health-view"]')).not.toBeNull();
    expect(container?.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.healthReadiness.at(-1)).toBe(true);
  });
});
