import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  mergeNoteArrays,
  mergeFolderArrays,
  mergeNotesFromStorageJson,
  mergeFoldersFromStorageJson,
  normalizeNoteFolderId,
  normalizeNote,
  normalizeNoteProperties,
  noteSyncPayload,
  saveNotes,
  LOCAL_NOTES_SAVE_ERROR,
  NOTES_KEY,
  type NoteBase,
} from './noteUtils';
import { listTags } from './features/knowledge/tags/noteTags';

const notes: NoteBase[] = [
  { id: '1', title: 'Hello World', body: 'See [[Target Note]] here.', updatedAt: 0, folderId: null, deletedAt: null },
  { id: '2', title: 'Target Note', body: '#work content', updatedAt: 0, folderId: null, deletedAt: null },
  { id: '3', title: 'Deleted', body: '[[Target Note]]', updatedAt: 0, folderId: null, deletedAt: 1 },
];

describe('normalizeNoteProperties tags hardening', () => {
  function hydrate(properties: Record<string, unknown>) {
    return normalizeNote({
      id: 'n1',
      title: 'Note',
      body: '',
      updatedAt: 0,
      folderId: null,
      deletedAt: null,
      properties: properties as NoteBase['properties'],
    });
  }

  it('preserves valid tag arrays through note hydration', () => {
    const normalized = normalizeNoteProperties({ tags: ['Japanese', 'grammar'] });
    expect(normalized?.tags).toBe('["Japanese","grammar"]');
    expect(listTags(hydrate({ tags: ['Japanese', 'grammar'] }))).toEqual(['Japanese', 'grammar']);
  });

  it('preserves legacy string tag values through normalization', () => {
    const normalized = normalizeNoteProperties({ tags: 'japanese, grammar' });
    expect(normalized?.tags).toBe('["japanese","grammar"]');
    expect(listTags(hydrate({ tags: 'japanese, grammar' }))).toEqual(['japanese', 'grammar']);
  });

  it('drops null tag values without removing other properties', () => {
    expect(normalizeNoteProperties({ tags: null, status: 'active' })).toEqual({ status: 'active' });
    expect(listTags(hydrate({ tags: null, status: 'active' }))).toEqual([]);
  });

  it('degrades object tag values safely to empty tags', () => {
    expect(normalizeNoteProperties({ tags: {} })).toBeUndefined();
    expect(listTags(hydrate({ tags: {} }))).toEqual([]);
  });

  it('degrades numeric tag values safely to empty tags', () => {
    expect(normalizeNoteProperties({ tags: 123 })).toBeUndefined();
    expect(listTags(hydrate({ tags: 123 }))).toEqual([]);
  });
});

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

  it('mergeNoteArrays keeps newer updatedAt per id', () => {
    const a: NoteBase = { id: '1', title: 'old', body: '', updatedAt: 100, folderId: null, deletedAt: null };
    const b: NoteBase = { id: '1', title: 'new', body: 'x', updatedAt: 200, folderId: null, deletedAt: null };
    expect(mergeNoteArrays([a], [b])[0].title).toBe('new');
  });

  it('mergeFolderArrays unions by id', () => {
    const merged = mergeFolderArrays(
      [{ id: 'f1', name: 'A', createdAt: 1 }],
      [{ id: 'f2', name: 'B', createdAt: 2 }],
    );
    expect(merged).toHaveLength(2);
  });

  it('noteSyncPayload includes starred for upsert', () => {
    const payload = noteSyncPayload({
      id: 'n1', title: 'T', body: 'B', updatedAt: 1, folderId: null, deletedAt: null, starred: true,
    });
    expect(payload.starred).toBe(true);
    expect(payload.folder_id).toBeNull();
  });

  it('noteSyncPayload includes properties when present', () => {
    const payload = noteSyncPayload({
      id: 'n1', title: 'T', body: 'B', updatedAt: 1, folderId: null, deletedAt: null,
      properties: { status: 'active' },
    });
    expect(payload.properties).toEqual({ status: 'active' });
  });
});

describe('mergeNotesFromStorageJson — multi-tab', () => {
  it('keeps newer updatedAt per note id from peer tab', () => {
    const local: NoteBase[] = [
      { id: '1', title: 'A', body: 'local-old', updatedAt: 100, folderId: null, deletedAt: null },
      { id: '2', title: 'B', body: 'only-local', updatedAt: 50, folderId: null, deletedAt: null },
    ];
    const peer = JSON.stringify([
      { id: '1', title: 'A', body: 'peer-new', updatedAt: 200, folderId: null, deletedAt: null },
    ]);
    const merged = mergeNotesFromStorageJson(local, peer);
    expect(merged.find(n => n.id === '1')?.body).toBe('peer-new');
    expect(merged.find(n => n.id === '2')?.body).toBe('only-local');
  });

  it('mergeFoldersFromStorageJson unions folders by id', () => {
    const local = [{ id: 'f1', name: 'A', createdAt: 1 }];
    const peer = JSON.stringify([{ id: 'f2', name: 'B', createdAt: 2 }]);
    const merged = mergeFoldersFromStorageJson(local, peer);
    expect(merged).toHaveLength(2);
  });
});

describe('saveNotes localStorage failure', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => { storage.set(k, v); },
      removeItem: (k: string) => { storage.delete(k); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns false when setItem throws QuotaExceededError', () => {
    vi.stubGlobal('localStorage', {
      setItem: (key: string) => {
        if (key === NOTES_KEY) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      },
    });

    expect(saveNotes([{ id: '1', title: 't', body: 'b', updatedAt: 1, folderId: null, deletedAt: null }])).toBe(false);
    expect(LOCAL_NOTES_SAVE_ERROR).toContain('storage');
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
