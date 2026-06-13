import type { BlockType } from '../../../blockUtils';

export const CHROME_LEAVE_DELAY_MS = 180;
export const FOCUS_CMD_RESET_MS = 100;
export const NESTED_EDITOR_PADDING_LEFT_PX = 36;

export const HEADING_BLOCK_TYPES: readonly BlockType[] = ['heading1', 'heading2', 'heading3', 'heading4'];

export const noopBlockChange = () => {};
