import type { NoteBase } from '@/components/views/noteUtils';

/** UTF-16 length of JSON for trashed notes — approximate localStorage reclaim. */
export function estimateDeletedNoteBytes(notes: readonly NoteBase[]): number {
  return JSON.stringify(notes.filter(n => n.deletedAt)).length;
}

export function formatRecoverableStorage(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
