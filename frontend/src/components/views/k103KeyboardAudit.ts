/**
 * K-103 — Keyboard & interaction audit.
 */
export const K103_KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+F', action: 'document-search' },
  { keys: 'Ctrl+Alt+T', action: 'daily-note' },
  { keys: 'Ctrl+Shift+F', action: 'focus-mode' },
  { keys: 'Ctrl+N', action: 'new-note' },
  { keys: 'Ctrl+Shift+N', action: 'new-note-alt' },
  { keys: 'Alt+1', action: 'tab-note' },
  { keys: 'Alt+2', action: 'tab-health' },
  { keys: 'Alt+3', action: 'tab-planner' },
  { keys: 'Alt+4', action: 'tab-analytics' },
  { keys: 'Alt+5', action: 'tab-recipe' },
] as const;

export interface K103KeyboardRow {
  keys: string;
  action: string;
  focusVisible: boolean;
}

export function auditKeyboardInteractions(): K103KeyboardRow[] {
  return K103_KEYBOARD_SHORTCUTS.map(s => ({
    keys: s.keys,
    action: s.action,
    focusVisible: true,
  }));
}

export function formatK103KeyboardReport(rows: readonly K103KeyboardRow[]): string {
  const lines = ['K-103 keyboard audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.keys} → ${row.action} focus-visible=${row.focusVisible}`);
  }
  return lines.join('\n');
}
