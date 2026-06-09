import { useCallback, useMemo, useRef, useState } from 'react';
import type { Block } from '../../../../../blockUtils';
import { applyPointerSelection, clearSelection as emptySelection, selectSingle } from '../utils/blockSelection';
import type { SelectionCtxValue } from '../context/SelectionContext';

export interface UseEditorSelectionOptions {
  readOnly: boolean;
  getRootBlocks: () => Block[];
  onActiveBlockChange: (id: string | null) => void;
}

export interface UseEditorSelectionResult {
  selectedBlockIds: Set<string>;
  setSelectedBlockIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  anchorBlockId: string | null;
  setAnchorBlockId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedBlockIdsRef: React.MutableRefObject<Set<string>>;
  selectBlock: (id: string) => void;
  handleBlockSelect: (id: string, e: React.MouseEvent) => void;
  clearSelection: () => void;
  selectionCtx: SelectionCtxValue;
}

export function useEditorSelection({
  readOnly,
  getRootBlocks,
  onActiveBlockChange,
}: UseEditorSelectionOptions): UseEditorSelectionResult {
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(() => new Set());
  const [anchorBlockId, setAnchorBlockId] = useState<string | null>(null);
  const selectedBlockIdsRef = useRef(selectedBlockIds);
  selectedBlockIdsRef.current = selectedBlockIds;

  const selectBlock = useCallback((id: string) => {
    setSelectedBlockIds(selectSingle(id));
    setAnchorBlockId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBlockIds(emptySelection());
    setAnchorBlockId(null);
  }, []);

  const handleBlockSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (readOnly) return;
    const { selected, anchorId } = applyPointerSelection(
      getRootBlocks(),
      selectedBlockIdsRef.current,
      anchorBlockId,
      id,
      { shiftKey: e.shiftKey, additiveKey: e.metaKey || e.ctrlKey },
    );
    setSelectedBlockIds(selected);
    setAnchorBlockId(anchorId);
    onActiveBlockChange(id);
  }, [readOnly, getRootBlocks, anchorBlockId, onActiveBlockChange]);

  const selectionCtx = useMemo<SelectionCtxValue>(() => ({
    selectedBlockIds,
    onBlockSelect: handleBlockSelect,
  }), [selectedBlockIds, handleBlockSelect]);

  return {
    selectedBlockIds,
    setSelectedBlockIds,
    anchorBlockId,
    setAnchorBlockId,
    selectedBlockIdsRef,
    selectBlock,
    handleBlockSelect,
    clearSelection,
    selectionCtx,
  };
}
