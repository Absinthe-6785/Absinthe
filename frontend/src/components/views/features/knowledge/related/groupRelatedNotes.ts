import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService, RelatedNote } from '../KnowledgeIndexService';

export type RelatedNotesSection = 'mostRelated' | 'worthRevisiting';

export interface GroupedRelatedNotes {
  mostRelated: RelatedNote[];
  worthRevisiting: RelatedNote[];
}

const MOST_RELATED_LIMIT = 6;
const WORTH_REVISITING_LIMIT = 4;

function incomingLinkCount(noteId: string, noteTitle: string, service: KnowledgeIndexService): number {
  return service.getIncoming(noteTitle, { excludeNoteId: noteId }).length;
}

function worthRevisitingScore(
  item: RelatedNote,
  note: NoteBase | undefined,
  incoming: number,
): number {
  const recency = note?.updatedAt ?? 0;
  return incoming * 3 + recency / 1_000_000_000 + item.score * 0.25;
}

/** Group related notes into two actionable sections without duplicates. */
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

  const incomingById = new Map<string, number>();
  for (const item of pool) {
    const note = noteById.get(item.noteId);
    if (!note) continue;
    incomingById.set(item.noteId, incomingLinkCount(item.noteId, note.title ?? '', service));
  }

  const mostRelated = take(
    [...pool].sort((a, b) => b.score - a.score || a.noteTitle.localeCompare(b.noteTitle)),
    MOST_RELATED_LIMIT,
  );

  const worthRevisiting = take(
    [...pool].sort((a, b) => {
      const an = noteById.get(a.noteId);
      const bn = noteById.get(b.noteId);
      const as = worthRevisitingScore(a, an, incomingById.get(a.noteId) ?? 0);
      const bs = worthRevisitingScore(b, bn, incomingById.get(b.noteId) ?? 0);
      return bs - as || b.score - a.score;
    }),
    WORTH_REVISITING_LIMIT,
  );

  return { mostRelated, worthRevisiting };
}
