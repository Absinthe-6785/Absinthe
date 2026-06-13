import { useCallback } from 'react';
import {
  type Block,
  type BlockType,
  makeBlock,
  updateBlockById,
  deleteBlockById,
  findBlockById,
  flattenBlockIds,
  isTextBlockType,
} from '../../../blockUtils';
import { isToggleBlockType } from '../../../toggleBlockTypes';
import { applyToggleChildEnter } from '../../../toggleNesting';
import {
  exitEmptyListBlock,
  isListType,
  listSplitExtras,
  renumberNumberedLists,
} from '../../../listBlocks';
import type { FocusCmd } from '../features/selection';
import { enterSplitBlockType } from '../utils/blockEditorMutations';

export interface UseEditorBlockEditingOptions {
  getBlocks: () => Block[];
  onChange: (blocks: Block[]) => void;
  onFocusCmd: (cmd: FocusCmd) => void;
  selectBlock: (id: string) => void;
  onActiveBlockChange: (id: string | null) => void;
  onEscapeToParentBelow?: () => void;
  onEscapeToParentHeader?: () => void;
  onMergeFirstChildIntoHeader?: (childId: string, childContent: string) => void;
}

export interface UseEditorBlockEditingResult {
  handleSplitBlock: (id: string, before: string, after: string) => void;
  handleMergeWithPrev: (id: string, selfContent: string) => void;
  handleContentChange: (id: string, content: string) => void;
  handleTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
  handleNavigateBlock: (fromId: string, dir: 'up' | 'down') => void;
}

export function useEditorBlockEditing({
  getBlocks,
  onChange,
  onFocusCmd,
  selectBlock,
  onActiveBlockChange,
  onEscapeToParentBelow,
  onEscapeToParentHeader,
  onMergeFirstChildIntoHeader,
}: UseEditorBlockEditingOptions): UseEditorBlockEditingResult {
  const handleSplitBlock = useCallback((id: string, before: string, after: string) => {
    const bs = getBlocks();
    const idx = bs.findIndex(b => b.id === id);
    if (idx < 0) return;

    if (onEscapeToParentBelow) {
      const result = applyToggleChildEnter(bs, id, before, after, true);
      if (result.action === 'escape_below') {
        onChange(result.children);
        onEscapeToParentBelow();
        return;
      }
      onChange(result.children);
      onFocusCmd({ blockId: result.focusBlockId, offset: 'start' });
      selectBlock(result.focusBlockId);
      return;
    }

    const cur = bs[idx];

    if (isListType(cur.type) && before === '' && after === '') {
      const next = exitEmptyListBlock(bs, id);
      onChange(next);
      onFocusCmd({ blockId: id, offset: 'start' });
      selectBlock(id);
      return;
    }

    const updatedCur: Block = { ...cur, content: before };
    const newType: BlockType = enterSplitBlockType(cur.type);
    const newBlock: Block = makeBlock(newType, {
      content: after,
      indent: cur.indent,
      checked: false,
      ...(isListType(newType) ? listSplitExtras(cur, newType) : {}),
    });

    let next = [...bs];
    next[idx] = updatedCur;
    next.splice(idx + 1, 0, newBlock);
    next = renumberNumberedLists(next);
    onChange(next);

    onFocusCmd({ blockId: newBlock.id, offset: 'start' });
    selectBlock(newBlock.id);
  }, [onChange, onEscapeToParentBelow, selectBlock]);

  const handleMergeWithPrev = useCallback((id: string, selfContent: string) => {
    const bs = getBlocks();
    const ids = flattenBlockIds(bs);
    const pos  = ids.indexOf(id);

    if (pos === 0 && onEscapeToParentHeader) {
      if (selfContent === '') {
        const cleaned = bs.filter(b => b.id !== id);
        onChange(cleaned.length > 0 ? cleaned : []);
        onEscapeToParentHeader();
        return;
      }
      if (onMergeFirstChildIntoHeader) {
        onMergeFirstChildIntoHeader(id, selfContent);
        return;
      }
    }

    if (pos <= 0) return;

    const selfBlock = findBlockById(bs, id);
    if (selfBlock != null && isToggleBlockType(selfBlock.type) && selfBlock.children.length > 0) {
      return;
    }

    const prevId    = ids[pos - 1];
    const prevBlock = findBlockById(bs, prevId);
    if (!prevBlock) return;

    const mergedContent = prevBlock.content + selfContent;
    const mergeOffset   = prevBlock.content.length;

    let next = updateBlockById(bs, prevId, b => ({ ...b, content: mergedContent }));
    next = deleteBlockById(next, id);
    onChange(next);

    onFocusCmd({ blockId: prevId, offset: mergeOffset });
    selectBlock(prevId);
  }, [onChange, onEscapeToParentHeader, onMergeFirstChildIntoHeader, selectBlock]);

  const handleContentChange = useCallback((id: string, content: string) => {
    onChange(updateBlockById(getBlocks(), id, b => ({ ...b, content })));
  }, [onChange]);

  const handleTableChange = useCallback((
    blockId: string, headers: string[], rows: string[][],
  ) => {
    onChange(updateBlockById(getBlocks(), blockId, b => ({
      ...b, tableHeaders: headers, tableRows: rows,
    })));
  }, [onChange]);

  const handleNavigateBlock = useCallback((fromId: string, dir: 'up' | 'down') => {
    const bs = getBlocks();
    const ids = flattenBlockIds(bs);
    const pos = ids.indexOf(fromId);
    if (pos < 0) return;
    const targetPos = dir === 'up' ? pos - 1 : pos + 1;
    if (targetPos < 0 || targetPos >= ids.length) return;
    const targetId = ids[targetPos];
    const targetBlock = findBlockById(bs, targetId);
    if (!targetBlock) return;
    selectBlock(targetId);
    onActiveBlockChange(targetId);
    onFocusCmd({
      blockId: targetId,
      offset: isTextBlockType(targetBlock.type)
        ? (dir === 'up' ? 'end' : 'start')
        : 'start',
    });
  }, [onActiveBlockChange, selectBlock]);

  return {
    handleSplitBlock,
    handleMergeWithPrev,
    handleContentChange,
    handleTableChange,
    handleNavigateBlock,
  };
}
