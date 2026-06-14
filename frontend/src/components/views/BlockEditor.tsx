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
  useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect, useContext,
} from 'react';
import { flushSync } from 'react-dom';
import {
  updateBlockById,
  findBlockById,
  blocksToMarkdown, markdownToBlocks,
} from './blockUtils';
import { indentBlock, outdentBlock } from './blockTree';
import { blockPlaceholder } from './blockPlaceholders';
import {
  BlockContextMenu,
  resolveSlashCommand,
  SlashMenu,
  useEditorMenus,
  WikiMenu,
} from './features/block-editor/features/menus';
import { collectEditorSearchMatches, shouldHighlightBlock, type EditorSearchScope } from './editorSearch';
import { type BlockTint } from './blockColors';
import {
  canMoveIntoPreviousToggle, getPreviousSiblingToggleId, isInsideToggle,
  moveBlockIntoToggle, moveBlockOutOfToggle,
} from './blockTree';
import { resolveDragOverFromPoint, useDragDrop } from './editorDragDrop';
import type {
  BlockEditorColors, TurnIntoMenuState,
} from './editorTypes';
import { loadValidatedBlocks } from './documentRecovery';
import { readingRootClass } from './editorReading';
import { ShortcutHelpOverlay, isShortcutHelpKey } from './ShortcutHelpOverlay';
import { FootnoteReferenceSection } from './FootnoteBlock';
import { collectFootnoteBlocks, footnoteAnchorId } from './footnoteUtils';
import { EditorChromeStyles } from './EditorChrome';
import {
  isFirstEmptyRootParagraph,
} from './documentFocus';
import { SingleBlock } from './features/block-editor/components/SingleBlock';
import {
  EmptyDocumentHint,
  MultiSelectHint,
} from './features/block-editor/components/EditorDiscoverabilityHints';
import { isEmptyDocument } from './features/block-editor/utils/editorDiscoverability';
import { BlocksCtx, type BlocksCtxValue } from './features/block-editor/contexts/BlocksContext';
import {
  dispatchFocusCommand,
  registerFocusHandler,
  SelectionCtx,
  SelectionToolbar,
  useEditorSelection,
  type FocusCmd,
} from './features/block-editor/features/selection';
import { DragCtx } from './features/block-editor/contexts/DragContext';
import {
  NESTED_EDITOR_PADDING_LEFT_PX,
  noopBlockChange,
} from './features/block-editor/constants/blockEditorConstants';
import type { BlockEditorProps, BlockEditorInnerProps } from './features/block-editor/types/blockEditorTypes';
import { buildHeadingIndexById } from './features/block-editor/utils/headingIndex';
import { buildEditorCssVariables } from './features/block-editor/utils/editorThemeStyle';
import { useEditorChrome } from './features/block-editor/hooks/useEditorChrome';
import { useEditorDocumentFocus } from './features/block-editor/hooks/useEditorDocumentFocus';
import { useEditorGutterDrag } from './features/block-editor/hooks/useEditorGutterDrag';
import { useEditorCopyEffects, useEditorPaste } from './features/block-editor/features/clipboard';
import { useEditorBlockOps } from './features/block-editor/hooks/useEditorBlockOps';
import { useEditorToggle } from './features/block-editor/hooks/useEditorToggle';
import { useEditorBlockEditing } from './features/block-editor/hooks/useEditorBlockEditing';
import { useEditorKeyboard } from './features/block-editor/hooks/useEditorKeyboard';
import {
  collectVirtualizationStats,
  DragOverlay,
  estimateBlockHeight,
  getRowMetrics,
  isVirtualBlocksPocEnabled,
  listVirtualBlockRows,
  PendingFocusQueue,
  resolveDropTargetFromRows,
  setVirtualizationStatsSource,
  createVirtualNavigationApi,
  useVirtualBlockList,
  VIRTUAL_BLOCK_OVERSCAN,
  VirtualBlockList,
  VirtualNavigationProvider,
  type RowMetricsOptions,
} from './features/block-editor/performance';

export type { BlockEditorColors } from './editorTypes';
export type { BlockEditorHandle } from './useBlockEditor';
export { useBlockEditor } from './useBlockEditor';

// ── 내부 재귀 렌더러 ─────────────────────────────────────────────────
function BlockEditorInner({ blocks, onChange, colors: c, readOnly, searchQuery, depth,
  wikiTargets, onWikiNavigate, onActiveBlockChange,
  externalFocusId, externalFocusOffset = 'start', onExternalFocusConsumed,
  onEscapeToParentBelow, onEscapeToParentHeader, onMergeFirstChildIntoHeader,
  getRootBlocks: getRootBlocksProp, onRootChange: onRootChangeProp,
  searchScope = 'document', searchMatchIndex = 0,
  documentFocusApiRef,
  virtualBlocksPoc,
  virtualScrollApiRef,
  virtualScrollParentRef,
}: BlockEditorInnerProps) {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const getLocalBlocks = useCallback(() => blocksRef.current, []);

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

  const [activeBlockId, setActiveBlockId] = useState<string | null>(() => (
    !readOnly && depth === 0 ? (blocks[0]?.id ?? null) : null
  ));
  const handleActiveBlockChange = useCallback((id: string | null) => {
    setActiveBlockId(id);
    onActiveBlockChange?.(id);
  }, [onActiveBlockChange]);

  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const footnotes = useMemo(
    () => (readOnly && depth === 0 ? collectFootnoteBlocks(getRootBlocks()) : []),
    [readOnly, depth, getRootBlocks, blocks],
  );

  useEffect(() => {
    if (depth !== 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && shortcutHelpOpen) {
        setShortcutHelpOpen(false);
        return;
      }
      if (isShortcutHelpKey(e)) {
        e.preventDefault();
        setShortcutHelpOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [depth, shortcutHelpOpen]);

  useEffect(() => {
    if (readOnly || depth !== 0) return;
    if (activeBlockId && findBlockById(getRootBlocks(), activeBlockId)) return;
    const first = getRootBlocks()[0];
    if (first) handleActiveBlockChange(first.id);
  }, [readOnly, depth, activeBlockId, getRootBlocks, handleActiveBlockChange, blocks]);

  const searchQueryFor = useCallback((blockId: string) => {
    if (!searchQuery.trim()) return '';
    return shouldHighlightBlock(searchScope, blockId, activeBlockId) ? searchQuery : '';
  }, [searchQuery, searchScope, activeBlockId]);

  const blocksCtx = useMemo<BlocksCtxValue>(() => ({
    getBlocks: () => blocksRef.current,
    onChange,
  }), [onChange]);

  const {
    selectedBlockIds,
    setSelectedBlockIds,
    setAnchorBlockId,
    selectedBlockIdsRef,
    selectBlock,
    clearSelection,
    selectionCtx,
  } = useEditorSelection({
    readOnly,
    getRootBlocks,
    onActiveBlockChange: handleActiveBlockChange,
  });

  const pendingFocusQueueRef = useRef<PendingFocusQueue | null>(null);
  if (!pendingFocusQueueRef.current) pendingFocusQueueRef.current = new PendingFocusQueue();
  // Phase 3: 드래그&드롭 — root-level only; nested editors share via DragCtx
  const parentDrag = useContext(DragCtx);
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const assignEditorRootRef = useCallback((node: HTMLDivElement | null) => {
    editorRootRef.current = node;
  }, []);

  const handleFootnoteClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (depth !== 0) return;
    const ref = (e.target as HTMLElement).closest('.be-footnote-ref') as HTMLElement | null;
    if (!ref?.dataset.footnoteId) return;
    e.preventDefault();
    const anchor = footnoteAnchorId(ref.dataset.footnoteId);
    const scrollRoot = editorRootRef.current?.closest('.editor-drop-zone') as HTMLElement | null;
    const el = scrollRoot?.querySelector(`#${CSS.escape(anchor)}`) ?? document.getElementById(anchor);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [depth]);

  const virtualRootEnabled = isVirtualBlocksPocEnabled(virtualBlocksPoc) && depth === 0;
  const [virtualScrollElement, setVirtualScrollElement] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!virtualRootEnabled) {
      setVirtualScrollElement(null);
      return;
    }
    const node = editorRootRef.current;
    if (!node) return;
    const scrollParent = node.closest('.editor-drop-zone') as HTMLElement | null
      ?? node.parentElement;
    setVirtualScrollElement(scrollParent);
  }, [virtualRootEnabled, blocks.length]);

  const getVirtualScrollElement = useCallback(
    () => virtualScrollParentRef?.current
      ?? virtualScrollElement
      ?? editorRootRef.current?.closest('.editor-drop-zone') as HTMLElement | null,
    [virtualScrollElement, virtualScrollParentRef],
  );

  const virtualList = useVirtualBlockList({
    blocks,
    enabled: virtualRootEnabled,
    getScrollElement: getVirtualScrollElement,
  });

  const rowMetricsOptionsRef = useRef<RowMetricsOptions>({
    getEditorRoot: () => editorRootRef.current,
    getRootBlockIds: () => blocksRef.current.map(b => b.id),
    getBlocks: () => blocksRef.current,
    getVirtualizer: () => virtualList.virtualizer,
    getScrollElement: getVirtualScrollElement,
  });
  rowMetricsOptionsRef.current = {
    getEditorRoot: () => editorRootRef.current,
    getRootBlockIds: () => blocksRef.current.map(b => b.id),
    getBlocks: () => blocksRef.current,
    getVirtualizer: () => virtualList.virtualizer,
    getScrollElement: getVirtualScrollElement,
  };

  const resolveVirtualDragOver = useCallback((
    clientX: number,
    clientY: number,
    draggingIds: string[],
  ) => {
    const domHit = resolveDragOverFromPoint(clientX, clientY, draggingIds);
    if (domHit) return domHit;
    if (!virtualRootEnabled) return null;
    const rows = getRowMetrics(rowMetricsOptionsRef.current);
    return resolveDropTargetFromRows(
      clientY,
      rows,
      draggingIds,
      id => findBlockById(blocksRef.current, id) ?? undefined,
    );
  }, [virtualRootEnabled]);

  const localDrag = useDragDrop(getRootBlocks, onRootChange, depth === 0 ? {
    getSelectedIds: () => [...selectedBlockIdsRef.current],
    getScrollContainer: () =>
      editorRootRef.current?.closest('.editor-drop-zone') as HTMLElement | null,
    getEditorRoot: () => editorRootRef.current,
    resolveDragOver: virtualRootEnabled ? resolveVirtualDragOver : undefined,
  } : undefined);
  const activeDrag = depth === 0 ? localDrag : parentDrag!;
  const { bindGripPointer, getDragProps } = activeDrag;

  const getRowMetricsOptions = useCallback(
    () => rowMetricsOptionsRef.current,
    [],
  );

  const navigationApi = useMemo(
    () => createVirtualNavigationApi({
      virtualEnabled: virtualRootEnabled,
      scrollToBlockId: virtualList.scrollToBlockId,
      queue: pendingFocusQueueRef.current!,
    }),
    [virtualRootEnabled, virtualList.scrollToBlockId],
  );

  const requestFocus = useCallback((cmd: FocusCmd) => {
    navigationApi.requestFocus(cmd);
  }, [navigationApi]);

  useEffect(() => {
    if (depth !== 0) return;
    setVirtualizationStatsSource(() => collectVirtualizationStats(
      virtualRootEnabled,
      blocksRef.current,
      virtualList.virtualizer,
      virtualList.heightCache,
      VIRTUAL_BLOCK_OVERSCAN,
    ));
    return () => { setVirtualizationStatsSource(null); };
  }, [
    depth,
    virtualRootEnabled,
    virtualList.virtualizer,
    virtualList.heightCache,
    blocks.length,
  ]);

  const getRootBlockRows = useCallback(() => {
    const scrollEl = getVirtualScrollElement();
    if (!scrollEl) return [];
    return listVirtualBlockRows(virtualList.virtualizer, blocksRef.current, scrollEl);
  }, [getVirtualScrollElement, virtualList.virtualizer]);

  const getBlockScrollTop = useCallback((blockId: string): number | null => {
    const blocks = blocksRef.current;
    const index = blocks.findIndex(b => b.id === blockId);
    if (index < 0) return null;
    const block = blocks[index];
    const measurement = virtualList.virtualizer.measurementsCache[index];
    const offsetInfo = virtualList.virtualizer.getOffsetForIndex(index, 'start');
    const start = measurement?.start
      ?? (Array.isArray(offsetInfo) ? offsetInfo[0] : undefined)
      ?? index * estimateBlockHeight(block);
    return start;
  }, [virtualList.virtualizer]);

  useEffect(() => {
    if (!virtualScrollApiRef) return;
    if (virtualRootEnabled) {
      virtualScrollApiRef.current = {
        scrollToBlockId: navigationApi.scrollToBlockId,
        getBlockScrollTop,
      };
    } else {
      virtualScrollApiRef.current = null;
    }
    return () => {
      virtualScrollApiRef.current = null;
    };
  }, [virtualRootEnabled, navigationApi, getBlockScrollTop, virtualScrollApiRef]);

  const { handleGutterPointerDown, isGutterDragging } = useEditorGutterDrag({
    readOnly,
    depth,
    getRootBlocks,
    setSelectedBlockIds,
    setAnchorBlockId,
    onActiveBlockChange: handleActiveBlockChange,
    editorRootRef,
  });

  const {
    handleMenu,
    setHandleMenu,
    pinnedControlsId,
    setPinnedControlsId,
    handleChromeEnter,
    handleChromeLeave,
    handleToggleControlsPin,
    controlsVisibleFor,
  } = useEditorChrome({ onPinSelection: selectBlock });

  const getBlockType = useCallback(
    (blockId: string) => findBlockById(getRootBlocks(), blockId)?.type,
    [getRootBlocks],
  );

  const showPersistentPlaceholder = useCallback((blockId: string) => {
    if (depth !== 0 || readOnly) return false;
    return isFirstEmptyRootParagraph(getRootBlocks(), blockId);
  }, [depth, readOnly, getRootBlocks]);

  const { handleDocumentFocusPointerDown } = useEditorDocumentFocus({
    readOnly,
    depth,
    getRootBlocks,
    onRootChange,
    selectBlock,
    onActiveBlockChange: handleActiveBlockChange,
    onFocusCmd: requestFocus,
    editorRootRef,
    documentFocusApiRef,
    getRootBlockRows: virtualRootEnabled ? getRootBlockRows : undefined,
  });

  const parentSelection = useContext(SelectionCtx);
  const activeSelection = depth === 0 ? selectionCtx : parentSelection;

  const {
    handleAddBelow,
    handleAddAbove,
    handleDelete,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleMove,
    handleConvert,
    handleDuplicate,
  } = useEditorBlockOps({
    getBlocks: getLocalBlocks,
    getRootBlocks,
    onChange,
    onRootChange,
    onFocusCmd: requestFocus,
    selectBlock,
    clearSelection,
    onActiveBlockChange: handleActiveBlockChange,
    getSelectedIds: () => selectedBlockIdsRef.current,
    setHandleMenu,
    setPinnedControlsId,
  });

  useEffect(() => {
    if (!searchQuery.trim() || searchScope === 'all') return;
    const matches = collectEditorSearchMatches(getRootBlocks(), searchQuery);
    if (!matches.length) return;
    const m = matches[searchMatchIndex % matches.length];
    selectBlock(m.blockId);
    handleActiveBlockChange(m.blockId);
    requestFocus({ blockId: m.blockId, offset: m.offset });
  }, [searchMatchIndex, searchQuery, searchScope, getRootBlocks, handleActiveBlockChange, selectBlock, requestFocus]);

  const renderBlockMenu = (state: TurnIntoMenuState, onDone: () => void) => {
    const id = state.blockId;
    const root = getRootBlocks();
    const menuBlock = findBlockById(root, id);
    const multiCount = selectedBlockIds.size > 1 && selectedBlockIds.has(id)
      ? selectedBlockIds.size
      : undefined;
    return (
      <BlockContextMenu
        blockId={id}
        currentType={menuBlock?.type ?? 'paragraph'}
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

  const {
    handleSplitBlock,
    handleMergeWithPrev,
    handleContentChange,
    handleTableChange,
    handleNavigateBlock,
  } = useEditorBlockEditing({
    getBlocks: getLocalBlocks,
    onChange,
    onFocusCmd: requestFocus,
    selectBlock,
    onActiveBlockChange: handleActiveBlockChange,
    onEscapeToParentBelow,
    onEscapeToParentHeader,
    onMergeFirstChildIntoHeader,
  });

  const {
    slashMenu,
    wikiMenu,
    setSlashMenu,
    setWikiMenu,
    closeSlashMenu,
    closeWikiMenu,
    closeMenus,
    isMenuOpenForBlock,
    handleSlashSelect,
    handleWikiSelect,
  } = useEditorMenus({
    getBlocks: getLocalBlocks,
    onChange,
    onFocusCmd: requestFocus,
    colors: c,
    wikiTargets,
    searchQuery,
    onContentChange: handleContentChange,
  });

  const { handlePasteAt, handlePasteBlocksAt } = useEditorPaste({
    getBlocks: getLocalBlocks,
    onChange,
    onFocusCmd: requestFocus,
    closeMenus,
    selectBlock,
  });

  const {
    handleToggleAddChild,
    handleToggleEnter,
    renderToggleNested,
  } = useEditorToggle({
    getBlocks: getLocalBlocks,
    getRootBlocks,
    onChange,
    onRootChange,
    NestedEditor: BlockEditorInner,
    colors: c,
    readOnly,
    searchQuery,
    depth,
    wikiTargets,
    onWikiNavigate,
    onActiveBlockChange,
    searchScope,
    searchMatchIndex,
  });

  // 외부 포커스 요청 (이미지 삽입 직후 등)
  useEffect(() => {
    if (!externalFocusId) return;
    selectBlock(externalFocusId);
    handleActiveBlockChange(externalFocusId);
    requestFocus({ blockId: externalFocusId, offset: externalFocusOffset });
    onExternalFocusConsumed?.();
  }, [externalFocusId, externalFocusOffset, handleActiveBlockChange, onExternalFocusConsumed, selectBlock, requestFocus]);

  const headingIndexById = useMemo(
    () => buildHeadingIndexById(blocks, depth),
    [blocks, depth],
  );

  useEditorKeyboard({
    readOnly,
    depth,
    getSelectedIds: () => selectedBlockIdsRef.current,
    onClearSelection: clearSelection,
    onDeleteSelected: handleDeleteSelected,
    documentRootRef: editorRootRef,
  });

  useEditorCopyEffects({
    readOnly,
    depth,
    getRootBlocks,
    getSelectedIds: () => selectedBlockIdsRef.current,
  });

  const renderEditorBlock = (block: typeof blocks[number]) => (
    <SingleBlock
      key={block.id}
      block={block}
      colors={c}
      isSelected={activeSelection?.selectedBlockIds.has(block.id) ?? false}
      activeBlockId={activeBlockId}
      onBlockSelect={activeSelection?.onBlockSelect ?? (() => {})}
      onAddBelow={handleAddBelow}
      readOnly={readOnly}
      searchQuery={searchQuery}
      depth={depth}
      wikiTargets={wikiTargets}
      headingIndex={headingIndexById[block.id]}
      onWikiNavigate={onWikiNavigate}
      onSplitBlock={handleSplitBlock}
      onMergeWithPrev={handleMergeWithPrev}
      onContentChange={handleContentChange}
      bindGripPointer={bindGripPointer}
      getDragProps={getDragProps}
      onOpenTurnInto={setHandleMenu}
      onConvertBlock={handleConvert}
      onSlashOpen={setSlashMenu}
      onSlashClose={closeSlashMenu}
      onWikiOpen={setWikiMenu}
      onWikiClose={closeWikiMenu}
      isMenuOpen={isMenuOpenForBlock(block.id)}
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
      onClearBlockSelection={clearSelection}
    />
  );

  const blockList = virtualRootEnabled ? (
    <VirtualBlockList blocks={blocks} virtualList={virtualList}>
      {(block) => renderEditorBlock(block)}
    </VirtualBlockList>
  ) : (
    blocks.map(block => renderEditorBlock(block))
  );

  const editorBody = (
    <>
      <div
        ref={depth === 0 ? assignEditorRootRef : undefined}
        className={`be-editor-root${depth > 0 ? ' be-editor-nested' : ''}${isGutterDragging ? ' be-gutter-dragging' : ''}`}
        style={{ paddingLeft: readOnly ? 0 : (depth > 0 ? NESTED_EDITOR_PADDING_LEFT_PX : 0), position:'relative' }}
        onPointerDown={depth === 0 && !readOnly ? handleDocumentFocusPointerDown : undefined}
        onClick={depth === 0 ? handleFootnoteClick : undefined}
      >
        {depth === 0 && !readOnly && (
          <EmptyDocumentHint visible={isEmptyDocument(getRootBlocks())} colors={c} />
        )}
        {blockList}
        {depth === 0 && readOnly && footnotes.length > 0 && (
          <FootnoteReferenceSection footnotes={footnotes} colors={c} />
        )}
        {depth === 0 && !readOnly && (
          <div className="be-document-bottom-strip" aria-hidden />
        )}
        {depth === 0 && !readOnly && (
          <MultiSelectHint count={selectedBlockIds.size} colors={c} />
        )}
        {depth === 0 && !readOnly && (
          <DragOverlay
            colors={c}
            getBlocks={getRootBlocks}
            getEditorRoot={() => editorRootRef.current}
            getRowMetricsOptions={virtualRootEnabled ? getRowMetricsOptions : undefined}
          />
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
          onClose={closeSlashMenu}
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
          onClose={closeWikiMenu}
        />
      )}
      {depth === 0 && (
        <ShortcutHelpOverlay
          open={shortcutHelpOpen}
          colors={c}
          onClose={() => setShortcutHelpOpen(false)}
        />
      )}
    </>
  );

  const bodyWithProviders = depth === 0 ? (
    <SelectionCtx.Provider value={selectionCtx}>
      <DragCtx.Provider value={localDrag}>
        <VirtualNavigationProvider value={navigationApi}>
          {editorBody}
        </VirtualNavigationProvider>
      </DragCtx.Provider>
    </SelectionCtx.Provider>
  ) : (
    editorBody
  );

  return (
    <BlocksCtx.Provider value={blocksCtx}>
      {bodyWithProviders}
    </BlocksCtx.Provider>
  );
}



// ── 최상위 BlockEditor ───────────────────────────────────────────────
export const BlockEditor = React.memo(function BlockEditor({
  blocks, onChange, colors, readOnly = false, searchQuery = '', searchScope = 'document',
  searchMatchIndex = 0, wikiTargets = [], onWikiNavigate,
  onActiveBlockChange, externalFocusId, externalFocusOffset = 'start', onExternalFocusConsumed,
  virtualBlocksPoc, virtualScrollApiRef, virtualScrollParentRef,
}: BlockEditorProps) {
  const documentFocusApiRef = useRef<{
    handlePointerDown: (e: React.PointerEvent) => void;
  } | null>(null);
  const internalVirtualScrollApiRef = useRef<{ scrollToBlockId: (blockId: string) => boolean } | null>(null);
  const scrollApiRef = virtualScrollApiRef ?? internalVirtualScrollApiRef;

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
        externalFocusOffset={externalFocusOffset}
        onExternalFocusConsumed={onExternalFocusConsumed}
        documentFocusApiRef={documentFocusApiRef}
        virtualBlocksPoc={virtualBlocksPoc}
        virtualScrollApiRef={scrollApiRef}
        virtualScrollParentRef={virtualScrollParentRef}
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
