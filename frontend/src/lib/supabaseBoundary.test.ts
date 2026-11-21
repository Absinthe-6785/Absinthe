import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runtimeSessionReadOwner, SessionReadOwnerChangedError, setRuntimeAccountSyncAccount } from './remoteBoundary';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './syncMode';

const getSessionMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
  }),
}));

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

beforeEach(() => {
  storage.clear();
  getSessionMock.mockReset();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  setRuntimeAccountSyncAccount('account-a', null);
});

describe('exact-session GET admission', () => {
  const weeklyUrl = '/api/weekly_schedules';
  const admit = (token = 'fixture-token') => {
    setRuntimeAccountSyncAccount('account-a', headers => { headers.set('Authorization', `Bearer ${token}`); });
    return runtimeSessionReadOwner()!;
  };

  it('uses only the credential issued by the exact app owner, without asking the SDK for a session', async () => {
    const readOwner = admit();
    const fetch = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetch);
    const { authFetch } = await import('./supabase');
    await expect(authFetch(weeklyUrl, { headers: { Authorization: 'Bearer not-the-owner' } }, { readOwner }))
      .resolves.toBeInstanceOf(Response);
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe(weeklyUrl);
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(request.method).toBe('GET');
    expect(request.signal).toBe(readOwner.signal);
    expect(new Headers(request.headers).get('Authorization')).toBe('Bearer fixture-token');
  });

  it.each(['fabricated', 'revoked', 'replaced during admission'] as const)('rejects a %s owner before the weekly GET', async mode => {
    const readOwner = admit();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { authFetch } = await import('./supabase');
    const replaceOwner = () => {
      setRuntimeAccountSyncAccount(null);
      admit('replacement-token');
    };
    if (mode === 'revoked') replaceOwner();
    await expect(authFetch(weeklyUrl, {}, {
      readOwner: mode === 'fabricated' ? { ...readOwner } : readOwner,
      ...(mode === 'replaced during admission' ? { onRequestStart: replaceOwner } : {}),
    })).rejects.toBeInstanceOf(SessionReadOwnerChangedError);
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves the offline gate and accepts no write method with a scoped owner', async () => {
    const readOwner = admit();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { authFetch } = await import('./supabase');
    await expect(authFetch(weeklyUrl, { method: 'POST' }, { readOwner })).rejects.toThrow('requires GET');
    vi.stubGlobal('navigator', { onLine: false });
    await expect(authFetch(weeklyUrl, {}, { readOwner })).rejects.toThrow();
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps a transient retry scoped to its owner (revoked: %s)', async revoked => {
    vi.useFakeTimers();
    try {
      const readOwner = admit();
      const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(Response.json([{ id: 'read-result' }]));
      vi.stubGlobal('fetch', fetch);
      const { fetcher } = await import('./fetcher');
      const request = fetcher(weeklyUrl, readOwner);
      const result = revoked
        ? expect(request).rejects.toBeInstanceOf(SessionReadOwnerChangedError)
        : expect(request).resolves.toEqual([{ id: 'read-result' }]);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledOnce();
      if (revoked) {
        setRuntimeAccountSyncAccount(null);
        admit();
      }
      await vi.advanceTimersByTimeAsync(600);
      await result;
      expect(fetch).toHaveBeenCalledTimes(revoked ? 1 : 2);
      expect(getSessionMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('supabase authFetch domain boundary', () => {
  it.each([
    ['/api/blocks', 'POST'],
    ['/api/protein_intake', 'POST'],
    ['/api/reset', 'DELETE'],
    ['/api/attachments', 'POST'],
  ])('blocks non-REMOTE_FIRST persistence before auth or network: %s', async (url, method) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('./supabase');

    await expect(authFetch(url, { method })).rejects.toThrow();
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['/api/schedules', '/api/recipes'])('allows REMOTE_FIRST %s independently of Notes local mode', async url => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('./supabase');

    await authFetch(url);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }));
  });

  it('keeps legacy Notes mode bounded to Notes routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('./supabase');

    await expect(authFetch('/api/notes')).rejects.toThrow();
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    localStorage.setItem(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } } });
    await authFetch('/api/notes');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects an unauthenticated runtime before session lookup', async () => {
    setRuntimeAccountSyncAccount(null);
    const { authFetch } = await import('./supabase');
    await expect(authFetch('/api/schedules')).rejects.toThrow();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('rejects offline runtime before session lookup', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { authFetch } = await import('./supabase');
    await expect(authFetch('/api/recipes')).rejects.toThrow();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('does not mark a request started when authentication is unavailable', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    const fetchMock = vi.fn();
    const onRequestStart = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { authFetch } = await import('./supabase');

    await expect(authFetch('/api/schedules', {}, { onRequestStart })).rejects.toThrow('Not authenticated');
    expect(onRequestStart).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mark a request started when request construction fails', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'token' } } });
    const fetchMock = vi.fn();
    const onRequestStart = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const options = Object.defineProperty({}, 'headers', {
      enumerable: true,
      get: () => { throw new Error('request construction failed'); },
    }) as RequestInit;
    const { authFetch } = await import('./supabase');

    await expect(authFetch('/api/schedules', options, { onRequestStart }))
      .rejects.toThrow('request construction failed');
    expect(onRequestStart).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
