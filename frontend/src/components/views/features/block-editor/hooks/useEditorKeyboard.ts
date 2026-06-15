import { useEffect, type RefObject } from 'react';
import type { Block } from '../../../blockUtils';
import { shouldDeleteSelectedBlocks } from '../../../blockKeyboard';
import { extendSelectionByArrow } from '../features/selection';
import { handleSelectAllKeydown } from '../features/selection/utils/documentSelectAll';

export interface UseEditorKeyboardOptions {
  readOnly: boolean;
  depth: number;
  getSelectedIds: () => Set<string>;
  getRootBlocks?: () => Block[];
  anchorBlockId?: string | null;
  activeBlockId?: string | null;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onExtendSelection?: (selected: Set<string>, anchorId: string) => void;
  documentRootRef?: RefObject<HTMLElement | null>;
}

export function useEditorKeyboard({
  readOnly,
  depth,
  getSelectedIds,
  getRootBlocks,
  anchorBlockId = null,
  activeBlockId = null,
  onClearSelection,
  onDeleteSelected,
  onExtendSelection,
  documentRootRef,
}: UseEditorKeyboardOptions): void {
  useEffect(() => {
    if (readOnly || depth !== 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (handleSelectAllKeydown(e, documentRootRef?.current ?? null)) return;

      if (e.key === 'Escape') {
        if (getSelectedIds().size > 0) {
          onClearSelection();
        }
        return;
      }

      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && getRootBlocks && onExtendSelection) {
        const selected = getSelectedIds();
        const focusId = selected.size > 0
          ? [...selected][e.key === 'ArrowDown' ? selected.size - 1 : 0]!
          : activeBlockId;
        if (!focusId) return;
        const target = e.target as HTMLElement | null;
        if (!target?.closest('.be-editor-root')) return;
        const extended = extendSelectionByArrow(
          getRootBlocks(),
          anchorBlockId,
          focusId,
          e.key === 'ArrowUp' ? 'up' : 'down',
        );
        if (extended) {
          e.preventDefault();
          onExtendSelection(extended.selected, extended.anchorId);
        }
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!shouldDeleteSelectedBlocks(e, getSelectedIds())) return;
      e.preventDefault();
      onDeleteSelected();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    readOnly,
    depth,
    onDeleteSelected,
    onClearSelection,
    getSelectedIds,
    getRootBlocks,
    anchorBlockId,
    activeBlockId,
    onExtendSelection,
    documentRootRef,
  ]);
}
