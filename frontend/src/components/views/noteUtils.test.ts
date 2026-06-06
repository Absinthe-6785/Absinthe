import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  findNoteByTitle,
  noteReferencesTitle,
  findWikiLinkInText,
  parseNoteSearchQuery,
  noteMatchesTagSearch,
  extractLinkContexts,
  type NoteBase,
} from './noteUtils';

const notes: NoteBase[] = [
  { id: '1', title: 'Hello World', body: 'See [[Target Note]] here.', updatedAt: 0, folderId: null, deletedAt: null },
  { id: '2', title: 'Target Note', body: '#work content', updatedAt: 0, folderId: null, deletedAt: null },
  { id: '3', title: 'Deleted', body: '[[Target Note]]', updatedAt: 0, folderId: null, deletedAt: 1 },
];

describe('wiki link helpers', () => {
  it('extractLinks deduplicates', () => {
    expect(extractLinks('[[A]] and [[A]]')).toEqual(['A']);
  });

  it('findNoteByTitle is case-insensitive', () => {
    expect(findNoteByTitle('hello world', notes)?.id).toBe('1');
    expect(findNoteByTitle('TARGET NOTE', notes)?.id).toBe('2');
  });

  it('noteReferencesTitle matches case-insensitively', () => {
    expect(noteReferencesTitle('Link to [[target note]]', 'Target Note')).toBe(true);
    expect(noteReferencesTitle('No link', 'Target Note')).toBe(false);
  });

  it('findWikiLinkInText returns actual token', () => {
    expect(findWikiLinkInText('refs [[Target Note]] ok', 'target note')).toBe('[[Target Note]]');
  });
});

describe('tag search helpers', () => {
  it('parseNoteSearchQuery detects #tag mode', () => {
    expect(parseNoteSearchQuery('#work')).toEqual({ mode: 'tag', value: 'work' });
    expect(parseNoteSearchQuery('hello')).toEqual({ mode: 'text', value: 'hello' });
  });

  it('noteMatchesTagSearch supports partial match', () => {
    expect(noteMatchesTagSearch('#workflow #idea', 'work')).toBe(true);
    expect(noteMatchesTagSearch('plain text', 'work')).toBe(false);
  });
});

describe('extractLinkContexts', () => {
  it('finds backlinks case-insensitively and skips deleted', () => {
    const ctx = extractLinkContexts('Target Note', notes);
    expect(ctx).toHaveLength(1);
    expect(ctx[0].noteId).toBe('1');
    expect(ctx[0].excerpts[0]).toContain('[[Target Note]]');
  });
});
