import { describe, expect, it, vi } from 'vitest';
import {
  buildNotesFetchUrl,
  resolveNotesSyncMode,
  computeLastSyncTimestamp,
  isNotesCloudSyncEnabled,
  NOTES_RUNTIME_SYNC_MODE_KEY,
  resetNotesSyncClientForTest,
  resolveNotesRuntimeSyncMode,
  writeLastNotesSyncAt,
} from './notesSyncClient';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
});

describe('notesSyncClient', () => {
  it('defaults runtime sync to local-only', () => {
    storage.clear();
    expect(resolveNotesRuntimeSyncMode()).toBe('local');
    expect(isNotesCloudSyncEnabled()).toBe(false);
  });

  it('can explicitly enable remote notes sync for future adapters', () => {
    storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'remote');
    expect(resolveNotesRuntimeSyncMode()).toBe('remote');
    expect(isNotesCloudSyncEnabled()).toBe(true);
  });

  it('bootstrap when no last sync', () => {
    resetNotesSyncClientForTest();
    expect(resolveNotesSyncMode()).toBe('bootstrap');
    expect(buildNotesFetchUrl('bootstrap', null)).not.toContain('updated_after');
  });

  it('recovery always full', () => {
    writeLastNotesSyncAt(100);
    expect(buildNotesFetchUrl('recovery', 100)).not.toContain('updated_after');
  });

  it('computeLastSyncTimestamp from rows', () => {
    const ts = computeLastSyncTimestamp([
      { id: '1', title: '', body: '', updated_at: 50, folder_id: null, deleted_at: null },
      { id: '2', title: '', body: '', updated_at: 99, folder_id: null, deleted_at: 80 },
    ]);
    expect(ts).toBe(99);
  });
});
