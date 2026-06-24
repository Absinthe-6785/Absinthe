/**
 * K-126C — Notes header & toolbar polish audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditK126cNotesHeader(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const actions = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  const menu = readFileSync(join(ROOT, 'components/views/noteview/NotesActionMenu.tsx'), 'utf8');
  const sidebar = readFileSync(join(ROOT, 'components/views/noteview/NoteViewSidebar.tsx'), 'utf8');
  const toolbar = readFileSync(join(ROOT, 'components/common/WorkspaceToolbar.tsx'), 'utf8');

  return {
    unifiedHeaderHook: editor.includes('data-k126c-notes-header'),
    primaryActionsHook: actions.includes('data-k126c-header-primary-actions'),
    newNoteConsolidatedInSidebar: !editor.includes('data-k126c-header-new-note')
      && sidebar.includes('data-noteview-new-note-btn'),
    findInHeader: actions.includes('data-k126c-header-find') && actions.includes('data-read-mode-search-btn'),
    starCopyPanelHooks: actions.includes('data-k126c-header-star')
      && actions.includes("key: 'copy'")
      && actions.includes('data-k126c-header-panel'),
    moreMenuExtracted: menu.includes('data-k126c-notes-more-menu'),
    noSeparateActionsRowInEditor: !editor.includes('data-note-header-actions-row'),
    noToolbarFindDup: !editor.includes('data-k123-toolbar-find'),
    compactEmptyState: editor.includes('data-k126c-notes-empty') && !editor.includes("secondaryAction={{ label: t('nvScGraph')"),
    denseListFilters: sidebar.includes('data-k126c-notes-list-filters') && sidebar.includes('dense'),
    sharedToolbarTokens: toolbar.includes('NOTE_CHROME_HEADER_BTN_RADIUS_PX') || readFileSync(join(ROOT, 'lib/uiInteractionTokens.ts'), 'utf8').includes('noteChromeBtnRadiusPx'),
    toolbarPaddingReduced: editor.includes("padding: '4px 0'"),
    findPanelUnchanged: editor.includes('<FindInNotePanel'),
  };
}

export function auditK126cRc(): boolean {
  return Object.values(auditK126cNotesHeader()).every(Boolean);
}
