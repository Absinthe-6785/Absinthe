// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { filterNotes } from '../query/filterNotes';
import { evaluateRuleCollection } from './evaluateRuleCollection';
import { filterByRuleCollection } from './filterByRuleCollection';
import {
  activateRuleCollection,
  createRuleCollection,
  deleteRuleCollection,
  findRuleCollection,
  isValidRuleCollectionQuery,
  normalizeRuleCollections,
  renameRuleCollection,
} from './ruleCollections';
import { loadRuleCollections, saveRuleCollections, RULE_COLLECTIONS_KEY } from './ruleCollectionsStorage';

function note(
  id: string,
  title: string,
  body: string,
  extras: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title,
    body,
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...extras,
  };
}

describe('isValidRuleCollectionQuery', () => {
  it('accepts valid knowledge queries', () => {
    expect(isValidRuleCollectionQuery('tag:japanese')).toBe(true);
    expect(isValidRuleCollectionQuery('tag:japanese status:active')).toBe(true);
  });

  it('rejects plain text and invalid syntax', () => {
    expect(isValidRuleCollectionQuery('hello')).toBe(false);
    expect(isValidRuleCollectionQuery('tag:japanese invalid')).toBe(false);
  });
});

describe('normalizeRuleCollections', () => {
  it('filters invalid entries and sorts by name', () => {
    const collections = normalizeRuleCollections([
      { id: '2', name: 'Beta', query: 'status:active' },
      { id: '1', name: 'Alpha', query: 'tag:japanese' },
      { id: 'bad', name: '', query: 'tag:x' },
      { id: 'bad2', name: 'Bad', query: 'not valid' },
      'invalid',
    ]);

    expect(collections).toEqual([
      { id: '1', name: 'Alpha', query: 'tag:japanese' },
      { id: '2', name: 'Beta', query: 'status:active' },
    ]);
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeRuleCollections(null)).toEqual([]);
  });
});

describe('rule collection CRUD', () => {
  const seed = [{ id: 'a', name: 'Japanese Study', query: 'tag:japanese' }];

  it('creates a collection with name and rule', () => {
    const next = createRuleCollection(seed, 'Active Projects', 'status:active');
    expect(next).toHaveLength(2);
    expect(findRuleCollection(next, next.find(c => c.name === 'Active Projects')!.id)).toMatchObject({
      name: 'Active Projects',
      query: 'status:active',
    });
  });

  it('rejects invalid queries on create', () => {
    expect(createRuleCollection(seed, 'Bad', 'hello')).toEqual(seed);
  });

  it('renames a collection', () => {
    const next = renameRuleCollection(seed, 'a', 'JLPT N1');
    expect(findRuleCollection(next, 'a')?.name).toBe('JLPT N1');
    expect(findRuleCollection(next, 'a')?.query).toBe('tag:japanese');
  });

  it('deletes a collection', () => {
    expect(deleteRuleCollection(seed, 'a')).toEqual([]);
  });

  it('activates by returning collection id', () => {
    expect(activateRuleCollection(seed[0])).toBe('a');
  });
});

describe('ruleCollectionsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and loads collections', () => {
    const collections = [{ id: '1', name: 'Japanese Study', query: 'tag:japanese status:active' }];
    saveRuleCollections(collections);
    expect(loadRuleCollections()).toEqual(collections);
  });

  it('returns empty list when storage is missing', () => {
    expect(loadRuleCollections()).toEqual([]);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(RULE_COLLECTIONS_KEY, '{not json');
    expect(loadRuleCollections()).toEqual([]);
  });

  it('round-trips through JSON serialization', () => {
    saveRuleCollections([
      { id: '1', name: 'Textbooks', query: 'tag:textbook' },
      { id: '2', name: 'High Priority', query: 'priority:high' },
    ]);
    const raw = localStorage.getItem(RULE_COLLECTIONS_KEY);
    expect(JSON.parse(raw!)).toHaveLength(2);
    expect(loadRuleCollections().map(c => c.name).sort()).toEqual(['High Priority', 'Textbooks']);
  });
});

describe('evaluateRuleCollection and filterByRuleCollection', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Japanese Grammar', '', { properties: { tags: 'japanese', status: 'active' } }),
      note('b', 'Japanese Vocab', '', { properties: { tags: 'japanese', status: 'draft' } }),
      note('c', 'English Notes', '', { properties: { tags: 'english', status: 'active' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('evaluates collection rules through filterNotes', () => {
    const collection = { id: '1', name: 'Japanese Study', query: 'tag:japanese status:active' };
    expect(evaluateRuleCollection(collection, service, notes).sort()).toEqual(['a']);
  });

  it('routes collection rules through parseQuery and evaluateQuery', () => {
    const collection = { id: '1', name: 'Japanese Study', query: 'tag:japanese status:active' };
    const direct = filterNotes(notes.filter(n => !n.deletedAt), service, collection.query);
    const viaCollection = filterByRuleCollection(notes.filter(n => !n.deletedAt), service, collection);

    expect(viaCollection.notes.map(n => n.id)).toEqual(direct.notes.map(n => n.id));
    expect(viaCollection.usedKnowledgeQuery).toBe(true);
    expect(viaCollection.matchedIds).toEqual(direct.matchedIds);
  });

  it('updates dynamically when indexed metadata changes', () => {
    const collection = { id: '1', name: 'Active Japanese', query: 'tag:japanese status:active' };

    expect(evaluateRuleCollection(collection, service, notes)).toEqual(['a']);

    service.updateNote(note('b', 'Japanese Vocab', '', { properties: { tags: 'japanese', status: 'active' } }));

    expect(evaluateRuleCollection(collection, service, notes).sort()).toEqual(['a', 'b']);
  });

  it('filters folder-scoped notes by collection rule', () => {
    notes[0] = { ...notes[0], folderId: 'f1' };
    notes[1] = { ...notes[1], folderId: 'f2' };
    service.buildFromNotes(notes);

    const collection = { id: '1', name: 'Japanese', query: 'tag:japanese' };
    const folderNotes = notes.filter(n => n.folderId === 'f1' && !n.deletedAt);
    const { notes: filtered } = filterByRuleCollection(folderNotes, service, collection);

    expect(filtered.map(n => n.id)).toEqual(['a']);
  });
});

describe('activation stability', () => {
  it('returns stable results across repeated evaluation', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'One', '', { properties: { tags: 'work' } }),
      note('b', 'Two', '', { properties: { tags: 'work', status: 'active' } }),
    ];
    service.buildFromNotes(notes);

    const collection = { id: '1', name: 'Work', query: 'tag:work status:active' };
    const run = () => evaluateRuleCollection(collection, service, notes);
    expect(run()).toEqual(run());
  });

  it('does not scan note bodies or rebuild indexes on evaluation', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Alpha', 'body text', { properties: { tags: 'alpha' } }),
    ]);

    const buildSpy = vi.spyOn(service, 'buildFromNotes');
    const collection = { id: '1', name: 'Alpha', query: 'tag:alpha' };
    evaluateRuleCollection(collection, service, service.getAllNoteIds().map(id => note(id, service.getNoteTitle(id), '')));

    expect(buildSpy).not.toHaveBeenCalled();
  });
});

describe('backward compatibility', () => {
  it('migrates legacy objects without throwing', () => {
    expect(normalizeRuleCollections(undefined)).toEqual([]);
    expect(normalizeRuleCollections([{ id: 'x', name: 'Legacy', query: 'tag:legacy' }])).toHaveLength(1);
  });

  it('uses a separate storage key from saved views', () => {
    expect(RULE_COLLECTIONS_KEY).not.toBe('note-saved-views-v1');
  });
});

describe('query integration', () => {
  it('keeps collection query strings compatible with parseQuery', async () => {
    const { parseQuery } = await import('../query/parseQuery');
    const collection = createRuleCollection([], 'Japanese Study', 'tag:japanese status:active')[0];
    const parsed = parseQuery(collection.query);
    expect(parsed.error).toBeUndefined();
    expect(parsed.clauses).toHaveLength(2);
  });
});
