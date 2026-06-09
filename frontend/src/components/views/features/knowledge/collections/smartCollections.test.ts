import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { evaluateSmartCollection } from './evaluateSmartCollection';
import { filterBySmartCollection } from './filterBySmartCollection';
import { activateSmartCollection, findSmartCollection, SMART_COLLECTIONS } from './smartCollections';
import { filterNotes } from '../query/filterNotes';

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

describe('smart collection catalog', () => {
  it('defines six phase-1 collections', () => {
    expect(SMART_COLLECTIONS).toHaveLength(6);
    expect(findSmartCollection('orphan')?.name).toBe('Orphan Notes');
  });

  it('activates by returning collection id', () => {
    const collection = SMART_COLLECTIONS[0];
    expect(activateSmartCollection(collection)).toBe(collection.id);
  });
});

describe('KnowledgeIndexService smart collection helpers', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('detects orphan notes with no backlinks or mentions', () => {
    service.buildFromNotes([
      note('a', 'Orphan', 'Standalone note.'),
      note('b', 'Linked', 'See [[Target]].'),
      note('c', 'Target', ''),
      note('d', 'Mentioned', 'Talks about Target in plain text.'),
    ]);

    expect(service.getOrphanNoteIds().sort()).toEqual(['a']);
  });

  it('detects untagged notes', () => {
    service.buildFromNotes([
      note('a', 'Tagged', '', { properties: { tags: 'alpha' } }),
      note('b', 'Untagged', ''),
    ]);

    expect(service.getUntaggedNoteIds()).toEqual(['b']);
  });

  it('detects notes with backlinks', () => {
    service.buildFromNotes([
      note('a', 'Source', '[[Target]].'),
      note('b', 'Target', ''),
      note('c', 'Alone', ''),
    ]);

    expect(service.getNoteIdsWithBacklinks().sort()).toEqual(['a', 'b']);
  });

  it('detects notes with mentions', () => {
    service.buildFromNotes([
      note('a', 'Alpha', 'Alpha mentions Beta in prose.'),
      note('b', 'Beta', ''),
      note('c', 'Gamma', 'No mentions here.'),
    ]);

    expect(service.getNoteIdsWithMentions().sort()).toEqual(['a', 'b']);
  });

  it('ranks highly connected notes by relationship score', () => {
    service.buildFromNotes([
      note('a', 'Hub', '[[B]] [[C]] and mentions Beta.'),
      note('b', 'Beta', 'Back to [[Hub]].'),
      note('c', 'Leaf', ''),
      note('d', 'Isolated', ''),
    ]);

    const connected = service.getHighlyConnectedNoteIds();
    expect(connected[0]).toBe('a');
    expect(connected).toContain('b');
    expect(connected).not.toContain('d');
  });
});

describe('evaluateSmartCollection', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Recent', '', { updatedAt: 300 }),
      note('b', 'Older', '[[Recent]].', { updatedAt: 100 }),
      note('c', 'Untagged', '', { updatedAt: 200 }),
      note('d', 'Tagged', '', { updatedAt: 50, properties: { tags: 'work' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('returns recent notes ordered by updatedAt desc', () => {
    expect(evaluateSmartCollection('recent', service, notes)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('returns stable orphan results from indexes', () => {
    const first = evaluateSmartCollection('orphan', service, notes);
    const second = evaluateSmartCollection('orphan', service, notes);
    expect(first).toEqual(second);
    expect(first).toContain('c');
    expect(first).toContain('d');
    expect(first).not.toContain('b');
  });

  it('returns untagged notes', () => {
    expect(evaluateSmartCollection('untagged', service, notes).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('filterBySmartCollection integration', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Alpha', '', { updatedAt: 300, folderId: 'f1' }),
      note('b', 'Beta', '[[Alpha]].', { updatedAt: 200, folderId: 'f1' }),
      note('c', 'Gamma', '', { updatedAt: 100, folderId: 'f2', properties: { tags: 'x' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('filters folder-scoped notes by collection membership', () => {
    const folderNotes = notes.filter(n => n.folderId === 'f1' && !n.deletedAt);
    const { notes: filtered } = filterBySmartCollection(
      folderNotes,
      service,
      'with-backlinks',
      notes,
    );

    expect(filtered.map(n => n.id).sort()).toEqual(['a', 'b']);
  });

  it('preserves recent ordering within filtered results', () => {
    const folderNotes = notes.filter(n => n.folderId === 'f1' && !n.deletedAt);
    const { notes: filtered } = filterBySmartCollection(
      folderNotes,
      service,
      'recent',
      notes,
    );

    expect(filtered.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('combines with query filtering without a second filter system', () => {
    const { notes: collectionNotes } = filterBySmartCollection(
      notes.filter(n => !n.deletedAt),
      service,
      'untagged',
      notes,
    );
    const queryResult = filterNotes(collectionNotes, service, 'tag:x');

    expect(queryResult.notes).toEqual([]);
    expect(queryResult.usedKnowledgeQuery).toBe(true);
  });

  it('returns stable results across repeated activation', () => {
    const run = () => filterBySmartCollection(
      notes.filter(n => !n.deletedAt),
      service,
      'highly-connected',
      notes,
    ).notes.map(n => n.id);

    expect(run()).toEqual(run());
  });
});
