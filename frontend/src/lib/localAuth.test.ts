import { describe, expect, it, vi } from 'vitest';
import {
  createLocalAuthUser,
  isLocalOnlyRuntime,
  LOCAL_AUTH_EMAIL,
  LOCAL_AUTH_RUNTIME_ENV,
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
  it('does not derive local authentication from default Notes local mode', () => {
    storage.clear();
    vi.stubEnv(LOCAL_AUTH_RUNTIME_ENV, 'false');
    expect(isLocalOnlyRuntime()).toBe(false);
  });

  it('creates a local fallback user only for local mode callers', () => {
    const user = createLocalAuthUser();
    expect(user.id).toBe(LOCAL_AUTH_USER_ID);
    expect(user.email).toBe(LOCAL_AUTH_EMAIL);
    expect(user.user_metadata).toMatchObject({ mode: 'local' });
  });

  it('keeps Notes mode independent from local authentication capability', () => {
    vi.stubEnv(LOCAL_AUTH_RUNTIME_ENV, 'false');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(isLocalOnlyRuntime()).toBe(false);
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    expect(isLocalOnlyRuntime()).toBe(false);
  });

  it('requires an explicit local-auth runtime capability', () => {
    vi.stubEnv(LOCAL_AUTH_RUNTIME_ENV, 'true');
    expect(isLocalOnlyRuntime()).toBe(true);
  });
});
