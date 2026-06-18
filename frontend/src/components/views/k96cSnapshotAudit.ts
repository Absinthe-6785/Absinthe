/**
 * K-96C — Snapshot compaction and chunked persistence audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { compactNotesForSnapshot, measureSnapshotCompaction } from '@/lib/snapshotCompaction';
import { buildVaultSnapshot, serializeVaultSnapshot } from '@/lib/vaultSnapshotBuild';
import { inspectSnapshotChunkPlan } from '@/lib/vaultSnapshotStore';

export const K96C_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K96CNoteCount = (typeof K96C_NOTE_COUNTS)[number];

export interface K96CSnapshotAuditRow {
  noteCount: number;
  deletedRatio: number;
  snapshotBytesBefore: number;
  snapshotBytesAfter: number;
  savedBytes: number;
  savedPct: number;
  chunkCount: number;
  writeCount: number;
  omittedDeletedCount: number;
}

function markDeletedRatio(notes: readonly NoteBase[], ratio: number): NoteBase[] {
  const deletedCount = Math.floor(notes.length * ratio);
  return notes.map((note, index) => ({
    ...note,
    deletedAt: index < deletedCount ? Date.now() - index : null,
  }));
}

export function buildK96CSnapshotAuditNotes(
  noteCount: number,
  deletedRatio = 0.1,
): NoteBase[] {
  const { notes } = buildLargeVaultDataset({ noteCount });
  return markDeletedRatio(notes, deletedRatio);
}

export function measureK96CSnapshotRow(
  noteCount: number,
  deletedRatio = 0.1,
): K96CSnapshotAuditRow {
  const notes = buildK96CSnapshotAuditNotes(noteCount, deletedRatio);
  const compaction = measureSnapshotCompaction(notes);

  const beforeSnapshot = buildVaultSnapshot(notes, [], 'last', 'last-audit-before', { compact: false });
  const snapshotBytesBefore = serializeVaultSnapshot(beforeSnapshot).length;

  const afterSnapshot = buildVaultSnapshot(notes, [], 'last', 'last-audit-after');
  const serializedAfter = serializeVaultSnapshot(afterSnapshot);
  const snapshotBytesAfter = serializedAfter.length;
  const chunkPlan = inspectSnapshotChunkPlan(serializedAfter);

  return {
    noteCount,
    deletedRatio,
    snapshotBytesBefore,
    snapshotBytesAfter,
    savedBytes: Math.max(0, snapshotBytesBefore - snapshotBytesAfter),
    savedPct: snapshotBytesBefore > 0
      ? ((snapshotBytesBefore - snapshotBytesAfter) / snapshotBytesBefore) * 100
      : 0,
    chunkCount: chunkPlan.chunkCount,
    writeCount: chunkPlan.writeCount,
    omittedDeletedCount: compaction.omittedDeletedCount,
  };
}

export function runK96CSnapshotMatrix(
  deletedRatio = 0.1,
): K96CSnapshotAuditRow[] {
  return K96C_NOTE_COUNTS.map(noteCount => measureK96CSnapshotRow(noteCount, deletedRatio));
}

export function formatK96CSnapshotAuditReport(rows: readonly K96CSnapshotAuditRow[]): string {
  const lines = ['K-96C snapshot compaction audit', ''];
  for (const row of rows) {
    const beforeMb = (row.snapshotBytesBefore / (1024 * 1024)).toFixed(2);
    const afterMb = (row.snapshotBytesAfter / (1024 * 1024)).toFixed(2);
    lines.push(
      `${row.noteCount} notes @ ${Math.round(row.deletedRatio * 100)}% deleted — `
      + `${beforeMb} MB → ${afterMb} MB (${row.savedPct.toFixed(1)}% saved) | `
      + `${row.chunkCount} chunks, ${row.writeCount} writes`,
    );
  }
  return lines.join('\n');
}

export function estimateCompactionOnlyBytes(notes: readonly NoteBase[]): {
  rawNotesBytes: number;
  compactNotesBytes: number;
} {
  return {
    rawNotesBytes: JSON.stringify(notes).length,
    compactNotesBytes: JSON.stringify(compactNotesForSnapshot(notes)).length,
  };
}
