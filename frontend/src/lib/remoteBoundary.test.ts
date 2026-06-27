import { describe, expect, it, vi } from 'vitest';
import {
  assertRemoteMutationAllowed,
  isLocalOnlyRemoteMutationPausedError,
  remoteSWRKey,
  shouldUseRemoteData,
} from './remoteBoundary';
import { NOTES_RUNTIME_SYNC_MODE_KEY } from './syncMode';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

describe('remoteBoundary', () => {
  it('disables remote data by default in local mode', () => {
    storage.clear();
    expect(shouldUseRemoteData()).toBe(false);
    expect(remoteSWRKey('/api/test')).toBeNull();
  });

  it('preserves remote access when mode is explicit', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(shouldUseRemoteData()).toBe(true);
    expect(remoteSWRKey('/api/test')).toBe('/api/test');
    expect(() => assertRemoteMutationAllowed()).not.toThrow();
  });

  it('throws a typed pause error for local-mode remote mutations', () => {
    storage.clear();
    try {
      assertRemoteMutationAllowed();
      throw new Error('Expected local mutation guard to throw');
    } catch (error) {
      expect(isLocalOnlyRemoteMutationPausedError(error)).toBe(true);
    }
  });
});
