import type { BlockType } from './blockUtils';

export const TOGGLE_BLOCK_TYPES: readonly BlockType[] = [
  'toggle',
  'toggleHeading1',
  'toggleHeading2',
  'toggleHeading3',
  'toggleHeading4',
];

export const TOGGLE_HEADING_BLOCK_TYPES: readonly BlockType[] = [
  'toggleHeading1',
  'toggleHeading2',
  'toggleHeading3',
  'toggleHeading4',
];

export const HEADING_AND_TOGGLE_HEADING_TYPES: readonly BlockType[] = [
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  ...TOGGLE_HEADING_BLOCK_TYPES,
];

export function isToggleBlockType(type: BlockType): boolean {
  return (TOGGLE_BLOCK_TYPES as readonly string[]).includes(type);
}

export function isToggleHeadingBlockType(type: BlockType): boolean {
  return (TOGGLE_HEADING_BLOCK_TYPES as readonly string[]).includes(type);
}

export function toggleHeadingLevel(type: BlockType): 1 | 2 | 3 | 4 | null {
  switch (type) {
    case 'toggleHeading1': return 1;
    case 'toggleHeading2': return 2;
    case 'toggleHeading3': return 3;
    case 'toggleHeading4': return 4;
    default: return null;
  }
}

export function toggleHeadingBlockType(level: 1 | 2 | 3 | 4): BlockType {
  return `toggleHeading${level}` as BlockType;
}

export function toggleHeadingMarker(level: number, collapsed: boolean): string {
  const hashes = '#'.repeat(level);
  return collapsed ? `${hashes}>!` : `${hashes}>`;
}
