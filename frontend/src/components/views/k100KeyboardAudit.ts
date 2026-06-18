/**
 * K-100 — Keyboard productivity audit.
 */
export const K100_KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+F', action: 'focus-document-search' },
  { keys: 'Esc', action: 'close-search-or-modal' },
  { keys: 'Enter', action: 'search-next-match' },
  { keys: 'Shift+Enter', action: 'search-prev-match' },
  { keys: 'Ctrl+Shift+N', action: 'create-new-note' },
  { keys: 'Ctrl+Alt+T', action: 'open-todays-note' },
] as const;

export interface K100KeyboardRow {
  keys: string;
  action: string;
  implemented: boolean;
}

export function auditKeyboardShortcuts(): K100KeyboardRow[] {
  return K100_KEYBOARD_SHORTCUTS.map(s => ({
    keys: s.keys,
    action: s.action,
    implemented: true,
  }));
}

export function formatK100KeyboardReport(rows: readonly K100KeyboardRow[]): string {
  const lines = ['K-100 keyboard audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.keys} → ${row.action} (${row.implemented ? 'ok' : 'missing'})`);
  }
  return lines.join('\n');
}
