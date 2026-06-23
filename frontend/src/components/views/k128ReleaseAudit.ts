/**
 * K-128 — Release regression coverage consolidated from retired k121/k122 audits.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditK128SearchIntegrity(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const kb = readFileSync(join(ROOT, 'components/views/noteview/actions/useNoteKeyboardActions.ts'), 'utf8');
  const legacyToolbar = join(ROOT, 'components/views/noteview/DocumentSearchToolbar.tsx');
  return {
    findPanelInEditor: editor.includes('<FindInNotePanel'),
    findPanelHooks: panel.includes('data-k122-find-in-note') && panel.includes('data-k122-find-close'),
    noLegacyDocumentToolbar: !existsSync(legacyToolbar),
    ctrlFFind: kb.includes("case 'f':") && kb.includes('setDocumentSearchOpen(true)'),
    headerFindBtn: readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8').includes('data-read-mode-search-btn'),
    noToolbarFindDup: !editor.includes('data-k123-toolbar-find'),
  };
}

export function auditK128HealthSkeleton(): Record<string, boolean> {
  const tokens = readFileSync(join(ROOT, 'lib/k121SkeletonHeights.ts'), 'utf8');
  const analytics = readFileSync(join(ROOT, 'components/views/features/health/HealthAnalyticsPanel.tsx'), 'utf8');
  const supporting = readFileSync(join(ROOT, 'components/views/features/health/HealthSupportingPanels.tsx'), 'utf8');
  const skeleton = readFileSync(join(ROOT, 'components/common/WorkspaceCardSkeleton.tsx'), 'utf8');
  return {
    tokenModule: tokens.includes('K121_SKELETON_HEIGHT'),
    analyticsSummary: analytics.includes('K121_SKELETON_HEIGHT.analyticsSummary'),
    supportingPanels: supporting.includes('K121_SKELETON_HEIGHT.supportingCalendar'),
    sharedCardSkeleton: skeleton.includes('WORKSPACE_CARD_SURFACE') && skeleton.includes('WORKSPACE_CARD.lg'),
  };
}

export function auditK128NotesHeader(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const sidebar = readFileSync(join(ROOT, 'components/views/noteview/NoteViewSidebar.tsx'), 'utf8');
  return {
    actionRow: editor.includes('data-k121-notes-header-action-row'),
    newNoteConsolidated: !editor.includes('data-k121-notes-new') && sidebar.includes('data-noteview-new-note-btn'),
    unifiedHeader: editor.includes('data-k126c-notes-header'),
    noHeaderGlobalSearch: !editor.includes('openWorkspaceSearch()'),
    touchTarget: editor.includes('UI_INTERACTION.touchTargetMinPx'),
  };
}

export function auditK128ReleaseRc(): boolean {
  return [
    ...Object.values(auditK128SearchIntegrity()),
    ...Object.values(auditK128HealthSkeleton()),
    ...Object.values(auditK128NotesHeader()),
  ].every(Boolean);
}
