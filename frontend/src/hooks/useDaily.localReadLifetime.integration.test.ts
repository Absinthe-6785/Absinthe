// @vitest-environment happy-dom
import { act, createElement, StrictMode, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, unstable_serialize, type State, type SWRConfiguration } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { LocalHealthDailyProjection } from '../lib/healthLocalRuntime';
import { setRuntimeAccountSyncAccount } from '../lib/remoteBoundary';

const sdk = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  onError: vi.fn(),
  readDaily: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: sdk }) }));
vi.mock('../lib/config', () => ({ API_URL: 'https://daily.example.invalid' }));
vi.mock('../lib/googleDriveSessionRuntime', () => ({ replaceGoogleDriveRuntimeAccount: vi.fn() }));
vi.mock('../lib/healthLocalRuntime', () => ({ readLocalHealthDaily: sdk.readDaily }));
vi.mock('../components/views/LoginScreen', () => ({ LoginScreen: () => createElement('p', null, 'Signed out') }));
vi.mock('../components/views/NotesReadOnlyCloudView', () => ({ NotesReadOnlyCloudView: () => null }));
vi.mock('../components/AppContent', async () => {
  const { useDailyData } = await import('./useDaily');
  return {
    AppContent: ({ authUser }: { authUser: User }) => {
      const [date, setDate] = useState(X);
      const [ready, setReady] = useState(true);
      const { workouts, inbody, routines, isLoading, mutate } = useDailyData(date, sdk.onError, authUser.id, ready);
      return createElement('section', { 'data-account': authUser.id, 'data-loading': String(isLoading) },
        createElement('output', null, [workouts[0]?.id, routines[0]?.id, inbody.weight || ''].join('/')),
        createElement('button', { 'data-date': X, onClick: () => setDate(X) }),
        createElement('button', { 'data-date': Y, onClick: () => setDate(Y) }),
        createElement('button', { 'data-toggle-ready': true, onClick: () => setReady(value => !value) }),
        createElement('button', { 'data-mutate': true, onClick: mutate }),
      );
    },
  };
});

import App from '../App';

const X = '2026-09-29', Y = '2026-09-30';
const cacheKey = (account: string, date = X) => unstable_serialize(['local-health-daily', account, date]);
const session = (id: string, version: number, user = { id } as User) => ({
  user, access_token: `fixture-${id}-${version}`, refresh_token: `fixture-refresh-${id}-${version}`,
}) as Session;
const snapshot = (id: string, weight: number): LocalHealthDailyProjection => ({
  routines: [{ id: `routine-${id}`, text: id, done: false, is_active: true }],
  workouts: [{ id: `workout-${id}`, block_id: 'exercise', sets: [] }],
  inbody: { weight, smm: 30, pbf: 20 },
});

type Read = {
  account: string;
  date: string;
  resolve: (value: LocalHealthDailyProjection) => void;
  reject: (error: Error) => void;
};

let root: Root;
let host: HTMLDivElement;
let cache: Map<string, State<LocalHealthDailyProjection>>;
let active: Session | null;
let emit: (event: AuthChangeEvent, next: Session | null) => void;
let reads: Read[];

function dispatch(next: Session | null, event: AuthChangeEvent = next ? 'SIGNED_IN' : 'SIGNED_OUT') {
  active = next;
  emit(event, next);
}

const displayed = () => host.querySelector('output')?.textContent;
const loading = () => host.querySelector('section')?.getAttribute('data-loading');
const click = (selector: string) => act(async () => host.querySelector<HTMLButtonElement>(selector)!.click());
const selectDate = (date: string) => click(`[data-date="${date}"]`);
const readKeys = () => reads.map(read => [read.account, read.date]);
const settle = (index: number, id: string, weight: number) =>
  act(async () => reads[index]!.resolve(snapshot(id, weight)));
const wait = (check: () => void) => vi.waitFor(async () => {
  await act(async () => {});
  check();
});

async function mount(initial: Session, strict = false, config: SWRConfiguration = {}) {
  active = initial;
  const tree = createElement(SWRConfig, {
    value: { provider: () => cache, shouldRetryOnError: false, ...config },
  }, createElement(App));
  await act(async () => root.render(strict ? createElement(StrictMode, null, tree) : tree));
  await act(async () => { await vi.dynamicImportSettled(); });
  await wait(() => expect(readKeys()).toEqual([[initial.user.id, X]]));
}

async function mountReadyInStrictMode(config: SWRConfiguration = {}) {
  const { AppContent } = await import('../components/AppContent');
  setRuntimeAccountSyncAccount('a', () => {});
  const render = () => root.render(createElement(StrictMode, null, createElement(SWRConfig,
    { value: { provider: () => cache, shouldRetryOnError: false, ...config } },
    createElement(AppContent, { authUser: session('a', 1).user }),
  )));
  await act(async () => render());
  expect(readKeys()).toEqual([['a', X]]);
  return render;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'true');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected remote I/O in local daily fixture'); }));
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  cache = new Map();
  reads = [];
  sdk.getSession.mockImplementation(async () => ({ data: { session: active } }));
  sdk.onAuthStateChange.mockImplementation(callback => {
    emit = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  sdk.readDaily.mockImplementation((account: string, date: string) =>
    new Promise<LocalHealthDailyProjection>((resolve, reject) => reads.push({ account, date, resolve, reject })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  setRuntimeAccountSyncAccount(null);
  host.remove();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('shared daily Health read lifetime with real App auth and SWR', () => {
  it.each(['reply', 'error'] as const)('does not rejoin an old A request on A→B→A (%s)', async outcome => {
    await mount(session('a', 1));
    await act(async () => dispatch(session('b', 1)));
    expect(host.querySelector('section')?.getAttribute('data-account')).toBe('b');
    expect(displayed()).toBe('//');
    await settle(1, 'b', 72);
    expect(displayed()).toBe('workout-b/routine-b/72');

    await act(async () => dispatch(session('a', 2)));
    expect(readKeys()).toEqual([['a', X], ['b', X], ['a', X]]);
    expect(loading()).toBe('true');
    await act(async () => {
      if (outcome === 'reply') reads[0]!.resolve(snapshot('obsolete-a', 55));
      else reads[0]!.reject(new Error('Obsolete A failure'));
    });
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(displayed()).toBe('//');
    expect(loading()).toBe('true');
    expect(sdk.onError).not.toHaveBeenCalled();

    await settle(2, 'current-a', 80);
    expect(displayed()).toBe('workout-current-a/routine-current-a/80');
    expect(loading()).toBe('false');
  });

  it('discards a date response after departure and starts a new read on X→Y→X', async () => {
    await mount(session('a', 1), true);
    await selectDate(Y);
    expect(readKeys()).toEqual([['a', X], ['a', Y]]);
    await settle(0, 'old-x', 55);
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(displayed()).toBe('//');
    await settle(1, 'y', 72);
    expect(displayed()).toBe('workout-y/routine-y/72');
    await selectDate(X);
    expect(readKeys()).toEqual([['a', X], ['a', Y], ['a', X]]);
    expect(displayed()).toBe('//');
    await settle(2, 'current-x', 80);
    expect(displayed()).toBe('workout-current-x/routine-current-x/80');
    expect(sdk.onError).not.toHaveBeenCalled();
  });

  it('replaces a pending read even if the same-account token changes before React commits', async () => {
    const initial = session('a', 1);
    await mount(initial);
    await act(async () => {
      dispatch(session('a', 2, initial.user), 'TOKEN_REFRESHED');
      reads[0]!.resolve(snapshot('obsolete-token', 55));
      await Promise.resolve();
    });
    expect(readKeys()).toEqual([['a', X], ['a', X]]);
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(loading()).toBe('true');
    await settle(1, 'rotated-session', 80);
    expect(displayed()).toBe('workout-rotated-session/routine-rotated-session/80');
  });

  it('recognizes a batched A→B→A even when React never renders B', async () => {
    const initial = session('a', 1);
    await mount(initial);
    await act(async () => {
      dispatch(session('b', 1));
      dispatch(session('a', 2, initial.user));
    });
    expect(readKeys()).toEqual([['a', X], ['a', X]]);
    await settle(0, 'obsolete-batch', 55);
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    await settle(1, 'batched', 80);
    expect(displayed()).toBe('workout-batched/routine-batched/80');
  });

  it('does not report a queued obsolete failure or lose an interrupted refresh at same-key handoff', async () => {
    const initial = session('a', 1);
    await mount(initial);
    await settle(0, 'before', 70);
    await click('[data-mutate]');
    expect(reads).toHaveLength(2);
    await act(async () => {
      reads[1]!.reject(new Error('Obsolete refresh failure'));
      // The reader has rejected but SWR has not yet handled that rejection.
      await Promise.resolve();
      flushSync(() => dispatch(session('a', 2, initial.user), 'TOKEN_REFRESHED'));
    });
    expect(sdk.onError).not.toHaveBeenCalled();
    expect(displayed()).toBe('workout-before/routine-before/70');
    expect(readKeys()).toEqual([['a', X], ['a', X], ['a', X]]);
    await settle(2, 'after', 80);
    expect(displayed()).toBe('workout-after/routine-after/80');
  });

  it('keeps a result revocable until SWR publishes it, even after a superseded error', async () => {
    const initial = session('a', 1);
    await mount(initial, true);
    await settle(0, 'accepted', 70);
    await click('[data-mutate]');
    await act(async () => {
      reads[1]!.reject(new Error('Superseded refresh'));
      await Promise.resolve();
      host.querySelector<HTMLButtonElement>('[data-mutate]')!.click();
    });
    expect(readKeys()).toEqual([['a', X], ['a', X], ['a', X]]);
    await act(async () => {
      reads[2]!.resolve(snapshot('obsolete-before-cache', 55));
      // Let the fetcher finish but revoke the session before SWR publishes.
      await Promise.resolve();
      dispatch(session('a', 2, initial.user), 'TOKEN_REFRESHED');
    });
    expect(cache.get(cacheKey('a'))?.data).toEqual(snapshot('accepted', 70));
    expect(displayed()).toBe('workout-accepted/routine-accepted/70');
    expect(readKeys()).toEqual([['a', X], ['a', X], ['a', X], ['a', X]]);
    await settle(3, 'current', 80);
    expect(displayed()).toBe('workout-current/routine-current/80');
  });

  it('retires a queued new request before it can erase verified data or skip the replacement read', async () => {
    const initial = session('a', 1);
    await mount(initial, true);
    await settle(0, 'accepted', 70);
    await click('[data-mutate]');
    await act(async () => {
      reads[1]!.reject(new Error('Superseded refresh'));
      await Promise.resolve();
      queueMicrotask(() => flushSync(() => dispatch(session('a', 2, initial.user), 'TOKEN_REFRESHED')));
      host.querySelector<HTMLButtonElement>('[data-mutate]')!.click();
    });
    // The revalidation queued under the old session must not do I/O. The third
    // physical read belongs to the current session and keeps the accepted snapshot.
    expect(cache.get(cacheKey('a'))?.data).toEqual(snapshot('accepted', 70));
    expect(displayed()).toBe('workout-accepted/routine-accepted/70');
    expect(readKeys()).toEqual([['a', X], ['a', X], ['a', X]]);
    await settle(2, 'current', 80);
    expect(displayed()).toBe('workout-current/routine-current/80');
    await act(async () => dispatch(session('a', 3, initial.user), 'TOKEN_REFRESHED'));
    expect(reads).toHaveLength(3);
    expect(displayed()).toBe('workout-current/routine-current/80');
  });

  it('starts one cold local read when an already-active reader and provider mount in StrictMode', async () => {
    await mountReadyInStrictMode();
    expect(loading()).toBe('true');
    await settle(0, 'strict', 71);
    expect(displayed()).toBe('workout-strict/routine-strict/71');
  });

  it('fences a StrictMode cold result when the date changes before SWR publication', async () => {
    await mountReadyInStrictMode();
    await act(async () => {
      reads[0]!.resolve(snapshot('obsolete-first-x', 55));
      await Promise.resolve();
      flushSync(() => host.querySelector<HTMLButtonElement>(`[data-date="${Y}"]`)!.click());
    });
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    await selectDate(X);
    expect(readKeys()).toEqual([['a', X], ['a', Y], ['a', X]]);
    expect(displayed()).toBe('//');
    await settle(2, 'current-x', 80);
    expect(displayed()).toBe('workout-current-x/routine-current-x/80');
  });

  it('retains the current return-date data when the original StrictMode read settles last', async () => {
    await mountReadyInStrictMode();
    await selectDate(Y);
    await selectDate(X);
    expect(readKeys()).toEqual([['a', X], ['a', Y], ['a', X]]);
    await settle(2, 'current-x', 80);
    await settle(0, 'obsolete-first-x', 55);
    expect(cache.get(cacheKey('a'))?.data).toEqual(snapshot('current-x', 80));
    expect(displayed()).toBe('workout-current-x/routine-current-x/80');
  });

  it('admits only the current session and its success notification after provider replay', async () => {
    const onSuccess = vi.fn();
    const render = await mountReadyInStrictMode({ onSuccess });
    await act(async () => {
      reads[0]!.resolve(snapshot('obsolete-session', 55));
      await Promise.resolve();
      flushSync(() => {
        setRuntimeAccountSyncAccount('a', () => {});
        render();
      });
    });
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(readKeys()).toEqual([['a', X], ['a', X]]);
    await settle(1, 'current-session', 80);
    expect(displayed()).toBe('workout-current-session/routine-current-session/80');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0]?.[0]).toEqual(snapshot('current-session', 80));
  });

  it('does not start a queued warm revalidation for a date already left', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
    await mount(session('a', 1), false, { dedupingInterval: 0 });
    await settle(0, 'warm-x', 70);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await click('[data-toggle-ready]');
    await click('[data-toggle-ready]');
    expect(frames).toHaveLength(1);
    expect(displayed()).toBe('workout-warm-x/routine-warm-x/70');
    await selectDate(Y);
    expect(readKeys()).toEqual([['a', X], ['a', Y]]);
    await act(async () => { frames.shift()!(0); });
    expect(readKeys()).toEqual([['a', X], ['a', Y]]);
    expect(cache.get(cacheKey('a'))?.data).toEqual(snapshot('warm-x', 70));
  });

  it('does not publish after sign-out and reuses the exact cache key on a new sign-in', async () => {
    await mount(session('a', 1));
    await act(async () => dispatch(null));
    expect(host.textContent).toContain('Signed out');
    await act(async () => dispatch(session('a', 2)));
    expect(readKeys()).toEqual([['a', X], ['a', X]]);
    await settle(0, 'obsolete', 51);
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(loading()).toBe('true');
    await settle(1, 'signed-in', 80);
    expect(displayed()).toBe('workout-signed-in/routine-signed-in/80');
  });

  it('preserves accepted data in a retained cache after its provider unmounts', async () => {
    await mount(session('a', 1));
    await settle(0, 'accepted', 70);
    await click('[data-mutate]');
    expect(reads).toHaveLength(2);
    await act(async () => root.render(null));
    await settle(1, 'obsolete-unmount', 55);
    expect(cache.get(cacheKey('a'))?.data).toEqual(snapshot('accepted', 70));
  });

  it('keeps accepted warm values but still invalidates and rereads on the existing restore callback', async () => {
    await mount(session('a', 1));
    await settle(0, 'before-restore', 71);
    await selectDate(Y);
    await settle(1, 'other-day', 72);
    await selectDate(X);
    expect(displayed()).toBe('workout-before-restore/routine-before-restore/71');
    expect(loading()).toBe('false');
    const beforeActiveRestore = reads.length;
    await click('[data-mutate]');
    expect(reads).toHaveLength(beforeActiveRestore + 1);
    expect(displayed()).toBe('workout-before-restore/routine-before-restore/71');
    await settle(beforeActiveRestore, 'active-restore', 75);
    expect(displayed()).toBe('workout-active-restore/routine-active-restore/75');

    await click('[data-toggle-ready]');
    const beforeDormantRestore = reads.length;
    await click('[data-mutate]');
    expect(reads).toHaveLength(beforeDormantRestore);
    expect(cache.get(cacheKey('a'))?.data).toBeUndefined();
    expect(cache.get(cacheKey('a', Y))?.data).toEqual(snapshot('other-day', 72));
    await click('[data-toggle-ready]');
    expect(reads).toHaveLength(beforeDormantRestore + 1);
    expect(displayed()).toBe('//');
    expect(loading()).toBe('true');
    await settle(beforeDormantRestore, 'dormant-restore', 79);
    expect(displayed()).toBe('workout-dormant-restore/routine-dormant-restore/79');
  });

  it('retains ordinary error feedback for a currently owned local read', async () => {
    await mount(session('a', 1));
    await act(async () => reads[0]!.reject(new Error('Local reader unavailable')));
    expect(sdk.onError).toHaveBeenCalledExactlyOnceWith('Fetch failed: Local reader unavailable');
    expect(loading()).toBe('false');
  });

  it('keeps configured retries for the current lifetime but drops them after departure', async () => {
    const retries: Array<() => void> = [];
    await mount(session('a', 1), false, {
      shouldRetryOnError: true,
      onErrorRetry: (_error, _key, _config, revalidate, options) => {
        retries.push(() => revalidate({ ...options, dedupe: false }));
      },
    });
    await act(async () => reads[0]!.reject(new Error('First failure')));
    expect(retries).toHaveLength(1);
    await act(async () => retries[0]!());
    expect(readKeys()).toEqual([['a', X], ['a', X]]);

    await act(async () => reads[1]!.reject(new Error('Second failure')));
    expect(retries).toHaveLength(2);
    await selectDate(Y);
    await selectDate(X);
    expect(readKeys()).toEqual([['a', X], ['a', X], ['a', Y], ['a', X]]);
    await act(async () => retries[1]!());
    expect(reads).toHaveLength(4);
    await settle(3, 'fresh', 80);
    expect(displayed()).toBe('workout-fresh/routine-fresh/80');
  });
});
