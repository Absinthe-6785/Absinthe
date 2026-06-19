/**
 * K-122 — Find-in-note dismissal audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditFindInNoteDismissal(): Record<string, boolean> {
  const dismiss = readFileSync(join(ROOT, 'components/views/noteview/useFindInNoteDismiss.ts'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const noteView = readFileSync(join(ROOT, 'components/views/NoteView.tsx'), 'utf8');
  return {
    dismissHook: dismiss.includes('useFindInNoteDismiss'),
    outsidePointer: dismiss.includes('pointerdown'),
    escDismiss: editor.includes('closeDocumentSearch') && editor.includes("e.key === 'Escape'"),
    closeButton: panel.includes('data-k122-find-close'),
    mobileBackdrop: panel.includes('data-k122-find-mobile-backdrop'),
    noteChangeDismiss: noteView.includes('setDocumentSearchOpen(false)') && noteView.includes('activeNoteId'),
    clearsQuery: editor.includes('setSearchQuery(\'\')'),
  };
}

export function auditDismissRc(): boolean {
  return Object.values(auditFindInNoteDismissal()).every(Boolean);
}
