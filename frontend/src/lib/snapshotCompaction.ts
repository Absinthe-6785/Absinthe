/**
 * K-96C — Snapshot payload compaction (export-compatible note shaping).
 */
import type { NoteBase } from '@/components/views/noteUtils';

/** Fields omitted from snapshot vault content — not needed for restore/export. */
export const SNAPSHOT_TRANSIENT_NOTE_FIELDS = ['lastOpenedAt', 'deletedAt'] as const;

/** Target chunk size for snapshot persistence (UTF-16 code units). */
export const SNAPSHOT_CHUNK_TARGET_BYTES = 384 * 1024;

export function compactNoteBodyWhitespace(body: string): string {
  return body
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

export function compactNoteForSnapshot(note: NoteBase): NoteBase {
  const compact: NoteBase = {
    id: note.id,
    title: (note.title ?? '').trim(),
    body: compactNoteBodyWhitespace(note.body ?? ''),
    updatedAt: note.updatedAt,
    folderId: note.folderId ?? null,
    deletedAt: null,
    starred: note.starred ?? false,
  };

  if (typeof note.createdAt === 'number') {
    compact.createdAt = note.createdAt;
  }
  if (note.properties && Object.keys(note.properties).length > 0) {
    compact.properties = note.properties;
  }
  if (note.relations && Object.keys(note.relations).length > 0) {
    compact.relations = note.relations;
  }

  return compact;
}

/** Active notes only — deleted notes omitted from snapshots. */
export function compactNotesForSnapshot(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt).map(compactNoteForSnapshot);
}

export function estimateNotesJsonBytes(notes: readonly NoteBase[]): number {
  return JSON.stringify(notes).length;
}

export interface SnapshotCompactionMetrics {
  beforeBytes: number;
  afterBytes: number;
  savedBytes: number;
  savedPct: number;
  omittedDeletedCount: number;
}

export function measureSnapshotCompaction(
  notes: readonly NoteBase[],
): SnapshotCompactionMetrics {
  const beforeBytes = estimateNotesJsonBytes(notes);
  const compacted = compactNotesForSnapshot(notes);
  const afterBytes = estimateNotesJsonBytes(compacted);
  const savedBytes = Math.max(0, beforeBytes - afterBytes);
  const savedPct = beforeBytes > 0 ? (savedBytes / beforeBytes) * 100 : 0;
  return {
    beforeBytes,
    afterBytes,
    savedBytes,
    savedPct,
    omittedDeletedCount: notes.filter(n => n.deletedAt).length,
  };
}

export interface SnapshotChunkPlan {
  totalBytes: number;
  chunkCount: number;
  writeCount: number;
  chunkSizes: number[];
}

export function planSnapshotChunks(
  serialized: string,
  chunkTargetBytes = SNAPSHOT_CHUNK_TARGET_BYTES,
): SnapshotChunkPlan {
  const chunkSizes: number[] = [];
  for (let offset = 0; offset < serialized.length; offset += chunkTargetBytes) {
    chunkSizes.push(Math.min(chunkTargetBytes, serialized.length - offset));
  }
  const chunkCount = chunkSizes.length || (serialized.length === 0 ? 0 : 1);
  return {
    totalBytes: new TextEncoder().encode(serialized).length,
    chunkCount: chunkCount || 1,
    writeCount: 1 + (chunkCount || 1),
    chunkSizes: chunkSizes.length > 0 ? chunkSizes : serialized.length === 0 ? [] : [serialized.length],
  };
}

export function splitSnapshotIntoChunks(
  serialized: string,
  chunkTargetBytes = SNAPSHOT_CHUNK_TARGET_BYTES,
): string[] {
  if (serialized.length === 0) return [''];
  const chunks: string[] = [];
  for (let offset = 0; offset < serialized.length; offset += chunkTargetBytes) {
    chunks.push(serialized.slice(offset, offset + chunkTargetBytes));
  }
  return chunks;
}

export function joinSnapshotChunks(chunks: readonly string[]): string {
  return chunks.join('');
}
