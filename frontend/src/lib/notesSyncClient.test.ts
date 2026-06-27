import { describe, expect, it, vi } from 'vitest';
import {
  buildNotesFetchUrl,
  resolveNotesSyncMode,
  computeLastSyncTimestamp,
  getNoteSyncStatus,
  isNotesCloudSyncEnabled,
  mergeDeltaNoteRows,
  NOTES_DELTA_CURSOR_KEY,
  NOTES_RUNTIME_SYNC_MODE_KEY,
  resetNotesSyncClientForTest,
  resolveNotesRuntimeSyncMode,
  selectDirtyNotesForPush,
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

  it('uses delta mode and changed-since cursor when no last sync exists', () => {
    resetNotesSyncClientForTest();
    expect(resolveNotesSyncMode()).toBe('delta');
    expect(buildNotesFetchUrl('delta', null)).toContain('updated_after=0');
  });

  it('recovery still uses changed-since instead of a full vault fetch', () => {
    writeLastNotesSyncAt(100);
    expect(buildNotesFetchUrl('recovery', 100)).toContain('updated_after=100');
  });

  it('computeLastSyncTimestamp from rows', () => {
    const ts = computeLastSyncTimestamp([
      { id: '1', title: '', body: '', updated_at: 50, folder_id: null, deleted_at: null },
      { id: '2', title: '', body: '', updated_at: 99, folder_id: null, deleted_at: 80 },
    ]);
    expect(ts).toBe(99);
  });

  it('formalizes local note sync status from the last-sync cursor', () => {
    expect(NOTES_DELTA_CURSOR_KEY).toBe('absinthe-notes-last-sync-at');
    expect(getNoteSyncStatus({ updatedAt: 100, deletedAt: null }, 100)).toBe('clean');
    expect(getNoteSyncStatus({ updatedAt: 101, deletedAt: null }, 100)).toBe('dirty');
    expect(getNoteSyncStatus({ updatedAt: 101, deletedAt: 120 }, 100)).toBe('deleted');
  });

  it('selects only dirty and tombstoned notes for push', () => {
    const notes = [
      { id: 'clean', updatedAt: 100, deletedAt: null },
      { id: 'dirty', updatedAt: 150, deletedAt: null },
      { id: 'deleted', updatedAt: 160, deletedAt: 170 },
    ];
    expect(selectDirtyNotesForPush(notes, 120).map(note => note.id)).toEqual(['dirty', 'deleted']);
  });

  it('merges remote deltas without replacing newer local notes', () => {
    const local = [
      { id: 'new-local', updatedAt: 300, deletedAt: null, body: 'local' },
      { id: 'same', updatedAt: 250, deletedAt: null, body: 'newer local' },
    ];
    const remote = [
      { id: 'same', updatedAt: 200, deletedAt: null, body: 'stale remote' },
      { id: 'remote', updatedAt: 220, deletedAt: null, body: 'remote' },
    ];

    const merged = mergeDeltaNoteRows(local, remote);

    expect(merged.find(note => note.id === 'same')?.body).toBe('newer local');
    expect(merged.find(note => note.id === 'new-local')).toBeDefined();
    expect(merged.find(note => note.id === 'remote')).toBeDefined();
  });

  it('applies remote tombstones when they are the newest revision', () => {
    const merged = mergeDeltaNoteRows(
      [{ id: 'note', updatedAt: 200, deletedAt: null }],
      [{ id: 'note', updatedAt: 100, deletedAt: 300 }],
    );

    expect(merged[0].deletedAt).toBe(300);
  });
});
