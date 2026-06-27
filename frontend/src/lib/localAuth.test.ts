import { describe, expect, it, vi } from 'vitest';
import {
  createLocalAuthUser,
  isLocalOnlyRuntime,
  LOCAL_AUTH_EMAIL,
  LOCAL_AUTH_USER_ID,
} from './localAuth';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './notesSyncClient';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

describe('localAuth', () => {
  it('defaults to local-only runtime', () => {
    storage.clear();
    expect(isLocalOnlyRuntime()).toBe(true);
  });

  it('creates a local fallback user only for local mode callers', () => {
    const user = createLocalAuthUser();
    expect(user.id).toBe(LOCAL_AUTH_USER_ID);
    expect(user.email).toBe(LOCAL_AUTH_EMAIL);
    expect(user.user_metadata).toMatchObject({ mode: 'local' });
  });

  it('does not treat explicit remote mode as local-only', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(isLocalOnlyRuntime()).toBe(false);
  });
});
