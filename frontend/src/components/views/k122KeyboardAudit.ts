/**
 * K-122 — Search keyboard flow audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditSearchKeyboardFlow(): Record<string, boolean> {
  const kb = readFileSync(join(ROOT, 'components/views/noteview/actions/useNoteKeyboardActions.ts'), 'utf8');
  const app = readFileSync(join(ROOT, 'components/AppContent.tsx'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  return {
    ctrlFFind: kb.includes("case 'f':") && kb.includes('setDocumentSearchOpen(true)'),
    ctrlShiftFGlobal: kb.includes('e.shiftKey') && kb.includes('openWorkspaceSearch'),
    appCtrlShiftF: app.includes('e.shiftKey') && app.includes('openWorkspaceSearch'),
    findFocusInput: panel.includes('searchInputRef.current?.focus'),
    closeRestoreFocus: editor.includes('editorFocusBeforeSearchRef') && editor.includes('scheduleEditorFocus'),
    escInFind: editor.includes('closeDocumentSearch'),
  };
}

export function auditKeyboardRc(): boolean {
  return Object.values(auditSearchKeyboardFlow()).every(Boolean);
}
