import type { BlockType } from './blockUtils';
import { isToggleHeadingBlockType, toggleHeadingBlockType } from './toggleBlockTypes';

export function isToolbarHeadingType(type: BlockType): boolean {
  return type === 'heading1' || type === 'heading2' || type === 'heading3' || type === 'heading4'
    || isToggleHeadingBlockType(type);
}

export function toolbarHeadingLevel(type: BlockType): 1 | 2 | 3 | 4 | null {
  switch (type) {
    case 'heading1':
    case 'toggleHeading1': return 1;
    case 'heading2':
    case 'toggleHeading2': return 2;
    case 'heading3':
    case 'toggleHeading3': return 3;
    case 'heading4':
    case 'toggleHeading4': return 4;
    default: return null;
  }
}

/** Preserve toggle-heading blocks when changing heading level from the toolbar. */
export function headingConvertTarget(current: BlockType | undefined, level: 1 | 2 | 3 | 4): BlockType {
  if (current && isToggleHeadingBlockType(current)) {
    return toggleHeadingBlockType(level);
  }
  return `heading${level}` as BlockType;
}
