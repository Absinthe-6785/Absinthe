import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setNoteKind } from './noteClassification';
import {
  getLinkedReadingNoteIds,
  getLinkedSourceNoteId,
  linkReadingNoteToSource,
  unlinkReadingNoteFromSource,
} from './readingSourceLink';
import { buildReadingNote } from './readingNoteTemplate';

function note(id: string, title: string): NoteBase {
  return { id, title, body: '', updatedAt: 1, folderId: null, deletedAt: null };
}

describe('readingSourceLink', () => {
  it('links reading note to source bidirectionally', () => {
    const reading = buildReadingNote(note('r', 'Reading'));
    const source = setNoteKind(note('s', 'Paper'), 'source');
    const { reading: linkedReading, source: linkedSource } = linkReadingNoteToSource(reading, source);
    expect(getLinkedSourceNoteId(linkedReading)).toBe('s');
    expect(getLinkedReadingNoteIds(linkedSource)).toEqual(['r']);
  });

  it('unlinks reading from source', () => {
    const reading = buildReadingNote(note('r', 'Reading'));
    const source = setNoteKind(note('s', 'Paper'), 'source');
    const linked = linkReadingNoteToSource(reading, source);
    const unlinked = unlinkReadingNoteFromSource(linked.reading, linked.source);
    expect(getLinkedSourceNoteId(unlinked.reading)).toBeNull();
    expect(getLinkedReadingNoteIds(unlinked.source)).toEqual([]);
  });
});
