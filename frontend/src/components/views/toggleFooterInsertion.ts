/**
 * toggleFooterInsertion.ts — Insert/focus child paragraph in expanded toggle footer (UX-3D)
 */
import { findBlockById, makeBlock, updateBlockById, type Block } from './blockUtils';
import { findExpandedToggleFooterHit, isCollapsedToggle } from './toggleFocusZones';

export interface ToggleFooterInsertionResult {
  toggleId: string;
  focusBlockId: string;
  blocks: Block[];
  /** True when a new child paragraph was appended. */
  created: boolean;
}

/**
 * Append or focus trailing empty paragraph inside an expanded toggle.
 * Works on any block tree level where toggleId is findable in `blocks`.
 */
export function appendToggleChildParagraph(
  blocks: Block[],
  toggleId: string,
): { blocks: Block[]; focusBlockId: string; created: boolean } | null {
  const toggle = findBlockById(blocks, toggleId);
  if (!toggle || toggle.type !== 'toggle' || isCollapsedToggle(toggle)) return null;

  const lastChild = toggle.children[toggle.children.length - 1];
  if (lastChild?.type === 'paragraph' && !lastChild.content.trim()) {
    return {
      blocks: updateBlockById(blocks, toggleId, t => ({ ...t, collapsed: false })),
      focusBlockId: lastChild.id,
      created: false,
    };
  }

  const newParagraph = makeBlock('paragraph');
  return {
    blocks: updateBlockById(blocks, toggleId, t => ({
      ...t,
      collapsed: false,
      children: [...t.children, newParagraph],
    })),
    focusBlockId: newParagraph.id,
    created: true,
  };
}

/**
 * Append or reuse trailing empty paragraph inside an expanded toggle.
 * Returns null for collapsed toggles or missing blocks.
 */
export function insertToggleFooterParagraph(
  rootBlocks: Block[],
  toggleId: string,
): ToggleFooterInsertionResult | null {
  const result = appendToggleChildParagraph(rootBlocks, toggleId);
  if (!result) return null;
  return {
    toggleId,
    focusBlockId: result.focusBlockId,
    blocks: result.blocks,
    created: result.created,
  };
}

/** Resolve footer-zone click into toggle child insertion when applicable. */
export function resolveToggleFooterInsertion(
  clientY: number,
  rootBlocks: Block[],
  editorRoot: HTMLElement,
): ToggleFooterInsertionResult | null {
  const toggleId = findExpandedToggleFooterHit(clientY, editorRoot, rootBlocks);
  if (!toggleId) return null;
  return insertToggleFooterParagraph(rootBlocks, toggleId);
}
