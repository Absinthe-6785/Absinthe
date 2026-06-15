import { describe, expect, it, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { groupRelatedNotes } from '../related/groupRelatedNotes';

function note(id: string, title: string, extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title, body: '', updatedAt: Date.now(), ...extra };
}

describe('groupRelatedNotes', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('src', 'Source', { properties: { tags: 'math' }, updatedAt: 100 }),
      note('a', 'Alpha', { properties: { tags: 'math' }, body: '[[Source]]', updatedAt: 300 }),
      note('b', 'Beta', { properties: { tags: 'math' }, updatedAt: 200 }),
      note('c', 'Gamma', { body: '[[Alpha]]', updatedAt: 50 }),
    ];
    service.buildFromNotes(notes);
  });

  it('groups without duplicates across sections', () => {
    const grouped = groupRelatedNotes('src', notes, service, 12);
    const ids = new Set([
      ...grouped.mostRelated,
      ...grouped.recentlyConnected,
      ...grouped.frequentlyReferenced,
    ].map(r => r.noteId));
    expect(ids.size).toBe(
      grouped.mostRelated.length
      + grouped.recentlyConnected.length
      + grouped.frequentlyReferenced.length,
    );
  });

  it('prioritizes highest scores in mostRelated', () => {
    const grouped = groupRelatedNotes('src', notes, service, 12);
    if (grouped.mostRelated.length >= 2) {
      expect(grouped.mostRelated[0]!.score).toBeGreaterThanOrEqual(grouped.mostRelated[1]!.score);
    }
  });
});
