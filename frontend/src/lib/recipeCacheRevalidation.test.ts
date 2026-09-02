// @vitest-environment happy-dom
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import useSWR, { SWRConfig, useSWRConfig, type ScopedMutator } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  fetcher: vi.fn(),
}));

vi.mock('./config', () => ({ API_URL: 'https://api.example.test' }));
vi.mock('./remoteBoundary', () => ({ remoteSWRKey: (url: string) => url }));
vi.mock('./fetcher', () => ({
  fetcher: (url: string) => harness.fetcher(url),
}));

import { accountBoundRemoteFetcher, accountBoundRemoteKey } from './accountBoundRemote';
import {
  revalidateRecipeAccountCacheAfterRestore,
  type RecipeRestoreCacheRefreshResult,
} from './recipeCacheRevalidation';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: string; title: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function MutatorCapture({ onReady }: { onReady: (mutate: ScopedMutator) => void }) {
  const { mutate } = useSWRConfig();
  useEffect(() => onReady(mutate), [mutate, onReady]);
  return null;
}

function RecipeSubscriber({ accountId }: { accountId: string }) {
  const { data } = useSWR<Row[]>(
    accountBoundRemoteKey('https://api.example.test/api/recipes', accountId),
    accountBoundRemoteFetcher,
    { dedupingInterval: 0, revalidateOnFocus: false },
  );
  return createElement('output', {
    'data-recipes': (data ?? []).map(row => `${row.id}:${row.title}`).join('|'),
  });
}

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('Recipe restore cache revalidation', () => {
  let root: Root;
  let host: HTMLDivElement;
  let cache: Map<unknown, unknown>;
  let globalMutate: ScopedMutator | null;

  beforeEach(() => {
    harness.fetcher.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    cache = new Map();
    globalMutate = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  async function renderHarness(subscribe = false): Promise<void> {
    await act(async () => {
      root.render(createElement(SWRConfig, {
        value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false },
      }, createElement('div', null,
        createElement(MutatorCapture, { onReady: mutate => { globalMutate = mutate; } }),
        subscribe ? createElement(RecipeSubscriber, { accountId: 'account-a' }) : null,
      )));
    });
    await flush();
    expect(globalMutate).not.toBeNull();
  }

  it('fetches and populates the exact active account key while Recipe consumers are unmounted', async () => {
    const rows = [{ id: 'restored', title: 'Restored server row' }];
    harness.fetcher.mockResolvedValue(rows);
    await renderHarness(false);

    let result: RecipeRestoreCacheRefreshResult | undefined;
    await act(async () => {
      result = await revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
        accountId: 'account-a',
        isCurrentAccount: () => true,
      });
    });

    const activeKey = accountBoundRemoteKey('https://api.example.test/api/recipes', 'account-a')!;
    const trashKey = accountBoundRemoteKey('https://api.example.test/api/recipes/trash', 'account-a')!;
    const otherKey = accountBoundRemoteKey('https://api.example.test/api/recipes', 'account-b')!;
    expect(result).toBe('refreshed');
    expect(harness.fetcher).toHaveBeenCalledOnce();
    expect(harness.fetcher).toHaveBeenCalledWith('https://api.example.test/api/recipes');
    expect(cache.get(activeKey)).toMatchObject({ data: rows });
    expect(cache.has(trashKey)).toBe(false);
    expect(cache.has(otherKey)).toBe(false);
  });

  it('replaces READY_EMPTY with authoritative server rows without using backup content', async () => {
    const activeKey = accountBoundRemoteKey('https://api.example.test/api/recipes', 'account-a')!;
    cache.set(activeKey, { data: [], error: undefined, _k: activeKey });
    harness.fetcher.mockResolvedValue([{ id: 'remote', title: 'Remote truth' }]);
    await renderHarness(false);

    await revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
      accountId: 'account-a',
      isCurrentAccount: () => true,
    });

    expect(cache.get(activeKey)).toMatchObject({
      data: [{ id: 'remote', title: 'Remote truth' }],
      error: undefined,
    });
  });

  it('refreshes a retained exact cache after the Recipe subscriber unmounts', async () => {
    harness.fetcher
      .mockResolvedValueOnce([{ id: 'old', title: 'Before restore' }])
      .mockResolvedValueOnce([{ id: 'current', title: 'After restore' }]);
    await renderHarness(true);
    await renderHarness(false);

    const result = await revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
      accountId: 'account-a',
      isCurrentAccount: () => true,
    });

    const activeKey = accountBoundRemoteKey('https://api.example.test/api/recipes', 'account-a')!;
    expect(result).toBe('refreshed');
    expect(harness.fetcher).toHaveBeenCalledTimes(2);
    expect(cache.get(activeKey)).toMatchObject({
      data: [{ id: 'current', title: 'After restore' }],
    });
  });

  it.each([
    ['UNAVAILABLE_NO_DATA', undefined],
    ['STALE_WITH_DATA', [{ id: 'stale', title: 'Stale row' }]],
  ])('preserves %s cache evidence when the authoritative GET fails', async (_state, data) => {
    const activeKey = accountBoundRemoteKey('https://api.example.test/api/recipes', 'account-a')!;
    const existingError = new Error('existing fetch failure');
    cache.set(activeKey, { data, error: existingError, _k: activeKey });
    harness.fetcher.mockRejectedValue(new Error('refresh failed'));
    await renderHarness(false);

    const result = await revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
      accountId: 'account-a',
      isCurrentAccount: () => true,
    });

    expect(result).toBe('failed');
    expect(cache.get(activeKey)).toMatchObject({ data, error: existingError });
  });

  it('suppresses a stale account before GET and discards a result that becomes stale during GET', async () => {
    await renderHarness(false);
    const pending = deferred<Row[]>();
    let current = false;

    const beforeResult = await revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
      accountId: 'account-a',
      isCurrentAccount: () => current,
    });
    expect(beforeResult).toBe('stale-account');
    expect(harness.fetcher).not.toHaveBeenCalled();

    current = true;
    harness.fetcher.mockReturnValueOnce(pending.promise);
    const refresh = revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
      accountId: 'account-a',
      isCurrentAccount: () => current,
    });
    expect(harness.fetcher).toHaveBeenCalledOnce();

    current = false;
    pending.resolve([{ id: 'account-b-row', title: 'Must be discarded' }]);
    await expect(refresh).resolves.toBe('stale-account');

    const activeKey = accountBoundRemoteKey('https://api.example.test/api/recipes', 'account-a')!;
    expect((cache.get(activeKey) as { data?: unknown } | undefined)?.data).toBeUndefined();
  });

  it('fences an older in-flight SWR GET so post-restore server truth wins', async () => {
    const oldFetch = deferred<Row[]>();
    const postRestoreFetch = deferred<Row[]>();
    harness.fetcher
      .mockReturnValueOnce(oldFetch.promise)
      .mockReturnValueOnce(postRestoreFetch.promise);
    await renderHarness(true);
    expect(harness.fetcher).toHaveBeenCalledTimes(1);

    const refresh = revalidateRecipeAccountCacheAfterRestore(globalMutate!, {
      accountId: 'account-a',
      isCurrentAccount: () => true,
    });
    expect(harness.fetcher).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldFetch.resolve([{ id: 'old', title: 'Pre-restore row' }]);
      await Promise.resolve();
    });
    await act(async () => {
      postRestoreFetch.resolve([{ id: 'current', title: 'Post-restore truth' }]);
      await refresh;
    });
    await flush();

    expect(host.querySelector('output')?.getAttribute('data-recipes')).toBe(
      'current:Post-restore truth',
    );
  });
});
