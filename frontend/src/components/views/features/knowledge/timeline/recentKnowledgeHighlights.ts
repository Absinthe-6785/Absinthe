import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';

export type KnowledgeHighlightKind =
  | 'note-created'
  | 'link-created'
  | 'relation-resolved'
  | 'major-change';

export interface KnowledgeHighlight {
  id: string;
  kind: KnowledgeHighlightKind;
  noteId: string;
  detail: string;
  timestamp: number;
}

function noteTitle(notes: readonly NoteBase[], noteId: string): string {
  const note = notes.find(n => n.id === noteId);
  return note ? displayNoteTitle(note.title) : noteId;
}

/** Recent knowledge evolution highlights from history + connection score. */
export function buildRecentKnowledgeHighlights(
  events: readonly KnowledgeHistoryEvent[],
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  limit = 5,
): KnowledgeHighlight[] {
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
  const highlights: KnowledgeHighlight[] = [];

  for (const event of sorted) {
    if (highlights.length >= limit) break;

    if (event.type === 'NOTE_CREATED') {
      highlights.push({
        id: event.id,
        kind: 'note-created',
        noteId: event.noteId,
        detail: event.metadata?.title ?? noteTitle(notes, event.noteId),
        timestamp: event.timestamp,
      });
      continue;
    }

    if (event.type === 'LINK_CREATED') {
      const target = event.metadata?.linkTitle
        ?? (event.relatedNoteId ? noteTitle(notes, event.relatedNoteId) : '');
      const source = noteTitle(notes, event.noteId);
      const detail = target ? `${source} ↔ ${target}` : source;
      const connectionScore = service.getConnectionScore(event.noteId);
      highlights.push({
        id: event.id,
        kind: connectionScore >= 4 ? 'major-change' : 'link-created',
        noteId: event.noteId,
        detail,
        timestamp: event.timestamp,
      });
      continue;
    }

    if (
      event.type === 'DISCOVERY_RESOLVED'
      && (event.metadata?.action === 'connect' || event.metadata?.action === 'create-relation')
    ) {
      highlights.push({
        id: event.id,
        kind: 'relation-resolved',
        noteId: event.noteId,
        detail: event.metadata?.title ?? noteTitle(notes, event.noteId),
        timestamp: event.timestamp,
      });
    }
  }

  return highlights;
}
