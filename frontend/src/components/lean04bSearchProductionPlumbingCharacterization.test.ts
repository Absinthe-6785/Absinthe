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
};

type PaletteProps = {
  open: boolean;
  query: string;
  projection: SearchProjection;
};

const harness = vi.hoisted(() => ({
  targetKind: 'todos' as TargetKind,
  targetStatus: 'pending' as TargetStatus,
  todoPromise: null as Promise<unknown> | null,
  blockPromise: null as Promise<unknown> | null,
  emptyPromise: null as Promise<unknown> | null,
  fetches: [] as string[],
  palette: null as PaletteProps | null,
  paletteSnapshots: [] as PaletteProps[],
  openers: [] as Array<() => void>,
  persisted: { query: '', filter: 'all' as const },
  plannerInputs: [] as Array<{ schedules: unknown[]; todos: unknown[] }>,
  healthInputs: [] as Array<{ workouts: unknown[]; healthBlocks: unknown[] }>,
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
  openWorkspaceSearch: () => undefined,
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
}));

vi.mock('../lib/localAuth', () => ({ isLocalOnlyRuntime: () => false }));

vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: async () => undefined,
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
vi.mock('./common/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./common/ViewLoadingFallback', () => ({ ViewLoadingFallback: () => null }));
vi.mock('./views/NoteView', () => ({ NoteView: () => null }));
vi.mock('./views/HomeView', () => ({ HomeView: () => null }));
vi.mock('./views/PlannerView', () => ({ PlannerView: () => null }));
vi.mock('./views/HealthView', () => ({ HealthView: () => null }));
vi.mock('./views/AnalyticsView', () => ({ AnalyticsView: () => null }));
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
  startIndependentStartup: () => ({ cancel: () => undefined, retry: () => undefined }),
}));

vi.mock('./views/features/knowledge/KnowledgeIndexService', () => ({
  knowledgeIndexService: {},
}));
vi.mock('./views/features/knowledge/discovery', () => ({
  buildDiscoveryFeed: () => ({ items: [], sections: {}, summary: {} }),
}));
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

function deferred(): { promise: Promise<unknown>; resolve: (value: unknown) => void } {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(nextResolve => { resolve = nextResolve; });
  return { promise, resolve };
}

function resetHarness(kind: TargetKind, status: TargetStatus, query: string): void {
  harness.targetKind = kind;
  harness.targetStatus = status;
  harness.todoPromise = Promise.resolve([]);
  harness.blockPromise = Promise.resolve([]);
  harness.emptyPromise = Promise.resolve([]);
  harness.fetches.length = 0;
  harness.palette = null;
  harness.paletteSnapshots.length = 0;
  harness.openers.length = 0;
  harness.persisted = { query, filter: 'all' };
  harness.plannerInputs.length = 0;
  harness.healthInputs.length = 0;
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
