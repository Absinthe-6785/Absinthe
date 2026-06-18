import type { NoteBase } from './noteUtils';
import {
  findDailyAnchorNote,
  formatTraceDayHeading,
  shiftDateKey,
} from './features/knowledge/trace/dailyTraceDayHelpers';

export { shiftDateKey, formatTraceDayHeading };

/** All non-deleted notes titled exactly YYYY-MM-DD for a given day. */
export function findAllDailyAnchorNotes(
  notes: readonly NoteBase[],
  dateKey: string,
): NoteBase[] {
  const trimmed = dateKey.trim();
  return notes.filter(n => n.deletedAt == null && n.title.trim() === trimmed);
}

export function hasDailyNote(notes: readonly NoteBase[], dateKey: string): boolean {
  return findAllDailyAnchorNotes(notes, dateKey).length > 0;
}

export function formatDailyNoteLabel(dateKey: string): string {
  return formatTraceDayHeading(dateKey);
}

export interface OpenDailyNoteOptions {
  notes: readonly NoteBase[];
  dateKey: string;
  createNote: (opts: { title: string; body: string }) => string | void;
  setActiveNoteId: (id: string) => void;
}

/** Open existing daily anchor or create one — never creates when a match already exists. */
export function openOrCreateDailyNote({
  notes,
  dateKey,
  createNote,
  setActiveNoteId,
}: OpenDailyNoteOptions): 'opened' | 'created' {
  const existing = findDailyAnchorNote(notes, dateKey)
    ?? findAllDailyAnchorNotes(notes, dateKey)[0];
  if (existing) {
    setActiveNoteId(existing.id);
    return 'opened';
  }
  const body = `## ${dateKey}\n\n`;
  const created = createNote({ title: dateKey, body });
  if (typeof created === 'string') setActiveNoteId(created);
  return 'created';
}
