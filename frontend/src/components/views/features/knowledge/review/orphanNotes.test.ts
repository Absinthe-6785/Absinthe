import { describe, it, expect } from 'vitest';
import { buildOrphanNotes, isOrphanNote } from './orphanNotes';
import { buildBacklinkIndex } from '../backlinks';
import type { NoteBase } from '../../../noteUtils';

function note(id: string, title: string, body: string, properties?: Record<string, string>): NoteBase {
  return { id, title, body, updatedAt: 1, folderId: null, deletedAt: null, properties };
}

describe('orphanNotes', () => {
  const notes = [
    note('orphan', 'Orphan', 'plain text'),
    note('out', 'Outbound', '[[Target]]'),
    note('target', 'Target', 'referenced only'),
    note('tagged', 'Tagged', 'hello', { tags: 'study' }),
  ];

  it('detects notes without links or tags', () => {
    const index = buildBacklinkIndex(notes);
    expect(isOrphanNote(notes[0], index)).toBe(true);
    expect(isOrphanNote(notes[1], index)).toBe(false);
    expect(isOrphanNote(notes[2], index)).toBe(false);
    expect(isOrphanNote(notes[3], index)).toBe(false);
  });

  it('buildOrphanNotes returns orphan entries', () => {
    const orphans = buildOrphanNotes(notes);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].noteId).toBe('orphan');
  });
});
