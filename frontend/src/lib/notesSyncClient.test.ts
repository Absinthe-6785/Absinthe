import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNoteSyncStatus,
  isNotesCloudSyncEnabled,
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
  const legacyNotesLastSyncKey = 'absinthe-notes-last-sync-at';

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

  it('classifies an eligible note as dirty from note-local state', () => {
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null })).toBe('dirty');
  });

  it('classifies tombstoned notes as deleted from note-local state', () => {
    expect(getNoteSyncStatus({ updatedAt: 101, deletedAt: 120 })).toBe('deleted');
  });

  it.each([
    ['stale', '100'],
    ['future-dated', String(Number.MAX_SAFE_INTEGER)],
    ['malformed', 'not-a-timestamp'],
  ])('ignores %s historical legacy cursor state for upload eligibility', (_label, value) => {
    storage.set(legacyNotesLastSyncKey, value);
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null })).toBe('dirty');
  });

  it('keeps account-scoped Note decisions independent from the shared legacy cursor', () => {
    storage.set(legacyNotesLastSyncKey, String(Number.MAX_SAFE_INTEGER));
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null })).toBe('dirty');
    expect(getNoteSyncStatus({ updatedAt: 200, deletedAt: null })).toBe('dirty');
  });

});
