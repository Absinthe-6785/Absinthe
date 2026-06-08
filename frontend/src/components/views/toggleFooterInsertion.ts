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
 * Append or reuse trailing empty paragraph inside an expanded toggle.
 * Returns null for collapsed toggles or missing blocks.
 */
export function insertToggleFooterParagraph(
  rootBlocks: Block[],
  toggleId: string,
): ToggleFooterInsertionResult | null {
  const toggle = findBlockById(rootBlocks, toggleId);
  if (!toggle || toggle.type !== 'toggle' || isCollapsedToggle(toggle)) return null;

  const lastChild = toggle.children[toggle.children.length - 1];
  if (lastChild?.type === 'paragraph' && !lastChild.content.trim()) {
    return {
      toggleId,
      focusBlockId: lastChild.id,
      blocks: rootBlocks,
      created: false,
    };
  }

  const newParagraph = makeBlock('paragraph');
  const blocks = updateBlockById(rootBlocks, toggleId, t => ({
    ...t,
    collapsed: false,
    children: [...t.children, newParagraph],
  }));

  return {
    toggleId,
    focusBlockId: newParagraph.id,
    blocks,
    created: true,
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
