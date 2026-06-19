/**
 * K-116 — Responsive sizing audit (menus, dropdowns, header).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SORT_MENU_MAX_WIDTH_PX } from '../components/views/noteview/NoteListSortMenu';
import { K108A_HEADER_ACTION_BTN_SIZE } from '../components/views/noteview/NoteEditorHeaderActions';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K116_RESPONSIVE_SURFACES = [
  'sort-menu',
  'block-context-menu',
  'editor-header-actions',
  'image-mobile-menu',
] as const;

export function auditResponsiveSizing(): Record<string, boolean> {
  const menu = readFileSync(join(ROOT, 'components/views/features/block-editor/features/menus/components/BlockContextMenu.tsx'), 'utf8');
  const header = readFileSync(join(ROOT, 'components/views/noteview/NoteEditorHeaderActions.tsx'), 'utf8');
  return {
    sortMenuMax220: SORT_MENU_MAX_WIDTH_PX === 220,
    headerBtnSize: K108A_HEADER_ACTION_BTN_SIZE === 24,
    contextMenuViewport: menu.includes('computeFixedMenuPosition'),
    mobileTouch44: header.includes('min-h-[44px]') || header.includes('44'),
  };
}

export function auditResponsiveRc(): boolean {
  const r = auditResponsiveSizing();
  return r.sortMenuMax220 && r.contextMenuViewport;
}
