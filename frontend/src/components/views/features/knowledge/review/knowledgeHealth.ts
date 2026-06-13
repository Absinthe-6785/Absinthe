import type { NoteBase } from '../../../noteUtils';
import { buildBacklinkIndex, getBacklinkCount } from '../backlinks';
import { listTags } from '../tags/noteTags';
import { countOrphanNotes, isOrphanNote } from './orphanNotes';
import { countStaleNotes } from './staleNotes';

export interface KnowledgeHealthMetrics {
  totalNotes: number;
  linkedNotes: number;
  orphanNotes: number;
  taggedNotes: number;
  staleNotes: number;
  totalBacklinks: number;
  averageConnections: number;
}

export function buildKnowledgeHealthMetrics(notes: readonly NoteBase[]): KnowledgeHealthMetrics {
  const active = notes.filter(n => !n.deletedAt);
  const index = buildBacklinkIndex(active);

  let linkedNotes = 0;
  let taggedNotes = 0;
  let totalConnections = 0;
  let totalBacklinks = 0;

  for (const note of active) {
    const incoming = getBacklinkCount(index, note.title ?? '', note.id);
    const outgoing = index.outgoingByNoteId.get(note.id)?.length ?? 0;
    totalBacklinks += incoming;
    const connections = incoming + outgoing;
    totalConnections += connections;
    if (connections > 0) linkedNotes += 1;
    if (listTags(note).length > 0) taggedNotes += 1;
  }

  const orphanNotes = active.filter(n => isOrphanNote(n, index)).length;
  const staleNotes = countStaleNotes(active, 30);
  const averageConnections = active.length > 0
    ? Math.round((totalConnections / active.length) * 10) / 10
    : 0;

  return {
    totalNotes: active.length,
    linkedNotes,
    orphanNotes,
    taggedNotes,
    staleNotes,
    totalBacklinks,
    averageConnections,
  };
}
