import { describe, it, expect } from 'vitest';
import { buildKnowledgeHealthMetrics } from './knowledgeHealth';
import type { NoteBase } from '../../../noteUtils';

function note(id: string, title: string, body: string): NoteBase {
  return { id, title, body, updatedAt: 1, folderId: null, deletedAt: null };
}

describe('buildKnowledgeHealthMetrics', () => {
  it('computes vault metrics', () => {
    const notes = [
      note('a', 'Alpha', '[[Beta]]'),
      note('b', 'Beta', 'ref [[Alpha]]'),
      note('c', 'Orphan', 'lonely'),
    ];
    const metrics = buildKnowledgeHealthMetrics(notes);
    expect(metrics.totalNotes).toBe(3);
    expect(metrics.linkedNotes).toBe(2);
    expect(metrics.orphanNotes).toBe(1);
    expect(metrics.totalBacklinks).toBeGreaterThan(0);
    expect(metrics.averageConnections).toBeGreaterThan(0);
  });
});
