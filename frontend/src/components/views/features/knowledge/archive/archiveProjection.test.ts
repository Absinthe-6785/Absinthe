// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildArchiveProjection } from './buildArchiveProjection';
import { recordArchiveRestore, readArchiveRestoreRecents, clearArchiveRestoreRecentsForTest } from './archiveRestoreRecents';

describe('buildArchiveProjection', () => {
  it('builds all K-109 slices in one pass', () => {
    const projection = buildArchiveProjection({
      notes: [
        {
          id: '1',
          title: 'Note',
          body: 'text',
          updatedAt: 1000,
          lastOpenedAt: 2000,
          folderId: null,
          deletedAt: null,
        },
      ],
      now: new Date('2026-06-18T15:00:00'),
      snapshots: [],
      restoreRecents: [],
    });
    expect(projection.historyItems.groups.length).toBe(3);
    expect(projection.deletedItems.isEmpty).toBe(true);
    expect(projection.snapshotItems.isEmpty).toBe(true);
    expect(projection.timelineItems.groups.length).toBe(4);
    expect(projection.home.markCalendar).toBeDefined();
  });

  it('includes deleted notes in deletedItems', () => {
    const projection = buildArchiveProjection({
      notes: [{
        id: 't',
        title: 'Trash',
        body: '',
        updatedAt: 1,
        folderId: null,
        deletedAt: Date.now(),
      }],
      now: new Date(),
      snapshots: [],
      restoreRecents: [],
    });
    expect(projection.deletedItems.totalCount).toBe(1);
    expect(projection.empty.noDeleted).toBe(false);
  });
});

describe('archiveRestoreRecents', () => {
  it('records restore without note schema changes', () => {
    clearArchiveRestoreRecentsForTest();
    recordArchiveRestore('note-1', 5000);
    expect(readArchiveRestoreRecents()[0]?.noteId).toBe('note-1');
    clearArchiveRestoreRecentsForTest();
  });
});
