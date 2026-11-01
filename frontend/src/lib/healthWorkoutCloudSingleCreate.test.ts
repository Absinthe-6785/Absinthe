import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthWorkoutAdoptionCapture } from './healthLocalRepository';
const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), auth: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), driver: vi.fn(), capture: vi.fn(), close: vi.fn(), fetch: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: m.session, getUser: m.user, onAuthStateChange: m.auth }, from: m.from } }));
vi.mock('./healthLocalRepository', () => ({ createLocalHealthDriver: m.driver }));
import { createWorkoutCloudSingleCreate } from './healthWorkoutCloudSingleCreate';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BLOCK = '22222222-2222-4222-8222-222222222222';
let serial = 0, id: string, local: ReturnType<typeof record>, callbacks: ((event: string, session: unknown) => void)[];
const record = () => ({ id, user_id: A, date: '2026-10-30', block_id: BLOCK, sort_order: 2, sets: [{ type: 'strength', set: 1, kg: '50', reps: 5, assisted_reps: 1, done: true }] });
const block = () => ({ id: BLOCK, user_id: A, name: 'Squat', type: 'strength', tags: ['legs'], cardio_mode: null });
const capture = () => ({ accountId: A, sourceSchemaVersion: 1, importState: { accountId: A, status: 'VERIFIED_IMPORT_COMPLETE', datasetCounts: { workout_logs: 1 } }, workouts: [{ accountId: A, storageKey: `${A}:workout_logs:${id}`, record: structuredClone(local) }], exerciseBlocks: [{ accountId: A, storageKey: `${A}:exercise_blocks:${BLOCK}`, record: block() }] } as unknown as HealthWorkoutAdoptionCapture);
const session = () => ({ data: { session: { user: { id: A }, access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 600 } }, error: null });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const owner = () => createWorkoutCloudSingleCreate(A, record(), () => true);
const posts = () => m.fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
beforeEach(() => {
  vi.resetAllMocks(); callbacks = []; id = `${String(++serial).padStart(8, '0')}-1111-4111-8111-111111111111`; local = record();
  vi.stubGlobal('fetch', m.fetch); vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  m.session.mockImplementation(async () => session()); m.user.mockResolvedValue({ data: { user: { id: A } }, error: null });
  m.auth.mockImplementation(callback => { callbacks.push(callback); return { data: { subscription: { unsubscribe: vi.fn() } } }; });
  m.from.mockReturnValue({ select: m.select }); m.select.mockReturnValue({ eq: m.eq }); m.eq.mockReturnValue({ order: m.order }); m.order.mockReturnValue({ limit: m.limit });
  m.limit.mockResolvedValue({ data: [], count: 0, error: null });
  m.driver.mockResolvedValue({ captureWorkoutAdoptionSource: m.capture, close: m.close });
  m.capture.mockImplementation(async (_account, callback) => { const value = capture(); callback?.(value); return value; });
  m.fetch.mockImplementation(async (url, init) => String(url).includes('exercise_blocks') ? json([block()]) : init.method === 'POST' ? new Response(null, { status: 201 }) : json([record()]));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('one confirmed create-only workout transfer', () => {
  it('inserts one exact original row, then verifies authoritative readback without local writes or the legacy endpoint', async () => {
    const before = structuredClone(local);
    expect(await owner().transfer()).toBe('REMOTE_INSERT_CONFIRMED');
    expect(posts()).toHaveLength(1);
    const [url, init] = posts()[0];
    expect(String(url)).toBe('https://example.supabase.co/rest/v1/workout_logs');
    expect(JSON.parse(init.body)).toEqual(before);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-token', Prefer: 'return=minimal', apikey: 'test-anon-key' });
    expect(local).toEqual(before);
    expect(m.fetch.mock.calls.every(([url, init]) => !String(url).includes('/api/') && ['GET', 'POST'].includes(init.method))).toBe(true);
    expect(m.close).toHaveBeenCalledTimes(2);
  });
  it.each(['matching', 'divergent'])('does not attempt an insert for an existing same-ID %s row', async category => {
    m.limit.mockResolvedValue({ data: [{ ...record(), sort_order: category === 'matching' ? 2 : 9 }], count: 1, error: null });
    expect(await owner().transfer()).toBe('CONFLICT'); expect(posts()).toHaveLength(0);
  });
  it('uses primary-key rejection for a concurrent collision and does not replace or retry', async () => {
    m.fetch.mockImplementation(async (_url, init) => init.method === 'POST' ? json({ code: '23505' }, 409) : json([block()]));
    expect(await owner().transfer()).toBe('CONFLICT'); expect(posts()).toHaveLength(1);
  });
  it.each([[], [{ ...block(), user_id: B }], [{ ...block(), id: id }], [{ ...block(), type: 'cardio' }]])('denies missing/foreign/mismatched block: %s', remote => {
    m.fetch.mockResolvedValue(json(remote));
    return owner().transfer().then(result => { expect(result).toBe('DENIED'); expect(posts()).toHaveLength(0); });
  });
  it('denies a local edit after the displayed intent and before the operation', async () => {
    const transfer = owner(); local.sort_order = 7;
    expect(await transfer.transfer()).toBe('DENIED'); expect(posts()).toHaveLength(0);
  });
  it.each([{ name: 'Bench Press' }, { tags: ['arms'] }, { cardio_mode: 'both' }, { unknown: true }])('denies divergent or unsupported exercise-block content: %s', change => {
    m.fetch.mockResolvedValue(json([{ ...block(), ...change }]));
    return owner().transfer().then(result => { expect(result).toBe('DENIED'); expect(posts()).toHaveLength(0); });
  });
  it('does not confirm an exercise block changed after the INSERT', async () => {
    let inserted = false;
    m.fetch.mockImplementation(async (url, init) => {
      if (init.method === 'POST') { inserted = true; return new Response(null, { status: 201 }); }
      return json(String(url).includes('exercise_blocks') ? [{ ...block(), name: inserted ? 'Bench Press' : 'Squat' }] : [record()]);
    });
    expect(await owner().transfer()).toBe('INDETERMINATE'); expect(posts()).toHaveLength(1);
  });
  it('denies a local edit while remote block verification is pending', async () => {
    m.fetch.mockImplementation(async () => { local.sort_order = 7; return json([block()]); });
    expect(await owner().transfer()).toBe('DENIED'); expect(posts()).toHaveLength(0);
  });
  it('reports indeterminate if the local record changes after dispatch, never rewrites either source', async () => {
    m.fetch.mockImplementation(async (url, init) => {
      if (init.method === 'POST') { local.sort_order = 7; return new Response(null, { status: 201 }); }
      return json(String(url).includes('exercise_blocks') ? [block()] : [record()]);
    });
    expect(await owner().transfer()).toBe('INDETERMINATE'); expect(posts()).toHaveLength(1); expect(local.sort_order).toBe(7);
  });
  it.each(['expired', 'logout', 'foreign', 'server-denied'])('denies %s authority before insertion', async reason => {
    if (reason === 'server-denied') m.user.mockResolvedValue({ data: { user: null }, error: {} });
    else m.session.mockResolvedValue(reason === 'logout' ? { data: { session: null }, error: null } : { ...session(), data: { session: { ...session().data.session, expires_at: reason === 'expired' ? 1 : session().data.session.expires_at, user: { id: reason === 'foreign' ? B : A } } } });
    expect(await owner().transfer()).toBe('DENIED'); expect(posts()).toHaveLength(0);
  });
  it('rejects A/B/A before dispatch even when the account string returns', async () => {
    m.user.mockImplementation(async () => { callbacks.forEach(cb => { cb('SIGNED_IN', { user: { id: B } }); cb('SIGNED_IN', { user: { id: A } }); }); return { data: { user: { id: A } }, error: null }; });
    expect(await owner().transfer()).toBe('DENIED'); expect(posts()).toHaveLength(0);
  });
  it('does not acknowledge a late POST after account invalidation', async () => {
    m.fetch.mockImplementation(async (url, init) => {
      if (init.method === 'POST') { callbacks.forEach(cb => cb('SIGNED_OUT', null)); return new Response(null, { status: 201 }); }
      return json(String(url).includes('exercise_blocks') ? [block()] : [record()]);
    });
    expect(await owner().transfer()).toBe('INDETERMINATE'); expect(posts()).toHaveLength(1);
  });
  it('does not confirm a session that expires during the last asynchronous local capture', async () => {
    let captures = 0;
    const now = Date.now();
    m.capture.mockImplementation(async (_account, callback) => {
      const value = capture(); callback?.(value);
      if (++captures === 3) vi.spyOn(Date, 'now').mockReturnValue(now + 601_000);
      return value;
    });
    expect(await owner().transfer()).toBe('INDETERMINATE'); expect(posts()).toHaveLength(1);
  });
  it('ends asynchronous verification with the source capture, never an auth await that permits a newer save', async () => {
    const events: string[] = [];
    m.session.mockImplementation(async () => { events.push('auth'); return session(); });
    m.capture.mockImplementation(async (_account, callback) => {
      const value = capture(); callback?.(value); events.push('capture'); return value;
    });
    expect(await owner().transfer()).toBe('REMOTE_INSERT_CONFIRMED');
    expect(events.slice(-2)).toEqual(['auth', 'capture']);
  });
  it.each(['offline', 'incomplete', 'invalid'])('denies %s source before any insert', async reason => {
    if (reason === 'offline') vi.stubGlobal('navigator', { onLine: false });
    if (reason === 'incomplete') m.limit.mockResolvedValue({ data: [], count: 1, error: null });
    if (reason === 'invalid') local.sets[0].assisted_reps = 0;
    expect(await owner().transfer()).toBe('DENIED'); expect(posts()).toHaveLength(0);
  });
  it.each(['missing', 'mismatch', 'transport'])('never confirms %s readback', async reason => {
    m.fetch.mockImplementation(async (url, init) => {
      if (String(url).includes('exercise_blocks')) return json([block()]);
      if (init.method === 'POST') return new Response(null, { status: 201 });
      if (reason === 'transport') throw new TypeError('network');
      return json(reason === 'missing' ? [] : [{ ...record(), sort_order: 99 }]);
    });
    expect(await owner().transfer()).toBe('INDETERMINATE'); expect(posts()).toHaveLength(1);
  });
  it('does not retry an ambiguous POST, including through a new owner in the same page', async () => {
    m.fetch.mockImplementation(async (_url, init) => { if (init.method === 'POST') throw new TypeError('network'); return json([block()]); });
    expect(await owner().transfer()).toBe('INDETERMINATE');
    expect(await owner().transfer()).toBe('DENIED'); expect(posts()).toHaveLength(1);
  });
  it('coalesces rapid repeated confirmation and prevents a second owner from starting concurrently', async () => {
    const transfer = owner(); const first = transfer.transfer();
    expect(transfer.transfer()).toBe(first);
    expect(await owner().transfer()).toBe('DENIED');
    expect(await first).toBe('REMOTE_INSERT_CONFIRMED'); expect(posts()).toHaveLength(1);
  });
  it('treats a timed-out POST as indeterminate, not a confirmed failure', async () => {
    vi.useFakeTimers();
    m.fetch.mockImplementation(async (_url, init) => {
      if (init.method !== 'POST') return json([block()]);
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout'))));
    });
    const pending = owner().transfer();
    for (let i = 0; i < 40; i++) await Promise.resolve();
    expect(posts()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toBe('INDETERMINATE'); expect(posts()).toHaveLength(1);
  });
});
