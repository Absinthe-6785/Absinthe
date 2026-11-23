// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type TargetKind = 'todos' | 'healthBlocks';
type TargetStatus = 'pending' | 'empty' | 'results';

type SearchProjection = {
  query: string;
  results: Array<{ kind: string; title?: string }>;
  empty: { noQuery: boolean; noResults: boolean; noRecent: boolean };
  groupStates?: { planner?: { status: string } };
};

type PaletteProps = {
  open: boolean;
  query: string;
  projection: SearchProjection;
  projectionStatus?: 'loading' | 'unavailable';
  onQueryChange: (query: string) => void;
  onClose: () => void;
};

const harness = vi.hoisted(() => ({
  targetKind: 'todos' as TargetKind,
  targetStatus: 'pending' as TargetStatus,
  todoPromise: null as Promise<unknown> | null,
  blockPromise: null as Promise<unknown> | null,
  emptyPromise: null as Promise<unknown> | null,
  weeklyOwner: null as { accountId: string; signal: AbortSignal } | null,
  weeklyReply: null as Promise<unknown> | null,
  routineReply: null as Promise<unknown> | null,
  localAuthority: false,
  localDailyReply: undefined as Promise<import('../lib/healthLocalRuntime').LocalHealthDailyProjection> | undefined,
  archiveEnabled: true,
  fetches: [] as string[],
  palette: null as PaletteProps | null,
  paletteSnapshots: [] as PaletteProps[],
  openers: [] as Array<() => void>,
  persisted: { query: '', filter: 'all' as const },
  plannerInputs: [] as Array<{ schedules: unknown[]; todos: unknown[] }>,
  healthInputs: [] as Array<{ workouts: unknown[]; healthBlocks: unknown[] }>,
  discoveryCalls: 0,
  projectionCalls: 0,
  notes: [] as unknown[],
  folders: [] as unknown[],
  updateSetting: () => undefined,
  showToast: () => undefined,
  initNotesStorage: async (_accountId: string) => undefined,
  bootstrapFromSupabase: async () => undefined,
  detachNotesStorage: () => undefined,
}));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

vi.mock('../lib/noteNavigation', () => ({
  registerNotesTabSwitcher: () => () => undefined,
  registerAppTabSwitcher: () => () => undefined,
  openWorkspaceSearch: () => harness.openers.at(-1)?.(),
  registerWorkspaceSearchOpener: (opener: () => void) => {
    harness.openers.push(opener);
    return () => {
      const index = harness.openers.indexOf(opener);
      if (index >= 0) harness.openers.splice(index, 1);
    };
  },
}));

vi.mock('../store/useAppStore', () => ({
  useAppStore: () => ({
    appSettings: { language: 'en', darkMode: false },
    updateSetting: harness.updateSetting,
  }),
}));

vi.mock('../store/useNotesStore', () => {
  const state = {
    get notes() { return harness.notes; },
    get folders() { return harness.folders; },
    notesAuthorityState: 'LOADED_EMPTY' as const,
    foldersAuthorityState: 'LOADED_EMPTY' as const,
    syncError: null,
    initNotesStorage: harness.initNotesStorage,
    bootstrapFromSupabase: harness.bootstrapFromSupabase,
    detachNotesStorage: harness.detachNotesStorage,
  };
  const useNotesStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { useNotesStore };
});

vi.mock('../hooks/useNow', () => ({
  useNow: () => ({
    now: { toJSDate: () => new Date('2026-08-26T12:00:00.000Z') },
    formatDate: (date: Date) => date.toISOString().slice(0, 10),
    isToday: () => true,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ toast: null, showToast: harness.showToast }),
}));

vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));

vi.mock('../lib/remoteBoundary', () => ({
  shouldUseRemoteData: () => true,
  remoteSWRKey: (key: string) => key,
  runtimeSessionReadOwner: () => harness.weeklyOwner,
}));

vi.mock('../lib/workoutRuntimeAuthority', () => ({
  createProductionWorkoutRuntimeAuthorityController: () => ({
    start: async () => ({ kind: 'not_ready' }), cancel: () => undefined,
  }),
}));

vi.mock('../lib/syncAuthority', () => ({
  domainUsesLocalWorkingCopy: (domain: string) => domain === 'health_workouts' && harness.localAuthority,
}));

vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: async () => harness.localDailyReply,
  readLocalHealthStatic: async () => undefined,
}));

vi.mock('../lib/fetcher', () => ({
  fetcher: (key: unknown) => {
    const url = Array.isArray(key) ? String(key[2] ?? key[0] ?? '') : String(key);
    harness.fetches.push(url);
    if (url.includes('/todos?')) {
      return harness.targetKind === 'todos'
        ? harness.todoPromise ?? harness.emptyPromise
        : harness.emptyPromise;
    }
    if (url.endsWith('/blocks')) {
      return harness.targetKind === 'healthBlocks'
        ? harness.blockPromise ?? harness.emptyPromise
        : harness.emptyPromise;
    }
    if (url.endsWith('/weekly_schedules')) return harness.weeklyReply ?? harness.emptyPromise;
    if (url.includes('/routines_with_logs?')) return harness.routineReply ?? harness.emptyPromise;
    return harness.emptyPromise;
  },
  isLocalOnlyRemotePausedError: () => false,
}));

vi.mock('../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  resolveAppLanguage: () => 'en',
  getTranslator: () => (key: string) => key,
}));

vi.mock('../theme', () => ({ buildThemeClasses: () => ({}) }));
vi.mock('./common/Sidebar', () => ({
  Sidebar: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => createElement(
    'nav', {},
    ...['home', 'planner', 'health', 'recipe', 'analytics', 'note', 'settings'].map(tab =>
      createElement('button', { key: tab, 'data-shell-tab': tab, onClick: () => setActiveTab(tab) }, tab)),
  ),
}));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => null }));
vi.mock('./views/NoteView', () => ({ NoteView: () => null }));
vi.mock('./views/HomeView', () => ({ HomeView: () => null }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: () => null }));
vi.mock('./views/features/archive/archiveShellConfig', () => ({
  get ARCHIVE_SHELL_ENABLED() { return harness.archiveEnabled; },
}));
vi.mock('./views/AnalyticsView', () => ({
  AnalyticsView: ({ onPlannerRestoreComplete, routines, routinesState }: import('../types').AnalyticsProps) =>
    createElement('button', {
      'data-completed-restore': true, onClick: onPlannerRestoreComplete,
      'data-analytics-routine-ids': routines.map(row => row.id).join(','),
      'data-analytics-routine-status': routinesState?.status,
    }, 'Restore completed'),
}));
vi.mock('./views/SettingsView', () => ({ SettingsView: () => null }));
vi.mock('./views/RecipeView', () => ({ RecipeView: () => null }));

vi.mock('../lib/migrateLegacyDdays', () => ({ migrateLegacyDdays: async () => undefined }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ runPeriodicSnapshotSlots: () => undefined }));
vi.mock('../lib/healthSupabaseBootstrap', () => ({
  bootstrapHealthFromSupabase: async () => undefined,
  HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT: 'lean04b-health-bootstrap-complete',
}));
vi.mock('../lib/healthBootstrapSingleFlight', () => ({
  runHealthBootstrapSingleFlight: async (_accountId: string, start: () => Promise<unknown>) => start(),
}));
vi.mock('../lib/startupBootstrapCoordinator', () => ({
  startIndependentStartup: (input: Parameters<typeof import('../lib/startupBootstrapCoordinator').startIndependentStartup>[0]) => {
    if (harness.localAuthority) input.onStateChange('health', { status: 'ready', error: null });
    return { cancel: () => undefined, retry: () => undefined };
  },
}));

vi.mock('./views/features/knowledge/discovery', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/knowledge/discovery')>();
  return {
    ...actual,
    buildDiscoveryFeed: (...args: Parameters<typeof actual.buildDiscoveryFeed>) => {
      harness.discoveryCalls += 1;
      return actual.buildDiscoveryFeed(...args);
    },
  };
});
vi.mock('./views/features/search/buildSearchProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./views/features/search/buildSearchProjection')>();
  return {
    ...actual,
    buildSearchProjection: (...args: Parameters<typeof actual.buildSearchProjection>) => {
      harness.projectionCalls += 1;
      return actual.buildSearchProjection(...args);
    },
  };
});
vi.mock('./views/k101WorkspaceSearchState', () => ({
  readWorkspaceSearchState: () => harness.persisted,
  writeWorkspaceSearchState: (state: { query: string; filter: string }) => {
    harness.persisted = { query: state.query, filter: 'all' };
  },
}));
vi.mock('./views/features/search/searchRecentStorage', async () => {
  const actual = await vi.importActual<typeof import('./views/features/search/searchRecentStorage')>('./views/features/search/searchRecentStorage');
  return { ...actual, loadSearchRecent: () => [] };
});
vi.mock('./views/features/search/components/SearchWorkspacePalette', () => ({
  SearchWorkspacePalette: (props: PaletteProps) => {
    harness.palette = props;
    harness.paletteSnapshots.push(props);
    return createElement('output', {
      'data-open': String(props.open),
      'data-query': props.query,
    });
  },
}));
vi.mock('./views/noteEditorTheme', () => ({
  buildNoteChrome: () => ({
    card: '#fff', sideBdr: '#ddd', text: '#111', textMuted: '#666', textFaint: '#999', accent: '#00f',
  }),
}));

vi.mock('./views/features/search/buildSearchDomainResults', async () => {
  const actual = await vi.importActual<typeof import('./views/features/search/buildSearchDomainResults')>('./views/features/search/buildSearchDomainResults');
  return {
    ...actual,
    buildPlannerSearchResults: (...args: Parameters<typeof actual.buildPlannerSearchResults>) => {
      const [, schedules, todos] = args;
      harness.plannerInputs.push({ schedules: [...schedules], todos: [...todos] });
      return actual.buildPlannerSearchResults(...args);
    },
    buildHealthSearchResults: (...args: Parameters<typeof actual.buildHealthSearchResults>) => {
      const [, workouts, healthBlocks] = args;
      harness.healthInputs.push({ workouts: [...workouts], healthBlocks: [...healthBlocks] });
      return actual.buildHealthSearchResults(...args);
    },
  };
});

import { AppContent } from './AppContent';

const accountUser = (id: string) => ({ id, email: `${id}@example.com` }) as never;

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

async function settlePresentation(): Promise<void> {
  await act(async () => { await vi.dynamicImportSettled(); });
}

function deferred<T = unknown>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => { resolve = nextResolve; });
  return { promise, resolve };
}

function resetHarness(kind: TargetKind, status: TargetStatus, query: string): void {
  harness.targetKind = kind;
  harness.targetStatus = status;
  harness.todoPromise = Promise.resolve([]);
  harness.blockPromise = Promise.resolve([]);
  harness.emptyPromise = Promise.resolve([]);
  harness.weeklyOwner = null;
  harness.weeklyReply = null;
  harness.routineReply = null;
  harness.localAuthority = false;
  harness.localDailyReply = undefined;
  harness.archiveEnabled = true;
  harness.fetches.length = 0;
  harness.palette = null;
  harness.paletteSnapshots.length = 0;
  harness.openers.length = 0;
  harness.persisted = { query, filter: 'all' };
  harness.plannerInputs.length = 0;
  harness.healthInputs.length = 0;
  harness.discoveryCalls = 0;
  harness.projectionCalls = 0;
  harness.notes = [];
  harness.folders = [];

  if (kind === 'todos') {
    harness.todoPromise = status === 'pending'
      ? deferred().promise
      : status === 'results'
        ? Promise.resolve([{ id: 'todo-a', text: 'todo', done: false }])
        : Promise.resolve([]);
  } else {
    harness.blockPromise = status === 'pending'
      ? deferred().promise
      : status === 'results'
        ? Promise.resolve([{ id: 'block-a', name: 'block', type: 'strength', tags: [] }])
        : Promise.resolve([]);
  }
}

type ScenarioResult = {
  projection: SearchProjection;
  fetches: string[];
  plannerInput: { schedules: unknown[]; todos: unknown[] } | undefined;
  healthInput: { workouts: unknown[]; healthBlocks: unknown[] } | undefined;
};

async function renderScenario(kind: TargetKind, status: TargetStatus, query: string): Promise<ScenarioResult> {
  resetHarness(kind, status, query);
  // Exercise one unresolved source at a time; weekly data is verified empty.
  harness.weeklyOwner = { accountId: 'account-a', signal: new AbortController().signal };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);

  await act(async () => {
    root.render(createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false } },
      createElement(AppContent, { authUser: accountUser('account-a') }),
    ));
  });
  await flush();
  expect(harness.openers).toHaveLength(1);
  act(() => harness.openers[0]!());
  await settlePresentation();
  await flush();

  const projection = harness.palette?.projection;
  const result: ScenarioResult = {
    projection: projection!,
    fetches: [...harness.fetches],
    plannerInput: harness.plannerInputs.at(-1),
    healthInput: harness.healthInputs.at(-1),
  };
  act(() => root.unmount());
  host.remove();
  return result;
}

describe('LEAN_04B production-plumbing Search characterization', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each(['local', 'legacy-remote'] as const)('measures daily Routine GETs across tabs and Search (%s authority)', async source => {
    resetHarness('todos', 'empty', '');
    harness.weeklyOwner = { accountId: 'account-a', signal: new AbortController().signal };
    if (source === 'local') {
      harness.localAuthority = true;
      harness.localDailyReply = Promise.resolve({
        routines: [{ id: 'local-a', text: 'Routine local', done: false, is_active: true }],
        workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 },
      });
    }
    const rows = [{ id: 'remote-a', text: 'Routine remote', done: true, is_active: true }];
    harness.routineReply = Promise.resolve(rows);
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    const counts: Record<string, number> = {};
    const total = () => harness.fetches.filter(url => url.includes('/routines_with_logs?')).length;
    const measure = async (label: string, action: () => void | Promise<void>) => {
      const before = total();
      await action();
      await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
      await flush();
      counts[label] = total() - before;
    };
    const click = (selector: string) => act(async () => { host.querySelector<HTMLButtonElement>(selector)!.click(); });
    const open = async () => {
      await act(async () => { harness.openers[0]!(); });
      await settlePresentation();
    };
    const close = () => act(async () => { harness.palette!.onClose(); });
    try {
      await measure('home', () => act(async () => {
        root.render(createElement(SWRConfig, {
          value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false },
        }, createElement(AppContent, { authUser: accountUser('account-a') })));
      }));
      for (const tab of ['planner', 'health', 'note', 'recipe', 'settings', 'analytics']) {
        await measure(tab, () => click(`[data-shell-tab="${tab}"]`));
      }
      await measure('restoreWhileClosed', () => click('[data-completed-restore]'));
      await measure('blankSearch', open);
      const reply = deferred();
      harness.routineReply = reply.promise;
      await measure('firstQuery', () => act(async () => { harness.palette!.onQueryChange('Routine'); }));
      const whilePending = harness.palette!.projection;
      await act(async () => reply.resolve(rows));
      await flush();
      const results = () => harness.palette!.projection.results.filter(result => result.kind === 'routine');
      const afterQuery = results();
      await close();
      await measure('persistedQueryReopen', open);
      const onReopen = results();
      await close();
      await measure('refreshWhileClosed', () => act(async () => {
        window.dispatchEvent(new Event('lean04b-health-bootstrap-complete'));
      }));

      console.info('[daily Routine GET counts]', source, counts);
      const remote = Number(source === 'legacy-remote');
      expect(counts).toEqual({
        home: 0, planner: 0, health: 0, note: 0, recipe: 0, settings: 0, analytics: 0,
        restoreWhileClosed: 0, blankSearch: 0, firstQuery: remote,
        persistedQueryReopen: remote, refreshWhileClosed: 0,
      });
      if (remote) {
        expect(whilePending.groupStates?.planner?.status).toBe('LOADING');
        expect(whilePending.empty.noResults).toBe(false);
      }
      const expectedTitle = source === 'local' ? 'Routine local' : 'Routine remote';
      expect(afterQuery).toMatchObject([{ kind: 'routine', title: expectedTitle, plannerItemId: remote ? 'remote-a' : 'local-a' }]);
      expect(onReopen).toEqual(afterQuery);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  }, 15_000);

  it('keeps the Routine read live on the legacy Analytics rollback path, without opening Search', async () => {
    resetHarness('todos', 'empty', '');
    harness.archiveEnabled = false;
    harness.weeklyOwner = { accountId: 'account-a', signal: new AbortController().signal };
    harness.routineReply = Promise.resolve([{ id: 'legacy-analytics', text: 'Routine legacy', done: true, is_active: true }]);
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    const routineGets = () => harness.fetches.filter(url => url.includes('/routines_with_logs?'));
    try {
      await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map() } },
        createElement(AppContent, { authUser: accountUser('account-a') }))));
      expect(routineGets()).toHaveLength(0);
      await act(async () => host.querySelector<HTMLButtonElement>('[data-shell-tab="analytics"]')!.click());
      await settlePresentation();
      await flush();
      expect(routineGets()).toHaveLength(1);
      expect(host.querySelector('[data-completed-restore]')?.getAttribute('data-analytics-routine-ids')).toBe('legacy-analytics');
      expect(host.querySelector('[data-completed-restore]')?.getAttribute('data-analytics-routine-status')).toBe('READY_WITH_RESULTS');
      expect(harness.palette?.open).toBe(false);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it('does not report no matches while a warm empty local Routine snapshot refreshes', async () => {
    resetHarness('todos', 'empty', 'Routine');
    harness.weeklyOwner = { accountId: 'account-a', signal: new AbortController().signal };
    harness.localAuthority = true;
    const empty = { routines: [], workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 } };
    harness.localDailyReply = Promise.resolve(empty);
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map() } },
        createElement(AppContent, { authUser: accountUser('account-a') }))));
      await act(async () => harness.openers[0]!());
      await settlePresentation();
      await flush();
      expect(harness.palette!.projection.empty.noResults).toBe(true);

      const reply = deferred<import('../lib/healthLocalRuntime').LocalHealthDailyProjection>();
      harness.localDailyReply = reply.promise;
      await act(async () => window.dispatchEvent(new Event('lean04b-health-bootstrap-complete')));
      expect(harness.palette!.projection.empty.noResults).toBe(false);
      expect(harness.palette!.projection.groupStates?.planner).toMatchObject({ status: 'READY_EMPTY', validating: true });
      const row = { id: 'new-local-routine', text: 'Routine added locally', is_active: true, done: false };
      await act(async () => reply.resolve({ ...empty, routines: [row] }));
      expect(harness.palette!.projection.results).toMatchObject([{ kind: 'routine', plannerItemId: row.id }]);
      expect(harness.fetches.filter(url => url.includes('/routines_with_logs?'))).toEqual([]);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it('measures weekly requests across workspaces, inactive invalidation, and persisted Search reopening', async () => {
    resetHarness('todos', 'empty', '');
    harness.weeklyOwner = { accountId: 'account-a', signal: new AbortController().signal };
    const row = (title: string) => [{ id: 'slot-a', day: 0, title, start_time: '09:00', end_time: '10:00', color: 'blue' }];
    harness.weeklyReply = Promise.resolve(row('Weekly original'));
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    const config = { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false };
    const counts: Record<string, number> = {};
    const total = () => harness.fetches.filter(url => url.endsWith('/weekly_schedules')).length;
    const frame = () => act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    const measure = async (name: string, action: () => void | Promise<void>) => {
      const before = total();
      await action();
      await frame();
      await flush();
      counts[name] = total() - before;
    };
    const select = (tab: string) => act(async () => {
      host.querySelector<HTMLButtonElement>(`[data-shell-tab="${tab}"]`)!.click();
    });
    const open = async () => {
      await act(async () => { harness.openers[0]!(); });
      await settlePresentation();
    };
    const close = () => act(async () => { harness.palette?.onClose(); });
    const bootstrapComplete = () => act(async () => { window.dispatchEvent(new Event('lean04b-health-bootstrap-complete')); });
    try {
      await measure('home', () => act(async () => root.render(createElement(
        SWRConfig, { value: config }, createElement(AppContent, { authUser: accountUser('account-a') }),
      ))));
      await measure('warmPlannerAndHealth', async () => { await select('planner'); await flush(); await select('health'); });
      for (const tab of ['note', 'recipe', 'settings', 'analytics']) {
        await measure(`enter:${tab}`, () => select(tab));
        // Count what the existing static invalidator does in each inactive
        // surface. Archive exercises the actual successful-restore callback.
        await measure(`invalidate:${tab}`, tab === 'analytics'
          ? () => act(async () => { host.querySelector<HTMLButtonElement>('[data-completed-restore]')!.click(); })
          : bootstrapComplete);
      }
      await measure('openWithoutQuery', open);
      await close();
      harness.persisted = { query: 'Weekly', filter: 'all' };
      const response = deferred();
      harness.weeklyReply = response.promise;
      await measure('openPersistedQuery', open);
      const stateBeforeResponse = harness.palette?.projection.groupStates?.planner?.status;
      const titlesBeforeResponse = harness.palette?.projection.results.map(result => result.title);
      const emptyBeforeResponse = harness.palette?.projection.empty.noResults;
      await act(async () => response.resolve(row('Weekly current')));
      await flush();
      const resultTitles = harness.palette?.projection.results.map(result => result.title);
      await close();
      await measure('warmSearchReopen', open);

      console.info('[weekly Schedule GET counts]', counts);
      expect(counts).toEqual({
        home: 1, warmPlannerAndHealth: 0,
        'enter:note': 0, 'invalidate:note': 0,
        'enter:recipe': 0, 'invalidate:recipe': 0,
        'enter:settings': 0, 'invalidate:settings': 0,
        'enter:analytics': 0, 'invalidate:analytics': 0,
        openWithoutQuery: 0, openPersistedQuery: 1, warmSearchReopen: 0,
      });
      expect(stateBeforeResponse).toBe('LOADING');
      expect(titlesBeforeResponse).not.toContain('Weekly original');
      expect(emptyBeforeResponse).toBe(false);
      expect(resultTitles).toContain('Weekly current');
      expect(harness.palette?.projection.results.map(result => result.title)).toContain('Weekly current');
    } finally {
      await act(async () => { root.unmount(); });
      host.remove();
    }
  }, 15_000);

  it.each([20, 500])('measures real shell Search builders with %i Notes and opens with fresh results', async count => {
    resetHarness('todos', 'empty', '');
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    const config = { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false };
    const render = (account = 'account-a') => act(() => root.render(createElement(
      SWRConfig, { value: config }, createElement(AppContent, { authUser: accountUser(account) }),
    )));
    const notes = (prefix: string) => Array.from({ length: count }, (_, i) => ({
      id: `note-${prefix}-${i}`, title: `${prefix} note ${i}`, body: 'Fixture body',
    }));
    const work: Record<string, [discovery: number, projection: number]> = {};
    const measure = async (phase: string, action: () => void | Promise<void>) => {
      const { discoveryCalls, projectionCalls } = harness;
      await action();
      work[phase] = [harness.discoveryCalls - discoveryCalls, harness.projectionCalls - projectionCalls];
    };
    const open = () => {
      expect(harness.openers).toHaveLength(1);
      act(() => harness.openers[0]!());
    };
    const expectNote = (title: string) => {
      expect(harness.palette?.open).toBe(true);
      expect(harness.palette?.projection.results.some(result => result.kind === 'note' && result.title === title)).toBe(true);
    };
    const expectNoBuilds = () => {
      expect([harness.discoveryCalls, harness.projectionCalls]).toEqual([0, 0]);
    };
    const expectOnlyCurrentNotes = (prefix: string, since: number) => {
      const snapshots = harness.paletteSnapshots.slice(since).filter(snapshot => snapshot.open);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots.some(snapshot => snapshot.projectionStatus === undefined)).toBe(true);
      for (const snapshot of snapshots) {
        const results = snapshot.projection.results.filter(result => result.kind === 'note');
        if (snapshot.projectionStatus === 'loading') {
          expect(snapshot.projection.results).toEqual([]);
          continue;
        }
        expect(snapshot.projectionStatus).toBeUndefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(result => result.title?.startsWith(`${prefix} note `))).toBe(true);
      }
    };
    try {
      harness.notes = notes('Initial');
      await measure('mountClosed', () => render());
      await flush();
      expectNoBuilds();
      harness.notes = notes('Latest');
      await measure('notesChangeClosed', () => render());
      await measure('unrelatedRenderClosed', () => render());
      await measure('workspaceNavigationClosed', () => {
        for (const tab of ['planner', 'health', 'recipe', 'analytics', 'note', 'home']) {
          act(() => host.querySelector<HTMLButtonElement>(`[data-shell-tab="${tab}"]`)!.click());
        }
      });
      await flush();
      expectNoBuilds();
      await measure('open', async () => { open(); await settlePresentation(); });
      await measure('query', () => act(() => harness.palette!.onQueryChange('Latest')));
      expectNote('Latest note 0');
      harness.notes = notes('Latest Edited');
      await measure('notesChangeOpen', () => render());
      expectNote('Latest Edited note 0');
      await measure('close', () => act(() => harness.palette!.onClose()));
      expect(harness.palette?.projection.results).toEqual([]);
      harness.notes = notes('Latest Reopened');
      await measure('notesChangeAfterClose', () => render());
      await measure('reopen', open);
      expect(harness.palette?.query).toBe('Latest');
      expectNote('Latest Reopened note 0');
      expect(harness.palette?.projection.results.some(result => result.title === 'Latest Edited note 0')).toBe(false);

      harness.notes = notes('Latest B');
      const bStart = harness.paletteSnapshots.length;
      render('account-b');
      expect(harness.palette?.open).toBe(false);
      open();
      await settlePresentation();
      expectNote('Latest B note 0');
      expectOnlyCurrentNotes('Latest B', bStart);
      harness.notes = notes('Latest A2');
      const a2Start = harness.paletteSnapshots.length;
      render();
      expect(harness.palette?.open).toBe(false);
      expect(harness.openers).toHaveLength(1);
      // Exercise the AppContent shortcut as well as the direct opener above.
      act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'F', ctrlKey: true, metaKey: true, shiftKey: true, cancelable: true,
      })));
      await settlePresentation();
      expectNote('Latest A2 note 0');
      expectOnlyCurrentNotes('Latest A2', a2Start);

      expect(work).toMatchObject({
        mountClosed: [0, 0], notesChangeClosed: [0, 0], unrelatedRenderClosed: [0, 0],
        workspaceNavigationClosed: [0, 0], close: [0, 0], notesChangeAfterClose: [0, 0],
      });
      expect(work.open?.[0]).toBe(1);
      expect(work.reopen?.[0]).toBe(1);
      // Captured on 44d03864e with this same mounted fixture/action sequence,
      // before gating the builders. Both fixture sizes yielded these counts.
      const baseline = {
        mountClosed: [1, 2], notesChangeClosed: [1, 1], unrelatedRenderClosed: [0, 1],
        workspaceNavigationClosed: [0, 6], open: [0, 2], query: [0, 2],
        notesChangeOpen: [1, 1], close: [0, 2], notesChangeAfterClose: [1, 1], reopen: [0, 2],
      };
      console.info('[search-builders: discovery, projection]', count, { baseline, optimized: work });
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it('traces useDailyData todos through AppContent and GlobalSearchHost into real projection semantics', async () => {
    const notReady = await renderScenario('todos', 'pending', 'todo');
    const readyEmpty = await renderScenario('todos', 'empty', 'todo');
    const readyResults = await renderScenario('todos', 'results', 'todo');

    expect(notReady.fetches.some(url => url.includes('/todos?'))).toBe(true);
    expect(readyEmpty.fetches.some(url => url.includes('/todos?'))).toBe(true);
    expect(notReady.plannerInput?.todos).toEqual([]);
    expect(readyEmpty.plannerInput?.todos).toEqual([]);
    expect(notReady.projection.results).toEqual([]);
    expect(readyEmpty.projection.results).toEqual([]);
    expect(notReady.projection.empty).toEqual(readyEmpty.projection.empty);
    expect(notReady.projection.empty).toMatchObject({ noQuery: false, noResults: true });
    expect(notReady.projection).not.toHaveProperty('loading');
    expect(notReady.projection).not.toHaveProperty('error');
    expect(notReady.projection).not.toHaveProperty('inactive');
    expect(notReady.projection).not.toHaveProperty('healthReady');
    expect(notReady.projection).not.toHaveProperty('healthError');
    expect(readyResults.plannerInput?.todos).toEqual([{ id: 'todo-a', text: 'todo', done: false }]);
    expect(readyResults.projection.results.map(result => result.kind)).toContain('todo');
  });

  it('traces useStaticData healthBlocks through AppContent and GlobalSearchHost into real projection semantics', async () => {
    const notReady = await renderScenario('healthBlocks', 'pending', 'block');
    const readyEmpty = await renderScenario('healthBlocks', 'empty', 'block');
    const readyResults = await renderScenario('healthBlocks', 'results', 'block');

    expect(notReady.fetches.some(url => url.endsWith('/blocks'))).toBe(true);
    expect(readyEmpty.fetches.some(url => url.endsWith('/blocks'))).toBe(true);
    expect(notReady.healthInput?.healthBlocks).toEqual([]);
    expect(readyEmpty.healthInput?.healthBlocks).toEqual([]);
    expect(notReady.projection.results).toEqual([]);
    expect(readyEmpty.projection.results).toEqual([]);
    expect(notReady.projection.empty).toEqual(readyEmpty.projection.empty);
    expect(notReady.projection.empty).toMatchObject({ noQuery: false, noResults: true });
    expect(notReady.projection).not.toHaveProperty('loading');
    expect(notReady.projection).not.toHaveProperty('error');
    expect(notReady.projection).not.toHaveProperty('inactive');
    expect(notReady.projection).not.toHaveProperty('healthReady');
    expect(notReady.projection).not.toHaveProperty('healthError');
    expect(readyResults.healthInput?.healthBlocks).toEqual([{ id: 'block-a', name: 'block', type: 'strength', tags: [] }]);
    expect(readyResults.projection.results.map(result => result.kind)).toContain('exercise-block');
  });
});
