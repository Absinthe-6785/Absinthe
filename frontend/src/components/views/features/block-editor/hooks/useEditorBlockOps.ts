import { useCallback } from 'react';
import type React from 'react';
import {
  type Block,
  type BlockType,
  makeBlock,
  cloneBlockTree,
  updateBlockById,
  insertBlockAfter,
  deleteBlockById,
  findBlockById,
  convertBlock,
} from '../../../blockUtils';
import { deleteSelectedBlocks, duplicateSelectedBlocks } from '../../../multiBlockOps';
import type { TurnIntoMenuState } from '../../../editorTypes';
import type { FocusCmd } from '../../../selectionState';
import { insertBlockAtIndex, moveBlockInList } from '../utils/blockEditorMutations';

export interface UseEditorBlockOpsOptions {
  getBlocks: () => Block[];
  getRootBlocks: () => Block[];
  onChange: (blocks: Block[]) => void;
  onRootChange: (blocks: Block[]) => void;
  onFocusCmd: (cmd: FocusCmd) => void;
  selectBlock: (id: string) => void;
  clearSelection: () => void;
  onActiveBlockChange: (id: string | null) => void;
  getSelectedIds: () => Set<string>;
  setHandleMenu: React.Dispatch<React.SetStateAction<TurnIntoMenuState | null>>;
  setPinnedControlsId: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface UseEditorBlockOpsResult {
  handleAddBelow: (id: string) => void;
  handleAddAbove: (id: string) => void;
  handleDelete: (id: string) => void;
  handleDeleteSelected: () => void;
  handleDuplicateSelected: () => void;
  handleMove: (id: string, dir: 'up' | 'down') => void;
  handleConvert: (id: string, newType: BlockType) => void;
  handleDuplicate: (id: string) => void;
}

export function useEditorBlockOps({
  getBlocks,
  getRootBlocks,
  onChange,
  onRootChange,
  onFocusCmd,
  selectBlock,
  clearSelection,
  onActiveBlockChange,
  getSelectedIds,
  setHandleMenu,
  setPinnedControlsId,
}: UseEditorBlockOpsOptions): UseEditorBlockOpsResult {
  const handleAddBelow = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    onChange(insertBlockAfter(getBlocks(), id, nb));
    onFocusCmd({ blockId: nb.id, offset: 'start' });
    selectBlock(nb.id);
  }, [onChange, selectBlock]);

  const handleAddAbove = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    const bs = getBlocks();
    const idx = bs.findIndex(b => b.id === id);
    if (idx < 0) return;
    onChange(insertBlockAtIndex(bs, idx, nb));
    onFocusCmd({ blockId: nb.id, offset: 'start' });
    selectBlock(nb.id);
  }, [onChange, selectBlock]);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteBlockById(getBlocks(), id);
    onChange(updated.length > 0 ? updated : [makeBlock('paragraph')]);
    clearSelection();
  }, [onChange, clearSelection]);

  const handleDeleteSelected = useCallback(() => {
    const ids = getSelectedIds();
    if (!ids.size) return;
    const updated = deleteSelectedBlocks(getRootBlocks(), ids);
    onRootChange(updated);
    clearSelection();
    onActiveBlockChange(null);
  }, [getRootBlocks, onRootChange, onActiveBlockChange, clearSelection]);

  const handleDuplicateSelected = useCallback(() => {
    const ids = getSelectedIds();
    if (!ids.size) return;
    const updated = duplicateSelectedBlocks(getRootBlocks(), ids);
    onRootChange(updated);
  }, [getRootBlocks, onRootChange]);

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    const next = moveBlockInList(getBlocks(), id, dir);
    if (next) onChange(next);
  }, [onChange]);

  const handleConvert = useCallback((id: string, newType: BlockType) => {
    onChange(updateBlockById(getBlocks(), id, b => convertBlock(b, newType)));
    setHandleMenu(null);
    setPinnedControlsId(null);
    onFocusCmd({ blockId: id, offset: 'end' });
  }, [onChange]);

  const handleDuplicate = useCallback((id: string) => {
    const block = findBlockById(getBlocks(), id);
    if (!block) return;
    const copy = cloneBlockTree(block);
    onChange(insertBlockAfter(getBlocks(), id, copy));
    onFocusCmd({ blockId: copy.id, offset: 'start' });
    selectBlock(copy.id);
  }, [onChange, selectBlock]);

  return {
    handleAddBelow,
    handleAddAbove,
    handleDelete,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleMove,
    handleConvert,
    handleDuplicate,
  };
}
