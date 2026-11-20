// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchWorkspacePaletteProps } from './components/SearchWorkspacePalette';
import { pushSearchRecent } from './searchRecentStorage';

type PaletteProps = {
  open: boolean;
  query: string;
  projection: unknown;
  isSearching?: boolean;
  onQueryChange: (query: string) => void;
  onClose: () => void;
};

const harness = vi.hoisted(() => ({
  notes: [] as unknown[],
  folders: [] as unknown[],
  persisted: { query: '', filter: 'all' as const },
  palette: null as PaletteProps | null,
  projectionInputs: [] as Array<Record<string, unknown>>,
  recipeRequests: [] as unknown[],
  recipeResolvers: [] as Array<{
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }>,
  openers: [] as Array<() => void>,
  writes: [] as Array<{ query: string; filter: string }>,
  activationSignals: [] as boolean[],
  discoveryCalls: 0,
  useRealPalette: false,
}));

vi.mock('../../../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notes: unknown[]; folders: unknown[] }) => unknown) =>
    selector({ notes: harness.notes, folders: harness.folders }),
}));

vi.mock('../../noteEditorTheme', () => ({
  buildNoteChrome: () => ({
    card: '#fff', sideBdr: '#ddd', text: '#111', textMuted: '#666', textFaint: '#999', accent: '#00f',
  }),
}));

vi.mock('../../../../lib/config', () => ({ API_URL: 'https://example.invalid' }));

vi.mock('../../../../lib/remoteBoundary', () => ({
  remoteSWRKey: (key: string) => key,
}));

vi.mock('../../../../lib/fetcher', () => ({
  fetcher: (key: unknown) => {
    harness.recipeRequests.push(key);
    return new Promise((resolve, reject) => harness.recipeResolvers.push({ resolve, reject }));
  },
}));

vi.mock('../../../../lib/i18n', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/i18n')>(),
  resolveAppLanguage: () => 'en',
}));

vi.mock('../../../../lib/noteNavigation', () => ({
  registerWorkspaceSearchOpener: (opener: () => void) => {
    harness.openers.push(opener);
    return () => {
      const index = harness.openers.indexOf(opener);
      if (index >= 0) harness.openers.splice(index, 1);
    };
  },
}));

vi.mock('../knowledge/discovery', () => ({
  buildDiscoveryFeed: () => {
    harness.discoveryCalls += 1;
    return { items: [], sections: {}, summary: {} };
  },
}));

vi.mock('../../k101WorkspaceSearchState', () => ({
  readWorkspaceSearchState: () => harness.persisted,
  writeWorkspaceSearchState: (state: { query: string; filter: string }) => {
    harness.persisted = { query: state.query, filter: 'all' };
    harness.writes.push(state);
  },
}));

vi.mock('./buildSearchProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./buildSearchProjection')>();
  return {
    ...actual,
    buildSearchProjection: (input: Parameters<typeof actual.buildSearchProjection>[0]) => {
      harness.projectionInputs.push({ ...input });
      return actual.buildSearchProjection(input);
    },
  };
});

vi.mock('./components/SearchWorkspacePalette', async importOriginal => {
  const actual = await importOriginal<typeof import('./components/SearchWorkspacePalette')>();
  return {
    SearchWorkspacePalette: (props: SearchWorkspacePaletteProps) => {
      harness.palette = props;
      return harness.useRealPalette
        ? createElement(actual.SearchWorkspacePalette, props)
        : createElement('output', {
          'data-open': String(props.open),
          'data-query': props.query,
          'data-searching': String(Boolean(props.isSearching)),
        });
    },
  };
});

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

function settings() {
  return { darkMode: true, defaultCategory: 'General', defaultColor: 'blue', language: 'en' as const };
}

type SearchDataOverrides = Partial<{
  schedules: unknown[];
  todos: unknown[];
  routines: unknown[];
  workouts: unknown[];
  healthBlocks: unknown[];
  weeklySchedules: unknown[];
}>;

function mount(
  overrides: SearchDataOverrides = {},
  onSearchHasQueryChange?: (hasQuery: boolean) => void,
): { root: Root; host: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const data = {
    schedules: [{ id: 's1', text: 'schedule', category: 'work', start_time: '09:00', end_time: '10:00', color: '#fff' }],
    todos: [{ id: 't1', text: 'todo', done: false }],
    routines: [{ id: 'r1', text: 'routine' }],
    workouts: [{ id: 'w1', exercise_blocks: { name: 'workout', type: 'strength' } }],
    healthBlocks: [{ id: 'b1', name: 'block', type: 'strength', tags: [] }],
    weeklySchedules: [{ id: 'ws1', title: 'weekly', day: 1, start_time: '09:00', end_time: '10:00', color: '#fff' }],
    ...overrides,
  };
  act(() => {
    root.render(createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false, shouldRetryOnError: false } },
      createElement(GlobalSearchHost, {
        accountId: 'account-a',
        appSettings: settings(),
        onSearchHasQueryChange,
        ...data,
      }),
    ));
  });
  return { root, host };
}

function openSearch(): void {
  expect(harness.openers).toHaveLength(1);
  act(() => harness.openers[0]!());
}

import { GlobalSearchHost } from './GlobalSearchHost';

describe('LEAN_04B GlobalSearchHost lifecycle characterization', () => {
  let mounted: { root: Root; host: HTMLDivElement } | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    harness.notes = [];
    harness.folders = [];
    harness.persisted = { query: '', filter: 'all' };
    harness.palette = null;
    harness.projectionInputs.length = 0;
    harness.recipeRequests.length = 0;
    harness.recipeResolvers.length = 0;
    harness.openers.length = 0;
    harness.writes.length = 0;
    harness.activationSignals.length = 0;
    harness.discoveryCalls = 0;
    harness.useRealPalette = false;
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    if (mounted) act(() => mounted?.root.unmount());
    mounted?.host.remove();
    mounted = null;
  });

  it('keeps the global opener registered without building discovery or projection while closed', () => {
    mounted = mount();

    expect(harness.palette?.open).toBe(false);
    expect(harness.openers).toHaveLength(1);
    expect(harness.writes).toHaveLength(0);
    expect(harness.recipeRequests).toHaveLength(0);
    expect(harness.projectionInputs).toHaveLength(0);
    expect(harness.discoveryCalls).toBe(0);
  });

  it('opens through the registered global path, fetches recipes on open, and enters query without moving data ownership', async () => {
    mounted = mount();
    openSearch();
    await flush();

    expect(harness.palette?.open).toBe(true);
    expect(harness.recipeRequests).toEqual(['https://example.invalid/api/recipes']);
    expect(harness.projectionInputs.at(-1)?.todos).toHaveLength(1);
    expect(harness.projectionInputs.at(-1)?.healthBlocks).toHaveLength(1);

    act(() => harness.palette?.onQueryChange('todo'));
    expect(harness.palette?.query).toBe('todo');
    await flush();
    expect(harness.writes.at(-1)).toEqual({ query: 'todo', filter: 'all' });
  });

  it('exposes warm recipe data immediately on reopen while any revalidation remains owned by SWR', async () => {
    mounted = mount();
    openSearch();
    await flush();
    const recipe = { id: 'recipe-a', title: 'Recipe A', category: 'Dinner' };
    const request = harness.recipeResolvers.shift();
    expect(request).toBeDefined();
    act(() => request?.resolve([recipe]));
    await flush();
    expect(harness.projectionInputs.at(-1)?.recipes).toEqual([recipe]);

    act(() => harness.palette?.onClose());
    openSearch();
    await flush();
    expect(harness.projectionInputs.at(-1)?.recipes).toEqual([recipe]);
    expect(harness.recipeRequests.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves Recipe failure state for Search and recovers on a later successful activation', async () => {
    mounted = mount();
    openSearch();
    await flush();
    const failedRequest = harness.recipeResolvers.shift();
    expect(failedRequest).toBeDefined();
    act(() => failedRequest?.reject(new Error('recipes offline')));
    await flush();

    expect(harness.projectionInputs.at(-1)?.recipes).toEqual([]);
    expect(harness.projectionInputs.at(-1)?.recipeState).toMatchObject({
      status: 'ERROR',
      validating: false,
    });
    expect(harness.projectionInputs.at(-1)?.todos).toHaveLength(1);

    act(() => harness.palette?.onClose());
    openSearch();
    await flush();
    const recoveredRequest = harness.recipeResolvers.shift();
    expect(recoveredRequest).toBeDefined();
    const recipe = { id: 'recipe-recovered', title: 'Recovered recipe', category: 'Dinner' };
    act(() => recoveredRequest?.resolve([recipe]));
    await flush();

    expect(harness.projectionInputs.at(-1)?.recipes).toEqual([recipe]);
    expect(harness.projectionInputs.at(-1)?.recipeState).toEqual({
      status: 'READY_WITH_RESULTS',
      validating: false,
    });
  });

  it('closes by clearing the live query and reopens with the persisted query without changing the host mount', async () => {
    mounted = mount();
    openSearch();
    await flush();
    act(() => harness.palette?.onQueryChange('saved query'));
    await flush();
    act(() => harness.palette?.onClose());
    expect(harness.palette?.open).toBe(false);
    expect(harness.palette?.query).toBe('');

    openSearch();
    await flush();
    expect(harness.palette?.open).toBe(true);
    expect(harness.palette?.query).toBe('saved query');
    expect(harness.projectionInputs.at(-1)?.query).toBe('saved query');
    expect(Boolean(String(harness.projectionInputs.at(-1)?.query ?? '').trim())).toBe(true);
    expect(harness.recipeRequests.length).toBeGreaterThanOrEqual(1);
  });

  it('signals deferred activation immediately when a persisted non-empty query is reopened', async () => {
    harness.persisted = { query: 'saved query', filter: 'all' };
    mounted = mount({}, value => harness.activationSignals.push(value));

    expect(harness.activationSignals).toContain(false);
    openSearch();
    await flush();

    expect(harness.activationSignals).toContain(true);
  });

  it('focuses the real palette, restores opener focus, and displays current recents on reopen', async () => {
    harness.useRealPalette = true;
    mounted = mount();
    const opener = mounted.host.appendChild(document.createElement('button'));
    opener.addEventListener('click', openSearch);
    opener.focus();
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recipe-a', title: 'First recent recipe' }, 'account-a');
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recipe-b', title: 'Foreign recent recipe' }, 'account-b');
    const expectOpen = () => {
      const input = mounted!.host.querySelector('[data-k111-search-input]');
      expect(input).not.toBeNull();
      expect(document.activeElement).toBe(input);
      expect(mounted!.host.querySelector('[data-k111-search-recent]')?.textContent).toContain('First recent recipe');
      expect(mounted!.host.textContent).not.toContain('Foreign recent recipe');
    };

    opener.click();
    await flush();
    expectOpen();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
    expect(mounted.host.querySelector('[data-k111-search-modal]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recipe-new', title: 'New recent recipe' }, 'account-a');
    opener.click();
    await flush();
    expectOpen();
    expect(mounted.host.querySelector('[data-k111-search-recent]')?.textContent).toContain('New recent recipe');
  });

  it('keeps closed updates idle and uses the latest sources on open', async () => {
    mounted = mount();
    harness.notes = [{ id: 'new-note', title: 'Latest', body: '' }];
    harness.folders = [{ id: 'new-folder', name: 'Latest folder' }];
    act(() => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false, shouldRetryOnError: false } },
        createElement(GlobalSearchHost, {
          accountId: 'account-a',
          appSettings: settings(), schedules: [], todos: [], routines: [], workouts: [], healthBlocks: [], weeklySchedules: [],
        }),
      ));
    });
    expect(harness.projectionInputs).toHaveLength(0);
    expect(harness.discoveryCalls).toBe(0);
    openSearch();
    expect(harness.projectionInputs[0]).toMatchObject({ notes: harness.notes, folders: harness.folders, todos: [] });
    expect(harness.discoveryCalls).toBe(1);
    await flush();
  });

  it('passes an unavailable Health group as empty data without exposing a Health readiness state to Search', async () => {
    mounted = mount({ healthBlocks: [] });
    openSearch();
    act(() => harness.palette?.onQueryChange('block'));
    await flush();
    expect(harness.projectionInputs.at(-1)?.healthBlocks).toEqual([]);
    expect(harness.projectionInputs.at(-1)?.schedules).toHaveLength(1);
    expect(harness.projectionInputs.at(-1)?.todos).toHaveLength(1);
    expect(harness.projectionInputs.at(-1)).not.toHaveProperty('healthReady');
    expect(harness.projectionInputs.at(-1)).not.toHaveProperty('healthError');
  });
});
