import { describe, expect, it } from 'vitest';
import {
  buildNotesFetchUrl,
  resolveNotesSyncMode,
  computeLastSyncTimestamp,
  resetNotesSyncClientForTest,
  writeLastNotesSyncAt,
} from './notesSyncClient';

describe('notesSyncClient', () => {
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
