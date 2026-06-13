import { describe, it, expect } from 'vitest';
import { buildKnowledgeReviewLists } from './buildKnowledgeReview';
import type { NoteBase } from '../../../noteUtils';

function note(
  id: string,
  title: string,
  body: string,
  updatedAt: number,
  createdAt?: number,
): NoteBase {
  return {
    id,
    title,
    body,
    updatedAt,
    createdAt,
    folderId: null,
    deletedAt: null,
  };
}

describe('buildKnowledgeReviewLists', () => {
  const notes = [
    note('a', 'Alpha', 'links to [[Beta]]', 1000, 100),
    note('b', 'Beta', 'back to [[Alpha]] and #tag', 5000, 200),
    note('c', 'Gamma', 'stale content here', 100, 50),
    note('d', 'Delta', '', 300, 300),
  ];

  it('returns recently edited sorted by updatedAt desc', () => {
    const lists = buildKnowledgeReviewLists(notes, { limit: 2 });
    expect(lists.recentlyEdited.map(e => e.noteId)).toEqual(['b', 'a']);
  });

  it('returns recently created sorted by createdAt desc', () => {
    const lists = buildKnowledgeReviewLists(notes, { limit: 2 });
    expect(lists.recentlyCreated.map(e => e.noteId)).toEqual(['d', 'b']);
  });

  it('ranks most linked notes by total link count', () => {
    const lists = buildKnowledgeReviewLists(notes, { limit: 3 });
    expect(lists.mostLinked[0]?.noteId).toBe('b');
    expect(lists.mostLinked.some(e => e.noteId === 'a')).toBe(true);
  });

  it('lists least revisited as oldest updated non-empty notes', () => {
    const lists = buildKnowledgeReviewLists(notes, { limit: 2 });
    expect(lists.leastRevisited[0]?.noteId).toBe('c');
  });

  it('excludes deleted notes by default', () => {
    const deleted = { ...notes[0], deletedAt: Date.now() };
    const lists = buildKnowledgeReviewLists([deleted, ...notes.slice(1)], { limit: 5 });
    expect(lists.recentlyEdited.every(e => e.noteId !== 'a')).toBe(true);
  });
});
