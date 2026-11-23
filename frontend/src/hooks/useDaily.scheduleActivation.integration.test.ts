// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, useSWRConfig, type State } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountBoundCacheKey } from '../lib/accountBoundRemote';
import { revalidatePlannerAccountCache } from '../lib/plannerCacheRevalidation';
import { setRuntimeAccountSyncAccount } from '../lib/remoteBoundary';
import type { Schedule } from '../types';
import { useDailyData } from './useDaily';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));
vi.mock('../lib/config', () => ({ API_URL: 'https://selected-day.example.invalid' }));

const X = '2026-08-26', Y = '2026-08-21';
const url = (date = X) => `https://selected-day.example.invalid/api/schedules?date=${date}`;
const key = (account = 'a', date = X) => accountBoundCacheKey(url(date), account)!;
const row = (id: string): Schedule => ({
  id, text: id, start_time: '09:00', end_time: '10:00', color: 'purple', category: 'Study', is_dday: false,
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
type Read = {
  url: string;
  authorization: string | null;
  signal: AbortSignal | null | undefined;
  resolve: (response: Response) => void;
};
let root: Root;
let host: HTMLElement;
let cache: Map<string, State<Schedule[]>>;
let reads: Read[];
let result: ReturnType<typeof useDailyData>;
let restore: () => void;
let online: boolean;
let pauseAutomatic: boolean;
let strictLifecycle: boolean;
const reportError = vi.fn();

function Probe({ account, date, active }: { account: string; date: string; active?: boolean }) {
  result = useDailyData(date, reportError, account, false, false, false, false, active);
  const { mutate } = useSWRConfig();
  restore = () => revalidatePlannerAccountCache(mutate, account);
  return null;
}

function bind(account: string, revision = 1, confirmedRenewal = false) {
  const token = `fixture-${account}-${revision}`;
  setRuntimeAccountSyncAccount(account, headers => headers.set('Authorization', `Bearer ${token}`), confirmedRenewal);
  auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
}

const draw = (active?: boolean, account = 'a', date = X) => {
  const probe = createElement(SWRConfig, {
    value: { provider: () => cache, shouldRetryOnError: false, loadingTimeout: 0, dedupingInterval: 0,
      isPaused: () => pauseAutomatic },
  }, createElement(Probe, { account, date, active }));
  root.render(strictLifecycle ? createElement(StrictMode, null, probe) : probe);
};
const render = (active?: boolean, account = 'a', date = X) => act(async () => draw(active, account, date));
const reply = (i: number, rows: unknown, status = 200) => act(async () => reads[i]!.resolve(json(rows, status)));
const ids = () => result.schedules.map(schedule => schedule.id);
const manualRead = () => result.revalidateSelectedDaySchedules('a', X, () => true)
  .then(() => null, error => error);
const reconnect = async (count: number) => {
  await act(async () => window.dispatchEvent(new Event('online')));
  await act(async () => vi.waitFor(() => expect(reads).toHaveLength(count)));
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  online = true;
  pauseAutomatic = false;
  strictLifecycle = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  bind('a');
  cache = new Map();
  reads = [];
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  vi.stubGlobal('fetch', vi.fn((input: string, init?: RequestInit) => {
    expect(init?.method ?? 'GET').toBe('GET');
    expect(new URL(input).pathname).toBe('/api/schedules');
    return new Promise<Response>(resolve => reads.push({
      url: input, authorization: new Headers(init?.headers).get('Authorization'), signal: init?.signal, resolve,
    }));
  }));
});

afterEach(async () => {
  await act(async () => root.unmount());
  setRuntimeAccountSyncAccount(null);
  await act(async () => { reads.forEach(read => read.resolve(json([]))); });
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('shared selected-day Schedule activation through useDailyData and SWR', () => {
  it('fetches once under StrictMode, reports inactive as unknown, and resumes the same verified cache quietly', async () => {
    await render(false);
    expect(reads).toHaveLength(0);
    expect(result.schedulesState).toEqual({ status: 'NOT_READY', validating: false });
    await render(true);
    expect(reads.map(read => [read.url, read.authorization])).toEqual([[url(), 'Bearer fixture-a-1']]);
    expect(result.isScheduleLoading).toBe(true);
    await reply(0, [row('today')]);
    await render(false);
    expect(ids()).toEqual([]);
    expect(result.schedulesState.status).toBe('NOT_READY');
    await render(true);
    expect(reads).toHaveLength(1);
    expect(ids()).toEqual(['today']);
    expect(result.schedulesState).toEqual({ status: 'READY_WITH_RESULTS', validating: false });
    expect(cache.get(key())?.data).toEqual([row('today')]);
  });

  it('keeps the legacy caller subscribed without an activation argument or scoped session owner', async () => {
    setRuntimeAccountSyncAccount(null);
    setRuntimeAccountSyncAccount('a');
    await render();
    expect(reads.map(read => read.url)).toEqual([url()]);
    await reply(0, [row('legacy')]);
    expect(ids()).toEqual(['legacy']);
    await act(async () => result.mutate());
    expect(reads.map(read => read.url)).toEqual([url(), url()]);
  });

  it.each(['committed', 'batched'] as const)('fences late read and refresh callbacks across %s A→B→A', async transition => {
    await render(true);
    const staleRefresh = result.mutate;
    const staleManual = result.revalidateSelectedDaySchedules;
    if (transition === 'committed') {
      await act(async () => { bind('b'); draw(true, 'b'); });
      expect(ids()).toEqual([]);
      await reply(1, [row('account-b')]);
      expect(ids()).toEqual(['account-b']);
    }
    await act(async () => {
      if (transition === 'batched') bind('b');
      bind('a', 2);
      draw(true);
    });
    const fresh = transition === 'committed' ? 2 : 1;
    expect(ids()).toEqual([]);
    expect(reads[0]!.signal?.aborted).toBe(true);
    expect(reads[fresh]!.authorization).toBe('Bearer fixture-a-2');
    await reply(0, [row('obsolete-a')]);
    expect(cache.get(key())?.data).toBeUndefined();
    await act(async () => staleRefresh());
    await expect(staleManual('a', X, () => true)).rejects.toThrow('no longer available');
    expect(reads).toHaveLength(fresh + 1);
    await reply(fresh, [row('current-a')]);
    expect(ids()).toEqual(['current-a']);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('does not admit stale date responses across X→Y→X, including a separately requested manual refresh', async () => {
    await render(true);
    const manual = result.revalidateSelectedDaySchedules('a', X, () => true).catch(error => error);
    await render(true, 'a', Y);
    await render(true);
    expect(reads.map(read => read.url)).toEqual([url(), url(), url(Y), url()]);
    await reply(2, [row('obsolete-y')]);
    await reply(0, [row('obsolete-x')]);
    await reply(1, [row('obsolete-manual')]);
    expect(await manual).toBeInstanceOf(Error);
    expect(cache.get(key('a', Y))?.data).toBeUndefined();
    expect(ids()).toEqual([]);
    expect(result.schedulesState.status).toBe('LOADING');
    await reply(3, [row('current-x')]);
    expect(ids()).toEqual(['current-x']);
  });

  it('invalidates the origin date after a same-session mutation finishes in an inactive workspace', async () => {
    await render(true);
    await reply(0, [row('before-mutation')]);
    const afterMutation = result.onScheduleMutationCommitted!;
    await render(false, 'a', Y);
    await act(async () => afterMutation([X]));
    expect(reads).toHaveLength(1);
    expect(cache.get(key())?.data).toBeUndefined();
    await render(true);
    expect(ids()).toEqual([]);
    expect(result.schedulesState.status).toBe('LOADING');
    await reply(1, [row('after-mutation')]);
    expect(ids()).toEqual(['after-mutation']);
  });

  it('clears same-account inactive date caches on restore without a GET or affecting another account', async () => {
    await render(true);
    await reply(0, [row('before-restore-x')]);
    await render(true, 'a', Y);
    await reply(1, [row('before-restore-y')]);
    await act(async () => { bind('b'); draw(true, 'b'); });
    await reply(2, [row('account-b')]);
    await act(async () => { bind('a', 2); draw(false); });
    await act(async () => restore());
    expect(reads).toHaveLength(3);
    expect(cache.get(key())?.data).toBeUndefined();
    expect(cache.get(key('a', Y))?.data).toBeUndefined();
    expect(cache.get(key('b'))?.data).toEqual([row('account-b')]);
    await render(true);
    expect(ids()).toEqual([]);
    expect(result.schedulesState.status).toBe('LOADING');
    await reply(3, [row('restored-x')]);
    expect(ids()).toEqual(['restored-x']);
  });

  it('keeps verified rows on failed or incomplete refresh and never treats an unverified response as empty', async () => {
    await render(true);
    await reply(0, { rows: [], complete: false });
    expect(result.schedulesState).toMatchObject({ status: 'ERROR', validating: false });
    await act(async () => result.mutate());
    await reply(1, [row('verified')]);
    await act(async () => result.mutate());
    await reply(2, null, 500);
    expect(ids()).toEqual(['verified']);
    expect(result.schedulesState).toMatchObject({ status: 'READY_WITH_RESULTS', validating: false, error: expect.any(Error) });
    await render(false);
    await render(true);
    expect(ids()).toEqual(['verified']);
    expect(result.schedulesState.validating).toBe(true);
    await reply(3, []);
    expect(result.schedulesState).toEqual({ status: 'READY_EMPTY', validating: false });
  });

  it('does not read offline or on reconnect without demand, and revalidates when demand returns', async () => {
    online = false;
    await render(true);
    expect(reads).toHaveLength(0);
    expect(result.schedulesState.status).toBe('NOT_READY');
    await expect(result.revalidateSelectedDaySchedules('a', X, () => true)).rejects.toThrow('no longer available');
    online = true;
    await act(async () => window.dispatchEvent(new Event('online')));
    await reply(0, [row('before-reconnect')]);
    await render(false);
    online = false;
    await act(async () => window.dispatchEvent(new Event('offline')));
    online = true;
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(reads).toHaveLength(1);
    await render(true);
    expect(reads).toHaveLength(2);
    await reply(1, [row('after-reconnect')]);
    expect(ids()).toEqual(['after-reconnect']);
  });

  it('uses an explicit authoritative read, retaining failure data and rejecting a pre-invalidation reply', async () => {
    await render(true);
    await reply(0, [row('verified')]);
    const manual = () => result.revalidateSelectedDaySchedules('a', X, () => true).then(() => null, error => error);
    const failed = manual();
    await reply(1, { rows: [], complete: false });
    expect(await failed).toBeInstanceOf(Error);
    expect(ids()).toEqual(['verified']);
    const interrupted = manual();
    await act(async () => restore());
    await reply(3, [row('after-restore')]);
    await reply(2, [row('pre-restore')]);
    expect(await interrupted).toBeInstanceOf(Error);
    expect(ids()).toEqual(['after-restore']);
    const success = manual();
    await reply(4, [row('manual')]);
    expect(await success).toBeNull();
    expect(ids()).toEqual(['manual']);
    expect(reads.every(read => read.url === url())).toBe(true);
  });

  it('does not show old verified A rows after A→B→A, even when the new result is identical', async () => {
    await render(true);
    await reply(0, [row('a-verified')]);
    await act(async () => { bind('b'); draw(true, 'b'); });
    await reply(1, [row('b-verified')]);
    await act(async () => { bind('a', 2); draw(true); });
    expect(ids()).toEqual([]);
    expect(result.schedulesState.status).toBe('LOADING');
    await reply(2, [row('a-verified')]);
    expect(ids()).toEqual(['a-verified']);
  });

  it('keeps deleted rows hidden when demand closes during post-mutation revalidation', async () => {
    await render(true);
    await reply(0, [row('deleted')]);
    await act(async () => result.onScheduleMutationCommitted!([X]));
    await render(false);
    await render(true);
    expect(ids()).toEqual([]);
    expect(result.schedulesState.status).toBe('LOADING');
    await reply(1, [row('obsolete')]);
    expect(ids()).toEqual([]);
    await reply(2, []);
    expect(result.schedulesState.status).toBe('READY_EMPTY');
  });

  it('keeps successful manual authority over a later reconnect GET', async () => {
    await render(true);
    await reply(0, [row('verified')]);
    const manual = manualRead();
    await reconnect(3);
    await reply(1, []);
    expect(await manual).toBeNull();
    await reply(2, [row('reconnect')]);
    expect(result.schedulesState).toEqual({ status: 'READY_EMPTY', validating: false });
  });

  it('clears retired validation on a warm empty reopen even when an older GET was pending', async () => {
    await render(true);
    const manual = manualRead();
    await reply(1, []);
    expect(await manual).toBeNull();
    await render(false);
    await render(true);
    await reply(0, [row('old')]);
    expect(reads).toHaveLength(2);
    expect(result.schedulesState).toEqual({ status: 'READY_EMPTY', validating: false });
  });

  it('reports a failed cold manual read when no automatic GET produced a snapshot', async () => {
    pauseAutomatic = true;
    await render(true);
    expect(reads).toHaveLength(0);
    const manual = manualRead();
    await reply(0, null, 500);
    expect(await manual).toBeInstanceOf(Error);
    expect(ids()).toEqual([]);
    expect(result.schedulesState).toMatchObject({ status: 'ERROR', validating: false });
  });

  it('keeps a concurrent successful automatic snapshot when a cold manual GET fails in production ordering', async () => {
    strictLifecycle = false;
    await render(true);
    const manual = manualRead();
    await reply(0, [row('automatic-verified')]);
    await reply(1, null, 500);
    expect(await manual).toBeInstanceOf(Error);
    expect(ids()).toEqual(['automatic-verified']);
    expect(result.schedulesState).toEqual({ status: 'READY_WITH_RESULTS', validating: false });
  });

  it.each(['automatic', 'manual'] as const)('retries %s 401 only once after owner-confirmed renewal', async mode => {
    await render(true);
    let manual: ReturnType<typeof manualRead> | undefined;
    if (mode === 'manual') {
      await reply(0, [row('previous')]);
      manual = manualRead();
    }
    const first = reads.length - 1;
    await reply(first, null, 401);
    expect(reads).toHaveLength(first + 1);
    await act(async () => { bind('a', 2, true); draw(true); });
    expect(reads).toHaveLength(first + 2);
    expect(reads[first + 1]).toMatchObject({ url: url(), authorization: 'Bearer fixture-a-2' });
    if (mode === 'manual') {
      await reply(first + 1, [row('renewed')]);
      expect(await manual).toBeNull();
      expect(ids()).toEqual(['renewed']);
    } else {
      await reply(first + 1, null, 401);
      await act(async () => { bind('a', 3, true); draw(true); });
      expect(result.schedulesState.status).toBe('ERROR');
      expect(reads).toHaveLength(first + 2);
    }
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it.each(['account', 'date', 'closed'] as const)('does not retry an abandoned 401 after %s changes', async transition => {
    await render(true);
    await reply(0, null, 401);
    if (transition === 'account') await act(async () => {
      bind('b'); bind('a', 2); draw(false);
    });
    if (transition === 'date') await render(false, 'a', Y);
    if (transition === 'closed') await render(false);
    await act(async () => { bind('a', 3, true); });
    expect(reads).toHaveLength(1);
    expect(result.schedulesState.status).toBe('NOT_READY');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('fails closed within the renewal window when the owner confirms nothing', async () => {
    await render(true);
    await reply(0, [row('verified')]);
    const manual = manualRead();
    await reply(1, null, 401);
    await act(async () => {
      expect(await manual).toMatchObject({ name: 'SessionReadUnauthorizedError' });
    });
    expect(reads).toHaveLength(2);
    expect(ids()).toEqual(['verified']);
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
