/**
 * K-97G — Shared incremental/batch sync logic mirrored from backend/notes_sync.py.
 */
import type { NoteBase } from '@/components/views/noteUtils';

export const BATCH_CHUNK_SIZES = [20, 50, 100] as const;
export const DEFAULT_BATCH_CHUNK_SIZE = 50;

export interface DbNoteRow {
  id: string;
  title: string;
  body: string;
  updated_at: number;
  folder_id: string | null;
  deleted_at: number | null;
  starred?: boolean;
  properties?: Record<string, string> | null;
  user_id?: string;
}

export function noteChangedSince(row: DbNoteRow, updatedAfter: number): boolean {
  const updatedAt = row.updated_at ?? 0;
  const deletedAt = row.deleted_at;
  if (updatedAt > updatedAfter) return true;
  if (deletedAt != null && deletedAt > updatedAfter) return true;
  return false;
}

export function filterNotesIncremental(rows: readonly DbNoteRow[], updatedAfter: number): DbNoteRow[] {
  return rows
    .filter(row => noteChangedSince(row, updatedAfter))
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
}

export function chunkNotePayloads<T>(notes: readonly T[], chunkSize: number): T[][] {
  const size = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let i = 0; i < notes.length; i += size) {
    chunks.push(notes.slice(i, i + size));
  }
  return chunks;
}

export function estimateBatchRequestCount(noteCount: number, chunkSize: number): number {
  if (noteCount <= 0) return 0;
  return Math.ceil(noteCount / Math.max(1, chunkSize));
}

export function estimateSingleRequestCount(noteCount: number): number {
  return noteCount;
}

export function toDbNoteRow(note: NoteBase): DbNoteRow {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    updated_at: note.updatedAt,
    folder_id: note.folderId,
    deleted_at: note.deletedAt,
    starred: note.starred ?? false,
    properties: note.properties ?? null,
  };
}
