/**
 * K-121 — Notes header action row recovery audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditNotesHeaderRecovery(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  return {
    actionRowHook: editor.includes('data-k121-notes-header-action-row'),
    searchHook: editor.includes('data-k121-notes-search'),
    newNoteHook: editor.includes('data-k121-notes-new'),
    searchFlexGrow: editor.includes('flex: 1') && editor.includes('data-k121-notes-search'),
    mobileTouch44: editor.includes('UI_INTERACTION.touchTargetMinPx'),
    inlineRow: editor.includes('display: \'flex\'') && editor.includes('data-k121-notes-header-action-row'),
  };
}

export function auditNotesHeaderRc(): boolean {
  const r = auditNotesHeaderRecovery();
  return Object.values(r).every(Boolean);
}
