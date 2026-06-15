import type { NoteBase } from '../components/views/noteUtils';

/** Fields that describe organization/metadata — not note body content. */
const METADATA_PATCH_KEYS = new Set([
  'properties',
  'starred',
  'relations',
  'folderId',
]);

export type NoteContentPatch = Partial<
  Pick<NoteBase, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>
>;

/** True when patch only touches metadata fields (tags, classification, weak, favorite, relations, folder). */
export function isMetadataOnlyPatch(patch: NoteContentPatch): boolean {
  const keys = Object.keys(patch) as (keyof NoteContentPatch)[];
  if (keys.length === 0) return false;
  return keys.every(k => METADATA_PATCH_KEYS.has(k));
}

/** Content edits and mixed patches should advance updatedAt. */
export function shouldBumpContentUpdatedAt(patch: NoteContentPatch): boolean {
  return !isMetadataOnlyPatch(patch);
}

export function mergeNotePatch(
  note: NoteBase,
  patch: NoteContentPatch,
  now = Date.now(),
): NoteBase {
  const merged = { ...note, ...patch };
  if (shouldBumpContentUpdatedAt(patch)) {
    return { ...merged, updatedAt: now };
  }
  return { ...merged, updatedAt: note.updatedAt };
}
