/**
 * editorDiscoverability.ts — Pure helpers for UX-5C chrome hints
 */
import type { Block } from '../../../blockUtils';

/** True when the document is a single empty root paragraph. */
export function isEmptyDocument(blocks: Block[]): boolean {
  return blocks.length === 1
    && blocks[0].type === 'paragraph'
    && !blocks[0].content.trim();
}

export function multiSelectHintText(count: number): string {
  return `${count} blocks selected · Shift+click range · ⌘/Ctrl+click toggle · Esc clear`;
}

export const EMPTY_DOC_HINT_LINES = [
  "Type '/' for commands",
  'Paste markdown or rich text',
  'Drag ⋮⋮ handles to reorder blocks',
] as const;

export const BLOCK_MENU_FOOTER_HINT = '⋮⋮ grip: drag or menu · Right-click block · Shift+click multi-select';

export const GRIP_DRAG_TITLE = 'Drag to move · Click for block menu';
export const GUTTER_RANGE_TITLE = 'Shift+drag to select multiple blocks';
