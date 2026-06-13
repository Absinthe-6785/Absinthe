import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { buildBacklinkIndex, getBacklinkCount } from '../backlinks';
import { listTags } from '../tags/noteTags';
import type { ReviewNoteEntry } from './buildKnowledgeReview';

export interface BuildOrphanNotesOptions {
  limit?: number;
  activeOnly?: boolean;
}

/** Orphan = no backlinks, no outgoing wiki links, no tags. */
export function isOrphanNote(
  note: NoteBase,
  index: ReturnType<typeof buildBacklinkIndex>,
): boolean {
  if (note.deletedAt) return false;
  const incoming = getBacklinkCount(index, note.title ?? '', note.id);
  const outgoing = index.outgoingByNoteId.get(note.id)?.length ?? 0;
  const tags = listTags(note);
  return incoming === 0 && outgoing === 0 && tags.length === 0;
}

export function buildOrphanNotes(
  notes: readonly NoteBase[],
  opts: BuildOrphanNotesOptions = {},
): ReviewNoteEntry[] {
  const limit = opts.limit ?? 12;
  const activeOnly = opts.activeOnly !== false;
  const index = buildBacklinkIndex(notes.filter(n => !activeOnly || !n.deletedAt));

  return notes
    .filter(n => !activeOnly || !n.deletedAt)
    .filter(n => isOrphanNote(n, index))
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, limit)
    .map(note => ({
      noteId: note.id,
      noteTitle: displayNoteTitle(note.title),
      metric: note.updatedAt,
      meta: '링크·태그 없음',
    }));
}

export function countOrphanNotes(notes: readonly NoteBase[]): number {
  const active = notes.filter(n => !n.deletedAt);
  const index = buildBacklinkIndex(active);
  return active.filter(n => isOrphanNote(n, index)).length;
}
