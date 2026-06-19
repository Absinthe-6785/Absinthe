/**
 * K-115 — Release candidate keyboard audit (RC matrix).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K115_KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl+F', action: 'document-search', domain: 'notes' },
  { keys: 'Ctrl+Shift+F', action: 'workspace-search', domain: 'global' },
  { keys: 'Ctrl+Alt+T', action: 'daily-note', domain: 'notes' },
  { keys: 'Ctrl+Z', action: 'undo', domain: 'editor' },
  { keys: 'Ctrl+Y', action: 'redo', domain: 'editor' },
  { keys: 'Ctrl+Shift+Z', action: 'redo', domain: 'editor' },
  { keys: 'Alt+1', action: 'tab-notes', domain: 'global' },
  { keys: 'Alt+2', action: 'tab-health', domain: 'global' },
  { keys: 'Alt+3', action: 'tab-planner', domain: 'global' },
  { keys: 'Alt+4', action: 'tab-archive', domain: 'global' },
  { keys: 'Alt+5', action: 'tab-recipe', domain: 'global' },
  { keys: 'Escape', action: 'close-modals-sort-menu', domain: 'global' },
] as const;

export function auditKeyboardMatrix(): readonly string[] {
  return K115_KEYBOARD_SHORTCUTS.map(s => `${s.keys}:${s.action}`);
}

export function auditKeyboardWiring(): Record<string, boolean> {
  const app = readFileSync(join(ROOT, 'components/AppContent.tsx'), 'utf8');
  const noteKb = readFileSync(join(ROOT, 'components/views/noteview/actions/useNoteKeyboardActions.ts'), 'utf8');
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const undo = readFileSync(join(ROOT, 'components/views/k106UndoRedoAudit.ts'), 'utf8');
  return {
    ctrlShiftF: app.includes("e.key.toLowerCase() === 'f'") && app.includes('e.shiftKey'),
    ctrlAltT: noteKb.includes("e.key.toLowerCase() === 't'") && noteKb.includes('e.altKey'),
    ctrlF: noteKb.includes("case 'f':") && noteKb.includes('setDocumentSearchOpen'),
    altTabs: app.includes('TAB_BY_ALT'),
    escapeSortMenu: noteKb.includes("e.key === 'Escape'") && noteKb.includes('setShowSortMenu'),
    undoRedo: undo.includes('Ctrl+Z') && undo.includes('Ctrl+Y'),
    searchEscape: search.includes('Escape') || search.includes("'Escape'"),
  };
}

export function auditKeyboardRc(): boolean {
  const w = auditKeyboardWiring();
  return w.ctrlShiftF && w.ctrlAltT && w.ctrlF && w.altTabs && w.undoRedo;
}
