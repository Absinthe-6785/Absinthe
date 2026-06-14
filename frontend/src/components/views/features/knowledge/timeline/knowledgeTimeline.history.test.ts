import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildKnowledgeTimeline } from './knowledgeTimeline';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';

function note(id: string, title: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body, ...extra };
}

describe('knowledgeTimeline with history', () => {
  const now = Date.parse('2026-06-20T12:00:00Z');
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('falls back when no history exists', () => {
    const notes = [note('n1', 'A', '', { createdAt: Date.parse('2026-06-01') })];
    service.buildFromNotes(notes);
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { now });
    expect(timeline.usesEventHistory).toBe(false);
  });

  it('uses event history for growth when events exist', () => {
    const notes = [note('n1', 'History', '[[Japan]]', { createdAt: Date.parse('2026-06-01') })];
    service.buildFromNotes(notes);
    const historyEvents: KnowledgeHistoryEvent[] = [
      { id: 'e1', type: 'NOTE_CREATED', timestamp: Date.parse('2026-06-13'), noteId: 'n1' },
      { id: 'e2', type: 'LINK_CREATED', timestamp: Date.parse('2026-06-14'), noteId: 'n1', metadata: { linkTitle: 'Japan' } },
      { id: 'e3', type: 'HUB_CREATED', timestamp: Date.parse('2026-06-18'), noteId: 'h1', areaId: 'History' },
      { id: 'e4', type: 'DISCOVERY_RESOLVED', timestamp: Date.parse('2026-06-20'), noteId: 'n1' },
    ];
    const timeline = buildKnowledgeTimeline(notes, service, undefined, { now, historyEvents });
    expect(timeline.usesEventHistory).toBe(true);
    expect(timeline.recentEvolution.notesAdded).toBeGreaterThanOrEqual(1);
    expect(timeline.growth.discovery.discoveriesResolved).toBeGreaterThanOrEqual(1);
  });
});
