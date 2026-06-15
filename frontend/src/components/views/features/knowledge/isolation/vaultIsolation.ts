import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { listTags } from '../tags/noteTags';

export interface IsolationStatus {
  isIsolated: boolean;
  hasWikiLinks: boolean;
  hasMentions: boolean;
  hasRelations: boolean;
  hasTags: boolean;
}

/** K-70 canonical isolation: no wiki links, mentions, relations, or tags. */
export function evaluateNoteIsolation(
  note: NoteBase,
  service: KnowledgeIndexService,
): IsolationStatus {
  const title = (note.title ?? '').trim();
  const incomingWiki = title ? service.getIncoming(title, { excludeNoteId: note.id }).length : 0;
  const outgoingWiki = service.getOutgoing(note.id).length;
  const incomingMentions = service.getMentioningNotes(note.id, { excludeNoteId: note.id }).length;
  const hasRelations = service.getOutgoingRelations(note.id).length > 0
    || service.getIncomingRelations(note.id).length > 0;
  const hasTags = listTags(note).length > 0;

  const hasWikiLinks = incomingWiki > 0 || outgoingWiki > 0;
  const hasMentions = incomingMentions > 0
    || service.getConnectionScore(note.id) > incomingWiki + outgoingWiki + incomingMentions
      + (hasRelations ? 1 : 0);

  const isIsolated = !hasWikiLinks && !hasMentions && !hasRelations && !hasTags;

  return { isIsolated, hasWikiLinks, hasMentions, hasRelations, hasTags };
}

export function collectIsolatedNoteIds(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  limit = 12,
): string[] {
  return notes
    .filter(n => !n.deletedAt && evaluateNoteIsolation(n, service).isIsolated)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => n.id);
}
