import { K108A_EDITOR_FOCUS_HOOKS } from './noteview/editorFocus';

/** K-108A — Editor focus restoration on edit-mode entry. */
export { K108A_EDITOR_FOCUS_HOOKS };

export const K108A_EDITOR_FOCUS_TRANSITIONS = [
  'double-click-reading-mode',
  'view-mode-toggle-reading',
  'view-mode-toggle-graph',
  'cosmos-select',
  'keyboard-ctrl-e',
  'keyboard-ctrl-g',
] as const;

export function auditEditorFocus(): readonly string[] {
  return [...K108A_EDITOR_FOCUS_HOOKS, ...K108A_EDITOR_FOCUS_TRANSITIONS];
}

export function formatK108aEditorFocusReport(entries: readonly string[]): string {
  return ['K-108A editor focus audit', '', ...entries.map(e => `  ${e}`)].join('\n');
}
