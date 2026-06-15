import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import { buildRecentKnowledgeHighlights } from './recentKnowledgeHighlights';

function note(id: string, title: string): NoteBase {
  return { id, title, body: '', updatedAt: Date.now() };
}

describe('recentKnowledgeHighlights', () => {
  let service: KnowledgeIndexService;
  const notes = [note('a', 'Alpha'), note('b', 'Beta')];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
  });

  it('extracts note creation, links, and relation resolution', () => {
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: 300, noteId: 'a', metadata: { title: 'Alpha' } },
      { id: '2', type: 'LINK_CREATED', timestamp: 200, noteId: 'a', relatedNoteId: 'b', metadata: { linkTitle: 'Beta' } },
      {
        id: '3',
        type: 'DISCOVERY_RESOLVED',
        timestamp: 100,
        noteId: 'a',
        metadata: { action: 'create-relation', title: 'Alpha' },
      },
    ];
    const highlights = buildRecentKnowledgeHighlights(events, notes, service, 5);
    expect(highlights.map(h => h.kind)).toEqual(['note-created', 'link-created', 'relation-resolved']);
  });
});
