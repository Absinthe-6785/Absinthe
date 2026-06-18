import { describe, expect, it } from 'vitest';
import { estimateDeletedNoteBytes } from '@/lib/trashNoteStorage';
import {
  K96A_DELETED_RATIOS,
  K96A_NOTE_COUNTS,
  buildK96TrashAuditNotes,
  formatK96TrashAuditReport,
  measureTrashStorageRecovery,
  runK96TrashStorageMatrix,
  simulatePermanentTrashEmpty,
  verifyIndexAfterPermanentDelete,
} from './k96aTrashAudit';

describe('k96aTrashAudit storage recovery', () => {
  it.each(K96A_NOTE_COUNTS)('estimates recoverable bytes at %i notes', noteCount => {
    for (const ratio of K96A_DELETED_RATIOS) {
      const notes = buildK96TrashAuditNotes(noteCount, ratio);
      const row = measureTrashStorageRecovery(noteCount, ratio);
      expect(row.deletedCount).toBe(Math.floor(noteCount * ratio));
      expect(row.recoverableBytes).toBe(estimateDeletedNoteBytes(notes));
      expect(row.recoverableBytes).toBeGreaterThan(0);
    }
  });

  it('prints storage matrix with recoverable MB labels', () => {
    const rows = runK96TrashStorageMatrix();
    expect(rows).toHaveLength(K96A_NOTE_COUNTS.length * K96A_DELETED_RATIOS.length);

    const report = formatK96TrashAuditReport(rows);
    console.log('\n' + report);

    for (const row of rows) {
      expect(row.recoverableLabel).toMatch(/\d+(\.\d+)? (KB|MB)/);
    }

    const largest = rows[rows.length - 1]!;
    expect(largest.noteCount).toBe(1000);
    expect(largest.deletedRatio).toBe(0.5);
  });

  it('recoverable bytes grow with vault size and deleted ratio', () => {
    const small = measureTrashStorageRecovery(100, 0.1);
    const large = measureTrashStorageRecovery(1000, 0.5);
    expect(large.recoverableBytes).toBeGreaterThan(small.recoverableBytes);
  });
});

describe('k96aTrashAudit index hygiene', () => {
  it('rebuild after empty trash excludes deleted note ids', () => {
    const notes = buildK96TrashAuditNotes(100, 0.3);
    const remaining = simulatePermanentTrashEmpty(notes);
    const check = verifyIndexAfterPermanentDelete(notes);

    expect(remaining.length).toBe(check.activeNoteCount);
    expect(check.indexedNoteCount).toBe(check.activeNoteCount);
    expect(check.deletedIdsStillIndexed).toBe(0);
  });
});
