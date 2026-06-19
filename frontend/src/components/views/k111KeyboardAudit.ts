/** K-111 — Search keyboard audit. */
export const K111_KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+Shift+F', action: 'open-search-focus-input' },
  { keys: 'Escape', action: 'clear-query-then-close' },
  { keys: 'ArrowUp', action: 'select-previous' },
  { keys: 'ArrowDown', action: 'select-next' },
  { keys: 'Enter', action: 'open-selected' },
] as const;

export function auditSearchKeyboard(): readonly string[] {
  return K111_KEYBOARD_SHORTCUTS.map(s => `${s.keys}:${s.action}`);
}

export function auditSearchKeyboardGlobalShortcut(): boolean {
  return K111_KEYBOARD_SHORTCUTS.some(s => s.keys === 'Ctrl+Shift+F');
}
