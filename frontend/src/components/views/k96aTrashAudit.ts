/**
 * K-96A — Trash cleanup storage recovery audit (test/dev only).
 *
 * Estimates localStorage reclaim from permanently removing soft-deleted notes.
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { estimateDeletedNoteBytes, formatRecoverableStorage } from '@/lib/trashNoteStorage';

export const K96A_NOTE_COUNTS = [100, 300, 1000] as const;
export type K96ANoteCount = (typeof K96A_NOTE_COUNTS)[number];

export const K96A_DELETED_RATIOS = [0.1, 0.3, 0.5] as const;
export type K96ADeletedRatio = (typeof K96A_DELETED_RATIOS)[number];

export interface K96TrashStorageRow {
  noteCount: number;
  deletedRatio: number;
  deletedCount: number;
  activeCount: number;
  recoverableBytes: number;
  recoverableLabel: string;
}

export function markDeletedRatio(
  notes: readonly NoteBase[],
  deletedRatio: number,
  now = Date.now(),
): NoteBase[] {
  const deletedCount = Math.floor(notes.length * deletedRatio);
  return notes.map((note, index) => ({
    ...note,
    deletedAt: index < deletedCount ? now - index * 1000 : null,
  }));
}

export function buildK96TrashAuditNotes(
  noteCount: number,
  deletedRatio: number,
): NoteBase[] {
  const { notes } = buildLargeVaultDataset({ noteCount });
  return markDeletedRatio(notes, deletedRatio);
}

export function measureTrashStorageRecovery(
  noteCount: number,
  deletedRatio: number,
): K96TrashStorageRow {
  const notes = buildK96TrashAuditNotes(noteCount, deletedRatio);
  const deletedCount = notes.filter(n => n.deletedAt).length;
  const recoverableBytes = estimateDeletedNoteBytes(notes);
  return {
    noteCount,
    deletedRatio,
    deletedCount,
    activeCount: notes.length - deletedCount,
    recoverableBytes,
    recoverableLabel: formatRecoverableStorage(recoverableBytes),
  };
}

export function runK96TrashStorageMatrix(): K96TrashStorageRow[] {
  const rows: K96TrashStorageRow[] = [];
  for (const noteCount of K96A_NOTE_COUNTS) {
    for (const deletedRatio of K96A_DELETED_RATIOS) {
      rows.push(measureTrashStorageRecovery(noteCount, deletedRatio));
    }
  }
  return rows;
}

export function formatK96TrashAuditReport(rows: readonly K96TrashStorageRow[]): string {
  const lines = ['K-96A trash storage recovery matrix', ''];
  for (const row of rows) {
    lines.push(
      `${row.noteCount} notes @ ${Math.round(row.deletedRatio * 100)}% deleted `
      + `(${row.deletedCount} trashed) → ${row.recoverableLabel} (${row.recoverableBytes} bytes)`,
    );
  }
  return lines.join('\n');
}

/** After permanent delete simulation, index should only retain active notes. */
export function verifyIndexAfterPermanentDelete(notes: readonly NoteBase[]): {
  activeNoteCount: number;
  indexedNoteCount: number;
  deletedIdsStillIndexed: number;
} {
  const activeNotes = simulatePermanentTrashEmpty(notes);
  const service = new KnowledgeIndexService();
  service.buildFromNotes(activeNotes);
  const deletedIds = new Set(notes.filter(n => n.deletedAt).map(n => n.id));
  const indexedIds = service.getAllNoteIds();
  const deletedIdsStillIndexed = indexedIds.filter(id => deletedIds.has(id)).length;

  return {
    activeNoteCount: activeNotes.length,
    indexedNoteCount: indexedIds.length,
    deletedIdsStillIndexed,
  };
}

export function simulatePermanentTrashEmpty(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt);
}
