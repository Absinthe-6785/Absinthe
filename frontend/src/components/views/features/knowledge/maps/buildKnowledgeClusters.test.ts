import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { setNoteKind } from '../research/noteClassification';
import { addTag } from '../tags/noteTags';
import { buildKnowledgeClusters } from './buildKnowledgeClusters';

function note(id: string, title: string, body = ''): NoteBase {
  return { id, title, body, updatedAt: 1, folderId: null, deletedAt: null };
}

describe('buildKnowledgeClusters', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('finds highly connected concepts and tag clusters', () => {
    const hub = setNoteKind(addTag(note('h', 'Hub', '[[A]] [[B]] [[C]]'), 'politics'), 'concept');
    const a = setNoteKind(note('a', 'A', '[[Hub]]'), 'concept');
    const b = setNoteKind(addTag(note('b', 'B', '[[Hub]]'), 'politics'), 'concept');
    const c = setNoteKind(addTag(note('c', 'C', '[[Hub]]'), 'politics'), 'concept');
    const notes = [hub, a, b, c];
    service.buildFromNotes(notes);

    const data = buildKnowledgeClusters(notes, service, { limit: 5, minScore: 1 });
    expect(data.conceptCount).toBe(4);
    expect(data.highlyConnected.length).toBeGreaterThan(0);
    expect(data.tagClusters.some(t => t.tag === 'politics' && t.conceptCount >= 2)).toBe(true);
  });
});
