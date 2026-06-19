/**
 * K-116 — Popover / sort menu audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SORT_MENU_MAX_WIDTH_PX } from '../components/views/noteview/NoteListSortMenu';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K116_POPOVER_CHECKS = [
  'max-width-220',
  'outside-click-dismiss',
  'escape-close',
  'focus-trap',
  'mobile-bottom-sheet',
] as const;

export function auditPopoverSurfaces(): Record<string, boolean> {
  const menu = readFileSync(join(ROOT, 'components/views/noteview/NoteListSortMenu.tsx'), 'utf8');
  const kb = readFileSync(join(ROOT, 'components/views/noteview/actions/useNoteKeyboardActions.ts'), 'utf8');
  return {
    maxWidth220: menu.includes('SORT_MENU_MAX_WIDTH_PX') && SORT_MENU_MAX_WIDTH_PX === 220,
    outsideClick: menu.includes('data-k116-sort-backdrop') && menu.includes('mousedown'),
    escapeClose: menu.includes("e.key === 'Escape'") && kb.includes('setShowSortMenu(false)'),
    focusTrap: menu.includes("e.key !== 'Tab'") && menu.includes('focusables'),
    mobileSheet: menu.includes('data-k104-sort-sheet'),
  };
}

export function auditPopoverRc(): boolean {
  const a = auditPopoverSurfaces();
  return a.maxWidth220 && a.outsideClick && a.escapeClose && a.focusTrap && a.mobileSheet;
}
