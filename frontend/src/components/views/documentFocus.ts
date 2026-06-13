/**
 * documentFocus.ts — Document chrome hit-testing and focus placement (UX-3B)
 */
import { makeBlock, type Block } from './blockUtils';
import { isGutterDragStart } from './blockGutterSelection';
import { resolveToggleFooterInsertion } from './toggleFooterInsertion';
import {
  classifyToggleFooterZone,
  evaluateToggleFooterFeasibility,
  resolveToggleAwareFocus,
} from './toggleFocusZones';

export {
  classifyToggleFooterZone,
  evaluateToggleFooterFeasibility,
} from './toggleFocusZones';
export { insertToggleFooterParagraph, resolveToggleFooterInsertion } from './toggleFooterInsertion';

export type FocusOffset = 'start' | 'end';

export type DocumentFocusAction =
  | { kind: 'focus'; blockId: string; offset: FocusOffset }
  | { kind: 'append'; block: Block }
  | {
    kind: 'toggle-footer';
    toggleId: string;
    focusBlockId: string;
    blocks: Block[];
    created: boolean;
  };

export interface BlockRowHit {
  blockId: string;
  top: number;
  bottom: number;
}

/** True when pointer target is document chrome (not gutter, editable text, or row padding). */
export function shouldHandleDocumentFocus(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (isGutterDragStart(target)) return false;
  if (target.closest('.be-gutter-strip, .be-handles, .be-block-handle-menu, .be-grip')) return false;
  if (target.closest('button, input, label, a, table, .be-toggle-empty')) return false;
  if (target.isContentEditable || target.closest('.be-editable, [contenteditable="true"]')) return false;
  if (target.closest('.be-content')) return false;
  return true;
}

export function isBlockEmptyForFocus(block: Block): boolean {
  if (block.type === 'paragraph'
    || block.type === 'heading1'
    || block.type === 'heading2'
    || block.type === 'heading3'
    || block.type === 'heading4'
    || block.type === 'quote'
    || block.type === 'callout'
    || block.type === 'toggle') {
    return !block.content.trim();
  }
  return false;
}

export function focusOffsetForBlock(block: Block): FocusOffset {
  return isBlockEmptyForFocus(block) ? 'start' : 'end';
}

/** First root-level empty paragraph — persistent placeholder target. */
export function isFirstEmptyRootParagraph(rootBlocks: Block[], blockId: string): boolean {
  const firstEmpty = rootBlocks.find(b => b.type === 'paragraph' && !b.content.trim());
  return firstEmpty?.id === blockId;
}

export function listRootBlockRows(
  editorRoot: HTMLElement,
  rootBlockIds: string[],
): BlockRowHit[] {
  const rows: BlockRowHit[] = [];
  for (const blockId of rootBlockIds) {
    const el = editorRoot.querySelector(`[data-drag-id="${blockId}"]`) as HTMLElement | null;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    rows.push({ blockId, top: rect.top, bottom: rect.bottom });
  }
  return rows;
}

/** Nearest root block row for clientY; null + belowAll when below every row. */
export function blockIdAtRow(
  clientY: number,
  editorRoot: HTMLElement,
  rootBlockIds: string[],
  rowHits?: BlockRowHit[],
): { blockId: string | null; belowAll: boolean } {
  const rows = rowHits ?? listRootBlockRows(editorRoot, rootBlockIds);
  if (rows.length === 0) return { blockId: null, belowAll: true };

  const last = rows[rows.length - 1]!;
  if (clientY > last.bottom) return { blockId: null, belowAll: true };

  for (const row of rows) {
    if (clientY >= row.top && clientY <= row.bottom) {
      return { blockId: row.blockId, belowAll: false };
    }
  }

  let nearest = rows[0]!;
  let minDist = Infinity;
  for (const row of rows) {
    const center = (row.top + row.bottom) / 2;
    const dist = Math.abs(clientY - center);
    if (dist < minDist) {
      minDist = dist;
      nearest = row;
    }
  }
  return { blockId: nearest.blockId, belowAll: false };
}

export function resolveDocumentFocus(
  clientY: number,
  rootBlocks: Block[],
  editorRoot: HTMLElement,
  rowHits?: BlockRowHit[],
): DocumentFocusAction {
  const toggleFocus = resolveToggleAwareFocus(clientY, rootBlocks, editorRoot);
  if (toggleFocus) {
    return { kind: 'focus', blockId: toggleFocus.blockId, offset: toggleFocus.offset };
  }

  const footerInsertion = resolveToggleFooterInsertion(clientY, rootBlocks, editorRoot);
  if (footerInsertion) {
    return {
      kind: 'toggle-footer',
      toggleId: footerInsertion.toggleId,
      focusBlockId: footerInsertion.focusBlockId,
      blocks: footerInsertion.blocks,
      created: footerInsertion.created,
    };
  }

  const rootBlockIds = rootBlocks.map(b => b.id);
  const { blockId, belowAll } = blockIdAtRow(clientY, editorRoot, rootBlockIds, rowHits);

  if (belowAll) {
    const last = rootBlocks[rootBlocks.length - 1];
    if (!last) {
      const nb = makeBlock('paragraph');
      return { kind: 'append', block: nb };
    }
    if (last.type === 'paragraph' && !last.content.trim()) {
      return { kind: 'focus', blockId: last.id, offset: 'start' };
    }
    return { kind: 'append', block: makeBlock('paragraph') };
  }

  if (blockId) {
    const block = rootBlocks.find(b => b.id === blockId);
    if (!block) {
      const last = rootBlocks[rootBlocks.length - 1]!;
      return { kind: 'focus', blockId: last.id, offset: focusOffsetForBlock(last) };
    }
    return { kind: 'focus', blockId, offset: focusOffsetForBlock(block) };
  }

  const last = rootBlocks[rootBlocks.length - 1]!;
  return { kind: 'focus', blockId: last.id, offset: focusOffsetForBlock(last) };
}

/** UX-3B entry — resolve focus action from pointer Y inside editor root. */
export function focusNearestEditable(
  clientY: number,
  blocks: Block[],
  editorRoot: HTMLElement,
  rowHits?: BlockRowHit[],
): DocumentFocusAction {
  return resolveDocumentFocus(clientY, blocks, editorRoot, rowHits);
}
