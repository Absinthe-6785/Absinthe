import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertRemoteMutationAllowed,
  isLocalOnlyRemoteMutationPausedError,
  remoteSWRKey,
  runtimeAccountSyncAvailability,
  setRuntimeAccountSyncAccount,
  shouldUseAccountSyncTransport,
  shouldUseDomainSyncTransport,
  shouldUseDomainRemotePersistence,
  shouldUseLegacyNotesRemoteData,
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
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
  vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', '');
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  setRuntimeAccountSyncAccount('account-a');
});

describe('remoteBoundary', () => {
  it('keeps account transport independent while direct persistence obeys domain policy', () => {
    expect(shouldUseAccountSyncTransport()).toBe(true);
    expect(shouldUseDomainSyncTransport('health_workouts')).toBe(true);
    expect(shouldUseDomainRemotePersistence('health_workouts')).toBe(false);
    expect(shouldUseDomainRemotePersistence('planner_events')).toBe(true);
    expect(remoteSWRKey('/api/schedules', 'planner_events')).toBe('/api/schedules');
    expect(remoteSWRKey('/api/workouts', 'health_workouts')).toBeNull();
  });

  it('bounds the Notes return-to-use lock to the Notes adapter', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(shouldUseLegacyNotesRemoteData()).toBe(false);
    expect(shouldUseDomainRemotePersistence('planner_events')).toBe(true);
    expect(shouldUseDomainRemotePersistence('recipes')).toBe(true);
  });

  it('blocks account transport when availability is offline', () => {
    const offline = deriveAccountSyncAvailability({
      authenticated: true,
      capabilityEnabled: true,
      online: false,
    });
    expect(shouldUseAccountSyncTransport(offline)).toBe(false);
    expect(remoteSWRKey('/api/schedules', 'planner_events', offline)).toBeNull();
    expect(() => assertRemoteMutationAllowed('planner_events', offline)).toThrow();
  });

  it('prevents LOCAL_ONLY and DEFERRED direct persistence', () => {
    expect(shouldUseDomainRemotePersistence('recipe_drafts')).toBe(false);
    expect(shouldUseDomainRemotePersistence('account_reset')).toBe(false);
    expect(shouldUseDomainRemotePersistence('attachments')).toBe(false);
    expect(remoteSWRKey('/api/attachments', 'attachments')).toBeNull();
    try {
      assertRemoteMutationAllowed('account_reset');
      throw new Error('Expected local-only mutation guard to throw');
    } catch (error) {
      expect(isLocalOnlyRemoteMutationPausedError(error)).toBe(true);
    }
  });

  it('uses real account and connectivity authority and clears stale logout state', () => {
    expect(runtimeAccountSyncAvailability().state).toBe('AVAILABLE');
    setRuntimeAccountSyncAccount(null);
    expect(runtimeAccountSyncAvailability()).toEqual({
      state: 'UNAUTHENTICATED',
      transportAvailable: false,
    });
    setRuntimeAccountSyncAccount('account-b');
    vi.stubGlobal('navigator', { onLine: false });
    expect(runtimeAccountSyncAvailability()).toEqual({
      state: 'OFFLINE',
      transportAvailable: false,
    });
  });
});
