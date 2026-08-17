import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNoteSyncStatus,
  isNotesCloudSyncEnabled,
  NOTES_LAST_SYNC_KEY,
  NOTES_RUNTIME_SYNC_MODE_KEY,
  RETURN_TO_USE_LOCAL_LOCK_ENV,
  resolveNotesRuntimeSyncMode,
} from './notesSyncClient';

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

describe('notesSyncClient', () => {
  it('defaults runtime sync to local-only', () => {
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('local safety lock defeats a stale remote browser override', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('local safety lock defeats a stale hybrid browser override', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, '1');
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'hybrid');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('local safety lock outranks a remote environment mode', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('falls back closed for a malformed browser mode value', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'unexpected');
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('can explicitly enable remote notes sync for future adapters', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('remote');
    expect(isNotesCloudSyncEnabled()).toBe(true);
  });

  it('formalizes local note sync status from the last-sync cursor', () => {
    storage.set(NOTES_LAST_SYNC_KEY, '100');
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null }, 100)).toBe('clean');
    expect(getNoteSyncStatus({ updatedAt: 101, deletedAt: null }, 100)).toBe('dirty');
    expect(getNoteSyncStatus({ updatedAt: 101, deletedAt: 120 }, 100)).toBe('deleted');
  });

});
