/**
 * Toggle child nesting — Enter/split/escape logic scoped to toggle.children[].
 */
import { makeBlock, type Block, type BlockType } from './blockUtils';
import {
  exitEmptyListBlock,
  isListType,
  listSplitExtras,
  renumberNumberedLists,
} from './listBlocks';

export type ToggleChildEnterResult =
  | { action: 'split'; children: Block[]; focusBlockId: string }
  | { action: 'escape_below'; children: Block[] };

function isParagraphType(type: BlockType): boolean {
  return type === 'paragraph';
}

/** Enter inside a toggle child block. */
export function applyToggleChildEnter(
  children: Block[],
  blockId: string,
  before: string,
  after: string,
  allowEscapeBelow = true,
): ToggleChildEnterResult {
  const idx = children.findIndex(b => b.id === blockId);
  if (idx < 0) {
    throw new Error(`toggle child not found: ${blockId}`);
  }

  const cur = children[idx];
  const isLast = idx === children.length - 1;
  const isEmpty = before === '' && after === '';
  const isPara = isParagraphType(cur.type);

  if (isListType(cur.type) && isEmpty) {
    return {
      action: 'split',
      children: exitEmptyListBlock(children, blockId),
      focusBlockId: blockId,
    };
  }

  if (allowEscapeBelow && isLast && isEmpty && isPara) {
    return {
      action: 'escape_below',
      children: children.filter(b => b.id !== blockId),
    };
  }

  const updatedCur: Block = { ...cur, content: before };
  const newType: BlockType = ['heading1', 'heading2', 'heading3'].includes(cur.type)
    ? 'paragraph'
    : cur.type;
  const newBlock = makeBlock(newType, {
    content: after,
    indent: cur.indent,
    checked: false,
    ...(isListType(newType) ? listSplitExtras(cur, newType) : {}),
  });

  let next = [...children];
  next[idx] = updatedCur;
  next.splice(idx + 1, 0, newBlock);
  next = renumberNumberedLists(next);
  return { action: 'split', children: next, focusBlockId: newBlock.id };
}

export type ToggleHeaderEnterResult = {
  headerContent: string;
  children: Block[];
  focusBlockId: string;
};

/**
 * Enter on toggle header — split title at caret or append empty child at end.
 *
 * Case B (caret at end, after === ''): keep title, append empty paragraph child.
 * Case A/C (caret mid/start, after non-empty): title = before, prepend child with after.
 * Case C (caret at start, after only): empty title, first child = full remainder text.
 */
export function applyToggleHeaderEnter(
  children: Block[],
  before: string,
  after: string,
): ToggleHeaderEnterResult {
  if (after === '') {
    const newChild = makeBlock('paragraph');
    return {
      headerContent: before,
      children: [...children, newChild],
      focusBlockId: newChild.id,
    };
  }

  const newChild = makeBlock('paragraph', { content: after });
  return {
    headerContent: before,
    children: [newChild, ...children],
    focusBlockId: newChild.id,
  };
}

/** First toggle child Backspace@0 — merge child text into header, remove child. */
export function applyToggleChildMergeIntoHeader(
  headerContent: string,
  children: Block[],
  childId: string,
  childContent: string,
): { headerContent: string; children: Block[]; focusOffset: number } | null {
  if (!children.length || children[0].id !== childId) return null;
  return {
    headerContent: headerContent + childContent,
    children: children.slice(1),
    focusOffset: headerContent.length,
  };
}

/** Simulate consecutive non-empty Enter splits inside toggle children. */
export function splitToggleChildrenSequential(
  children: Block[],
  blockId: string,
  lines: string[],
): Block[] {
  let current = children;
  let activeId = blockId;
  for (const line of lines) {
    const result = applyToggleChildEnter(current, activeId, line, '', true);
    if (result.action !== 'split') {
      throw new Error('unexpected escape during non-empty split');
    }
    current = result.children;
    activeId = result.focusBlockId;
  }
  return current;
}
