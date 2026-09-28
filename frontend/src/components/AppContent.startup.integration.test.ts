// @vitest-environment happy-dom
import { createElement, StrictMode, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHealthWorkoutDraft } from './views/features/health/useHealthWorkoutDraft';

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
    healthRenders: [] as Array<{ accountId: string; transient: string; draftNames: string; workoutProps: string }>,
    dailyWorkoutOwner: null as string | null,
    healthAsync: null as Promise<string> | null,
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
      schedules: [], todos: [], routines: [],
      workouts: mocks.dailyWorkoutOwner ? [{ id: `${mocks.dailyWorkoutOwner}-workout` }] : [], inbody: {},
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
vi.mock('./views/HealthView', () => ({ HealthView: ({ user, workouts }: { user: { id: string }; workouts: Array<{ id: string }> }) => {
    const draft = useHealthWorkoutDraft({ accountId: user.id, dateKey: '2026-01-01' });
    const [transient, setTransient] = useState('');
    const draftNames = draft.localWorkouts.map(row => row.exercise_blocks?.name ?? '').join(',');
    mocks.healthRenders.push({ accountId: user.id, transient, draftNames, workoutProps: workouts.map(row => row.id).join(',') });
    return createElement('div', { 'data-testid': 'health-view', 'data-account': user.id },
      createElement('span', { 'data-testid': 'health-transient' }, transient),
      createElement('span', { 'data-testid': 'health-draft' }, draftNames),
      createElement('button', { type: 'button', 'data-testid': 'edit-health', onClick: () => {
        draft.setLocalWorkouts([{ id: 'draft-a', block_id: 'block-a', exercise_blocks: {
          id: 'block-a', name: 'A-private-workout', type: 'strength',
        }, sets: [{ type: 'strength', set: 1, kg: '', reps: '8', done: false }] }]);
        draft.setIsDirty(true);
        setTransient('A-private-memo|A-private-input|A-private-modal');
      } }, 'Edit'),
      createElement('button', { type: 'button', 'data-testid': 'load-health-async', onClick: () => {
        if (mocks.healthAsync) void mocks.healthAsync.then(value => setTransient(value));
      } }, 'Load'),
    );
  } }));
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
    localStorage.clear();
    mocks.initNotesStorage.mockReset().mockResolvedValue(undefined);
    mocks.bootstrapFromSupabase.mockReset().mockResolvedValue(undefined);
    mocks.detachNotesStorage.mockReset();
    mocks.healthBootstrap.mockReset();
    mocks.healthReadiness.length = 0;
    mocks.dailyLoading = false;
    mocks.showToast.mockReset();
    mocks.healthRenders.length = 0;
    mocks.dailyWorkoutOwner = null;
    mocks.healthAsync = null;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('bounds a delegated workspace viewport inside the dynamic-height app shell', async () => {
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('shell-contract-account') }));
    });
    await flushStartup();

    const shell = container?.querySelector('[data-app-shell]');
    const viewport = shell?.querySelector('[data-workspace-viewport]');
    expect(shell?.getAttribute('data-app-height-owner')).toBe('dynamic-viewport');
    expect(shell?.classList.contains('abs-cosmos-shell')).toBe(true);
    expect(shell?.classList.contains('h-[100dvh]')).toBe(true);
    expect(shell?.classList.contains('overflow-hidden')).toBe(true);
    expect(viewport?.getAttribute('data-workspace-scroll-mode')).toBe('delegated');
    expect(viewport?.classList.contains('min-h-0')).toBe(true);
    expect(viewport?.classList.contains('min-w-0')).toBe(true);
    expect(viewport?.classList.contains('overflow-hidden')).toBe(true);
    expect(viewport?.classList.contains('overflow-y-auto')).toBe(false);
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

  it('never renders A Health transient state in the first B Health render', async () => {
    mocks.healthBootstrap.mockResolvedValue(undefined);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('account-a') }));
    });
    await flushStartup();
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    await act(async () => {
      (container?.querySelector('[data-testid="edit-health"]') as HTMLButtonElement)?.click();
    });
    expect(container?.querySelector('[data-testid="health-draft"]')?.textContent).toContain('A-private-workout');

    mocks.healthRenders.length = 0;
    await act(async () => {
      root?.render(createElement(AppContent, { authUser: user('account-b') }));
    });
    await flushStartup();
    const firstBRender = mocks.healthRenders.find(render => render.accountId === 'account-b');
    expect(firstBRender).toBeDefined();
    expect(firstBRender?.transient).toBe('');
    expect(firstBRender?.draftNames).toBe('');
    expect(container?.querySelector('[data-testid="health-transient"]')?.textContent).not.toContain('A-private');
    expect(container?.querySelector('[data-testid="health-draft"]')?.textContent).not.toContain('A-private');
  });

  it('does not mount B Health from A-ready state or stale parent props before B bootstrap', async () => {
    const accountB = deferred();
    mocks.healthBootstrap.mockImplementation(({ accountId }: { accountId: string }) => (
      accountId === 'account-b' ? accountB.promise : Promise.resolve()
    ));
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('account-a') }));
    });
    await flushStartup();
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    mocks.dailyWorkoutOwner = 'account-a';
    mocks.healthRenders.length = 0;
    await act(async () => {
      root?.render(createElement(AppContent, { authUser: user('account-b') }));
    });
    expect(mocks.healthRenders.some(render => render.accountId === 'account-b')).toBe(false);
    expect(container?.querySelector('[data-testid="health-view"]')).toBeNull();
    expect(container?.querySelector('[data-testid="view-loading"]')).not.toBeNull();

    mocks.dailyWorkoutOwner = 'account-b';
    accountB.resolve();
    await flushStartup();
    expect(mocks.healthRenders.find(render => render.accountId === 'account-b')?.workoutProps).toBe('account-b-workout');
  });

  it('keeps Health editing state on same-account rerender and isolates A-B-A switches', async () => {
    mocks.healthBootstrap.mockResolvedValue(undefined);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('account-a') }));
    });
    await flushStartup();
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    await act(async () => {
      (container?.querySelector('[data-testid="edit-health"]') as HTMLButtonElement)?.click();
    });
    await act(async () => root?.render(createElement(AppContent, { authUser: user('account-a') })));
    expect(container?.querySelector('[data-testid="health-draft"]')?.textContent).toContain('A-private-workout');

    await act(async () => root?.render(createElement(AppContent, { authUser: user('account-b') })));
    await flushStartup();
    await act(async () => root?.render(createElement(AppContent, { authUser: user('account-a') })));
    await flushStartup();
    expect(mocks.healthRenders.filter(render => render.accountId === 'account-a').at(-1)?.transient).toBe('');
    expect(container?.querySelector('[data-testid="health-draft"]')?.textContent).toContain('A-private-workout');
  });

  it('does not surface a previous instance async completion after A-B-A account transitions', async () => {
    mocks.healthBootstrap.mockResolvedValue(undefined);
    const oldACompletion = deferred<string>();
    const oldBCompletion = deferred<string>();
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('account-a') }));
    });
    await flushStartup();
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    mocks.healthAsync = oldACompletion.promise;
    await act(async () => {
      (container?.querySelector('[data-testid="load-health-async"]') as HTMLButtonElement)?.click();
    });
    await act(async () => root?.render(createElement(AppContent, { authUser: user('account-b') })));
    await flushStartup();
    mocks.healthAsync = oldBCompletion.promise;
    await act(async () => {
      (container?.querySelector('[data-testid="load-health-async"]') as HTMLButtonElement)?.click();
    });
    await act(async () => root?.render(createElement(AppContent, { authUser: user('account-a') })));
    await flushStartup();
    await act(async () => {
      oldACompletion.resolve('old-A-previous-workout');
      oldBCompletion.resolve('old-B-previous-workout');
      await Promise.resolve();
    });
    expect(container?.querySelector('[data-testid="health-transient"]')?.textContent).toBe('');
    expect(mocks.healthRenders.filter(render => render.accountId === 'account-a').at(-1)?.transient).toBe('');
  });

  it('retains the existing Health tab unmount behavior without changing the account key', async () => {
    mocks.healthBootstrap.mockResolvedValue(undefined);
    const { AppContent } = await import('./AppContent');
    await act(async () => {
      root = createRoot(container!);
      root.render(createElement(AppContent, { authUser: user('account-a') }));
    });
    await flushStartup();
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    await act(async () => {
      (container?.querySelector('[data-testid="edit-health"]') as HTMLButtonElement)?.click();
    });
    await act(async () => {
      (container?.querySelector('[data-testid="nav-notes"]') as HTMLButtonElement)?.click();
    });
    await act(async () => {
      (container?.querySelector('[data-testid="nav-health"]') as HTMLButtonElement)?.click();
    });
    expect(container?.querySelector('[data-testid="health-view"]')?.getAttribute('data-account')).toBe('account-a');
    expect(container?.querySelector('[data-testid="health-transient"]')?.textContent).toBe('');
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
