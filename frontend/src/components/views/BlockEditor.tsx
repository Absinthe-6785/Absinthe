/**
 * BlockEditor.tsx — Phase 3: 드래그&드롭 + 슬래시 커맨드 통합
 *
 * Phase 3 추가 사항:
 *  - 드래그&드롭 순서 변경 (Pointer Events 기반, 외부 라이브러리 없음)
 *    · GripVertical 핸들 pointerdown → 드래그 시작
 *    · 드래그 중 블록 위/아래에 파란 삽입 인디케이터 표시
 *    · pointerup → 블록 배열 재정렬
 *  - 슬래시 커맨드 통합 (/ → 메뉴 → 타입 전환)
 *    · '/' 입력 시 커서 위치에서 SlashMenu 팝업
 *    · 검색어 실시간 필터링
 *    · 선택 시 블록 타입 변환 + '/쿼리' 텍스트 제거 + 포커스 복원
 *    · Escape / 블러 시 메뉴 닫힘
 */

import React, {
  useState, useRef, useCallback, useMemo, useEffect, useContext,
} from 'react';
import { flushSync } from 'react-dom';
import {
  type Block, type BlockType,
  makeBlock, cloneBlockTree,
  updateBlockById, insertBlockAfter, deleteBlockById,
  findBlockById, flattenBlockIds,
  isTextBlockType,
  blocksToMarkdown, markdownToBlocks,
  convertBlock,
} from './blockUtils';
import {
  applyToggleChildEnter,
  applyToggleChildMergeIntoHeader,
  applyToggleHeaderEnter,
} from './toggleNesting';
import { indentBlock, outdentBlock } from './blockTree';
import { blockPlaceholder } from './blockPlaceholders';
import { resolveSlashCommand } from './slashCommands';
import { collectEditorSearchMatches, shouldHighlightBlock, type EditorSearchScope } from './editorSearch';
import { type BlockTint } from './blockColors';
import {
  finishPastePipelineTrace,
  traceApplyPasteBlocksAtInput,
  traceApplyPasteBlocksAtOutput,
  traceStateAfterSetStateCallback,
  traceStateBeforeSetState,
} from './pastePipelineTrace';
import { applyPasteAtBlock, applyPasteBlocksAt } from './blockPaste';
import {
  exitEmptyListBlock,
  isListType,
  listSplitExtras,
  numberedMarker,
  renumberNumberedLists,
} from './listBlocks';
import {
  canMoveIntoPreviousToggle, getPreviousSiblingToggleId, isInsideToggle,
  moveBlockIntoToggle, moveBlockOutOfToggle,
} from './blockTree';
import { useDragDrop } from './editorDragDrop';
import { SlashMenu } from './SlashMenu';
import { recordSlashUsage } from './slashRecent';
import type {
  BlockEditorColors, TurnIntoMenuState,
  SlashMenuState, WikiMenuState,
} from './editorTypes';
import { loadValidatedBlocks } from './documentRecovery';
import type { ToggleNestedRenderer } from './toggleRender';
import { applyPointerSelection, clearSelection as emptySelection, selectSingle } from './blockSelection';
import {
  beginGutterSelection,
  hitTestBlockIdFromPoint,
  isGutterDragStart,
  updateGutterSelection,
} from './blockGutterSelection';
import { deleteSelectedBlocks, duplicateSelectedBlocks } from './multiBlockOps';
import { readingRootClass } from './editorReading';
import { BlockContextMenu } from './BlockContextMenu';
import { SelectionToolbar } from './SelectionToolbar';
import { WikiMenu } from './WikiMenu';
import { insertWikiAtCaret } from './wikiNavigation';
import {
  dispatchFocusCommand, getFocusHandler, registerFocusHandler,
  type FocusCmd,
} from './selectionState';
import { EditorChromeStyles } from './EditorChrome';
import {
  focusNearestEditable,
  isFirstEmptyRootParagraph,
  shouldHandleDocumentFocus,
  type DocumentFocusAction,
} from './documentFocus';
import { SingleBlock } from './features/block-editor/components/SingleBlock';
import { BlocksCtx, type BlocksCtxValue } from './features/block-editor/contexts/BlocksContext';
import { SelectionCtx, type SelectionCtxValue } from './features/block-editor/contexts/SelectionContext';
import { DragCtx } from './features/block-editor/contexts/DragContext';
import {
  FOCUS_CMD_RESET_MS,
  NESTED_EDITOR_PADDING_LEFT_PX,
  noopBlockChange,
} from './features/block-editor/constants/blockEditorConstants';
import type { BlockEditorProps, BlockEditorInnerProps } from './features/block-editor/types/blockEditorTypes';
import { buildHeadingIndexById } from './features/block-editor/utils/headingIndex';
import {
  applySlashMenuTypeChange,
  enterSplitBlockType,
  getPasteBlockContext,
  insertBlockAtIndex,
  moveBlockInList,
} from './features/block-editor/utils/blockEditorMutations';
import { buildEditorCssVariables } from './features/block-editor/utils/editorThemeStyle';
import { useEditorChrome } from './features/block-editor/hooks/useEditorChrome';
import { useEditorCopyEffects } from './features/block-editor/hooks/useEditorCopyEffects';
import { useEditorKeyboard } from './features/block-editor/hooks/useEditorKeyboard';

export type { BlockEditorColors } from './editorTypes';
export type { BlockEditorHandle } from './useBlockEditor';
export { useBlockEditor } from './useBlockEditor';

// ── 내부 재귀 렌더러 ─────────────────────────────────────────────────
function BlockEditorInner({ blocks, onChange, colors: c, readOnly, searchQuery, depth,
  wikiTargets, onWikiNavigate, onActiveBlockChange,
  externalFocusId, onExternalFocusConsumed,
  onEscapeToParentBelow, onEscapeToParentHeader, onMergeFirstChildIntoHeader,
  getRootBlocks: getRootBlocksProp, onRootChange: onRootChangeProp,
  searchScope = 'document', searchMatchIndex = 0,
  documentFocusApiRef,
}: BlockEditorInnerProps) {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const getRootBlocks = useCallback(
    () => (getRootBlocksProp ? getRootBlocksProp() : blocksRef.current),
    [getRootBlocksProp],
  );
  const onRootChange = onRootChangeProp ?? onChange;

  const handleIndentBlock = useCallback((blockId: string) => {
    const next = indentBlock(getRootBlocks(), blockId);
    if (next) onRootChange(next);
  }, [getRootBlocks, onRootChange]);

  const handleOutdentBlock = useCallback((blockId: string) => {
    const next = outdentBlock(getRootBlocks(), blockId);
    if (next) onRootChange(next);
  }, [getRootBlocks, onRootChange]);

  const handleMoveIntoPrevToggle = useCallback((blockId: string) => {
    const root = getRootBlocks();
    const toggleId = getPreviousSiblingToggleId(root, blockId);
    if (!toggleId) return;
    const next = moveBlockIntoToggle(root, blockId, toggleId);
    if (next) onRootChange(next);
  }, [getRootBlocks, onRootChange]);

  const handleMoveOutOfToggleBlock = useCallback((blockId: string) => {
    const next = moveBlockOutOfToggle(getRootBlocks(), blockId);
    if (next) onRootChange(next);
  }, [getRootBlocks, onRootChange]);

  const handleCopyBlockLink = useCallback((blockId: string) => {
    void navigator.clipboard?.writeText(`#block-${blockId}`);
  }, []);

  const handleSetTint = useCallback((blockId: string, tint: BlockTint) => {
    onRootChange(updateBlockById(getRootBlocks(), blockId, b => ({
      ...b,
      tint: tint === 'default' ? undefined : tint,
    })));
  }, [getRootBlocks, onRootChange]);

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const handleActiveBlockChange = useCallback((id: string | null) => {
    setActiveBlockId(id);
    onActiveBlockChange?.(id);
  }, [onActiveBlockChange]);

  const searchQueryFor = useCallback((blockId: string) => {
    if (!searchQuery.trim()) return '';
    return shouldHighlightBlock(searchScope, blockId, activeBlockId) ? searchQuery : '';
  }, [searchQuery, searchScope, activeBlockId]);

  const blocksCtx = useMemo<BlocksCtxValue>(() => ({
    getBlocks: () => blocksRef.current,
    onChange,
  }), [onChange]);

  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(() => new Set());
  const [anchorBlockId, setAnchorBlockId] = useState<string | null>(null);
  const selectedBlockIdsRef = useRef(selectedBlockIds);
  selectedBlockIdsRef.current = selectedBlockIds;
  const [focusCmd, setFocusCmd] = useState<FocusCmd | null>(null);
  // Phase 3: 슬래시 커맨드
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  // 위키링크 자동완성
  const [wikiMenu, setWikiMenu] = useState<WikiMenuState | null>(null);
  // Phase 3: 드래그&드롭 — root-level only; nested editors share via DragCtx
  const parentDrag = useContext(DragCtx);
  const localDrag = useDragDrop(getRootBlocks, onRootChange, depth === 0 ? {
    getSelectedIds: () => [...selectedBlockIdsRef.current],
    getScrollContainer: () =>
      editorRootRef.current?.closest('.editor-drop-zone') as HTMLElement | null,
  } : undefined);
  const { dragState, bindGripPointer, getDragProps } = depth === 0 ? localDrag : parentDrag!;
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const gutterDragCleanupRef = useRef<(() => void) | null>(null);
  const [isGutterDragging, setIsGutterDragging] = useState(false);

  const onPinSelection = useCallback((id: string) => {
    setSelectedBlockIds(selectSingle(id));
    setAnchorBlockId(id);
  }, []);

  const {
    handleMenu,
    setHandleMenu,
    pinnedControlsId,
    setPinnedControlsId,
    handleChromeEnter,
    handleChromeLeave,
    handleToggleControlsPin,
    controlsVisibleFor,
  } = useEditorChrome({ onPinSelection });

  useEffect(() => () => {
    gutterDragCleanupRef.current?.();
  }, []);

  const getBlockType = useCallback(
    (blockId: string) => findBlockById(blocksRef.current, blockId)?.type,
    [],
  );

  const selectBlock = useCallback((id: string) => {
    setSelectedBlockIds(selectSingle(id));
    setAnchorBlockId(id);
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
    handleActiveBlockChange(id);
  }, [readOnly, getRootBlocks, anchorBlockId, handleActiveBlockChange]);

  const showPersistentPlaceholder = useCallback((blockId: string) => {
    if (depth !== 0 || readOnly) return false;
    return isFirstEmptyRootParagraph(getRootBlocks(), blockId);
  }, [depth, readOnly, getRootBlocks]);

  const applyDocumentFocusAction = useCallback((action: DocumentFocusAction) => {
    if (action.kind === 'toggle-footer') {
      if (action.created) {
        flushSync(() => {
          onRootChange(action.blocks);
        });
      }
      handleActiveBlockChange(action.focusBlockId);
      const focus = { blockId: action.focusBlockId, offset: 'start' as const };
      setFocusCmd(focus);
      requestAnimationFrame(() => dispatchFocusCommand(focus));
      return;
    }
    if (action.kind === 'append') {
      flushSync(() => {
        onRootChange([...getRootBlocks(), action.block]);
      });
      selectBlock(action.block.id);
      handleActiveBlockChange(action.block.id);
      const focus = { blockId: action.block.id, offset: 'start' as const };
      setFocusCmd(focus);
      requestAnimationFrame(() => dispatchFocusCommand(focus));
      return;
    }
    selectBlock(action.blockId);
    handleActiveBlockChange(action.blockId);
    setFocusCmd({ blockId: action.blockId, offset: action.offset });
  }, [getRootBlocks, onRootChange, selectBlock, handleActiveBlockChange]);

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

  const handleGutterPointerDown = useCallback((blockId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || depth !== 0) return;
    if (!isGutterDragStart(e.target)) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();

    gutterDragCleanupRef.current?.();

    const root = editorRootRef.current;
    root?.setPointerCapture(e.pointerId);
    beginGutterSelection(blockId, e.pointerId);
    setIsGutterDragging(true);

    const anchorId = blockId;
    const applyHover = (hoverId: string) => {
      const selected = updateGutterSelection(getRootBlocks(), anchorId, hoverId);
      setSelectedBlockIds(selected);
      setAnchorBlockId(anchorId);
      handleActiveBlockChange(hoverId);
    };

    applyHover(blockId);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const hoverId = hitTestBlockIdFromPoint(ev.clientX, ev.clientY, root);
      if (hoverId) applyHover(hoverId);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      root?.releasePointerCapture(ev.pointerId);
      setIsGutterDragging(false);
      cleanup();
      gutterDragCleanupRef.current = null;
    };
    gutterDragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [readOnly, depth, getRootBlocks, handleActiveBlockChange]);

  const selectionCtx = useMemo<SelectionCtxValue>(() => ({
    selectedBlockIds,
    onBlockSelect: handleBlockSelect,
  }), [selectedBlockIds, handleBlockSelect]);

  const parentSelection = useContext(SelectionCtx);
  const activeSelection = depth === 0 ? selectionCtx : parentSelection;

  const handleAddBelow = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    onChange(insertBlockAfter(blocksRef.current, id, nb));
    setFocusCmd({ blockId: nb.id, offset: 'start' });
    selectBlock(nb.id);
  }, [onChange, selectBlock]);

  const handleAddAbove = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    const bs = blocksRef.current;
    const idx = bs.findIndex(b => b.id === id);
    if (idx < 0) return;
    onChange(insertBlockAtIndex(bs, idx, nb));
    setFocusCmd({ blockId: nb.id, offset: 'start' });
    selectBlock(nb.id);
  }, [onChange, selectBlock]);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteBlockById(blocksRef.current, id);
    onChange(updated.length > 0 ? updated : [makeBlock('paragraph')]);
    setSelectedBlockIds(emptySelection());
    setAnchorBlockId(null);
  }, [onChange]);

  const handleDeleteSelected = useCallback(() => {
    const ids = selectedBlockIdsRef.current;
    if (!ids.size) return;
    const updated = deleteSelectedBlocks(getRootBlocks(), ids);
    onRootChange(updated);
    setSelectedBlockIds(emptySelection());
    setAnchorBlockId(null);
    handleActiveBlockChange(null);
  }, [getRootBlocks, onRootChange, handleActiveBlockChange]);

  const handleDuplicateSelected = useCallback(() => {
    const ids = selectedBlockIdsRef.current;
    if (!ids.size) return;
    const updated = duplicateSelectedBlocks(getRootBlocks(), ids);
    onRootChange(updated);
  }, [getRootBlocks, onRootChange]);

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    const next = moveBlockInList(blocksRef.current, id, dir);
    if (next) onChange(next);
  }, [onChange]);

  const handleConvert = useCallback((id: string, newType: BlockType) => {
    onChange(updateBlockById(blocksRef.current, id, b => convertBlock(b, newType)));
    setHandleMenu(null);
    setPinnedControlsId(null);
    setFocusCmd({ blockId: id, offset: 'end' });
  }, [onChange]);

  const handleDuplicate = useCallback((id: string) => {
    const block = findBlockById(blocksRef.current, id);
    if (!block) return;
    const copy = cloneBlockTree(block);
    onChange(insertBlockAfter(blocksRef.current, id, copy));
    setFocusCmd({ blockId: copy.id, offset: 'start' });
    selectBlock(copy.id);
  }, [onChange, selectBlock]);

  useEffect(() => {
    if (!searchQuery.trim() || searchScope === 'all') return;
    const matches = collectEditorSearchMatches(getRootBlocks(), searchQuery);
    if (!matches.length) return;
    const m = matches[searchMatchIndex % matches.length];
    selectBlock(m.blockId);
    handleActiveBlockChange(m.blockId);
    setFocusCmd({ blockId: m.blockId, offset: m.offset });
  }, [searchMatchIndex, searchQuery, searchScope, getRootBlocks, handleActiveBlockChange, selectBlock]);

  const renderBlockMenu = (state: TurnIntoMenuState, onDone: () => void) => {
    const id = state.blockId;
    const root = getRootBlocks();
    const multiCount = selectedBlockIds.size > 1 && selectedBlockIds.has(id)
      ? selectedBlockIds.size
      : undefined;
    return (
      <BlockContextMenu
        blockId={id}
        currentType={findBlockById(blocksRef.current, id)?.type ?? 'paragraph'}
        anchorY={state.anchorY}
        anchorX={state.anchorX}
        colors={c}
        selectionCount={multiCount}
        onAddAbove={() => { handleAddAbove(id); onDone(); }}
        onAddBelow={() => { handleAddBelow(id); onDone(); }}
        onDuplicate={() => {
          if (multiCount) handleDuplicateSelected();
          else handleDuplicate(id);
          onDone();
        }}
        onIndent={() => { handleIndentBlock(id); onDone(); }}
        onOutdent={() => { handleOutdentBlock(id); onDone(); }}
        onMoveIntoToggle={() => { handleMoveIntoPrevToggle(id); onDone(); }}
        onMoveOutOfToggle={() => { handleMoveOutOfToggleBlock(id); onDone(); }}
        canMoveIntoToggle={canMoveIntoPreviousToggle(root, id)}
        canMoveOutOfToggle={isInsideToggle(root, id)}
        onSetTint={tint => { handleSetTint(id, tint); onDone(); }}
        onCopyLink={() => { handleCopyBlockLink(id); onDone(); }}
        onSelect={type => handleConvert(id, type)}
        onDelete={() => {
          if (multiCount) handleDeleteSelected();
          else handleDelete(id);
          onDone();
        }}
        onMoveUp={() => { handleMove(id, 'up'); onDone(); }}
        onMoveDown={() => { handleMove(id, 'down'); onDone(); }}
        onClose={onDone}
        onChromeEnter={handleChromeEnter}
        onChromeLeave={handleChromeLeave}
      />
    );
  };

  // ── Phase 2: 블록 분리 (Enter) ───────────────────────────────────
  const handleSplitBlock = useCallback((id: string, before: string, after: string) => {
    const bs = blocksRef.current;
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
      setFocusCmd({ blockId: result.focusBlockId, offset: 'start' });
      selectBlock(result.focusBlockId);
      return;
    }

    const cur = bs[idx];

    if (isListType(cur.type) && before === '' && after === '') {
      const next = exitEmptyListBlock(bs, id);
      onChange(next);
      setFocusCmd({ blockId: id, offset: 'start' });
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

    setFocusCmd({ blockId: newBlock.id, offset: 'start' });
    selectBlock(newBlock.id);
  }, [onChange, onEscapeToParentBelow, selectBlock]);

  // ── Phase 2: 블록 병합 (Backspace at start) ──────────────────────
  const handleMergeWithPrev = useCallback((id: string, selfContent: string) => {
    const bs = blocksRef.current;
    const ids = flattenBlockIds(bs);
    const pos  = ids.indexOf(id);

    // Toggle Step 3: 첫 번째 자식 Backspace@0 → 헤더 병합 또는 빈 자식 탈출
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

    const prevId    = ids[pos - 1];
    const prevBlock = findBlockById(bs, prevId);
    if (!prevBlock) return;

    const mergedContent = prevBlock.content + selfContent;
    const mergeOffset   = prevBlock.content.length;

    let next = updateBlockById(bs, prevId, b => ({ ...b, content: mergedContent }));
    next = deleteBlockById(next, id);
    onChange(next);

    setFocusCmd({ blockId: prevId, offset: mergeOffset });
    selectBlock(prevId);
  }, [onChange, onEscapeToParentHeader, onMergeFirstChildIntoHeader, selectBlock]);

  // ── Phase 2: 블록 content 변경 ───────────────────────────────────
  const handleContentChange = useCallback((id: string, content: string) => {
    onChange(updateBlockById(blocksRef.current, id, b => ({ ...b, content })));
  }, [onChange]);

  const handlePasteAt = useCallback((id: string, start: number, end: number, text: string) => {
    const context = getPasteBlockContext(findBlockById(blocksRef.current, id));
    const result = applyPasteAtBlock(blocksRef.current, id, start, end, text, context);
    if (!result) return;
    onChange(result.blocks);
    setSlashMenu(null);
    setWikiMenu(null);
    setFocusCmd({ blockId: result.focusBlockId, offset: result.focusOffset });
    selectBlock(result.focusBlockId);
  }, [onChange, selectBlock]);

  const handlePasteBlocksAt = useCallback((
    id: string, start: number, end: number, pasted: Block[],
  ) => {
    const cur = findBlockById(blocksRef.current, id);
    const context = getPasteBlockContext(cur);
    traceApplyPasteBlocksAtInput(
      id,
      cur?.type ?? '(missing)',
      start,
      end,
      pasted,
    );
    const result = applyPasteBlocksAt(blocksRef.current, id, start, end, pasted, context);
    if (!result) {
      finishPastePipelineTrace();
      return;
    }
    traceApplyPasteBlocksAtOutput(result.blocks);
    traceStateBeforeSetState(result.blocks);
    flushSync(() => { onChange(result.blocks); });
    traceStateAfterSetStateCallback(result.blocks);
    finishPastePipelineTrace();
    setSlashMenu(null);
    setWikiMenu(null);
    setFocusCmd({ blockId: result.focusBlockId, offset: result.focusOffset });
    selectBlock(result.focusBlockId);
  }, [onChange, selectBlock]);

  // ── Toggle Step 1: 빈 toggle에 첫 자식 블록 생성 ─────────────────
  const handleToggleAddChild = useCallback((toggleBlockId: string) => {
    const newChild = makeBlock('paragraph');
    onChange(updateBlockById(blocksRef.current, toggleBlockId, b => ({
      ...b,
      collapsed: false,
      children: [newChild],
    })));
    // 새로 생성된 자식 블록으로 포커스
    requestAnimationFrame(() => {
      const handler = getFocusHandler(newChild.id);
      if (handler) handler({ blockId: newChild.id, offset: 'start' });
    });
  }, [onChange]);

  // ── Toggle Step 2: 헤더 Enter → 자식 블록 생성 & 포커스 ──────────
  const handleToggleEnter = useCallback((toggleBlockId: string, before: string, after: string) => {
    const toggle = findBlockById(blocksRef.current, toggleBlockId);
    if (!toggle) return;
    const { headerContent, children, focusBlockId } = applyToggleHeaderEnter(
      toggle.children,
      before,
      after,
    );
    onChange(updateBlockById(blocksRef.current, toggleBlockId, b => ({
      ...b,
      content: headerContent,
      collapsed: false,
      children,
    })));
    requestAnimationFrame(() => {
      const handler = getFocusHandler(focusBlockId);
      if (handler) handler({ blockId: focusBlockId, offset: 'start' });
    });
  }, [onChange]);

  // ── Table: 셀/행/열 변경 ─────────────────────────────────────────
  const handleTableChange = useCallback((
    blockId: string, headers: string[], rows: string[][],
  ) => {
    onChange(updateBlockById(blocksRef.current, blockId, b => ({
      ...b, tableHeaders: headers, tableRows: rows,
    })));
  }, [onChange]);

  const handleNavigateBlock = useCallback((fromId: string, dir: 'up' | 'down') => {
    const bs = blocksRef.current;
    const ids = flattenBlockIds(bs);
    const pos = ids.indexOf(fromId);
    if (pos < 0) return;
    const targetPos = dir === 'up' ? pos - 1 : pos + 1;
    if (targetPos < 0 || targetPos >= ids.length) return;
    const targetId = ids[targetPos];
    const targetBlock = findBlockById(bs, targetId);
    if (!targetBlock) return;
    selectBlock(targetId);
    handleActiveBlockChange(targetId);
    setFocusCmd({
      blockId: targetId,
      offset: isTextBlockType(targetBlock.type)
        ? (dir === 'up' ? 'end' : 'start')
        : 'start',
    });
  }, [handleActiveBlockChange, selectBlock]);

  // 외부 포커스 요청 (이미지 삽입 직후 등)
  useEffect(() => {
    if (!externalFocusId) return;
    selectBlock(externalFocusId);
    handleActiveBlockChange(externalFocusId);
    setFocusCmd({ blockId: externalFocusId, offset: 'start' });
    onExternalFocusConsumed?.();
  }, [externalFocusId, handleActiveBlockChange, onExternalFocusConsumed, selectBlock]);

  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!slashMenu) return;
    const { blockId, query } = slashMenu;

    onChange(updateBlockById(blocksRef.current, blockId, b => applySlashMenuTypeChange(b, type, query)));

    recordSlashUsage(type);
    setSlashMenu(null);
    // 타입 변환 후 해당 블록 포커스 (끝)
    setFocusCmd({ blockId, offset: 'end' });
  }, [slashMenu, onChange]);

  // ── 위키링크 선택 → 포커스된 contentEditable에 직접 [[제목]] 삽입 ──
  // 상태 round-trip 대신 DOM을 직접 조작해 캐럿 위치를 정확히 유지한다.
  const handleWikiSelect = useCallback((title: string) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.isContentEditable) {
      const text = insertWikiAtCaret(el, title, c, wikiTargets, searchQuery);
      if (wikiMenu) handleContentChange(wikiMenu.blockId, text);
    }
    setWikiMenu(null);
  }, [wikiMenu, handleContentChange, c, wikiTargets, searchQuery]);

  // focusCmd 소비 후 리셋
  useEffect(() => {
    if (focusCmd) {
      const t = setTimeout(() => setFocusCmd(null), FOCUS_CMD_RESET_MS);
      return () => clearTimeout(t);
    }
  }, [focusCmd]);

  const headingIndexById = useMemo(
    () => buildHeadingIndexById(blocks, depth),
    [blocks, depth],
  );

  const renderToggleNested = useCallback<ToggleNestedRenderer>((toggleBlock) => (
    <BlockEditorInner
      blocks={toggleBlock.children}
      onChange={children => {
        onChange(updateBlockById(blocksRef.current, toggleBlock.id, b => ({ ...b, children })));
      }}
      colors={c}
      readOnly={readOnly}
      searchQuery={searchQuery}
      depth={depth + 1}
      wikiTargets={wikiTargets}
      onWikiNavigate={onWikiNavigate}
      onActiveBlockChange={onActiveBlockChange}
      externalFocusId={undefined}
      getRootBlocks={getRootBlocks}
      onRootChange={onRootChange}
      searchScope={searchScope}
      searchMatchIndex={searchMatchIndex}
      onEscapeToParentBelow={() => {
        const newBlock = makeBlock('paragraph');
        onChange(insertBlockAfter(getRootBlocks(), toggleBlock.id, newBlock));
        requestAnimationFrame(() => {
          const h = getFocusHandler(newBlock.id);
          if (h) h({ blockId: newBlock.id, offset: 'start' });
        });
      }}
      onEscapeToParentHeader={() => {
        const h = getFocusHandler(toggleBlock.id);
        if (h) h({ blockId: toggleBlock.id, offset: 'end' });
      }}
      onMergeFirstChildIntoHeader={(childId, childContent) => {
        const root = getRootBlocks();
        const toggle = findBlockById(root, toggleBlock.id);
        if (!toggle) return;
        const result = applyToggleChildMergeIntoHeader(
          toggle.content,
          toggle.children,
          childId,
          childContent,
        );
        if (!result) return;
        onChange(updateBlockById(root, toggleBlock.id, t => ({
          ...t,
          content: result.headerContent,
          children: result.children,
        })));
        requestAnimationFrame(() => {
          const h = getFocusHandler(toggleBlock.id);
          if (h) h({ blockId: toggleBlock.id, offset: result.focusOffset });
        });
      }}
    />
  ), [
    onChange, c, readOnly, searchQuery, depth, wikiTargets, onWikiNavigate,
    onActiveBlockChange, getRootBlocks, onRootChange, searchScope, searchMatchIndex,
  ]);

  useEditorKeyboard({
    readOnly,
    depth,
    getSelectedIds: () => selectedBlockIdsRef.current,
    onClearSelection: () => {
      setSelectedBlockIds(emptySelection());
      setAnchorBlockId(null);
    },
    onDeleteSelected: handleDeleteSelected,
  });

  useEditorCopyEffects({
    readOnly,
    depth,
    getRootBlocks,
    getSelectedIds: () => selectedBlockIdsRef.current,
  });

  const editorBody = (
    <>
      <div
        ref={depth === 0 ? editorRootRef : undefined}
        className={`be-editor-root${depth > 0 ? ' be-editor-nested' : ''}${isGutterDragging ? ' be-gutter-dragging' : ''}`}
        style={{ paddingLeft: readOnly ? 0 : (depth > 0 ? NESTED_EDITOR_PADDING_LEFT_PX : 0), position:'relative' }}
        onPointerDown={depth === 0 && !readOnly ? handleDocumentFocusPointerDown : undefined}
      >
        {blocks.map(block => (
          <SingleBlock
            key={block.id} block={block}
            colors={c}
            isSelected={activeSelection?.selectedBlockIds.has(block.id) ?? false}
            activeBlockId={activeBlockId}
            onBlockSelect={activeSelection?.onBlockSelect ?? (() => {})}
            onAddBelow={handleAddBelow} readOnly={readOnly}
            searchQuery={searchQuery} depth={depth} wikiTargets={wikiTargets}
            headingIndex={headingIndexById[block.id]}
            onWikiNavigate={onWikiNavigate}
            onSplitBlock={handleSplitBlock}
            onMergeWithPrev={handleMergeWithPrev}
            onContentChange={handleContentChange}
            focusCmd={focusCmd}
            dragState={dragState}
            bindGripPointer={bindGripPointer}
            getDragProps={getDragProps}
            onOpenTurnInto={setHandleMenu}
            onConvertBlock={handleConvert}
            onSlashOpen={setSlashMenu}
            onSlashClose={() => setSlashMenu(null)}
            onWikiOpen={setWikiMenu}
            onWikiClose={() => setWikiMenu(null)}
            isMenuOpen={slashMenu?.blockId === block.id || wikiMenu?.blockId === block.id}
            onToggleAddChild={handleToggleAddChild}
            onToggleEnter={handleToggleEnter}
            onTableChange={handleTableChange}
            onNavigateBlock={handleNavigateBlock}
            onActiveBlockChange={handleActiveBlockChange}
            controlsVisible={controlsVisibleFor(block.id)}
            onToggleControlsPin={handleToggleControlsPin}
            onChromeEnter={handleChromeEnter}
            onChromeLeave={handleChromeLeave}
            onIndentBlock={handleIndentBlock}
            onOutdentBlock={handleOutdentBlock}
            onPasteAt={handlePasteAt}
            onPasteBlocksAt={handlePasteBlocksAt}
            onGutterPointerDown={depth === 0 && !readOnly ? handleGutterPointerDown : undefined}
            getRootBlocks={getRootBlocks}
            onRootChange={onRootChange}
            searchQueryFor={searchQueryFor}
            renderToggleNested={renderToggleNested}
            showPersistentPlaceholder={showPersistentPlaceholder}
          />
        ))}
        {depth === 0 && !readOnly && (
          <div className="be-document-bottom-strip" aria-hidden />
        )}
      </div>
      {!readOnly && (
        <SelectionToolbar
          colors={c}
          wikiTargets={wikiTargets}
          searchQuery={searchQuery}
          activeBlockId={activeBlockId}
          onContentChange={handleContentChange}
          onConvertBlock={handleConvert}
          getBlockType={getBlockType}
        />
      )}
      {handleMenu && renderBlockMenu(handleMenu, () => { setHandleMenu(null); setPinnedControlsId(null); })}
      {/* Phase 3: 슬래시 커맨드 메뉴 */}
      {slashMenu && (
        <SlashMenu
          query={slashMenu.query}
          anchorY={slashMenu.anchorY}
          anchorX={slashMenu.anchorX}
          colors={c}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
      {/* 위키링크 자동완성 메뉴 */}
      {wikiMenu && (
        <WikiMenu
          query={wikiMenu.query}
          targets={wikiTargets}
          anchorY={wikiMenu.anchorY}
          anchorX={wikiMenu.anchorX}
          colors={c}
          onSelect={handleWikiSelect}
          onClose={() => setWikiMenu(null)}
        />
      )}
    </>
  );

  return (
    <BlocksCtx.Provider value={blocksCtx}>
      {depth === 0 ? (
        <SelectionCtx.Provider value={selectionCtx}>
          <DragCtx.Provider value={localDrag}>{editorBody}</DragCtx.Provider>
        </SelectionCtx.Provider>
      ) : (
        editorBody
      )}
    </BlocksCtx.Provider>
  );
}



// ── 최상위 BlockEditor ───────────────────────────────────────────────
export const BlockEditor = React.memo(function BlockEditor({
  blocks, onChange, colors, readOnly = false, searchQuery = '', searchScope = 'document',
  searchMatchIndex = 0, wikiTargets = [], onWikiNavigate,
  onActiveBlockChange, externalFocusId, onExternalFocusConsumed,
}: BlockEditorProps) {
  const documentFocusApiRef = useRef<{
    handlePointerDown: (e: React.PointerEvent) => void;
  } | null>(null);

  return (
    <>
      <EditorChromeStyles />
      <div
        className={`be-editor-root ${readingRootClass(readOnly)}${readOnly ? '' : ' be-document-edit'}`}
        onPointerDown={!readOnly ? e => {
          if (e.target === e.currentTarget) {
            documentFocusApiRef.current?.handlePointerDown(e);
          }
        } : undefined}
        style={buildEditorCssVariables(colors)}
      >
      <BlockEditorInner
        blocks={blocks} onChange={onChange} colors={colors}
        readOnly={readOnly} searchQuery={searchQuery} depth={0}
        searchScope={searchScope} searchMatchIndex={searchMatchIndex}
        wikiTargets={wikiTargets}
        onWikiNavigate={onWikiNavigate}
        onActiveBlockChange={onActiveBlockChange}
        externalFocusId={externalFocusId}
        onExternalFocusConsumed={onExternalFocusConsumed}
        documentFocusApiRef={documentFocusApiRef}
      />
      </div>
    </>
  );
});

/** readOnly reading view — undo/history 없이 body → Block[] 1회 파싱만 수행 */
export const BlockEditorPreview = React.memo(function BlockEditorPreview({
  body, colors, searchQuery = '', wikiTargets = [], onWikiNavigate,
}: Pick<BlockEditorProps, 'colors' | 'searchQuery' | 'wikiTargets' | 'onWikiNavigate'> & { body: string }) {
  const blocks = useMemo(() => loadValidatedBlocks(body, markdownToBlocks), [body]);
  return (
    <BlockEditor
      blocks={blocks}
      onChange={noopBlockChange}
      colors={colors}
      readOnly
      searchQuery={searchQuery}
      wikiTargets={wikiTargets}
      onWikiNavigate={onWikiNavigate}
    />
  );
});
