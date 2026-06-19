/**
 * K-123 — Find-in-note panel placement audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditFindPanelPlacement(): Record<string, boolean> {
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  return {
    anchoredHook: panel.includes('data-k123-find-anchored'),
    absoluteTopRight: panel.includes("position: 'absolute'") && panel.includes('right: 0'),
    inColumnShell: editor.includes('k123-editor-column-shell') && editor.includes('anchored'),
    mobileSheet: panel.includes('data-k122-find-sheet'),
    mobileUnchanged: panel.includes('data-k122-find-mobile-backdrop'),
    notFullWidthBar: !panel.includes('data-k122-find-desktop'),
  };
}

export function auditFindPanelRc(): boolean {
  return Object.values(auditFindPanelPlacement()).every(Boolean);
}
