import type { NoteBase } from '../../../noteUtils';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import { hasTag, addTag, removeTag } from '../tags/noteTags';

export const WEAK_TOPIC_PROPERTY = 'weakTopic';
export const WEAK_TOPIC_TAG = 'weak-topic';

export function isWeakTopic(note: NoteBase): boolean {
  const prop = getProperty(note, WEAK_TOPIC_PROPERTY)?.trim().toLowerCase();
  if (prop === 'true' || prop === 'yes' || prop === '1') return true;
  return hasTag(note, WEAK_TOPIC_TAG);
}

export function setWeakTopic(note: NoteBase, weak: boolean): NoteBase {
  if (!weak) {
    let result = removeProperty(note, WEAK_TOPIC_PROPERTY);
    result = removeTag(result, WEAK_TOPIC_TAG);
    return result;
  }
  let result = setProperty(note, WEAK_TOPIC_PROPERTY, 'yes');
  result = addTag(result, WEAK_TOPIC_TAG);
  return result;
}

export function filterWeakTopicNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes.filter(n => !n.deletedAt && isWeakTopic(n));
}

/** K-85: align weakTopic property and weak-topic tag after load/migration. */
export function reconcileWeakTopicNote(note: NoteBase): NoteBase {
  return setWeakTopic(note, isWeakTopic(note));
}
