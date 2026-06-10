import type { NoteBase } from '../../../noteUtils';
import { addTag } from '../tags/noteTags';
import { getCaptureTypeTag, INBOX_TAG, type QuickCaptureType } from './quickCaptureModels';

export { INBOX_TAG };

/** Apply inbox convention (tag:inbox) and optional capture type tag to a note */
export function createInboxNote(
  note: NoteBase,
  options: { captureType?: QuickCaptureType } = {},
): NoteBase {
  let result = addTag(note, INBOX_TAG);
  const typeTag = options.captureType ? getCaptureTypeTag(options.captureType) : undefined;
  if (typeTag) {
    result = addTag(result, typeTag);
  }
  return result;
}

export function buildQuickCaptureTitle(title: string): string {
  return title.trim();
}
