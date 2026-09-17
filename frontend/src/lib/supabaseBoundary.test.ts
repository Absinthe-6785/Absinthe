import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('supabase authFetch remote boundary', () => {
  it('does not let Notes local mode suppress unrelated account transport', async () => {
    storage.clear();
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    const { authFetch } = await import('./supabase');
    await expect(authFetch('/api/test')).rejects.toThrow('Not authenticated');
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it('uses Supabase auth in explicit remote mode', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: 'token' } },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await import('./supabase');
    const onRequestStart = vi.fn();
    await authFetch('/api/test', {}, { onRequestStart });

    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token' }),
    }));
    expect(onRequestStart).toHaveBeenCalledTimes(1);
    expect(onRequestStart.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
  });

  it('does not mark a request started when authentication is unavailable', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });
    const fetchMock = vi.fn();
    const onRequestStart = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await import('./supabase');
    await expect(authFetch('/api/test', {}, { onRequestStart })).rejects.toThrow('Not authenticated');

    expect(onRequestStart).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mark a request started when request construction fails', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    getSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: 'token' } },
    });
    const fetchMock = vi.fn();
    const onRequestStart = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const options = Object.defineProperty({}, 'headers', {
      enumerable: true,
      get: () => { throw new Error('request construction failed'); },
    }) as RequestInit;

    const { authFetch } = await import('./supabase');
    await expect(authFetch('/api/test', options, { onRequestStart }))
      .rejects.toThrow('request construction failed');

    expect(onRequestStart).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
