import { describe, expect, it } from 'vitest';
import { auditArchiveIa, K109_ARCHIVE_IA_SECTIONS } from './k109ArchiveIaAudit';
import { auditArchiveHistory } from './k109HistoryAudit';
import { auditArchiveTrash } from './k109TrashAudit';
import { auditArchiveSnapshots } from './k109SnapshotAudit';
import { auditArchiveTimeline } from './k109TimelineAudit';
import {
  auditArchiveProjection,
  auditArchiveProjectionSinglePass,
} from './k109ArchiveProjectionAudit';
import { auditArchiveEmptyStates } from './k109EmptyStateAudit';
import { auditArchiveMobile, auditArchiveMobileTouchTargets } from './k109MobileAudit';
import { buildArchiveProjection, sortArchiveDeletedItems } from './features/knowledge/archive';

describe('k109 audits', () => {
  it('archive IA section order', () => {
    const { sections } = auditArchiveIa();
    expect(sections[0]).toBe('history');
    expect(sections[1]).toBe('deleted');
    expect(K109_ARCHIVE_IA_SECTIONS).toContain('restore-tools');
  });

  it('history buckets and kinds', () => {
    expect(auditArchiveHistory()).toContain('restored');
    expect(auditArchiveHistory()).toContain('data-k109-history-row');
  });

  it('trash browsing hooks', () => {
    expect(auditArchiveTrash()).toContain('data-k109-deleted-search');
    expect(auditArchiveTrash()).toContain('newest');
  });

  it('snapshot slots exposed', () => {
    expect(auditArchiveSnapshots()).toContain('monthly');
    expect(auditArchiveSnapshots()).toContain('data-k109-snapshot-restore');
  });

  it('timeline flat buckets', () => {
    expect(auditArchiveTimeline()).toContain('thisWeek');
    expect(auditArchiveTimeline()).toContain('absinthe-archive-sections');
  });

  it('ArchiveProjection single-pass slices', () => {
    expect(auditArchiveProjection()).toEqual([
      'historyItems',
      'deletedItems',
      'snapshotItems',
      'timelineItems',
      'restoreTools',
    ]);
    expect(auditArchiveProjectionSinglePass()).toBe(true);
  });

  it('empty state hooks', () => {
    expect(auditArchiveEmptyStates()).toContain('k109EmptyDeleted');
  });

  it('mobile widths and touch targets', () => {
    expect(auditArchiveMobile()).toEqual([320, 375, 768]);
    expect(auditArchiveMobileTouchTargets()).toBe(true);
  });

  it('deleted sort helper', () => {
    const items = [
      { noteId: 'a', title: 'B', deletedAt: 100, relativeLabel: '' },
      { noteId: 'b', title: 'A', deletedAt: 200, relativeLabel: '' },
    ];
    expect(sortArchiveDeletedItems(items, 'newest')[0].noteId).toBe('b');
    expect(sortArchiveDeletedItems(items, 'title')[0].title).toBe('A');
  });

  it('buildArchiveProjection includes home slice', () => {
    const p = buildArchiveProjection({
      notes: [],
      now: new Date(),
      snapshots: [],
      restoreRecents: [],
    });
    expect(p.home).toBeDefined();
    expect(p.empty).toBeDefined();
  });
});
