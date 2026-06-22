/**
 * K-117 — Persistent New Note top action audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export const K117_NEW_NOTE_HOOKS = [
  'data-k117-new-note-btn',
  'data-k117-note-top-actions',
] as const;

export function auditNewNoteTopPlacement(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'noteview/NoteViewEditorArea.tsx'), 'utf8');
  const header = readFileSync(join(ROOT, 'noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  return {
    topActionsBar: editor.includes('data-k117-note-top-actions'),
    stickyClass: editor.includes('bsticky-header'),
    newNoteBtn: editor.includes('data-k117-new-note-btn') || header.includes('data-k117-new-note-btn'),
    nearSearch: editor.includes('data-noteview-workspace-search-trigger'),
    mobileHeader: editor.includes('isMobile ? 44') || header.includes('k125a-header-action-btn'),
  };
}

export function auditNewNoteRc(): boolean {
  const r = auditNewNoteTopPlacement();
  return r.topActionsBar && r.newNoteBtn && r.stickyClass;
}
