import { describe, it, expect, beforeEach } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { buildBacklinkIndex, getIncomingLinks, getPageReferences } from './backlinks';
import { KnowledgeIndexService } from './KnowledgeIndexService';

function note(
  id: string,
  title: string,
  body: string,
  deletedAt: number | null = null,
): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt };
}

describe('KnowledgeIndexService.buildFromNotes', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('builds incoming and outgoing indexes', () => {
    const notes = [
      note('a', 'Page A', 'See [[Page B]].'),
      note('b', 'Page B', 'Target.'),
    ];
    service.buildFromNotes(notes);

    expect(service.getIncoming('Page B', { excludeNoteId: 'b' })).toEqual([
      { noteId: 'a', noteTitle: 'Page A' },
    ]);
    expect(service.getOutgoing('a')).toEqual(['Page B']);
  });

  it('matches full rebuild from buildBacklinkIndex', () => {
    const notes = [
      note('a', 'Page A', '[[Page B]] and [[Ghost]].'),
      note('b', 'Page B', 'Back to [[Page A]].'),
      note('c', 'Deleted', '[[Page B]]', 100),
    ];
    service.buildFromNotes(notes);

    const fullIndex = buildBacklinkIndex(notes);
    expect(service.getIncoming('Page B', { excludeNoteId: 'b' })).toEqual(
      getIncomingLinks(fullIndex, 'Page B', { excludeNoteId: 'b' }),
    );
    expect(service.getPageReferences(notes[1], notes)).toEqual(
      getPageReferences(fullIndex, notes[1], notes),
    );
  });
});

describe('KnowledgeIndexService.updateNote', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Page A', 'Initial [[Page B]].'),
      note('b', 'Page B', ''),
    ]);
  });

  it('incrementally adds outgoing links without full rebuild', () => {
    service.updateNote(note('a', 'Page A', '[[Page B]] and [[Page C]].'));

    expect(service.getOutgoing('a')).toEqual(['Page B', 'Page C']);
    expect(service.getIncoming('Page C')).toHaveLength(1);
  });

  it('incrementally removes replaced outgoing links', () => {
    service.updateNote(note('a', 'Page A', 'Only [[Page C]] now.'));

    expect(service.getIncoming('Page B', { excludeNoteId: 'b' })).toHaveLength(0);
    expect(service.getIncoming('Page C')).toHaveLength(1);
  });

  it('updates source note title in incoming references', () => {
    service.updateNote(note('a', 'Renamed Page', '[[Page B]].'));

    const incoming = service.getIncoming('Page B', { excludeNoteId: 'b' });
    expect(incoming[0].noteTitle).toBe('Renamed Page');
  });

  it('deduplicates duplicate links on update', () => {
    service.updateNote(note('a', 'Page A', '[[Page B]] [[Page B]]'));

    expect(service.getIncoming('Page B', { excludeNoteId: 'b' })).toHaveLength(1);
    expect(service.getOutgoing('a')).toEqual(['Page B']);
  });
});

describe('KnowledgeIndexService.removeNote', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Page A', '[[Page B]].'),
      note('b', 'Page B', ''),
      note('c', 'Page C', 'Also [[Page B]].'),
    ]);
  });

  it('removes deleted source from incoming index', () => {
    service.removeNote('a');

    expect(service.getIncoming('Page B', { excludeNoteId: 'b' })).toEqual([
      { noteId: 'c', noteTitle: 'Page C' },
    ]);
    expect(service.getOutgoing('a')).toEqual([]);
  });

  it('preserves incoming links to trashed page title (broken link policy)', () => {
    service.removeNote('b');

    // Other pages still link to [[Page B]] in body — index tracks link text, not target id
    expect(service.getIncoming('Page B', { excludeNoteId: 'b' }).map(r => r.noteId)).toEqual(['a', 'c']);
    expect(service.getOutgoing('b')).toEqual([]);
  });
});

describe('KnowledgeIndexService — rename policy (no auto-rewrite)', () => {
  it('old title links do not appear on renamed page', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('a', 'Page A', '[[Old Name]].'),
      note('b', 'Old Name', ''),
    ]);

    service.updateNote(note('b', 'New Name', ''));

    expect(service.getIncoming('New Name', { excludeNoteId: 'b' })).toHaveLength(0);
    expect(service.getIncoming('Old Name')).toHaveLength(1);
  });
});

describe('KnowledgeIndexService — delete policy (broken link)', () => {
  it('trashing source removes it from index but keeps target title keys', () => {
    const service = new KnowledgeIndexService();
    const pageA = note('a', 'Page A', '[[Page B]].');
    const pageB = note('b', 'Page B', '');
    service.buildFromNotes([pageA, pageB]);

    service.updateNote({ ...pageA, deletedAt: 1000 });

    expect(service.getIncoming('Page B')).toHaveLength(0);
    expect(service.getOutgoing('a')).toEqual([]);
  });
});

describe('KnowledgeIndexService — incremental parity', () => {
  it('sequential updates match single buildFromNotes', () => {
    const incremental = new KnowledgeIndexService();
    const notes = [
      note('1', 'One', '[[Two]]'),
      note('2', 'Two', '[[Three]]'),
      note('3', 'Three', ''),
    ];

    incremental.updateNote(notes[0]);
    incremental.updateNote(notes[1]);
    incremental.updateNote(notes[2]);

    const bulk = new KnowledgeIndexService();
    bulk.buildFromNotes(notes);

    for (const n of notes) {
      expect(incremental.getOutgoing(n.id)).toEqual(bulk.getOutgoing(n.id));
      expect(incremental.getPageReferences(n, notes)).toEqual(
        bulk.getPageReferences(n, notes),
      );
    }
  });
});

describe('KnowledgeIndexService — navigation', () => {
  it('resolveBacklinkNavigation returns source note id', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([note('src', 'Source', '[[Target]]'), note('tgt', 'Target', '')]);

    const incoming = service.getIncoming('Target', { excludeNoteId: 'tgt' });
    expect(service.resolveBacklinkNavigation(incoming[0])).toBe('src');
  });
});
