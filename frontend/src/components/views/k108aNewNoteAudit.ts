/** K-108A — New Note deduplication (sidebar + mobile toolbar only). */
export const K108A_NEW_NOTE_HOOKS = [
  'data-noteview-new-note-btn',
] as const;

/** Removed from editor title row in K-108A. */
export const K108A_NEW_NOTE_REMOVED_HOOKS = [
  'data-k106-new-note-btn',
] as const;

export function auditNewNotePlacement(): readonly string[] {
  return K108A_NEW_NOTE_HOOKS;
}

export function formatK108aNewNoteReport(hooks: readonly string[]): string {
  return [
    'K-108A new note audit',
    '',
    'Active hooks (sidebar / mobile list chrome):',
    ...hooks.map(h => `  ${h}`),
    '',
    'Removed from editor header:',
    ...K108A_NEW_NOTE_REMOVED_HOOKS.map(h => `  ${h}`),
  ].join('\n');
}
