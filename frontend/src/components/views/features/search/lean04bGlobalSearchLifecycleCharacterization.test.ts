// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchWorkspacePaletteProps } from './components/SearchWorkspacePalette';
import { loadSearchRecent, pushSearchRecent } from './searchRecentStorage';

type ProjectionRuntime = typeof import('./searchProjectionRuntime');

const harness = vi.hoisted(() => ({
  notes: [] as unknown[],
  folders: [] as unknown[],
  persisted: { query: '', filter: 'all' as const },
  palette: null as SearchWorkspacePaletteProps | null,
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
  storeListeners: new Set<() => void>(),
  useRealPalette: false,
  loadPresentation: undefined as (() => Promise<ProjectionRuntime>) | undefined,
}));

vi.mock('../../../../store/useNotesStore', () => {
  const store = {
    getState: () => ({ notes: harness.notes, folders: harness.folders }),
    subscribe: (listener: () => void) => {
      harness.storeListeners.add(listener);
      return () => { harness.storeListeners.delete(listener); };
    },
  };
  return {
    useNotesStore: Object.assign(
      (selector: (state: { notes: unknown[]; folders: unknown[] }) => unknown) => selector(store.getState()),
      store,
    ),
  };
});

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

vi.mock('../knowledge/discovery', async importOriginal => {
  const actual = await importOriginal<typeof import('../knowledge/discovery')>();
  return {
    ...actual,
    buildDiscoveryFeed: (...args: Parameters<typeof actual.buildDiscoveryFeed>) => {
      harness.discoveryCalls += 1;
      return actual.buildDiscoveryFeed(...args);
    },
  };
});

vi.mock('./hooks/useSearchProjection', async importOriginal => {
  const actual = await importOriginal<typeof import('./hooks/useSearchProjection')>();
  return {
    ...actual,
    loadSearchProjectionRuntime: () => harness.loadPresentation
      ? harness.loadPresentation() : actual.loadSearchProjectionRuntime(),
  };
});

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

async function settlePresentation(): Promise<void> {
  await act(async () => { await vi.dynamicImportSettled(); });
}

function holdPresentationImport() {
  let resolveRuntime!: (runtime: ProjectionRuntime) => void;
  let fail!: (error: Error) => void;
  const pending = new Promise<ProjectionRuntime>((resolve, reject) => { resolveRuntime = resolve; fail = reject; });
  const started = vi.fn(() => pending);
  harness.loadPresentation = started;
  const complete = async () => {
    await act(async () => resolveRuntime(await import('./searchProjectionRuntime')));
  };
  return { started, complete, fail };
}

function escape(): void {
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
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
) {
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
  const config = { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false, shouldRetryOnError: false };
  const render = (accountId = 'account-a') => act(() => {
    root.render(createElement(
      SWRConfig,
      { value: config },
      createElement(GlobalSearchHost, {
        key: accountId,
        accountId,
        appSettings: settings(),
        onSearchHasQueryChange,
        ...data,
      }),
    ));
  });
  render();
  return { root, host, render };
}

function openSearch(): void {
  expect(harness.openers).toHaveLength(1);
  act(() => harness.openers[0]!());
}

function updateSources(notes: unknown[], folders: unknown[] = harness.folders): void {
  act(() => {
    harness.notes = notes;
    harness.folders = folders;
    for (const listener of [...harness.storeListeners]) listener();
  });
}

import { GlobalSearchHost } from './GlobalSearchHost';

describe('LEAN_04B GlobalSearchHost lifecycle characterization', () => {
  let mounted: ReturnType<typeof mount> | null = null;

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
    expect(harness.storeListeners.size).toBe(0);
    harness.useRealPalette = false;
    harness.loadPresentation = undefined;
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    if (mounted) act(() => mounted?.root.unmount());
    expect(harness.storeListeners.size).toBe(0);
    mounted?.host.remove();
    mounted = null;
  });

  it('keeps the global opener registered without importing or building Search while closed', async () => {
    const heldImport = holdPresentationImport();
    mounted = mount();
    await flush();
    expect(heldImport.started).not.toHaveBeenCalled();

    expect(harness.palette?.open).toBe(false);
    expect(harness.openers).toHaveLength(1);
    expect(harness.writes).toHaveLength(0);
    expect(harness.recipeRequests).toHaveLength(0);
    expect(harness.projectionInputs).toHaveLength(0);
    expect(harness.discoveryCalls).toBe(0);
    expect(harness.storeListeners.size).toBe(0);
  });

  it('keeps cold typing and focus intact, uses current data on arrival, and reopens warm', async () => {
    const heldImport = holdPresentationImport();
    harness.useRealPalette = true;
    harness.persisted = { query: 'saved query', filter: 'all' };
    mounted = mount();
    const opener = mounted.host.appendChild(document.createElement('button'));
    opener.focus();
    openSearch();
    expect(harness.storeListeners.size).toBe(2);
    expect(heldImport.started).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    const input = mounted.host.querySelector<HTMLInputElement>('[data-k111-search-input]')!;
    expect(input.value).toBe('saved query');
    expect(document.activeElement).toBe(input);
    expect(mounted.host.querySelector('[data-k111-search-loading]')).not.toBeNull();
    expect(harness.projectionInputs).toHaveLength(0);
    expect(harness.recipeRequests).toEqual(['https://example.invalid/api/recipes']);

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'current target');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.setSelectionRange(7, 7);
    });
    expect(harness.persisted.query).toBe('current target');
    updateSources([{ id: 'live-note', title: 'Current target', body: 'Fixture body' }]);

    await heldImport.complete();
    expect(harness.palette?.projectionStatus).toBeUndefined();
    expect(harness.palette?.projection.results.some(item => item.noteId === 'live-note')).toBe(true);
    expect(mounted.host.querySelector('[data-k111-search-input]')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(7);
    expect(harness.recipeRequests).toHaveLength(1);

    escape();
    expect(input.value).toBe('');
    escape();
    expect(harness.storeListeners.size).toBe(0);
    expect(document.activeElement).toBe(opener);
    openSearch();
    expect(harness.palette?.projectionStatus).toBeUndefined();
    expect(heldImport.started).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(mounted.host.querySelector('[data-k111-search-input]'));
  });

  it('clears then closes on Escape while loading, and late code cannot reopen or build', async () => {
    const heldImport = holdPresentationImport();
    harness.useRealPalette = true;
    harness.persisted = { query: 'pending query', filter: 'all' };
    mounted = mount();
    const opener = mounted.host.appendChild(document.createElement('button'));
    opener.focus();
    openSearch();
    expect(heldImport.started).toHaveBeenCalledTimes(1);

    escape();
    expect(mounted.host.querySelector<HTMLInputElement>('[data-k111-search-input]')?.value).toBe('');
    escape();
    expect(mounted.host.querySelector('[data-k111-search-modal]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    await heldImport.complete();
    expect(mounted.host.querySelector('[data-k111-search-modal]')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(harness.projectionInputs).toHaveLength(0);
    expect(harness.discoveryCalls).toBe(0);
  });

  it('drops pending A and B activations and only exposes current A2 results and account recents', async () => {
    const heldImport = holdPresentationImport();
    harness.useRealPalette = true;
    harness.persisted = { query: 'target', filter: 'all' };
    harness.notes = [{ id: 'old-a', title: 'Target A1', body: '' }];
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recent-a', title: 'Account A recent' }, 'account-a');
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recent-b', title: 'Account B recent' }, 'account-b');
    mounted = mount();
    openSearch();
    expect(heldImport.started).toHaveBeenCalledTimes(1);
    expect(harness.palette?.projectionStatus).toBe('loading');

    harness.notes = [{ id: 'old-b', title: 'Target B', body: '' }];
    mounted.render('account-b');
    expect(harness.storeListeners.size).toBe(0);
    expect(harness.palette?.open).toBe(false);
    openSearch();
    expect(harness.storeListeners.size).toBe(2);
    expect(harness.palette?.projectionStatus).toBe('loading');
    expect(heldImport.started).toHaveBeenCalledTimes(2);

    harness.notes = [{ id: 'new-a', title: 'Target A2', body: '' }];
    mounted.render();
    expect(harness.storeListeners.size).toBe(0);
    await heldImport.complete();
    expect(harness.palette?.open).toBe(false);
    expect(harness.projectionInputs).toHaveLength(0);
    expect(harness.discoveryCalls).toBe(0);

    openSearch();
    await heldImport.complete();
    expect(harness.palette?.projection.results.filter(item => item.kind === 'note').map(item => item.noteId))
      .toEqual(['new-a']);
    escape();
    const recent = mounted.host.querySelector('[data-k111-search-recent]');
    expect(recent?.textContent).toContain('Account A recent');
    expect(recent?.textContent).not.toContain('Account B recent');
  });

  it('keeps current-account recents usable while loading or unavailable without retrying in a loop', async () => {
    const heldImport = holdPresentationImport();
    harness.useRealPalette = true;
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recent-a', title: 'Account A recent' }, 'account-a');
    pushSearchRecent({ domain: 'recipe', kind: 'recipe', id: 'recent-b', title: 'Account B recent' }, 'account-b');
    mounted = mount();
    openSearch();
    expect(heldImport.started).toHaveBeenCalledTimes(1);
    expect(mounted.host.querySelector('[data-k111-search-loading]')).not.toBeNull();
    const recent = () => mounted!.host.querySelector('[data-k111-search-recent]');
    expect(recent()?.textContent).toContain('Account A recent');
    expect(mounted.host.textContent).not.toContain('Account B recent');
    act(() => recent()!.querySelector<HTMLButtonElement>('[data-k111-recent-row]')!.click());
    expect(harness.palette?.query).toBe('Account A recent');
    expect(recent()).toBeNull();

    await act(async () => heldImport.fail(new Error('synthetic chunk failure')));
    expect(harness.palette?.projectionStatus).toBe('unavailable');
    expect(mounted.host.querySelector('[data-k111-search-results] [role="alert"]')?.textContent).toBe('사용할 수 없음');
    escape();
    expect(recent()?.textContent).toContain('Account A recent');
    expect(mounted.host.textContent).not.toContain('Account B recent');
    act(() => recent()!.querySelector<HTMLButtonElement>('[data-k111-clear-recent]')!.click());
    expect(recent()?.textContent).not.toContain('Account A recent');
    expect(loadSearchRecent('account-a')).toEqual([]);
    expect(loadSearchRecent('account-b').map(item => item.id)).toEqual(['recent-b']);
    expect(harness.projectionInputs).toHaveLength(0);
    expect(heldImport.started).toHaveBeenCalledTimes(1);
    escape();
    expect(mounted.host.querySelector('[data-k111-search-modal]')).toBeNull();
  });

  it('opens through the registered global path, fetches recipes on open, and enters query without moving data ownership', async () => {
    mounted = mount();
    openSearch();
    expect(harness.palette?.open).toBe(true);
    await settlePresentation();
    await flush();

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
    await settlePresentation();
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
    await settlePresentation();
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
    await settlePresentation();
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
    expect(harness.activationSignals).toContain(true);
    await settlePresentation();
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
    await settlePresentation();
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
    await settlePresentation();
    expect(harness.projectionInputs[0]).toMatchObject({ notes: harness.notes, folders: harness.folders, todos: [] });
    expect(harness.discoveryCalls).toBe(1);
    await flush();
  });

  it('passes an unavailable Health group as empty data without exposing a Health readiness state to Search', async () => {
    mounted = mount({ healthBlocks: [] });
    openSearch();
    act(() => harness.palette?.onQueryChange('block'));
    await settlePresentation();
    await flush();
    expect(harness.projectionInputs.at(-1)?.healthBlocks).toEqual([]);
    expect(harness.projectionInputs.at(-1)?.schedules).toHaveLength(1);
    expect(harness.projectionInputs.at(-1)?.todos).toHaveLength(1);
    expect(harness.projectionInputs.at(-1)).not.toHaveProperty('healthReady');
    expect(harness.projectionInputs.at(-1)).not.toHaveProperty('healthError');
  });
});
