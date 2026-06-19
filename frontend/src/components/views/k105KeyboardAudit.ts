/** K-105 — Retained keyboard shortcuts audit. */
export const K105_KEYBOARD_RETAINED = [
  { keys: 'Ctrl+Alt+T', action: 'daily-note' },
  { keys: 'Ctrl+Shift+F', action: 'focus-mode' },
  { keys: 'Alt+1', action: 'tab-notes' },
  { keys: 'Alt+2', action: 'tab-health' },
  { keys: 'Alt+3', action: 'tab-planner' },
  { keys: 'Alt+4', action: 'tab-analytics' },
  { keys: 'Alt+5', action: 'tab-recipe' },
] as const;

export function auditKeyboardRetained(): typeof K105_KEYBOARD_RETAINED[number][] {
  return [...K105_KEYBOARD_RETAINED];
}

export function formatK105KeyboardReport(rows: typeof K105_KEYBOARD_RETAINED[number][]): string {
  return [
    'K-105 keyboard audit',
    '',
    ...rows.map(r => `  ${r.keys} → ${r.action}`),
  ].join('\n');
}
