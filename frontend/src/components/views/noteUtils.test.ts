import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  findNoteByTitle,
  noteReferencesTitle,
  findWikiLinkInText,
  parseNoteSearchQuery,
  noteMatchesTagSearch,
  extractLinkContexts,
  mergeDbAndLocalNotes,
  getLocalOnlyNotes,
  normalizeNoteFolderId,
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

describe('mergeDbAndLocalNotes / normalizeNoteFolderId', () => {
  const dbNotes: NoteBase[] = [
    { id: 'db-1', title: 'From DB', body: '', updatedAt: 100, folderId: null, deletedAt: null },
  ];
  const localNotes: NoteBase[] = [
    { id: 'db-1', title: 'Local newer', body: 'x', updatedAt: 200, folderId: null, deletedAt: null },
    { id: 'local-only', title: 'Offline', body: '', updatedAt: 150, folderId: null, deletedAt: null },
  ];

  it('keeps local-only notes alongside db notes', () => {
    const dbMerged = dbNotes.map(n => {
      const local = localNotes.find(l => l.id === n.id)!;
      return local.updatedAt > n.updatedAt ? local : n;
    });
    const merged = mergeDbAndLocalNotes(dbMerged, localNotes);
    expect(merged.map(n => n.id)).toContain('local-only');
    expect(merged.map(n => n.id)).toContain('db-1');
  });

  it('getLocalOnlyNotes excludes db ids and trashed', () => {
    const localOnly = getLocalOnlyNotes(['db-1'], [
      ...localNotes,
      { id: 'trashed', title: 'T', body: '', updatedAt: 1, folderId: null, deletedAt: 99 },
    ]);
    expect(localOnly.map(n => n.id)).toEqual(['local-only']);
  });

  it('normalizeNoteFolderId maps virtual folders to null', () => {
    expect(normalizeNoteFolderId('starred')).toBeNull();
    expect(normalizeNoteFolderId('trash')).toBeNull();
    expect(normalizeNoteFolderId('folder-1')).toBe('folder-1');
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
