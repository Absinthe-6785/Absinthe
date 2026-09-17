import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setRuntimeAccountSyncAccount } from './remoteBoundary';
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
  setRuntimeAccountSyncAccount('account-a');
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
