/**
 * K-123 — Editor toolbar positioning audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditEditorToolbar(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const actions = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  const chrome = readFileSync(join(ROOT, 'components/views/editorChromeStyles.ts'), 'utf8');
  return {
    toolbarRow: editor.includes('data-k123-editor-toolbar-row'),
    toolbarShell: editor.includes('data-k123-editor-toolbar-shell'),
    centeredShell: chrome.includes('k123-editor-toolbar-shell') && chrome.includes('margin: 0 auto'),
    findInHeader: editor.includes('data-k126c-notes-header') && actions.includes('data-read-mode-search-btn'),
    noDuplicateToolbarFind: !editor.includes('data-k123-toolbar-find'),
    slashHint: editor.includes('editorToolbarSlash'),
    importActions: editor.includes('nvImportMd'),
  };
}

export function auditToolbarRc(): boolean {
  return Object.values(auditEditorToolbar()).every(Boolean);
}
