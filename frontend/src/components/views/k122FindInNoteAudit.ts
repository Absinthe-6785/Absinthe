/**
 * K-122 — Find-in-note panel redesign audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditFindInNotePanel(): Record<string, boolean> {
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  return {
    panelModule: panel.includes('FindInNotePanel'),
    panelHook: panel.includes('data-k122-find-in-note'),
    desktopBar: panel.includes('data-k122-find-desktop'),
    mobileSheet: panel.includes('data-k122-find-sheet'),
    findLabel: panel.includes('nvDocumentSearch'),
    matchCount: panel.includes('data-k122-find-count'),
    prevNext: panel.includes('data-k122-find-prev') && panel.includes('data-k122-find-next'),
    closeBtn: panel.includes('data-k122-find-close'),
    editorUsesPanel: editor.includes('<FindInNotePanel'),
    notInToolbar: !editor.includes('<DocumentSearchToolbar'),
    temporaryOpen: editor.includes('documentSearchOpen'),
  };
}

export function auditFindInNoteRc(): boolean {
  return Object.values(auditFindInNotePanel()).every(Boolean);
}
