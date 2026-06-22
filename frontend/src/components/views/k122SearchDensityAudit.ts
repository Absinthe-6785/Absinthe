/**
 * K-122 — Search density / compact controls audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditSearchDensity(): Record<string, boolean> {
  const panel = readFileSync(join(ROOT, 'components/views/noteview/FindInNotePanel.tsx'), 'utf8');
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const actions = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  return {
    compactControls: panel.includes('data-k122-find-controls'),
    prevNextOnly: panel.includes('data-k122-find-prev') && panel.includes('data-k122-find-next'),
    countLabel: panel.includes('data-document-search-match-count'),
    closeControl: panel.includes('data-k122-find-close'),
    noScopeChips: !panel.includes('nvSearchScopeBlock'),
    removedFromEditToolbar: !editor.includes('DocumentSearchToolbar'),
    headerPrimaryActions: editor.includes('data-k122-notes-header')
      && editor.includes('data-k121-notes-new')
      && actions.includes('data-k126c-header-primary-actions'),
  };
}

export function auditSearchDensityRc(): boolean {
  return Object.values(auditSearchDensity()).every(Boolean);
}
