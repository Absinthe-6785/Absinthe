import type { NoteBase } from '../../../noteUtils';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import {
  dedupeTags,
  normalizeTagName,
  TAGS_PROPERTY_KEY,
  tagsFromPropertyValue,
  tagsToPropertyValue,
} from './tagConstants';

export {
  dedupeTags,
  isTagsPropertyKey,
  normalizeTagName,
  TAGS_PROPERTY_KEY,
  tagsFromPropertyValue,
  tagsToPropertyValue,
} from './tagConstants';

/** List tags on a note, preserving display casing */
export function listTags(note: NoteBase): string[] {
  return tagsFromPropertyValue(getProperty(note, TAGS_PROPERTY_KEY));
}

/** Check if note has a tag (case-insensitive) */
export function hasTag(note: NoteBase, tag: string): boolean {
  const key = normalizeTagName(tag);
  return listTags(note).some(t => normalizeTagName(t) === key);
}

/** Add a tag — no duplicates (case-insensitive) */
export function addTag(note: NoteBase, tag: string): NoteBase {
  const trimmed = tag.trim();
  if (!trimmed) return note;

  const existing = listTags(note);
  if (existing.some(t => normalizeTagName(t) === normalizeTagName(trimmed))) {
    return note;
  }

  return setProperty(note, TAGS_PROPERTY_KEY, tagsToPropertyValue([...existing, trimmed]));
}

/** Remove a tag (case-insensitive) */
export function removeTag(note: NoteBase, tag: string): NoteBase {
  const key = normalizeTagName(tag);
  const next = listTags(note).filter(t => normalizeTagName(t) !== key);
  if (next.length === 0) return removeProperty(note, TAGS_PROPERTY_KEY);
  return setProperty(note, TAGS_PROPERTY_KEY, tagsToPropertyValue(next));
}

/** Rename a tag on a page (case-insensitive match for old name) */
export function renameTag(note: NoteBase, oldTag: string, newTag: string): NoteBase {
  const trimmedNew = newTag.trim();
  if (!trimmedNew) return removeTag(note, oldTag);

  const oldKey = normalizeTagName(oldTag);
  const newKey = normalizeTagName(trimmedNew);
  const withoutOld = listTags(note).filter(t => normalizeTagName(t) !== oldKey);

  if (withoutOld.some(t => normalizeTagName(t) === newKey)) {
    return setProperty(note, TAGS_PROPERTY_KEY, tagsToPropertyValue(withoutOld));
  }

  const renamed = [...withoutOld, trimmedNew];
  return setProperty(note, TAGS_PROPERTY_KEY, tagsToPropertyValue(renamed));
}

/** Replace entire tag list */
export function setTags(note: NoteBase, tags: readonly string[]): NoteBase {
  const deduped = dedupeTags(tags);
  if (deduped.length === 0) return removeProperty(note, TAGS_PROPERTY_KEY);
  return setProperty(note, TAGS_PROPERTY_KEY, tagsToPropertyValue(deduped));
}

/** Whether a note matches a tag search query via page tags */
export function noteMatchesPageTag(note: NoteBase, tagQuery: string): boolean {
  const q = normalizeTagName(tagQuery);
  if (!q) return true;
  return listTags(note).some(t => normalizeTagName(t).includes(q));
}
