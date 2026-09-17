import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RETURN_TO_USE_LOCAL_LOCK_ENV } from './notesSyncClient';

const getSessionMock = vi.fn();

vi.mock('./supabase', () => ({
  authFetch: vi.fn(),
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
  vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', '');
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
});

describe('fetcher account sync availability', () => {
  it('pauses remote fetches before Supabase auth is touched when account sync is disabled', async () => {
    vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'true');
    const { fetcher, isLocalOnlyRemotePausedError } = await import('./fetcher');

    try {
      await fetcher('/api/test');
      throw new Error('Expected local-only fetch to be paused');
    } catch (error) {
      expect(isLocalOnlyRemotePausedError(error)).toBe(true);
    }
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('does not let the default Notes local mode pause unrelated remote fetches', async () => {
    const { fetcher } = await import('./fetcher');
    const { authFetch } = await import('./supabase');
    vi.mocked(authFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await expect(fetcher('/api/test')).resolves.toEqual({ ok: true });
    expect(authFetch).toHaveBeenCalledWith('/api/test');
  });
});
