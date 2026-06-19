/** K-106 — Keyboard consistency audit (editor + app). */
export const K106_KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+Z', action: 'undo' },
  { keys: 'Ctrl+Shift+Z', action: 'redo' },
  { keys: 'Ctrl+Y', action: 'redo' },
  { keys: 'Ctrl+F', action: 'document-search' },
  { keys: 'Ctrl+Shift+F', action: 'focus-mode' },
  { keys: 'Ctrl+Alt+T', action: 'daily-note' },
  { keys: 'Ctrl+N', action: 'new-note' },
  { keys: 'Alt+1', action: 'tab-notes' },
  { keys: 'Alt+2', action: 'tab-health' },
  { keys: 'Alt+3', action: 'tab-planner' },
  { keys: 'Alt+4', action: 'tab-analytics' },
  { keys: 'Alt+5', action: 'tab-recipe' },
] as const;

export function auditKeyboardConsistency(): typeof K106_KEYBOARD_SHORTCUTS[number][] {
  return [...K106_KEYBOARD_SHORTCUTS];
}
