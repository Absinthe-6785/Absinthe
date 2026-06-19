/**
 * K-116 — Popover / sort menu audit (delegates to K-119 PopoverRoot).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POPOVER_MAX_WIDTH_PX } from '../components/common/popover/Popover';
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
  const popover = readFileSync(join(ROOT, 'components/common/popover/Popover.tsx'), 'utf8');
  const menu = readFileSync(join(ROOT, 'components/views/noteview/NoteListSortMenu.tsx'), 'utf8');
  const kb = readFileSync(join(ROOT, 'components/views/noteview/actions/useNoteKeyboardActions.ts'), 'utf8');
  return {
    maxWidth220: popover.includes('POPOVER_MAX_WIDTH_PX') && POPOVER_MAX_WIDTH_PX === 220 && SORT_MENU_MAX_WIDTH_PX === 220,
    outsideClick: popover.includes('data-k119-popover-dismiss') && popover.includes('mousedown'),
    escapeClose: popover.includes("e.key === UI_INTERACTION.escapeKey") && kb.includes('setShowSortMenu(false)'),
    focusTrap: popover.includes("e.key !== 'Tab'") && popover.includes('focusables'),
    mobileSheet: popover.includes('data-k104-sort-sheet') && menu.includes('PopoverDismiss'),
  };
}

export function auditPopoverRc(): boolean {
  const a = auditPopoverSurfaces();
  return a.maxWidth220 && a.outsideClick && a.escapeClose && a.focusTrap && a.mobileSheet;
}
