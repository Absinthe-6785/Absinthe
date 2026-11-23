// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, useSWRConfig, type State, type SWRConfiguration } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountBoundCacheKey } from '../lib/accountBoundRemote';
import { revalidatePlannerAccountCache } from '../lib/plannerCacheRevalidation';
import { setRuntimeAccountSyncAccount } from '../lib/remoteBoundary';
import type { Routine } from '../types';
import { useDailyData } from './useDaily';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
vi.mock('../lib/config', () => ({ API_URL: 'https://daily.example.invalid' }));
vi.mock('../lib/syncAuthority', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/syncAuthority')>(),
  domainUsesLocalWorkingCopy: () => false, // Exercise the legacy remote Routine fallback.
}));

const X = '2026-09-29', Y = '2026-09-30';
const url = (date: string) => `https://daily.example.invalid/api/routines_with_logs?date=${date}`;
const routine = (id: string, done = false): Routine => ({ id, text: id, done, is_active: true });
const cacheKey = (account: string, date = X) => accountBoundCacheKey(url(date), account)!;
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

type Read = {
  url: string;
  owner: string | null;
  signal: AbortSignal | null | undefined;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};
let root: Root;
let host: HTMLDivElement;
let cache: Map<string, State<Routine[]>>;
let requests: Read[];
let result: ReturnType<typeof useDailyData>;
let restore: () => void;
let online: boolean;
let onErrorRetry: SWRConfiguration['onErrorRetry'];
const showError = vi.fn();

function Probe({ account, date, enabled }: { account: string; date: string; enabled?: boolean }) {
  result = useDailyData(date, showError, account, false, false, false, enabled);
  const { mutate } = useSWRConfig();
  restore = () => revalidatePlannerAccountCache(mutate, account);
  return null;
}

function bind(account: string, version = 1) {
  const fixture = `Bearer fixture-${account}-${version}`;
  setRuntimeAccountSyncAccount(account, headers => headers.set('Authorization', fixture));
  auth.getSession.mockResolvedValue({ data: { session: { access_token: fixture.slice(7) } } });
}

const renderTree = (account: string, date: string, enabled?: boolean) =>
  root.render(createElement(StrictMode, null, createElement(SWRConfig, {
    value: { provider: () => cache, shouldRetryOnError: Boolean(onErrorRetry), loadingTimeout: 0,
      ...(onErrorRetry ? { onErrorRetry } : {}) },
  }, createElement(Probe, { account, date, enabled }))));
const render = (account: string, date: string, enabled?: boolean) =>
  act(async () => renderTree(account, date, enabled));
const resolve = (index: number, rows: Routine[]) => act(async () => requests[index]!.resolve(json(rows)));
const ids = () => result.routines.map(row => row.id);
const requestsFor = () => requests.map(r => [r.url, r.owner]);

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  online = true;
  onErrorRetry = undefined;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  bind('a');
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  cache = new Map();
  requests = [];
  vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => {
    expect(init?.method ?? 'GET').toBe('GET');
    if (!new URL(input).pathname.endsWith('/routines_with_logs')) return Promise.resolve(json([]));
    return new Promise<Response>((resolve, reject) => requests.push({
      url: input, owner: new Headers(init?.headers).get('Authorization'), signal: init?.signal, resolve, reject,
    }));
  }));
});

afterEach(async () => {
  await act(async () => root.unmount());
  setRuntimeAccountSyncAccount(null);
  await act(async () => { requests.forEach(r => r.resolve(json([]))); });
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('daily Routine activation through useDailyData and the real SWR/session read boundary', () => {
  it('stays inactive, activates once in StrictMode, and preserves warm data on a failed reactivation', async () => {
    await render('a', X, false);
    expect(requests).toHaveLength(0);
    expect(result.routinesState).toEqual({ status: 'NOT_READY', validating: false });

    await render('a', X, true);
    expect(requestsFor()).toEqual([[url(X), 'Bearer fixture-a-1']]);
    expect(result.routinesState.status).toBe('LOADING');
    await resolve(0, [routine('a-x')]);
    expect(ids()).toEqual(['a-x']);
    expect(result.routinesState.status).toBe('READY_WITH_RESULTS');

    await render('a', X, false);
    expect(ids()).toEqual([]);
    expect(result.routinesState.status).toBe('NOT_READY');
    expect(requests).toHaveLength(1);
    await render('a', X, true);
    expect(requests).toHaveLength(2);
    expect(ids()).toEqual(['a-x']);
    expect(result.routinesState.validating).toBe(true);
    const failure = new Error('fixture read failed');
    await act(async () => requests[1]!.reject(failure));
    expect(ids()).toEqual(['a-x']);
    expect(result.routinesState).toEqual({ status: 'READY_WITH_RESULTS', validating: false, error: failure });

    await act(async () => result.mutate());
    await resolve(2, []);
    expect(result.routinesState.status).toBe('READY_EMPTY');
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it.each(['committed', 'batched'] as const)('rejects A1 and stale mutation callbacks after %s A→B→A', async transition => {
    await render('a', X, true);
    const staleMutation = result.mutateRoutines;
    const signal = requests[0]!.signal;
    expect(signal?.aborted).toBe(false);
    if (transition === 'committed') {
      await act(async () => { bind('b'); renderTree('b', X, true); });
      expect(ids()).toEqual([]);
      await resolve(1, [routine('b-x')]);
      expect(ids()).toEqual(['b-x']);
    }
    await act(async () => {
      if (transition === 'batched') bind('b');
      bind('a', 2);
      renderTree('a', X, true);
    });
    const a2 = transition === 'committed' ? 2 : 1;
    expect(signal?.aborted).toBe(true);
    expect(requestsFor().slice(a2)).toEqual([[url(X), 'Bearer fixture-a-2']]);
    expect(ids()).toEqual([]);
    await resolve(0, [routine('obsolete-a')]);
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(ids()).toEqual([]);
    await resolve(a2, [routine('current-a')]);
    await act(async () => staleMutation(() => [routine('stale-mutation')]));
    expect(ids()).toEqual(['current-a']);
    expect(requests).toHaveLength(a2 + 1);
    expect(showError).not.toHaveBeenCalled();
  });

  it('does not publish a late date read, stale failure, or stale callback on X→Y→X', async () => {
    await render('a', X, true);
    const staleMutation = result.mutateRoutines;
    await render('a', Y, true);
    await render('a', X, true);
    expect(requestsFor()).toEqual([
      [url(X), 'Bearer fixture-a-1'], [url(Y), 'Bearer fixture-a-1'], [url(X), 'Bearer fixture-a-1'],
    ]);
    await act(async () => requests[0]!.reject(new Error('obsolete date error')));
    await resolve(1, [routine('obsolete-y')]);
    expect(result.routinesState.status).toBe('LOADING');
    expect(cache.get(cacheKey('a', Y))?.data).toBeUndefined();
    await resolve(2, [routine('current-x')]);
    await act(async () => staleMutation(() => [routine('stale-x')]));
    expect(ids()).toEqual(['current-x']);
    expect(requests).toHaveLength(3);
    expect(showError).not.toHaveBeenCalled();
  });

  it('uses the same cache key for active optimistic mutation and inactive refresh', async () => {
    await render('a', X, true);
    await resolve(0, [routine('base')]);
    await act(async () => result.mutate());
    await act(async () => result.mutateRoutines(rows => rows.map(row => ({ ...row, done: true })), false));
    expect(result.routines).toEqual([routine('base', true)]);
    await resolve(1, [routine('old-before-mutation')]);
    expect(result.routines).toEqual([routine('base', true)]);

    const update = result.mutateRoutines;
    await render('a', X, false);
    await act(async () => update(rows => [...rows, routine('inactive-update')]));
    expect(cache.get(cacheKey('a'))?.data?.map(row => row.id)).toEqual(['base', 'inactive-update']);
    expect(requests).toHaveLength(2);
    await act(async () => result.mutate());
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(requests).toHaveLength(2);
    await render('a', X, true);
    expect(ids()).toEqual([]);
    await resolve(2, [routine('after-refresh')]);
    expect(ids()).toEqual(['after-refresh']);
  });

  it('invalidates all inactive Routine dates for the restored account without a GET or touching B', async () => {
    await render('a', X, true);
    await resolve(0, [routine('old-x')]);
    await render('a', Y, true);
    await resolve(1, [routine('old-y')]);
    await act(async () => { bind('b'); renderTree('b', X, true); });
    await resolve(2, [routine('b-x')]);
    await act(async () => { bind('a', 2); renderTree('a', Y, false); });
    await act(async () => restore());
    expect(requests).toHaveLength(3);
    expect(cache.get(cacheKey('a', X))?.data).toBeUndefined();
    expect(cache.get(cacheKey('a', Y))?.data).toBeUndefined();
    expect(cache.get(cacheKey('b', X))?.data).toEqual([routine('b-x')]);
    await render('a', X, true);
    expect(ids()).toEqual([]);
    expect(result.routinesState.status).toBe('LOADING');
    await resolve(3, [routine('restored-x')]);
    expect(ids()).toEqual(['restored-x']);
  });

  it('does not seed a never-subscribed date with an unverified optimistic snapshot', async () => {
    await render('a', X, false);
    const update = vi.fn(() => [routine('unverified')]);
    await act(async () => result.mutateRoutines(update, false));
    expect(update).not.toHaveBeenCalled();
    expect(cache.get(cacheKey('a', X))).toBeUndefined();
    await render('a', Y, false);
    await act(async () => restore());
    expect(requests).toHaveLength(0);
    await render('a', X, true);
    expect(ids()).toEqual([]);
    expect(result.routinesState.status).toBe('LOADING');
    await resolve(0, [routine('authoritative')]);
    expect(ids()).toEqual(['authoritative']);
  });

  it('does not fetch offline; an active consumer can start on reconnect', async () => {
    online = false;
    await render('a', Y, true);
    expect(requests).toHaveLength(0);
    expect(result.routinesState.status).toBe('NOT_READY');
    online = true;
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(requestsFor()).toEqual([[url(Y), 'Bearer fixture-a-1']]);
    await act(async () => requests[0]!.resolve(json({ invalid: true })));
    expect(result.routinesState.status).toBe('ERROR');
    expect(ids()).toEqual([]);
  });

  it('allows a current retry but drops a queued retry after leaving the consumer', async () => {
    const retries: Array<() => void> = [];
    onErrorRetry = (_error, key, _config, retry, options) => {
      if (key.includes('/routines_with_logs?')) retries.push(() => retry(options));
    };
    await render('a', X, true);
    await act(async () => requests[0]!.reject(new Error('first failure')));
    expect(result.routinesState.status).toBe('ERROR');
    await act(async () => retries[0]!());
    expect(requests).toHaveLength(2);
    await act(async () => requests[1]!.reject(new Error('second failure')));
    expect(retries).toHaveLength(2);
    await render('a', X, false);
    await render('a', X, true);
    await resolve(2, [routine('current')]);
    await act(async () => retries[1]!());
    expect(requests).toHaveLength(3);
    expect(ids()).toEqual(['current']);
  });

  it('keeps omitted-activation legacy callers eager with the original auth/optimistic path', async () => {
    await render('a', X);
    expect(requestsFor()).toEqual([[url(X), 'Bearer fixture-a-1']]);
    expect(requests[0]!.signal).toBeUndefined();
    await resolve(0, [routine('legacy')]);
    await act(async () => result.mutateRoutines(rows => rows.map(row => ({ ...row, done: true })), false));
    expect(result.routines).toEqual([routine('legacy', true)]);
    expect(requests).toHaveLength(1);
  });
});
