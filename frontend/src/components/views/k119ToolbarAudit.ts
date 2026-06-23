/**
 * K-119 — Workspace toolbar consistency audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K119_TOOLBAR_WORKSPACES = [
  'notes',
  'health',
  'archive',
  'schedule',
  'recipe',
  'search',
] as const;

export function auditToolbarConsistency(): Record<string, boolean> {
  const toolbar = readFileSync(join(ROOT, 'components/common/WorkspaceToolbar.tsx'), 'utf8');
  const planner = readFileSync(join(ROOT, 'components/views/features/planner/PlannerStickyActions.tsx'), 'utf8');
  const noteTop = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const header = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  return {
    workspaceToolbar: toolbar.includes('data-k119-workspace-toolbar'),
    touchTarget44: (toolbar.includes('min-h-[44px]') || toolbar.includes('WORKSPACE_BTN_PRIMARY_CLASS')) && toolbar.includes('touchTargetMinPx'),
    iconSizeToken: toolbar.includes('toolbarIconSizePx') || planner.includes('toolbarIconSizePx'),
    plannerCompactChrome: planner.includes('data-k121-schedule-toolbar') && planner.includes('data-k121-schedule-new-event'),
    notesSticky: noteTop.includes('data-k117-note-top-actions'),
    headerActionTokens: header.includes('UI_INTERACTION'),
    focusRing: toolbar.includes('focus-visible:outline'),
  };
}

export function auditToolbarRc(): boolean {
  const r = auditToolbarConsistency();
  return r.workspaceToolbar && r.touchTarget44 && r.plannerCompactChrome && r.notesSticky;
}
