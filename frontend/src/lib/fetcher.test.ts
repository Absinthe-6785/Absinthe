import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RETURN_TO_USE_LOCAL_LOCK_ENV } from './notesSyncClient';
import { LocalOnlyRemoteMutationPausedError } from './remoteBoundary';

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
  it('preserves domain-boundary pause errors from the authenticated fetch boundary', async () => {
    const { fetcher, isLocalOnlyRemotePausedError } = await import('./fetcher');
    const { authFetch } = await import('./supabase');
    vi.mocked(authFetch).mockRejectedValueOnce(new LocalOnlyRemoteMutationPausedError());

    try {
      await fetcher('/api/schedules');
      throw new Error('Expected local-only fetch to be paused');
    } catch (error) {
      expect(isLocalOnlyRemotePausedError(error)).toBe(true);
    }
    expect(authFetch).toHaveBeenCalledWith('/api/schedules');
  });

  it('does not let the default Notes local mode pause unrelated remote fetches', async () => {
    const { fetcher } = await import('./fetcher');
    const { authFetch } = await import('./supabase');
    vi.mocked(authFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await expect(fetcher('/api/schedules')).resolves.toEqual({ ok: true });
    expect(authFetch).toHaveBeenCalledWith('/api/schedules');
  });
});
