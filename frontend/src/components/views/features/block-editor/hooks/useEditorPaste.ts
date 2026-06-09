import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { type Block, findBlockById } from '../../../blockUtils';
import { applyPasteAtBlock, applyPasteBlocksAt } from '../../../blockPaste';
import {
  finishPastePipelineTrace,
  traceApplyPasteBlocksAtInput,
  traceApplyPasteBlocksAtOutput,
  traceStateAfterSetStateCallback,
  traceStateBeforeSetState,
} from '../../../pastePipelineTrace';
import type { FocusCmd } from '../../../selectionState';
import { getPasteBlockContext } from '../utils/blockEditorMutations';

export interface UseEditorPasteOptions {
  getBlocks: () => Block[];
  onChange: (blocks: Block[]) => void;
  onFocusCmd: (cmd: FocusCmd) => void;
  closeMenus: () => void;
  selectBlock: (id: string) => void;
}

export interface UseEditorPasteResult {
  handlePasteAt: (id: string, start: number, end: number, text: string) => void;
  handlePasteBlocksAt: (id: string, start: number, end: number, pasted: Block[]) => void;
}

export function useEditorPaste({
  getBlocks,
  onChange,
  onFocusCmd,
  closeMenus,
  selectBlock,
}: UseEditorPasteOptions): UseEditorPasteResult {
  const handlePasteAt = useCallback((id: string, start: number, end: number, text: string) => {
    const context = getPasteBlockContext(findBlockById(getBlocks(), id));
    const result = applyPasteAtBlock(getBlocks(), id, start, end, text, context);
    if (!result) return;
    onChange(result.blocks);
    closeMenus();
    onFocusCmd({ blockId: result.focusBlockId, offset: result.focusOffset });
    selectBlock(result.focusBlockId);
  }, [onChange, selectBlock, closeMenus]);

  const handlePasteBlocksAt = useCallback((
    id: string, start: number, end: number, pasted: Block[],
  ) => {
    const cur = findBlockById(getBlocks(), id);
    const context = getPasteBlockContext(cur);
    traceApplyPasteBlocksAtInput(
      id,
      cur?.type ?? '(missing)',
      start,
      end,
      pasted,
    );
    const result = applyPasteBlocksAt(getBlocks(), id, start, end, pasted, context);
    if (!result) {
      finishPastePipelineTrace();
      return;
    }
    traceApplyPasteBlocksAtOutput(result.blocks);
    traceStateBeforeSetState(result.blocks);
    flushSync(() => { onChange(result.blocks); });
    traceStateAfterSetStateCallback(result.blocks);
    finishPastePipelineTrace();
    closeMenus();
    onFocusCmd({ blockId: result.focusBlockId, offset: result.focusOffset });
    selectBlock(result.focusBlockId);
  }, [onChange, selectBlock, closeMenus]);

  return {
    handlePasteAt,
    handlePasteBlocksAt,
  };
}
