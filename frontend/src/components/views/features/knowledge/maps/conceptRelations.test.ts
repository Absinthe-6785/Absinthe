import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { addRelationTarget } from '../relations/noteRelations';
import { setNoteKind } from '../research/noteClassification';
import {
  countConceptRelationsByType,
  filterConceptNotes,
  listConceptRelations,
  normalizeConceptRelationType,
} from './conceptRelations';

function note(id: string, title = id): NoteBase {
  return { id, title, body: '', updatedAt: 1, folderId: null, deletedAt: null };
}

describe('conceptRelations', () => {
  it('lists and counts typed concept relations', () => {
    let n = note('a');
    n = addRelationTarget(n, 'causes', 'b');
    n = addRelationTarget(n, 'related-to', 'c');
    expect(listConceptRelations(n)).toHaveLength(2);
    expect(countConceptRelationsByType(n).causes).toBe(1);
    expect(countConceptRelationsByType(n)['related-to']).toBe(1);
  });

  it('normalizes relation keys', () => {
    expect(normalizeConceptRelationType('Depends-On')).toBe('depends-on');
    expect(normalizeConceptRelationType('course')).toBeNull();
  });

  it('filters concept notes by noteKind', () => {
    const notes = [
      setNoteKind(note('c1'), 'concept'),
      setNoteKind(note('s1'), 'source'),
      note('x'),
    ];
    expect(filterConceptNotes(notes).map(n => n.id)).toEqual(['c1']);
  });
});
