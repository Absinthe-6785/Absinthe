import {
  K108A_HEADER_ACTION_BTN_SIZE,
  K108A_HEADER_ACTION_GAP,
} from './noteview/NoteEditorHeaderActions';

/** K-108A — Header spacing and alignment audit. */
export const K108A_HEADER_LAYOUT_HOOKS = [
  'data-k108-header-actions',
  'data-k108-header-layout',
  'data-note-editor-header-actions',
  'data-note-header-actions-row',
] as const;

export function auditHeaderLayout(): {
  hooks: readonly string[];
  btnSizePx: number;
  gapPx: number;
  mobileTouchTargetPx: number;
} {
  return {
    hooks: K108A_HEADER_LAYOUT_HOOKS,
    btnSizePx: K108A_HEADER_ACTION_BTN_SIZE,
    gapPx: K108A_HEADER_ACTION_GAP,
    mobileTouchTargetPx: 44,
  };
}

export function formatK108aHeaderLayoutReport(result: ReturnType<typeof auditHeaderLayout>): string {
  return [
    'K-108A header layout audit',
    '',
    `Button size: ${result.btnSizePx}px`,
    `Gap: ${result.gapPx}px`,
    `Mobile touch target: ${result.mobileTouchTargetPx}px`,
    '',
    ...result.hooks.map(h => `  ${h}`),
  ].join('\n');
}
