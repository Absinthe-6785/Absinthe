import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertRemoteMutationAllowed,
  isLocalOnlyRemoteMutationPausedError,
  remoteSWRKey,
  shouldUseDomainRemoteData,
  shouldUseRemoteData,
} from './remoteBoundary';
import { NOTES_RUNTIME_SYNC_MODE_KEY, RETURN_TO_USE_LOCAL_LOCK_ENV } from './syncMode';
import { deriveAccountSyncAvailability } from './syncAuthority';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

beforeEach(() => {
  storage.clear();
  vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
  vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', '');
});

describe('remoteBoundary', () => {
  it('keeps account remote transport available independently of default Notes local mode', () => {
    expect(shouldUseRemoteData()).toBe(true);
    expect(remoteSWRKey('/api/test')).toBe('/api/test');
  });

  it('bounds the Notes return-to-use lock to the Notes adapter', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(shouldUseRemoteData()).toBe(true);
    expect(remoteSWRKey('/api/planner')).toBe('/api/planner');
  });

  it('blocks account transport when availability is offline', () => {
    const offline = deriveAccountSyncAvailability({
      authenticated: true,
      capabilityEnabled: true,
      online: false,
    });
    expect(shouldUseRemoteData(offline)).toBe(false);
    expect(remoteSWRKey('/api/test', undefined, offline)).toBeNull();
    try {
      assertRemoteMutationAllowed(offline);
      throw new Error('Expected unavailable transport guard to throw');
    } catch (error) {
      expect(isLocalOnlyRemoteMutationPausedError(error)).toBe(true);
    }
  });

  it('allows unrelated Health, Planner, and Recipe transport in Notes local mode', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
    expect(shouldUseDomainRemoteData('health_workouts')).toBe(true);
    expect(shouldUseDomainRemoteData('planner_events')).toBe(true);
    expect(shouldUseDomainRemoteData('recipes')).toBe(true);
  });

  it('uses domain policy without changing account availability', () => {
    expect(shouldUseDomainRemoteData('recipe_drafts')).toBe(false);
    expect(shouldUseDomainRemoteData('attachments')).toBe(false);
    expect(remoteSWRKey('/api/recipes', 'recipes')).toBe('/api/recipes');
    expect(remoteSWRKey('/api/attachments', 'attachments')).toBeNull();
  });
});
