import type { NoteBase } from '../../../noteUtils';
import { addTag } from '../tags/noteTags';
import { setNoteKind } from './noteClassification';

export const READING_NOTE_TAG = 'reading';

export const READING_NOTE_TEMPLATE_BODY = `# Reading Notes

## Summary



## Key Ideas

- 

## Quotes

> 

## Questions

- 

## Connections

- [[Related note]]
`;

export interface BuildReadingNoteOptions {
  title?: string;
  /** Default: source classification */
  kind?: 'source' | 'literature' | null;
}

/** Create a reading note with standard sections and tags. */
export function buildReadingNote(note: NoteBase, options: BuildReadingNoteOptions = {}): NoteBase {
  let result: NoteBase = {
    ...note,
    title: options.title?.trim() || 'Reading Notes',
    body: READING_NOTE_TEMPLATE_BODY,
  };
  result = addTag(result, READING_NOTE_TAG);
  if (options.kind !== null) {
    result = setNoteKind(result, options.kind ?? 'source');
  }
  return result;
}
