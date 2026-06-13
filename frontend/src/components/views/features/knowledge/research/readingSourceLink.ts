import type { NoteBase } from '../../../noteUtils';
import {
  addRelationTarget,
  getRelationTargets,
  removeRelationTarget,
  setRelationTargets,
} from '../relations/noteRelations';
import { hasTag } from '../tags/noteTags';
import { getNoteKind } from './noteClassification';
import { READING_NOTE_TAG } from './readingNoteTemplate';

/** Reading note → source note relation key. */
export const READING_SOURCE_RELATION = 'source';

/** Source note → reading notes relation key (reverse navigation). */
export const SOURCE_READING_NOTES_RELATION = 'readingNotes';

export function isReadingNote(note: NoteBase): boolean {
  return hasTag(note, READING_NOTE_TAG)
    || (note.title ?? '').toLowerCase().includes('reading');
}

export function isSourceNote(note: NoteBase): boolean {
  return getNoteKind(note) === 'source';
}

export function getLinkedSourceNoteId(note: NoteBase): string | null {
  return getRelationTargets(note, READING_SOURCE_RELATION)[0] ?? null;
}

export function getLinkedReadingNoteIds(note: NoteBase): string[] {
  return getRelationTargets(note, SOURCE_READING_NOTES_RELATION);
}

export interface LinkReadingSourceResult {
  reading: NoteBase;
  source: NoteBase;
}

/** Bidirectional link between a reading note and a source note. */
export function linkReadingNoteToSource(
  readingNote: NoteBase,
  sourceNote: NoteBase,
): LinkReadingSourceResult {
  const reading = setRelationTargets(readingNote, READING_SOURCE_RELATION, [sourceNote.id]);
  const source = addRelationTarget(sourceNote, SOURCE_READING_NOTES_RELATION, readingNote.id);
  return { reading, source };
}

export function unlinkReadingNoteFromSource(
  readingNote: NoteBase,
  sourceNote: NoteBase,
): LinkReadingSourceResult {
  const reading = setRelationTargets(readingNote, READING_SOURCE_RELATION, []);
  const source = removeRelationTarget(sourceNote, SOURCE_READING_NOTES_RELATION, readingNote.id);
  return { reading, source };
}
