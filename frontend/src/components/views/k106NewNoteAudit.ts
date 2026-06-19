/** K-106 — New Note always accessible audit. */
export const K106_NEW_NOTE_HOOKS = [
  'data-k106-new-note-btn',
  'data-noteview-new-note-btn',
] as const;

export function auditNewNoteAccess(): readonly string[] {
  return K106_NEW_NOTE_HOOKS;
}

export function formatK106NewNoteReport(hooks: readonly string[]): string {
  return ['K-106 new note audit', '', ...hooks.map(h => `  ${h}`)].join('\n');
}
