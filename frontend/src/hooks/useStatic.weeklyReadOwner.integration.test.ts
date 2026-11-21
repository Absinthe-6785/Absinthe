// @vitest-environment happy-dom
import { act, createElement, StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, unstable_serialize, type State } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import type { WeeklySchedule } from '../types';
import { runtimeSessionReadOwner } from '../lib/remoteBoundary';

const sdk = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  onError: vi.fn(),
  initialWeeklyDemand: true,
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: sdk }) }));
vi.mock('../lib/config', () => ({ API_URL: 'https://weekly.example.invalid' }));
vi.mock('../lib/googleDriveSessionRuntime', () => ({ replaceGoogleDriveRuntimeAccount: vi.fn() }));
vi.mock('../components/views/LoginScreen', () => ({ LoginScreen: () => createElement('p', null, 'Signed out') }));
vi.mock('../components/views/NotesReadOnlyCloudView', () => ({ NotesReadOnlyCloudView: () => null }));
vi.mock('../components/AppContent', async () => {
  const { useStaticData } = await import('./useStatic');
  return {
    AppContent: ({ authUser }: { authUser: User }) => {
      const [weeklyNeeded, setWeeklyNeeded] = useState(sdk.initialWeeklyDemand);
      const { weeklySchedules, weeklySchedulesState, mutate } = useStaticData('2026-11-01', '2026-11-30',
        sdk.onError, authUser.id, false, false, false, false, weeklyNeeded);
      return createElement('section', {
        'data-account': authUser.id,
        'data-weekly-state': weeklySchedulesState.status,
        'data-weekly-error': String(weeklySchedulesState.error !== undefined),
        'data-weekly-validating': String(weeklySchedulesState.validating),
      },
        createElement('output', null, weeklySchedules.map(row => row.id).join(',')),
        createElement('button', { onClick: mutate }, 'Refresh static'),
        createElement('button', {
          'data-toggle-weekly-demand': true, onClick: () => setWeeklyNeeded(needed => !needed),
        }, 'Toggle weekly demand'));
    },
  };
});

import App from '../App';

const endpoint = 'https://weekly.example.invalid/api/weekly_schedules';
const key = (account: string) => unstable_serialize(['health-static', account, endpoint]);
const fixture = (id: string): WeeklySchedule[] => [
  { id, day: 1, title: id, start_time: '09:00', end_time: '10:00', color: 'blue' },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((next, fail) => { resolve = next; reject = fail; });
  return { promise, resolve, reject };
}

const session = (id: string, version: number) => ({
  user: { id },
  access_token: `synthetic-${id}-${version}`,
  refresh_token: `synthetic-refresh-${id}-${version}`,
}) as Session;
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
let active: Session | null;
let emit: (event: AuthEvent, current: Session | null) => void;
let host: HTMLDivElement;
let root: Root | undefined;
let cache: Map<string, State<WeeklySchedule[]>>;
let requests: Array<{ signal?: AbortSignal | null; deliver: (response: Response) => void }>;

function dispatch(next: Session | null, event: AuthEvent = next ? 'SIGNED_IN' : 'SIGNED_OUT') {
  active = next;
  emit(event, next);
}

function respond(index: number, rows: WeeklySchedule[]) {
  requests[index]!.deliver(Response.json(rows));
}

const displayed = () => host.querySelector('output')?.textContent ?? '';
const readState = () => host.querySelector('section')?.dataset.weeklyState;
const toggleWeekly = () => host.querySelector<HTMLButtonElement>('[data-toggle-weekly-demand]')!.click();
const wait = (check: () => void) => vi.waitFor(async () => {
  await act(async () => {});
  check();
});
const mount = async (
  initial: Session, strict = false, onErrorRetry?: ReturnType<typeof vi.fn>, revalidateOnReconnect = true,
) => {
  active = initial;
  const tree = createElement(SWRConfig, { value: {
    provider: () => cache, shouldRetryOnError: Boolean(onErrorRetry), ...(onErrorRetry ? { onErrorRetry } : {}),
    revalidateOnReconnect,
  } },
    createElement(App));
  await act(async () => root!.render(strict ? createElement(StrictMode, null, tree) : tree));
  await act(async () => { await vi.dynamicImportSettled(); });
  await wait(() => expect(host.querySelector('section')).not.toBeNull());
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  sdk.initialWeeklyDemand = true;
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  vi.stubGlobal('navigator', { onLine: true });
  active = null;
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  cache = new Map();
  requests = [];
  sdk.getSession.mockReset().mockImplementation(async () => ({ data: { session: active } }));
  sdk.onAuthStateChange.mockImplementation(callback => {
    emit = callback;
    return { data: { subscription: { unsubscribe: sdk.unsubscribe } } };
  });
  vi.stubGlobal('fetch', vi.fn((url: string, options: RequestInit) => {
    expect(url).toBe(endpoint);
    expect(options.method ?? 'GET').toBe('GET');
    expect(new Headers(options.headers).get('Authorization')).toBe(`Bearer ${active?.access_token}`);
    const response = deferred<Response>();
    // Deliberately don't resolve/reject on abort: exercise the publication
    // fence even if the response can't be canceled at the transport.
    requests.push({ signal: options.signal, deliver: response.resolve });
    return response.promise;
  }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  host.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('weekly Schedule session-owned GET in the real App auth and SWR lifetimes', () => {
  it('leaves a cold inactive source unverified and distinguishes loading from verified empty', async () => {
    sdk.initialWeeklyDemand = false;
    await mount(session('a', 1), true);
    expect(readState()).toBe('NOT_READY');
    expect(requests).toHaveLength(0);
    expect(cache.get(key('a'))?.data).toBeUndefined();

    await act(async () => { toggleWeekly(); });
    await wait(() => expect(requests).toHaveLength(1));
    expect(readState()).toBe('LOADING');
    await act(async () => { respond(0, []); });
    expect(readState()).toBe('READY_EMPTY');
    expect(cache.get(key('a'))?.data).toEqual([]);
  });

  it('invalidates warm data and a pending response for an acknowledged inactive change', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, fixture('previous')); });
    await act(async () => { host.querySelector('button')!.click(); });
    await wait(() => expect(requests).toHaveLength(2));

    await act(async () => { toggleWeekly(); });
    expect(readState()).toBe('NOT_READY');
    expect(displayed()).toBe('');
    expect(cache.get(key('a'))?.data).toEqual(fixture('previous'));
    await act(async () => { host.querySelector('button')!.click(); });
    expect(requests).toHaveLength(2);
    expect(cache.get(key('a'))?.data).toBeUndefined();
    await act(async () => { respond(1, fixture('obsolete')); });
    expect(cache.get(key('a'))?.data).toBeUndefined();

    await act(async () => { toggleWeekly(); });
    await wait(() => expect(requests).toHaveLength(3));
    expect(readState()).toBe('LOADING');
    expect(displayed()).toBe('');
    await act(async () => { requests[2]!.deliver(Response.json({ invalid: true })); });
    expect(readState()).toBe('ERROR');
    expect(cache.get(key('a'))?.data).toBeUndefined();
  });

  it('reuses a verified read that completed while inactive, even after SWR dedupe expires', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, fixture('warm')); });
    await act(async () => { host.querySelector('button')!.click(); });
    await wait(() => expect(requests).toHaveLength(2));
    vi.useFakeTimers();
    try {
      await act(async () => { toggleWeekly(); });
      await act(async () => { respond(1, fixture('completed-while-away')); });
      expect(readState()).toBe('NOT_READY');
      expect(cache.get(key('a'))?.data).toEqual(fixture('completed-while-away'));
      await act(async () => { await vi.advanceTimersByTimeAsync(2100); });

      const frames: FrameRequestCallback[] = [];
      const frame = vi.spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => frames.push(callback));
      try {
        await act(async () => { toggleWeekly(); });
        await act(async () => { frames.forEach(callback => callback(0)); });
      } finally {
        // Restore the fake clock's frame function before uninstalling it.
        frame.mockRestore();
      }
      expect(displayed()).toBe('completed-while-away');
      expect(requests).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts the demanded weekly read on reconnect even if the offline app did not rerender', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await mount(session('a', 1));
    expect(readState()).toBe('NOT_READY');
    expect(requests).toHaveLength(0);

    vi.stubGlobal('navigator', { onLine: true });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await wait(() => expect(requests).toHaveLength(1));
    expect(readState()).toBe('LOADING');
    await act(async () => { respond(0, []); });
    expect(readState()).toBe('READY_EMPTY');
  });

  it('defers reconnect reads while inactive and retains verified rows on failed revalidation', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, fixture('last-verified')); });
    await act(async () => { toggleWeekly(); });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(readState()).toBe('NOT_READY');
    expect(requests).toHaveLength(1);
    expect(cache.get(key('a'))?.data).toEqual(fixture('last-verified'));

    await act(async () => { toggleWeekly(); });
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => { requests[1]!.deliver(new Response(null, { status: 500 })); });
    expect(requests).toHaveLength(2);
    expect(readState()).toBe('READY_WITH_RESULTS');
    expect(host.querySelector('section')?.dataset.weeklyError).toBe('true');
    expect(displayed()).toBe('last-verified');
    expect(cache.get(key('a'))?.data).toEqual(fixture('last-verified'));
  });

  it.each(['inactive', 'offline-active'] as const)('preserves a reconnect in %s mode across a close before the scheduled frame', async phase => {
    const a = session('a', 1);
    // Isolate the hook's reconnect/defer path from SWR's provider-wide timer.
    await mount(a, false, undefined, false);
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, fixture('warm')); });
    if (phase === 'inactive') {
      await act(async () => { toggleWeekly(); });
    } else {
      vi.stubGlobal('navigator', { onLine: false });
      await act(async () => dispatch({ ...a, user: { ...a.user } }));
      await act(async () => { host.querySelector('button')!.click(); });
      vi.stubGlobal('navigator', { onLine: true });
    }
    expect(readState()).toBe('NOT_READY');
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    if (phase === 'inactive') await act(async () => { toggleWeekly(); });
    expect(frames).toHaveLength(1);
    expect(requests).toHaveLength(1);
    await act(async () => { toggleWeekly(); });
    expect(readState()).toBe('NOT_READY');
    await act(async () => { frames.shift()!(0); });
    expect(requests).toHaveLength(1);

    await act(async () => { toggleWeekly(); });
    expect(frames).toHaveLength(1);
    await act(async () => { frames.shift()!(0); });
    expect(requests).toHaveLength(2);
    await act(async () => { respond(1, fixture('refreshed')); });
    expect(displayed()).toBe('refreshed');
  });

  it('consumes a cold activation refresh even when it starts before the replacement owner commits', async () => {
    sdk.initialWeeklyDemand = false;
    await mount(session('a', 1));
    expect(requests).toHaveLength(0);
    await act(async () => {
      toggleWeekly();
      dispatch(session('a', 2), 'TOKEN_REFRESHED');
    });
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, []); });
    expect(readState()).toBe('READY_EMPTY');
    expect(host.querySelector('section')?.dataset.weeklyValidating).toBe('false');

    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    await act(async () => { toggleWeekly(); });
    await act(async () => { toggleWeekly(); });
    await act(async () => { frames.forEach(callback => callback(0)); });
    expect(requests).toHaveLength(1);
  });

  it('keeps the current read validating when a retired failure arrives over a warm empty result', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, []); });
    const validating = () => host.querySelector('section')?.dataset.weeklyValidating;
    expect(readState()).toBe('READY_EMPTY');
    expect(validating()).toBe('false');
    await act(async () => { host.querySelector('button')!.click(); });
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    await wait(() => expect(requests).toHaveLength(3));
    expect(validating()).toBe('true');

    await act(async () => { requests[1]!.deliver(new Response(null, { status: 500 })); });
    expect(sdk.onError).not.toHaveBeenCalled();
    expect(validating()).toBe('true');

    await act(async () => { respond(2, []); });
    expect(readState()).toBe('READY_EMPTY');
    expect(validating()).toBe('false');
  });

  it('retains a current refresh error when a retired failure completes afterwards', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { respond(0, []); });
    await act(async () => { host.querySelector('button')!.click(); });
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    await wait(() => expect(requests).toHaveLength(3));
    await act(async () => { requests[2]!.deliver(new Response(null, { status: 500 })); });
    const error = () => host.querySelector('section')?.dataset.weeklyError;
    expect(error()).toBe('true');
    expect(sdk.onError).toHaveBeenCalledOnce();
    await act(async () => { requests[1]!.deliver(new Response(null, { status: 503 })); });
    expect(error()).toBe('true');
    expect(sdk.onError).toHaveBeenCalledOnce();
    expect(cache.get(key('a'))?.data).toEqual([]);
  });

  it('does not dispatch a delayed transport retry after demand disappears', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    vi.useFakeTimers();
    try {
      await act(async () => { requests[0]!.deliver(new Response(null, { status: 503 })); });
      await act(async () => { toggleWeekly(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
      expect(requests).toHaveLength(1);
      expect(readState()).toBe('NOT_READY');
      expect(sdk.onError).not.toHaveBeenCalled();
      await act(async () => { toggleWeekly(); });
      expect(requests).toHaveLength(2);
      await act(async () => { respond(1, fixture('fresh')); });
      expect(displayed()).toBe('fresh');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not resume a retired A read on reactivation after an inactive A→B→A switch', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => { toggleWeekly(); });
    await act(async () => dispatch(session('b', 1)));
    expect(host.querySelector('section')?.dataset.account).toBe('b');
    expect(readState()).toBe('NOT_READY');
    await act(async () => dispatch(session('a', 2)));
    await act(async () => { respond(0, fixture('old-a')); });
    expect(readState()).toBe('NOT_READY');
    expect(cache.get(key('a'))?.data).toBeUndefined();
    expect(cache.get(key('b'))?.data).toBeUndefined();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.signal?.aborted).toBe(true);

    await act(async () => { toggleWeekly(); });
    await wait(() => expect(requests).toHaveLength(2));
    expect(readState()).toBe('LOADING');
    await act(async () => { respond(1, fixture('current-a')); });
    expect(displayed()).toBe('current-a');
  });

  it('retains the same cache key, ordinary duplicate/rotation request count, and explicit revalidation', async () => {
    const a = session('a', 1);
    await mount(a, true);
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm')));
    expect(cache.get(key('a'))?.data).toEqual(fixture('warm'));
    const firstOwner = runtimeSessionReadOwner();
    await act(async () => dispatch(a));
    expect(runtimeSessionReadOwner()).toBe(firstOwner);
    await act(async () => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    expect(firstOwner?.signal.aborted).toBe(true);
    expect(requests).toHaveLength(1);
    expect(displayed()).toBe('warm');

    await act(async () => host.querySelector('button')!.click());
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => respond(1, fixture('refreshed')));
    expect(displayed()).toBe('refreshed');
    expect(cache.get(key('a'))?.data).toEqual(fixture('refreshed'));
  });

  it('replays a static refresh requested during a same-account handoff exactly once', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm')));
    const invalidate = host.querySelector('button')!;
    await act(async () => {
      dispatch(session('a', 2), 'TOKEN_REFRESHED');
      // Existing save/restore invalidation can run before React commits the
      // replacement fetcher. Multiple invalidations need only one fresh GET.
      invalidate.click();
      invalidate.click();
      expect(requests).toHaveLength(1);
      expect(displayed()).toBe('warm');
    });
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => respond(1, fixture('refreshed')));
    expect(displayed()).toBe('refreshed');
    expect(cache.get(key('a'))?.data).toEqual(fixture('refreshed'));
    expect(sdk.onError).not.toHaveBeenCalled();
  });

  it.each(['committed', 'batched'] as const)('discards late A data after an A→B→A %s transition', async transition => {
    const a = session('a', 1);
    await mount(a);
    await wait(() => expect(requests).toHaveLength(1));
    if (transition === 'committed') {
      await act(async () => dispatch(session('b', 1)));
      await wait(() => expect(requests).toHaveLength(2));
      expect(displayed()).toBe('');
      await act(async () => respond(1, fixture('b-only')));
      expect(displayed()).toBe('b-only');
      await act(async () => dispatch(a));
    } else {
      await act(async () => {
        dispatch(session('b', 1));
        dispatch(a);
      });
    }
    const count = transition === 'committed' ? 3 : 2;
    await wait(() => expect(requests).toHaveLength(count));
    expect(host.querySelector('section')?.dataset.account).toBe('a');
    expect(displayed()).toBe('');
    expect(requests[0]?.signal?.aborted).toBe(true);
    await act(async () => respond(count - 1, fixture('a-current')));
    await act(async () => respond(0, fixture('a-revoked')));
    expect(displayed()).toBe('a-current');
    expect(cache.get(key('a'))?.data).toEqual(fixture('a-current'));
    expect(cache.get(key('b'))?.data).toEqual(transition === 'committed' ? fixture('b-only') : undefined);
    expect(sdk.onError).not.toHaveBeenCalled();
  });

  it('ignores a queued warm-key revalidation if its account no longer matches the current fetcher', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm-a')));
    await act(async () => dispatch(session('b', 1)));
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => respond(1, fixture('warm-b')));

    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    await act(async () => dispatch(session('a', 2)));
    expect(frames).toHaveLength(1);
    expect(displayed()).toBe('warm-a');
    await act(async () => dispatch(session('b', 2)));
    expect(frames).toHaveLength(2);
    expect(displayed()).toBe('warm-b');

    await act(async () => { frames[0]!(0); });
    expect(requests).toHaveLength(2);
    expect(cache.get(key('a'))?.data).toEqual(fixture('warm-a'));
    expect(displayed()).toBe('warm-b');
    expect(sdk.onError).not.toHaveBeenCalled();

    await act(async () => { frames[1]!(0); });
    await wait(() => expect(requests).toHaveLength(3));
    await act(async () => respond(2, fixture('current-b')));
    expect(cache.get(key('a'))?.data).toEqual(fixture('warm-a'));
    expect(cache.get(key('b'))?.data).toEqual(fixture('current-b'));
    expect(displayed()).toBe('current-b');
  });

  it('restarts a pending same-key read on rotation and rejects the previous body after decoding', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    const body = deferred<WeeklySchedule[]>();
    const json = vi.fn(() => body.promise);
    await act(async () => requests[0]!.deliver({ ok: true, json } as unknown as Response));
    expect(json).toHaveBeenCalledOnce();
    await act(async () => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => body.resolve(fixture('old-body')));
    expect(displayed()).toBe('');
    expect(cache.get(key('a'))?.data).toBeUndefined();
    await act(async () => respond(1, fixture('new-body')));
    expect(displayed()).toBe('new-body');
  });

  it('invalidates a result between its decode and SWR cache publication', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    const body = deferred<WeeklySchedule[]>();
    const json = vi.fn(() => body.promise);
    await act(async () => requests[0]!.deliver({ ok: true, json } as unknown as Response));
    expect(json).toHaveBeenCalledOnce();
    await act(async () => {
      body.resolve(fixture('not-committed'));
      // The guarded decoder's fulfillment runs first. The auth event still
      // precedes SWR's continuation, so revocation must also fence the cache.
      queueMicrotask(() => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    });
    await wait(() => expect(requests).toHaveLength(2));
    expect(cache.get(key('a'))?.data).toBeUndefined();
    expect(displayed()).toBe('');
    await act(async () => respond(1, fixture('current')));
    expect(displayed()).toBe('current');
  });

  it('revokes an outstanding read even when offline removes its subscription', async () => {
    const a = session('a', 1);
    await mount(a);
    await wait(() => expect(requests).toHaveLength(1));
    vi.stubGlobal('navigator', { onLine: false });
    // Commit an offline render without a token change.
    await act(async () => dispatch({ ...a, user: { ...a.user } }));
    expect(requests).toHaveLength(1);
    const body = deferred<WeeklySchedule[]>();
    await act(async () => requests[0]!.deliver({ ok: true, json: () => body.promise } as unknown as Response));
    await act(async () => {
      body.resolve(fixture('offline-revoked'));
      queueMicrotask(() => dispatch(null));
    });
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(cache.get(key('a'))?.data).toBeUndefined();

    vi.stubGlobal('navigator', { onLine: true });
    await act(async () => dispatch(a));
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => respond(1, fixture('reconnected')));
    expect(displayed()).toBe('reconnected');
  });

  it('invalidates an offline pending read for a static refresh without losing its verified cache', async () => {
    const a = session('a', 1);
    await mount(a);
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm')));
    await act(async () => host.querySelector('button')!.click());
    await wait(() => expect(requests).toHaveLength(2));

    vi.stubGlobal('navigator', { onLine: false });
    await act(async () => dispatch({ ...a, user: { ...a.user } }));
    await act(async () => host.querySelector('button')!.click());
    expect(requests).toHaveLength(2);
    expect(cache.get(key('a'))?.data).toEqual(fixture('warm'));

    vi.stubGlobal('navigator', { onLine: true });
    await act(async () => dispatch({ ...a, user: { ...a.user } }));
    await wait(() => expect(requests).toHaveLength(3));
    await act(async () => respond(1, fixture('before-static-refresh')));
    expect(displayed()).toBe('warm');
    expect(cache.get(key('a'))?.data).toEqual(fixture('warm'));
    await act(async () => respond(2, fixture('after-static-refresh')));
    expect(displayed()).toBe('after-static-refresh');
    expect(sdk.onError).not.toHaveBeenCalled();
  });

  it('ignores a rejected body when the session is replaced before SWR handles the error', async () => {
    const onErrorRetry = vi.fn();
    await mount(session('a', 1), false, onErrorRetry);
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm')));
    await act(async () => host.querySelector('button')!.click());
    await wait(() => expect(requests).toHaveLength(2));
    const body = deferred<WeeklySchedule[]>();
    const json = vi.fn(() => body.promise);
    await act(async () => requests[1]!.deliver({ ok: true, json } as unknown as Response));
    expect(json).toHaveBeenCalledOnce();
    await act(async () => {
      body.reject(new Error('obsolete read failure'));
      queueMicrotask(() => flushSync(() => dispatch(session('a', 2), 'TOKEN_REFRESHED')));
    });
    await wait(() => expect(requests).toHaveLength(3));
    expect(sdk.onError).not.toHaveBeenCalled();
    expect(onErrorRetry).not.toHaveBeenCalled();
    expect(displayed()).toBe('warm');
    await act(async () => respond(2, fixture('current')));
    expect(displayed()).toBe('current');
  });

  it('does not let a late failure after current success restart an idle read on the next rotation', async () => {
    const onErrorRetry = vi.fn();
    await mount(session('a', 1), false, onErrorRetry);
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm')));
    await act(async () => host.querySelector('button')!.click());
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    await wait(() => expect(requests).toHaveLength(3));
    await act(async () => respond(2, fixture('current')));
    await act(async () => requests[1]!.deliver(new Response(null, { status: 500 })));
    expect(requests[1]?.signal?.aborted).toBe(true);
    expect(sdk.onError).not.toHaveBeenCalled();
    expect(onErrorRetry).not.toHaveBeenCalled();
    await act(async () => dispatch(session('a', 3), 'TOKEN_REFRESHED'));
    expect(requests).toHaveLength(3);
    expect(cache.get(key('a'))?.data).toEqual(fixture('current'));
    expect(displayed()).toBe('current');
  });

  it('still replaces a pending current read if an older failure stops SWR loading metadata', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('warm')));
    await act(async () => host.querySelector('button')!.click());
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => dispatch(session('a', 2), 'TOKEN_REFRESHED'));
    await wait(() => expect(requests).toHaveLength(3));
    await act(async () => requests[1]!.deliver(new Response(null, { status: 500 })));
    await act(async () => dispatch(session('a', 3), 'TOKEN_REFRESHED'));
    await wait(() => expect(requests).toHaveLength(4));
    await act(async () => respond(3, fixture('current')));
    await act(async () => respond(2, fixture('revoked')));
    expect(displayed()).toBe('current');
    expect(sdk.onError).not.toHaveBeenCalled();
  });

  it('does not publish a pending response after sign-out', async () => {
    await mount(session('a', 1));
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => dispatch(null));
    expect(requests[0]?.signal?.aborted).toBe(true);
    await act(async () => respond(0, fixture('revoked')));
    expect(host.textContent).toContain('Signed out');
    expect(cache.get(key('a'))?.data).toBeUndefined();
    expect(runtimeSessionReadOwner()).toBeNull();
  });

  it('preserves verified rows on a current 401 without refreshing or signing out another session', async () => {
    const onErrorRetry = vi.fn();
    await mount(session('a', 1), false, onErrorRetry);
    await wait(() => expect(requests).toHaveLength(1));
    await act(async () => respond(0, fixture('verified')));
    await act(async () => host.querySelector('button')!.click());
    await wait(() => expect(requests).toHaveLength(2));
    await act(async () => requests[1]!.deliver(new Response(null, { status: 401 })));
    expect(displayed()).toBe('verified');
    expect(sdk.onError).toHaveBeenCalledWith(expect.stringContaining('[401]'));
    expect(onErrorRetry).not.toHaveBeenCalled();
    expect(sdk.getSession).toHaveBeenCalledOnce(); // App initialization only.
    expect(sdk.refreshSession).not.toHaveBeenCalled();
    expect(sdk.signOut).not.toHaveBeenCalled();
  });
});
