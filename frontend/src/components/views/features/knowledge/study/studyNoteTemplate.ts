import type { NoteBase } from '../../../noteUtils';
import { addTag, hasTag } from '../tags/noteTags';

export const STUDY_NOTE_TAG = 'study';
export const REVIEW_NOTE_TAG = 'review';
export const EXAM_PREP_TAG = 'exam-prep';

export const STUDY_NOTE_TEMPLATE_BODY = `# Study Notes

## Topic



## Summary



## Key Concepts

- 

## Questions

\`\`\`question
Q: 
\`\`\`

\`\`\`answer
hidden

\`\`\`

## Common Mistakes

- 

## Review Notes

- 
`;

export interface BuildStudyNoteOptions {
  title?: string;
}

/** Create a structured study note with default sections and #study tag. */
export function buildStudyNote(note: NoteBase, options: BuildStudyNoteOptions = {}): NoteBase {
  let result: NoteBase = {
    ...note,
    title: options.title?.trim() || 'Study Notes',
    body: STUDY_NOTE_TEMPLATE_BODY,
  };
  result = addTag(result, STUDY_NOTE_TAG);
  return result;
}

export function isStudyNote(note: NoteBase): boolean {
  return hasTag(note, STUDY_NOTE_TAG)
    || (note.title ?? '').toLowerCase().includes('study');
}
