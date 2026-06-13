import type { Block, BlockType } from '../../../blockUtils';
import { isToggleBlockType } from '../../../toggleBlockTypes';

/** Reasonable default row heights for virtual list estimates (px). */
const ESTIMATED_HEIGHT_BY_TYPE: Record<BlockType, number> = {
  paragraph: 46,
  heading1: 64,
  heading2: 56,
  heading3: 52,
  heading4: 46,
  bullet: 46,
  numbered: 46,
  todo: 46,
  quote: 52,
  callout: 56,
  code: 72,
  math: 56,
  image: 120,
  divider: 28,
  table: 160,
  toggle: 52,
  toggleHeading1: 64,
  toggleHeading2: 56,
  toggleHeading3: 52,
  toggleHeading4: 46,
};

const LINE_HEIGHT_PX = 22;
const CHARS_PER_LINE = 72;

function contentLines(content: string): number {
  if (!content) return 1;
  const lines = content.split('\n').reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE));
  }, 0);
  return lines;
}

/**
 * Estimate block row height before dynamic measurement.
 * Toggle collapsed uses header-only height; open toggles add child estimate buffer in POC.
 */
export function estimateBlockHeight(block: Block): number {
  const base = ESTIMATED_HEIGHT_BY_TYPE[block.type] ?? 46;

  if (isToggleBlockType(block.type)) {
    if (block.collapsed || block.children.length === 0) return base;
    const childEstimate = block.children.reduce((sum, child) => sum + estimateBlockHeight(child), 0);
    return base + Math.min(childEstimate, 240);
  }

  if (block.type === 'code') {
    const lines = (block.code ?? '').split('\n').length;
    return Math.max(base, 24 + lines * 20);
  }

  if (block.type === 'table') {
    const rows = block.tableRows?.length ?? 0;
    return Math.max(base, 48 + rows * 36);
  }

  if ('content' in block && typeof block.content === 'string' && block.content.length > 0) {
    const lines = contentLines(block.content);
    if (lines > 1) return Math.max(base, 20 + lines * LINE_HEIGHT_PX);
  }

  return base;
}

export function getEstimatedHeightForType(type: BlockType): number {
  return ESTIMATED_HEIGHT_BY_TYPE[type] ?? 46;
}
