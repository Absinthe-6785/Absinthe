/** Display-only placeholder for notes without a user title. Internal storage unchanged. */
export const UNTITLED_NOTE_LABEL = '제목 없음';

const LEGACY_UNTITLED = 'Untitled';

export function displayNoteTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  if (!trimmed || trimmed === LEGACY_UNTITLED) return UNTITLED_NOTE_LABEL;
  return trimmed;
}
