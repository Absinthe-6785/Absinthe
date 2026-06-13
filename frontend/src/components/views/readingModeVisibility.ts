import type { Block } from './blockUtils';
import { isToggleBlockType } from './toggleBlockTypes';

const EMPTY_TEXT_TYPES = new Set<Block['type']>([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'bullet',
  'numbered',
  'quote',
  'callout',
]);

/** Hide editor-only empty shells in reading mode so documents read cleanly. */
export function shouldHideBlockInReadingMode(block: Block): boolean {
  if (isToggleBlockType(block.type)) {
    return !block.content?.trim() && block.children.length === 0;
  }
  if (EMPTY_TEXT_TYPES.has(block.type)) {
    return !block.content?.trim();
  }
  if (block.type === 'todo') {
    return !block.content?.trim() && !block.checked;
  }
  return false;
}
