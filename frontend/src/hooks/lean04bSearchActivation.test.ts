// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  requests: [] as Array<{ url: string; account: string }>,
  todoResolvers: [] as Array<(value: unknown) => void>,
  blockResolvers: [] as Array<(value: unknown) => void>,
  currentAccount: 'account-a' as 'account-a' | 'account-b',
  latest: null as { daily: any; stat: any } | null,
}));

vi.mock('../lib/localAuth', () => ({ isLocalOnlyRuntime: () => false }));
vi.mock('../lib/remoteBoundary', () => ({
  remoteSWRKey: (key: string) => key,
}));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../lib/fetcher', () => ({
  fetcher: (input: unknown) => {
    const url = String(input);
    harness.requests.push({ url, account: harness.currentAccount });
    if (url.includes('/todos?')) {
      return new Promise(resolve => harness.todoResolvers.push(resolve));
    }
    if (url.endsWith('/blocks')) {
      return new Promise(resolve => harness.blockResolvers.push(resolve));
    }
    return Promise.resolve([]);
  },
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: async () => ({ routines: [], workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 } }),
  readLocalHealthStatic: async () => ({ healthBlocks: [], healthRoutines: [] }),
}));

import { useDailyData } from './useDaily';
import { useStaticData } from './useStatic';
import { accountBoundTodoKey } from './useDaily';
import { accountBoundHealthStaticKey } from './useStatic';

function Probe({
  account,
  date = '2026-08-26',
  todosEnabled,
  healthBlocksEnabled,
}: {
  account: string;
  date?: string;
  todosEnabled: boolean;
  healthBlocksEnabled: boolean;
}) {
  harness.currentAccount = account as 'account-a' | 'account-b';
  const daily = useDailyData(date, undefined, account, true, todosEnabled);
  const stat = useStaticData('2026-08-01', '2026-08-31', undefined, account, true, healthBlocksEnabled);
  harness.latest = { daily, stat };
  return createElement('output', {
    'data-todos-status': daily.todosState.status,
    'data-blocks-status': stat.healthBlocksState.status,
  });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('LEAN_04B Search activation seam', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  const cache = new Map<unknown, unknown>();

  beforeEach(() => {
    harness.requests.length = 0;
    harness.todoResolvers.length = 0;
    harness.blockResolvers.length = 0;
    harness.currentAccount = 'account-a';
    harness.latest = null;
    cache.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  function render(props: { account: string; date?: string; todosEnabled: boolean; healthBlocksEnabled: boolean }): void {
    root?.render(createElement(
      SWRConfig,
      { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
      createElement(Probe, props),
    ));
  }

  it('does not activate todos or Health blocks for an empty/closed Search signal', async () => {
    root = createRoot(host!);
    await act(async () => render({ account: 'account-a', todosEnabled: false, healthBlocksEnabled: false }));
    await flush();

    expect(harness.requests.some(request => request.url.includes('/todos?'))).toBe(false);
    expect(harness.requests.some(request => request.url.endsWith('/blocks'))).toBe(false);
    expect(harness.latest?.daily.todosState.status).toBe('NOT_READY');
    expect(harness.latest?.stat.healthBlocksState.status).toBe('NOT_READY');
  });

  it('activates both deferred groups for a non-empty Search signal and distinguishes pending from empty', async () => {
    root = createRoot(host!);
    await act(async () => render({ account: 'account-a', todosEnabled: false, healthBlocksEnabled: false }));
    await flush();

    await act(async () => render({ account: 'account-a', todosEnabled: true, healthBlocksEnabled: true }));
    await flush();
    expect(harness.requests.some(request => request.url.includes('/todos?'))).toBe(true);
    expect(harness.requests.some(request => request.url.endsWith('/blocks'))).toBe(true);
    expect(harness.latest?.daily.todosState.status).toBe('LOADING');
    expect(harness.latest?.stat.healthBlocksState.status).toBe('LOADING');
    expect(harness.latest?.daily.isLoading).toBe(false);

    harness.todoResolvers.splice(0).forEach(resolve => resolve([]));
    harness.blockResolvers.splice(0).forEach(resolve => resolve([]));
    await flush();
    expect(harness.latest?.daily.todosState.status).toBe('READY_EMPTY');
    expect(harness.latest?.stat.healthBlocksState.status).toBe('READY_EMPTY');
  });

  it('uses account-separated cache identities and does not show A data while B is pending', async () => {
    const url = 'https://example.invalid/api/todos?date=2026-08-26';
    expect(accountBoundTodoKey(url, 'account-a')).not.toBe(accountBoundTodoKey(url, 'account-b'));
    expect(accountBoundHealthStaticKey('https://example.invalid/api/blocks', 'account-a'))
      .not.toBe(accountBoundHealthStaticKey('https://example.invalid/api/blocks', 'account-b'));

    root = createRoot(host!);
    await act(async () => render({ account: 'account-a', todosEnabled: true, healthBlocksEnabled: true }));
    await flush();
    harness.todoResolvers.splice(0).forEach(resolve => resolve([{ id: 'todo-a', text: 'A', done: false }]));
    harness.blockResolvers.splice(0).forEach(resolve => resolve([{ id: 'block-a', name: 'A', type: 'strength', tags: [] }]));
    await flush();
    expect(harness.latest?.daily.todos).toEqual([{ id: 'todo-a', text: 'A', done: false }]);
    expect(harness.latest?.stat.healthBlocks).toEqual([{ id: 'block-a', name: 'A', type: 'strength', tags: [] }]);

    await act(async () => render({ account: 'account-b', todosEnabled: true, healthBlocksEnabled: true }));
    await flush();
    expect(harness.latest?.daily.todos).toEqual([]);
    expect(harness.latest?.stat.healthBlocks).toEqual([]);
    expect(harness.latest?.daily.todosState.status).toBe('LOADING');
    expect(harness.latest?.stat.healthBlocksState.status).toBe('LOADING');
  });

  it('uses the latest selected date when activation follows an inactive date transition', async () => {
    root = createRoot(host!);
    await act(async () => render({ account: 'account-a', date: '2026-08-25', todosEnabled: false, healthBlocksEnabled: false }));
    await flush();

    await act(async () => render({ account: 'account-a', date: '2026-08-26', todosEnabled: false, healthBlocksEnabled: false }));
    await flush();
    expect(harness.requests.some(request => request.url.includes('/todos?'))).toBe(false);

    await act(async () => render({ account: 'account-a', date: '2026-08-26', todosEnabled: true, healthBlocksEnabled: false }));
    await flush();

    const todoRequests = harness.requests.filter(request => request.url.includes('/todos?'));
    expect(todoRequests).toHaveLength(1);
    expect(todoRequests[0]?.url).toContain('date=2026-08-26');
    expect(todoRequests[0]?.url).not.toContain('date=2026-08-25');
  });

  async function warmThenDeactivate(): Promise<void> {
    root = createRoot(host!);
    await act(async () => render({ account: 'account-a', todosEnabled: true, healthBlocksEnabled: true }));
    await flush();

    harness.todoResolvers.splice(0).forEach(resolve => resolve([{ id: 'todo-before-reset', text: 'stale', done: false }]));
    harness.blockResolvers.splice(0).forEach(resolve => resolve([{ id: 'block-before-reset', name: 'stale', type: 'strength', tags: [] }]));
    await flush();
    expect(harness.latest?.daily.todos).toEqual([{ id: 'todo-before-reset', text: 'stale', done: false }]);
    expect(harness.latest?.stat.healthBlocks).toEqual([{ id: 'block-before-reset', name: 'stale', type: 'strength', tags: [] }]);

    await act(async () => render({ account: 'account-a', todosEnabled: false, healthBlocksEnabled: false }));
    await flush();
  }

  it('clears warm deferred caches when reset invalidates them while inactive', async () => {
    await warmThenDeactivate();

    harness.latest?.daily.mutate();
    harness.latest?.stat.mutate();
    await flush();

    await act(async () => render({ account: 'account-a', todosEnabled: true, healthBlocksEnabled: true }));
    expect(harness.latest?.daily.todos).toEqual([]);
    expect(harness.latest?.stat.healthBlocks).toEqual([]);
    expect(harness.latest?.daily.todosState.status).toBe('LOADING');
    expect(harness.latest?.stat.healthBlocksState.status).toBe('LOADING');
  });

  it('clears warm deferred caches when bootstrap refresh invalidates them while inactive', async () => {
    await warmThenDeactivate();

    // The production bootstrap-complete listener calls these same shell-level
    // mutation functions; exercise that refresh contract while both keys are
    // inactive rather than relying on a later fetch to overwrite stale data.
    harness.latest?.daily.mutate();
    harness.latest?.stat.mutate();
    await flush();

    await act(async () => render({ account: 'account-a', todosEnabled: true, healthBlocksEnabled: true }));
    expect(harness.latest?.daily.todos).toEqual([]);
    expect(harness.latest?.stat.healthBlocks).toEqual([]);
    expect(harness.latest?.daily.todosState.status).toBe('LOADING');
    expect(harness.latest?.stat.healthBlocksState.status).toBe('LOADING');
  });
});
