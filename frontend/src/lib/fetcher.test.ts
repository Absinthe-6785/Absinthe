import { describe, expect, it, vi } from 'vitest';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './notesSyncClient';

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

describe('fetcher local-only mode', () => {
  it('pauses remote fetches before Supabase auth is touched', async () => {
    storage.clear();
    const { fetcher, isLocalOnlyRemotePausedError } = await import('./fetcher');

    try {
      await fetcher('/api/test');
      throw new Error('Expected local-only fetch to be paused');
    } catch (error) {
      expect(isLocalOnlyRemotePausedError(error)).toBe(true);
    }
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('does not pause fetches when remote mode is explicit', async () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
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
