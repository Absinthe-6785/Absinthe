/**
 * K-121 — Notes header action row recovery audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditNotesHeaderRecovery(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const header = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  const styles = readFileSync(join(ROOT, 'components/views/noteview/useNoteViewStyles.ts'), 'utf8');
  return {
    actionRowHook: editor.includes('data-k121-notes-header-action-row'),
    k122HeaderHook: editor.includes('data-k122-notes-header'),
    newNoteHook: editor.includes('data-k121-notes-new') || header.includes('data-k121-notes-new'),
    noHeaderGlobalSearch: !editor.includes('data-k121-notes-search') && !editor.includes('openWorkspaceSearch()'),
    mobileTouch44: editor.includes('UI_INTERACTION.touchTargetMinPx') || styles.includes('touchTargetMinPx'),
    inlineRow: editor.includes('k125a-notes-top-bar') || (editor.includes('display: \'flex\'') && editor.includes('data-k121-notes-header-action-row')),
    k125aPolish: editor.includes('data-k125a-notes-workspace-header'),
  };
}

export function auditNotesHeaderRc(): boolean {
  const r = auditNotesHeaderRecovery();
  return Object.values(r).every(Boolean);
}
