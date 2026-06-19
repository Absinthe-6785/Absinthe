/** UI-only restore recents — not part of note schema (K-109). */
import type { ArchiveRestoreRecentEntry } from './archiveProjectionModels';

export const ARCHIVE_RESTORE_RECENTS_KEY = 'absinthe-archive-restore-recents';
const MAX_ENTRIES = 24;

export function readArchiveRestoreRecents(): ArchiveRestoreRecentEntry[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_RESTORE_RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchiveRestoreRecentEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => typeof e.noteId === 'string' && typeof e.restoredAt === 'number');
  } catch {
    return [];
  }
}

export function recordArchiveRestore(noteId: string, restoredAt = Date.now()): void {
  try {
    const prev = readArchiveRestoreRecents().filter(e => e.noteId !== noteId);
    const next = [{ noteId, restoredAt }, ...prev].slice(0, MAX_ENTRIES);
    localStorage.setItem(ARCHIVE_RESTORE_RECENTS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clearArchiveRestoreRecentsForTest(): void {
  try {
    localStorage.removeItem(ARCHIVE_RESTORE_RECENTS_KEY);
  } catch { /* ignore */ }
}
