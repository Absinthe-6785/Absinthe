import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService, RelatedNote } from '../KnowledgeIndexService';

export type RelatedNotesSection = 'mostRelated' | 'recentlyConnected' | 'frequentlyReferenced';

export interface GroupedRelatedNotes {
  mostRelated: RelatedNote[];
  recentlyConnected: RelatedNote[];
  frequentlyReferenced: RelatedNote[];
}

const SECTION_LIMIT = 4;

function incomingLinkCount(noteId: string, noteTitle: string, service: KnowledgeIndexService): number {
  return service.getIncoming(noteTitle, { excludeNoteId: noteId }).length;
}

/** Group related notes into actionable sections without duplicates. */
export function groupRelatedNotes(
  sourceId: string,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  limit = 12,
): GroupedRelatedNotes {
  const pool = [...service.getRelatedNotes(sourceId, limit)];
  const noteById = new Map(notes.map(n => [n.id, n]));
  const used = new Set<string>();

  const take = (sorted: RelatedNote[], max: number): RelatedNote[] => {
    const out: RelatedNote[] = [];
    for (const item of sorted) {
      if (used.has(item.noteId)) continue;
      used.add(item.noteId);
      out.push(item);
      if (out.length >= max) break;
    }
    return out;
  };

  const mostRelated = take(
    [...pool].sort((a, b) => b.score - a.score || a.noteTitle.localeCompare(b.noteTitle)),
    SECTION_LIMIT,
  );

  const recentlyConnected = take(
    [...pool].sort((a, b) => {
      const au = noteById.get(a.noteId)?.updatedAt ?? 0;
      const bu = noteById.get(b.noteId)?.updatedAt ?? 0;
      return bu - au || b.score - a.score;
    }),
    SECTION_LIMIT,
  );

  const frequentlyReferenced = take(
    [...pool].sort((a, b) => {
      const an = noteById.get(a.noteId);
      const bn = noteById.get(b.noteId);
      const ac = an ? incomingLinkCount(a.noteId, an.title ?? '', service) : 0;
      const bc = bn ? incomingLinkCount(b.noteId, bn.title ?? '', service) : 0;
      return bc - ac || b.score - a.score;
    }),
    SECTION_LIMIT,
  );

  return { mostRelated, recentlyConnected, frequentlyReferenced };
}
