import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  getNoteKind,
  setNoteKind,
  filterNotesByKind,
  noteKindWorkflowStep,
  NOTE_KIND_PROPERTY,
} from './noteClassification';

function note(id: string, props?: Record<string, string>): NoteBase {
  return { id, title: id, body: '', updatedAt: 1, folderId: null, deletedAt: null, properties: props };
}

describe('noteClassification', () => {
  it('reads and writes noteKind property', () => {
    const base = note('a');
    expect(getNoteKind(base)).toBeNull();
    const source = setNoteKind(base, 'source');
    expect(getNoteKind(source)).toBe('source');
    expect(source.properties?.[NOTE_KIND_PROPERTY]).toBe('source');
    const cleared = setNoteKind(source, null);
    expect(getNoteKind(cleared)).toBeNull();
  });

  it('filters notes by kind', () => {
    const notes = [
      setNoteKind(note('s'), 'source'),
      setNoteKind(note('l'), 'literature'),
      note('x'),
    ];
    expect(filterNotesByKind(notes, 'source')).toHaveLength(1);
    expect(filterNotesByKind(notes, 'literature')[0].id).toBe('l');
  });

  it('maps workflow steps', () => {
    expect(noteKindWorkflowStep('source')).toBe(0);
    expect(noteKindWorkflowStep('literature')).toBe(1);
    expect(noteKindWorkflowStep('permanent')).toBe(2);
    expect(noteKindWorkflowStep(null)).toBe(-1);
  });
});
