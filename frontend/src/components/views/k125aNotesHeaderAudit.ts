/**
 * K-125A — Notes workspace header polish audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditK125aNotesHeader(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const header = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  const styles = readFileSync(join(ROOT, 'components/views/noteview/useNoteViewStyles.ts'), 'utf8');
  return {
    topBarClass: styles.includes('k125a-notes-top-bar'),
    headerBandClass: styles.includes('k125a-notes-header-band'),
    newBtnClass: styles.includes('k125a-notes-new-btn'),
    actionBtnClass: styles.includes('k125a-header-action-btn'),
    workspaceHeaderHook: editor.includes('data-k125a-notes-workspace-header'),
    mergedNewNoteInActions: header.includes('onNewNote') && editor.includes('onNewNote={handleNewNote}'),
    inlineNewNoteHook: header.includes('data-k125a-notes-new-inline'),
    hideTopOnNoteOpen: editor.includes('showNotesTopBar'),
    hideTopOnEmptyVault: editor.includes('!isEmptyVault'),
    emptyShell: styles.includes('k125a-notes-empty-shell'),
    noHeaderGlobalSearch: !editor.includes('openWorkspaceSearch()'),
    actionsCluster: styles.includes('k125a-notes-actions-cluster'),
    tokenReuse: styles.includes('UI_INTERACTION.toolbarActionGapPx'),
  };
}

export function auditK125aNotesHeaderRc(): boolean {
  return Object.values(auditK125aNotesHeader()).every(Boolean);
}
