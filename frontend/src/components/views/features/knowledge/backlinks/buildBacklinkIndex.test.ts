import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  buildBacklinkIndex,
  getBacklinkCount,
  getIncomingLinks,
  getOutgoingLinks,
  getPageReferences,
  resolveBacklinkNavigation,
} from './buildBacklinkIndex';

function note(
  id: string,
  title: string,
  body: string,
  deletedAt: number | null = null,
): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt };
}

describe('buildBacklinkIndex', () => {
  it('builds reverse lookup for wiki links', () => {
    const notes = [
      note('a', 'Page A', 'See [[Page B]] for details.'),
      note('b', 'Page B', 'Target page content.'),
    ];
    const index = buildBacklinkIndex(notes);

    const incoming = getIncomingLinks(index, 'Page B', { excludeNoteId: 'b' });
    expect(incoming).toEqual([{ noteId: 'a', noteTitle: 'Page A' }]);
    expect(getBacklinkCount(index, 'Page B', 'b')).toBe(1);
  });

  it('matches titles case-insensitively', () => {
    const notes = [
      note('a', 'Page A', 'Link to [[page b]] here.'),
      note('b', 'Page B', ''),
    ];
    const index = buildBacklinkIndex(notes);

    expect(getIncomingLinks(index, 'PAGE B', { excludeNoteId: 'b' })).toHaveLength(1);
    expect(getIncomingLinks(index, 'page b', { excludeNoteId: 'b' })[0].noteTitle).toBe('Page A');
  });

  it('deduplicates duplicate links from the same source', () => {
    const notes = [
      note('a', 'Page A', '[[Page B]] and again [[Page B]].'),
      note('b', 'Page B', ''),
    ];
    const index = buildBacklinkIndex(notes);

    expect(getIncomingLinks(index, 'Page B', { excludeNoteId: 'b' })).toHaveLength(1);
    expect(getOutgoingLinks(index, 'a')).toEqual(['Page B']);
  });

  it('skips deleted source pages', () => {
    const notes = [
      note('a', 'Page A', '[[Page B]]', 1000),
      note('b', 'Page B', ''),
      note('c', 'Page C', 'Also [[Page B]].'),
    ];
    const index = buildBacklinkIndex(notes);

    const incoming = getIncomingLinks(index, 'Page B', { excludeNoteId: 'b' });
    expect(incoming.map(r => r.noteId)).toEqual(['c']);
  });

  it('tracks outgoing links per note', () => {
    const notes = [
      note('a', 'Page A', 'Links to [[Page B]] and [[Missing]].'),
      note('b', 'Page B', ''),
    ];
    const index = buildBacklinkIndex(notes);

    expect(getOutgoingLinks(index, 'a')).toEqual(['Page B', 'Missing']);
  });
});

describe('getPageReferences', () => {
  it('returns incoming and outgoing references for a page', () => {
    const notes = [
      note('a', 'Page A', 'See [[Page B]].'),
      note('b', 'Page B', 'Back to [[Page A]] and [[Ghost]].'),
    ];
    const index = buildBacklinkIndex(notes);
    const refs = getPageReferences(index, notes[1], notes);

    expect(refs.incoming.map(r => r.noteTitle)).toEqual(['Page A']);
    expect(refs.outgoing).toEqual([
      { title: 'Page A', targetNoteId: 'a' },
      { title: 'Ghost' },
    ]);
  });

  it('excludes self from incoming links', () => {
    const notes = [note('a', 'Page A', 'Self [[Page A]] link.')];
    const index = buildBacklinkIndex(notes);
    const refs = getPageReferences(index, notes[0], notes);

    expect(refs.incoming).toEqual([]);
  });
});

describe('rename scenarios', () => {
  it('links to old title do not appear after target rename', () => {
    const notes = [
      note('a', 'Page A', 'Still points at [[Old Name]].'),
      note('b', 'New Name', 'Renamed page.'),
    ];
    const index = buildBacklinkIndex(notes);

    expect(getIncomingLinks(index, 'New Name', { excludeNoteId: 'b' })).toHaveLength(0);
    expect(getIncomingLinks(index, 'Old Name')).toHaveLength(1);
  });
});

describe('navigation behavior', () => {
  it('resolveBacklinkNavigation returns source note id', () => {
    const ref = { noteId: 'source-1', noteTitle: 'Referrer' };
    expect(resolveBacklinkNavigation(ref)).toBe('source-1');
  });

  it('incoming references carry note ids for navigation', () => {
    const notes = [
      note('referrer', 'Referrer Page', '[[Target]]'),
      note('target', 'Target', ''),
    ];
    const index = buildBacklinkIndex(notes);
    const incoming = getIncomingLinks(index, 'Target', { excludeNoteId: 'target' });

    expect(incoming[0].noteId).toBe('referrer');
    expect(resolveBacklinkNavigation(incoming[0])).toBe('referrer');
  });
});

describe('deleted pages', () => {
  it('does not index outgoing links from deleted notes', () => {
    const notes = [
      note('deleted', 'Deleted Page', '[[Target]]', 999),
      note('target', 'Target', ''),
    ];
    const index = buildBacklinkIndex(notes);

    expect(getIncomingLinks(index, 'Target', { excludeNoteId: 'target' })).toHaveLength(0);
    expect(getOutgoingLinks(index, 'deleted')).toEqual([]);
  });
});
