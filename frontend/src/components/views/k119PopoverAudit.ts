/**
 * K-119 — Global popover system audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K119_POPOVER_CHECKS = [
  'PopoverRoot',
  'PopoverPortal',
  'PopoverDismiss',
  'outside-click',
  'escape-close',
  'focus-trap',
  'max-width',
  'mobile-sheet',
] as const;

export function auditPopoverSystem(): Record<string, boolean> {
  const popover = readFileSync(join(ROOT, 'components/common/popover/Popover.tsx'), 'utf8');
  const sortMenu = readFileSync(join(ROOT, 'components/views/noteview/NoteListSortMenu.tsx'), 'utf8');
  return {
    popoverRoot: popover.includes('export function PopoverRoot'),
    popoverPortal: popover.includes('export function PopoverPortal'),
    popoverDismiss: popover.includes('export function PopoverDismiss'),
    outsideClick: popover.includes('data-k119-popover-dismiss') && popover.includes('mousedown'),
    escapeClose: popover.includes('UI_INTERACTION.escapeKey'),
    focusTrap: popover.includes("e.key !== 'Tab'") && popover.includes('focusables'),
    maxWidth: popover.includes('POPOVER_MAX_WIDTH_PX') && popover.includes('UI_INTERACTION'),
    mobileSheet: popover.includes('data-k104-sort-sheet'),
    sortMenuUsesPopover: sortMenu.includes('PopoverRoot'),
  };
}

export function auditPopoverRc(): boolean {
  const r = auditPopoverSystem();
  return Object.values(r).every(Boolean);
}
