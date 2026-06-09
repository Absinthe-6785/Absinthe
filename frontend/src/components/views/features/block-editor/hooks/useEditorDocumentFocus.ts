import { useCallback, useEffect, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import type { Block } from '../../../blockUtils';
import {
  focusNearestEditable,
  shouldHandleDocumentFocus,
  type DocumentFocusAction,
} from '../../../documentFocus';
import { dispatchFocusCommand, type FocusCmd } from '../../../selectionState';
import type { DocumentFocusApiRef } from '../types/blockEditorTypes';

export interface UseEditorDocumentFocusOptions {
  readOnly: boolean;
  depth: number;
  getRootBlocks: () => Block[];
  onRootChange: (blocks: Block[]) => void;
  selectBlock: (id: string) => void;
  onActiveBlockChange: (id: string | null) => void;
  onFocusCmd: (cmd: FocusCmd) => void;
  editorRootRef: RefObject<HTMLDivElement | null>;
  documentFocusApiRef?: DocumentFocusApiRef;
}

export interface UseEditorDocumentFocusResult {
  handleDocumentFocusPointerDown: (e: React.PointerEvent) => void;
}

export function useEditorDocumentFocus({
  readOnly,
  depth,
  getRootBlocks,
  onRootChange,
  selectBlock,
  onActiveBlockChange,
  onFocusCmd,
  editorRootRef,
  documentFocusApiRef,
}: UseEditorDocumentFocusOptions): UseEditorDocumentFocusResult {
  const applyDocumentFocusAction = useCallback((action: DocumentFocusAction) => {
    if (action.kind === 'toggle-footer') {
      if (action.created) {
        flushSync(() => {
          onRootChange(action.blocks);
        });
      }
      onActiveBlockChange(action.focusBlockId);
      const focus = { blockId: action.focusBlockId, offset: 'start' as const };
      onFocusCmd(focus);
      requestAnimationFrame(() => dispatchFocusCommand(focus));
      return;
    }
    if (action.kind === 'append') {
      flushSync(() => {
        onRootChange([...getRootBlocks(), action.block]);
      });
      selectBlock(action.block.id);
      onActiveBlockChange(action.block.id);
      const focus = { blockId: action.block.id, offset: 'start' as const };
      onFocusCmd(focus);
      requestAnimationFrame(() => dispatchFocusCommand(focus));
      return;
    }
    selectBlock(action.blockId);
    onActiveBlockChange(action.blockId);
    onFocusCmd({ blockId: action.blockId, offset: action.offset });
  }, [getRootBlocks, onRootChange, selectBlock, onActiveBlockChange]);

  const handleDocumentFocusPointerDown = useCallback((e: React.PointerEvent) => {
    if (readOnly || depth !== 0) return;
    if (e.button !== 0) return;
    if (!shouldHandleDocumentFocus(e.target)) return;
    const root = editorRootRef.current;
    if (!root) return;
    applyDocumentFocusAction(focusNearestEditable(e.clientY, getRootBlocks(), root));
    e.preventDefault();
  }, [readOnly, depth, getRootBlocks, applyDocumentFocusAction]);

  useEffect(() => {
    if (!documentFocusApiRef) return;
    documentFocusApiRef.current = { handlePointerDown: handleDocumentFocusPointerDown };
    return () => { documentFocusApiRef.current = null; };
  }, [documentFocusApiRef, handleDocumentFocusPointerDown]);

  return { handleDocumentFocusPointerDown };
}
