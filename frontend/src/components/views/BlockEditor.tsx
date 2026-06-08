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
  type ReactNode, type CSSProperties,
} from 'react';
import {
  type Block, type BlockType,
  makeBlock, cloneBlockTree,
  updateBlockById, insertBlockAfter, deleteBlockById,
  findBlockById, flattenBlockIds,
  isTextBlockType,
  blocksToMarkdown, markdownToBlocks,
  convertBlock,
} from './blockUtils';
import { readBlockText, setCaretOffset } from './editableDom';
import { applyToggleChildEnter, applyToggleHeaderEnter } from './toggleNesting';
import { indentBlock, outdentBlock } from './blockTree';
import { blockPlaceholder } from './blockPlaceholders';
import { resolveSlashCommand } from './slashCommands';
import { collectEditorSearchMatches, shouldHighlightBlock, type EditorSearchScope } from './editorSearch';
import { blockTintStyle, type BlockTint } from './blockColors';
import { handleEditorCopyEvent } from './blockCopy';
import { installCopyDiagnostics } from './copyDiagnostics';
import { applyPasteAtBlock, applyPasteBlocksAt } from './blockPaste';
import {
  blockLayoutIndentPx,
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
import {
  useDragDrop,
  DropInsertIndicator,
  type DragState,
} from './editorDragDrop';
import { SlashMenu } from './SlashMenu';
import { recordSlashUsage } from './slashRecent';
import type {
  BlockEditorColors, BlockRenderContext, TurnIntoMenuState,
  SlashMenuState, WikiMenuState,
} from './editorTypes';
import { renderBlockContent } from './blockRegistry';
import { SafeBlockRenderer } from './SafeBlockRenderer';
import { loadValidatedBlocks } from './documentRecovery';
import { ToggleBlock } from './ToggleBlock';
import type { ToggleNestedRenderer } from './toggleRender';
import { applyPointerSelection, clearSelection as emptySelection, selectSingle } from './blockSelection';
import {
  beginGutterSelection,
  hitTestBlockIdFromPoint,
  isGutterDragStart,
  updateGutterSelection,
} from './blockGutterSelection';
import { shouldDeleteSelectedBlocks } from './blockKeyboard';
import { deleteSelectedBlocks, duplicateSelectedBlocks } from './multiBlockOps';
import { readingRootClass } from './editorReading';
import { BlockContextMenu } from './BlockContextMenu';
import { SelectionToolbar } from './SelectionToolbar';
import { renderInlineMarkdown } from './editableRender';
import { WikiMenu } from './WikiMenu';
import { insertWikiAtCaret } from './wikiNavigation';
import {
  dispatchFocusCommand, getFocusHandler, registerFocusHandler,
  type FocusCmd,
} from './selectionState';
import { BlockGutter, BlockHandles, blockShellClassName, EditorChromeStyles } from './EditorChrome';

export type { BlockEditorColors } from './editorTypes';
export type { BlockEditorHandle } from './useBlockEditor';
export { useBlockEditor } from './useBlockEditor';

const getElText = readBlockText;

/** SingleBlock 리렌더 최소화 — blocks 배열 참조 대신 ref로 최신 상태 접근 */
interface BlocksCtxValue {
  getBlocks: () => Block[];
  onChange: (b: Block[]) => void;
}
const BlocksCtx = React.createContext<BlocksCtxValue | null>(null);

function useBlocksCtx(): BlocksCtxValue {
  const ctx = useContext(BlocksCtx);
  if (!ctx) throw new Error('useBlocksCtx must be used within BlocksCtx');
  return ctx;
}

const DragCtx = React.createContext<import('./editorDragDrop').UseDragDropResult | null>(null);

interface SelectionCtxValue {
  selectedBlockIds: Set<string>;
  onBlockSelect: (id: string, e: React.MouseEvent) => void;
}
const SelectionCtx = React.createContext<SelectionCtxValue | null>(null);

// ── Props ────────────────────────────────────────────────────────────
interface BlockEditorProps {
  blocks:       Block[];
  onChange:     (blocks: Block[]) => void;
  colors:       BlockEditorColors;
  readOnly?:    boolean;
  searchQuery?: string;
  searchScope?: EditorSearchScope;
  searchMatchIndex?: number;
  /** 위키링크 [[ 자동완성 후보 (노트 제목 목록) */
  wikiTargets?: string[];
  /** edit 모드 Ctrl/Cmd+클릭으로 [[제목]] 따라가기 */
  onWikiNavigate?: (title: string) => void;
  /** 포커스된 블록 id — 이미지 삽입 위치 등 */
  onActiveBlockChange?: (id: string | null) => void;
  /** 외부에서 특정 블록으로 포커스 이동 요청 */
  externalFocusId?: string | null;
  onExternalFocusConsumed?: () => void;
}

// ── SingleBlock ───────────────────────────────────────────────────────
interface SingleBlockProps {
  block: Block;
  colors: BlockEditorColors;
  isSelected: boolean;
  onBlockSelect: (id: string, e: React.MouseEvent) => void;
  onAddBelow: (id: string) => void; readOnly: boolean;
  searchQuery: string; depth: number; wikiTargets: string[];
  headingIndex?: number;   // 최상위 헤딩 순번 (TOC 점프 타겟용), 헤딩이 아니면 undefined
  // Phase 2: 편집 콜백
  onSplitBlock:    (id: string, before: string, after: string) => void;
  onMergeWithPrev: (id: string, selfContent: string) => void;
  onContentChange: (id: string, content: string) => void;
  focusCmd?: FocusCmd | null;
  // Phase 3: 드래그&드롭
  dragState:  DragState | null;
  bindGripPointer: (id: string, e: React.PointerEvent, onClick?: () => void) => void;
  getDragProps: (id: string) => { onPointerEnter: (e: React.PointerEvent) => void; 'data-drag-id': string };
  onOpenTurnInto: (state: TurnIntoMenuState) => void;
  onConvertBlock: (id: string, type: BlockType) => void;
  // Phase 3: 슬래시 커맨드
  onSlashOpen:  (state: SlashMenuState) => void;
  onSlashClose: () => void;
  // 위키링크 자동완성
  onWikiOpen:   (state: WikiMenuState) => void;
  onWikiClose:  () => void;
  isMenuOpen:   boolean;   // 이 블록을 대상으로 슬래시/위키 메뉴가 열려있는지
  onWikiNavigate?: (title: string) => void;
  // Toggle Step 1
  onToggleAddChild: (toggleBlockId: string) => void;
  // Toggle Step 2
  onToggleEnter: (toggleBlockId: string, currentContent: string) => void;
  // Table
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
  onNavigateBlock: (fromId: string, dir: 'up' | 'down') => void;
  onActiveBlockChange?: (id: string | null) => void;
  activeBlockId?: string | null;
  controlsVisible?: boolean;
  onToggleControlsPin?: (id: string) => void;
  onChromeEnter?: (id: string) => void;
  onChromeLeave?: () => void;
  onIndentBlock?: (id: string) => void;
  onOutdentBlock?: (id: string) => void;
  onPasteAt?: (id: string, start: number, end: number, text: string) => void;
  onPasteBlocksAt?: (id: string, start: number, end: number, blocks: Block[]) => void;
  onGutterPointerDown?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  getRootBlocks?: () => Block[];
  onRootChange?: (b: Block[]) => void;
  searchQueryFor: (blockId: string) => string;
  renderToggleNested: ToggleNestedRenderer;
}

function singleBlockPropsEqual(prev: SingleBlockProps, next: SingleBlockProps): boolean {
  return prev.block === next.block
    && prev.isSelected === next.isSelected
    && prev.onBlockSelect === next.onBlockSelect
    && prev.activeBlockId === next.activeBlockId
    && prev.controlsVisible === next.controlsVisible
    && prev.readOnly === next.readOnly
    && prev.searchQuery === next.searchQuery
    && prev.depth === next.depth
    && prev.isMenuOpen === next.isMenuOpen
    && prev.headingIndex === next.headingIndex
    && prev.focusCmd === next.focusCmd
    && prev.dragState === next.dragState
    && prev.colors === next.colors
    && prev.wikiTargets === next.wikiTargets
    && prev.onAddBelow === next.onAddBelow
    && prev.onSplitBlock === next.onSplitBlock
    && prev.onMergeWithPrev === next.onMergeWithPrev
    && prev.onContentChange === next.onContentChange
    && prev.bindGripPointer === next.bindGripPointer
    && prev.getDragProps === next.getDragProps
    && prev.onOpenTurnInto === next.onOpenTurnInto
    && prev.onConvertBlock === next.onConvertBlock
    && prev.onSlashOpen === next.onSlashOpen
    && prev.onSlashClose === next.onSlashClose
    && prev.onWikiOpen === next.onWikiOpen
    && prev.onWikiClose === next.onWikiClose
    && prev.onWikiNavigate === next.onWikiNavigate
    && prev.onToggleAddChild === next.onToggleAddChild
    && prev.onToggleEnter === next.onToggleEnter
    && prev.onTableChange === next.onTableChange
    && prev.onNavigateBlock === next.onNavigateBlock
    && prev.onActiveBlockChange === next.onActiveBlockChange
    && prev.onToggleControlsPin === next.onToggleControlsPin
    && prev.onChromeEnter === next.onChromeEnter
    && prev.onChromeLeave === next.onChromeLeave
    && prev.onIndentBlock === next.onIndentBlock
    && prev.onOutdentBlock === next.onOutdentBlock
    && prev.onPasteAt === next.onPasteAt
    && prev.onPasteBlocksAt === next.onPasteBlocksAt
    && prev.onGutterPointerDown === next.onGutterPointerDown
    && prev.getRootBlocks === next.getRootBlocks
    && prev.onRootChange === next.onRootChange
    && prev.searchQueryFor === next.searchQueryFor
    && prev.renderToggleNested === next.renderToggleNested;
}

const SingleBlock = React.memo(function SingleBlock({
  block, colors: c, isSelected,
  onBlockSelect, onAddBelow, readOnly, searchQuery, depth, wikiTargets, headingIndex,
  onSplitBlock, onMergeWithPrev, onContentChange, focusCmd,
  dragState, bindGripPointer, getDragProps,
  onOpenTurnInto, onConvertBlock,
  onSlashOpen, onSlashClose,
  onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
  onToggleAddChild,
  onToggleEnter,
  onTableChange,
  onNavigateBlock,
  onActiveBlockChange,
  activeBlockId,
  controlsVisible,
  onToggleControlsPin,
  onChromeEnter,
  onChromeLeave,
  onIndentBlock,
  onOutdentBlock,
  onPasteAt,
  onPasteBlocksAt,
  onGutterPointerDown,
  getRootBlocks,
  onRootChange,
  searchQueryFor,
  renderToggleNested,
}: SingleBlockProps) {
  const { getBlocks, onChange } = useBlocksCtx();
  const [toggleOpen, setToggleOpen] = useState(!block.collapsed);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToggleOpen(!block.collapsed);
  }, [block.collapsed]);

  const handleToggleTodo = useCallback(() => {
    const blocks = getBlocks();
    onChange(updateBlockById(blocks, block.id, b => ({ ...b, checked: !b.checked })));
  }, [block.id, getBlocks, onChange]);

  const handleToggleCollapse = useCallback(() => {
    setToggleOpen(v => !v);
    const blocks = getBlocks();
    onChange(updateBlockById(blocks, block.id, b => ({ ...b, collapsed: !b.collapsed })));
  }, [block.id, getBlocks, onChange]);

  const editableRef = useRef<HTMLElement | null>(null);

  // 포커스 레지스트리 — 텍스트(contentEditable) / 비텍스트(shell) 분기
  useEffect(() => {
    const handler = (cmd: FocusCmd) => {
      if (isTextBlockType(block.type)) {
        const el = editableRef.current;
        if (!el) return;
        el.focus();
        requestAnimationFrame(() => {
          if (!editableRef.current) return;
          const target = editableRef.current;
          if (cmd.offset === 'start')       setCaretOffset(target, 0);
          else if (cmd.offset === 'end')    setCaretOffset(target, getElText(target).length);
          else                              setCaretOffset(target, cmd.offset as number);
        });
      } else {
        shellRef.current?.focus();
      }
    };
    return registerFocusHandler(block.id, handler);
  }, [block.id, block.type]);

  // 외부 focusCmd가 이 블록을 가리키면 실행
  useEffect(() => {
    if (focusCmd && focusCmd.blockId === block.id) {
      dispatchFocusCommand(focusCmd);
    }
  }, [focusCmd, block.id]);

  const inline = (text: string) => renderInlineMarkdown(text, c, searchQuery, wikiTargets);

  // ── 드래그 인디케이터 계산 ──────────────────────────────────────
  const isDragging   = dragState?.draggingIds.includes(block.id) ?? false;
  const isOverBefore = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'before';
  const isOverAfter  = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'after';
  const isOverInside = !isDragging && block.type === 'toggle' && dragState?.overId === block.id && dragState?.overPos === 'inside';
  const isActive     = activeBlockId === block.id;
  const layoutIndent = blockLayoutIndentPx(block, depth);

  const handles = (
    <BlockHandles
      blockId={block.id}
      depth={depth}
      readOnly={readOnly}
      controlsVisible={controlsVisible ?? false}
      onChromeEnter={onChromeEnter}
      onChromeLeave={onChromeLeave}
      onToggleControlsPin={onToggleControlsPin}
      bindGripPointer={bindGripPointer}
      onOpenTurnInto={onOpenTurnInto}
    />
  );

  const renderCtx: BlockRenderContext = {
    toggleOpen, inline,
    onToggleCollapse: handleToggleCollapse,
    onToggleTodo: handleToggleTodo,
    getBlocks, onChange, searchQuery, depth, wikiTargets,
    readOnly, onSelect: id => onBlockSelect(id, { shiftKey: false, metaKey: false, ctrlKey: false } as React.MouseEvent), onAddBelow,
    onSplitBlock, onMergeWithPrev, onContentChange,
    editableRef,
    onSlashOpen, onSlashClose,
    onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
    onToggleAddChild,
    onToggleEnter,
    onTableChange,
    onNavigateBlock,
    onActiveBlockChange,
    onConvertBlock,
    onIndentBlock,
    onOutdentBlock,
    onPasteAt,
    onPasteBlocksAt,
    getRootBlocks: getRootBlocks ?? getBlocks,
    onRootChange: onRootChange ?? onChange,
    searchQueryFor,
  };

  const inner = (
    <SafeBlockRenderer block={block} colors={c}>
      {renderBlockContent(block, c, renderCtx)}
    </SafeBlockRenderer>
  );

  const shellKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); onNavigateBlock(block.id, 'up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onNavigateBlock(block.id, 'down'); }
  }, [block.id, onNavigateBlock]);

  const handleContentMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    const t = e.target as HTMLElement;
    if (t.closest('.be-handles, .be-block-handle-menu, .be-grip, button, input, label, a, table')) return;
    if (t.isContentEditable || t.closest('.be-editable, [contenteditable="true"]')) return;
    e.preventDefault();
    onBlockSelect(block.id, e);
    onActiveBlockChange?.(block.id);
    dispatchFocusCommand({ blockId: block.id, offset: 'end' });
  }, [readOnly, block.id, onBlockSelect, onActiveBlockChange]);

  const gutterChrome = (
    <BlockGutter blockId={block.id} readOnly={readOnly} onPointerDown={onGutterPointerDown}>
      {handles}
    </BlockGutter>
  );

  // 토글은 내부 EditableBlock이 있으므로 shell 제외
  const SHELL_NAV_TYPES = new Set<BlockType>(['image', 'divider', 'code', 'math', 'table']);
  const needsShell = !readOnly && SHELL_NAV_TYPES.has(block.type);
  const body = needsShell ? (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={shellKeyDown}
      onMouseDown={handleContentMouseDown}
      onFocus={() => { onBlockSelect(block.id, { shiftKey: false, metaKey: false, ctrlKey: false } as React.MouseEvent); onActiveBlockChange?.(block.id); }}
      style={{ outline: 'none', borderRadius: 6 }}
    >
      {inner}
    </div>
  ) : inner;

  const openBlockMenu = useCallback((clientX: number, clientY: number) => {
    onToggleControlsPin?.(block.id);
    onOpenTurnInto({ blockId: block.id, anchorY: clientY, anchorX: clientX });
  }, [block.id, onOpenTurnInto, onToggleControlsPin]);

  const blockShellProps = {
    ...getDragProps(block.id),
    'data-be-heading': headingIndex,
    'data-block-type': block.type,
    ...(block.type === 'toggle' ? { 'data-toggle-collapsed': String(!toggleOpen) } : {}),
    onContextMenu: readOnly ? undefined : (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openBlockMenu(e.clientX, e.clientY);
    },
  } as const;

  const tintStyle = blockTintStyle(block.tint);
  const blockShellStyle: CSSProperties = {
    position:'relative', marginLeft: layoutIndent,
    borderRadius: 0,
    padding: '1px 0',
    outline: 'none',
    border: 'none',
    borderLeft: tintStyle.borderLeft,
    transition: 'background .12s',
    opacity: 1,
    userSelect: dragState ? 'none' : undefined,
    background: tintStyle.background ?? 'transparent',
  };

  const blockShellClass = blockShellClassName(
    isActive, isSelected, controlsVisible ?? false, isDragging ? 'be-dragging' : undefined,
  );

  const dropIndicators = (
    <>
      {isOverBefore && (
        <DropInsertIndicator position="before" indentLeft={layoutIndent} accent={c.accent} />
      )}
      {isOverInside && (
        <div
          className="be-drop-inside"
          style={{
            position: 'absolute', inset: 2, borderRadius: 8, zIndex: 9,
            border: `2px dashed ${c.accent}`, pointerEvents: 'none',
            background: `${c.accent}14`,
          }}
        />
      )}
      {isOverAfter && (
        <DropInsertIndicator position="after" indentLeft={layoutIndent} accent={c.accent} />
      )}
    </>
  );

  if (block.type === 'toggle') {
    const toggleDropActive = dragState?.overId === block.id && dragState?.overPos === 'inside';
    return (
      <ToggleBlock
        block={block}
        colors={c}
        ctx={renderCtx}
        toggleOpen={toggleOpen}
        toggleDropActive={toggleDropActive}
        depth={depth}
        blockShellProps={blockShellProps}
        blockShellStyle={blockShellStyle}
        blockShellClass={blockShellClass}
        dropIndicators={dropIndicators}
        onChromeEnter={() => onChromeEnter?.(block.id)}
        onChromeLeave={() => onChromeLeave?.()}
        onSelect={handleContentMouseDown}
        gutterChrome={gutterChrome}
        renderNested={renderToggleNested}
      />
    );
  }

  return (
    <div
      {...blockShellProps}
      style={blockShellStyle}
      className={blockShellClass}
      onMouseEnter={() => onChromeEnter?.(block.id)}
      onMouseLeave={() => onChromeLeave?.()}>
      {dropIndicators}
      {gutterChrome}
      {needsShell ? (
        <div className="be-content">{body}</div>
      ) : (
        <div className="be-content" onMouseDown={handleContentMouseDown}>{body}</div>
      )}
    </div>
  );
}, singleBlockPropsEqual);


// ── 내부 재귀 렌더러 ─────────────────────────────────────────────────
interface BlockEditorInnerProps {
  blocks: Block[]; onChange: (b: Block[]) => void;
  colors: BlockEditorColors; readOnly: boolean;
  searchQuery: string; depth: number;
  wikiTargets: string[];
  onWikiNavigate?: (title: string) => void;
  onActiveBlockChange?: (id: string | null) => void;
  externalFocusId?: string | null;
  onExternalFocusConsumed?: () => void;
  // Toggle Step 3: 자식 → 부모 탈출 콜백
  onEscapeToParentBelow?:  () => void;  // 마지막 빈 자식 Enter → toggle 아래 새 블록
  onEscapeToParentHeader?: () => void;  // 첫 자식 Backspace → toggle 헤더로 포커스
  getRootBlocks?: () => Block[];
  onRootChange?: (b: Block[]) => void;
  searchScope?: EditorSearchScope;
  searchMatchIndex?: number;
}

function BlockEditorInner({ blocks, onChange, colors: c, readOnly, searchQuery, depth,
  wikiTargets, onWikiNavigate, onActiveBlockChange,
  externalFocusId, onExternalFocusConsumed,
  onEscapeToParentBelow, onEscapeToParentHeader,
  getRootBlocks: getRootBlocksProp, onRootChange: onRootChangeProp,
  searchScope = 'document', searchMatchIndex = 0,
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
  } : undefined);
  const { dragState, bindGripPointer, getDragProps } = depth === 0 ? localDrag : parentDrag!;
  const [handleMenu, setHandleMenu] = useState<TurnIntoMenuState | null>(null);
  const [pinnedControlsId, setPinnedControlsId] = useState<string | null>(null);
  const [chromeHoverId, setChromeHoverId] = useState<string | null>(null);
  const chromeLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const gutterDragCleanupRef = useRef<(() => void) | null>(null);
  const [isGutterDragging, setIsGutterDragging] = useState(false);

  const handleToggleControlsPin = useCallback((id: string) => {
    setPinnedControlsId(prev => {
      if (prev !== id) {
        setSelectedBlockIds(selectSingle(id));
        setAnchorBlockId(id);
      }
      return prev === id ? null : id;
    });
  }, []);

  const handleChromeEnter = useCallback((id: string) => {
    if (chromeLeaveTimer.current) {
      clearTimeout(chromeLeaveTimer.current);
      chromeLeaveTimer.current = null;
    }
    setChromeHoverId(id);
  }, []);

  const handleChromeLeave = useCallback(() => {
    if (chromeLeaveTimer.current) clearTimeout(chromeLeaveTimer.current);
    chromeLeaveTimer.current = setTimeout(() => {
      setChromeHoverId(null);
      chromeLeaveTimer.current = null;
    }, 180);
  }, []);

  useEffect(() => () => {
    if (chromeLeaveTimer.current) clearTimeout(chromeLeaveTimer.current);
    gutterDragCleanupRef.current?.();
  }, []);

  const controlsVisibleFor = useCallback((blockId: string) =>
    pinnedControlsId === blockId
    || handleMenu?.blockId === blockId
    || chromeHoverId === blockId,
  [pinnedControlsId, handleMenu, chromeHoverId]);

  const getBlockType = useCallback(
    (blockId: string) => findBlockById(blocksRef.current, blockId)?.type,
    [],
  );

  useEffect(() => {
    if (!pinnedControlsId && !handleMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.be-handles, .be-block-handle-menu')) return;
      setPinnedControlsId(null);
      setHandleMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinnedControlsId, handleMenu]);

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
    const next = [...bs];
    next.splice(idx, 0, nb);
    onChange(next);
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
    const bs = blocksRef.current;
    const idx = bs.findIndex(b => b.id === id);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= bs.length) return;
    const next = [...bs];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
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
    const newType: BlockType = ['heading1','heading2','heading3'].includes(cur.type)
      ? 'paragraph' : cur.type;
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

    // Toggle Step 3: 첫 번째 자식의 커서가 맨 앞 + 빈 내용 → 헤더로 탈출
    if (pos === 0 && selfContent === '' && onEscapeToParentHeader) {
      // 빈 첫 자식 삭제
      const cleaned = bs.filter(b => b.id !== id);
      onChange(cleaned.length > 0 ? cleaned : []);
      onEscapeToParentHeader();
      return;
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
  }, [onChange, onEscapeToParentHeader, selectBlock]);

  // ── Phase 2: 블록 content 변경 ───────────────────────────────────
  const handleContentChange = useCallback((id: string, content: string) => {
    onChange(updateBlockById(blocksRef.current, id, b => ({ ...b, content })));
  }, [onChange]);

  const handlePasteAt = useCallback((id: string, start: number, end: number, text: string) => {
    const cur = findBlockById(blocksRef.current, id);
    const context = cur ? { blockType: cur.type, indent: cur.indent } : undefined;
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
    const context = cur ? { blockType: cur.type, indent: cur.indent } : undefined;
    const result = applyPasteBlocksAt(blocksRef.current, id, start, end, pasted, context);
    if (!result) return;
    onChange(result.blocks);
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
  const handleToggleEnter = useCallback((toggleBlockId: string, currentContent: string) => {
    const toggle = findBlockById(blocksRef.current, toggleBlockId);
    if (!toggle) return;
    const { children, focusBlockId } = applyToggleHeaderEnter(toggle.children);
    onChange(updateBlockById(blocksRef.current, toggleBlockId, b => ({
      ...b,
      content: currentContent,
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

    // 현재 블록 content에서 '/쿼리' 부분 제거
    onChange(updateBlockById(blocksRef.current, blockId, b => {
      const slashIdx = b.content.lastIndexOf('/' + query);
      const cleaned  = slashIdx >= 0
        ? b.content.slice(0, slashIdx) + b.content.slice(slashIdx + 1 + query.length)
        : b.content;
      // math/code 변환 시 남은 텍스트를 식/코드로 시드하고 content는 비움
      if (type === 'math')  return { ...b, type, content: '', math: b.math || cleaned, mathBlock: (b.math || cleaned).includes('\n') };
      if (type === 'code')  return { ...b, type, content: '', code: b.code || cleaned };
      if (type === 'image') return { ...b, type, content: '', src: '', alt: '', caption: undefined, width: undefined };
      return { ...b, type, content: cleaned };
    }));

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
      const t = setTimeout(() => setFocusCmd(null), 100);
      return () => clearTimeout(t);
    }
  }, [focusCmd]);

  // 최상위(depth 0) 헤딩 블록의 순번 — TOC(extractTOC와 동일한 문서 순서) 점프 타겟
  const headingIndexById = useMemo(() => {
    const m: Record<string, number> = {};
    if (depth === 0) {
      let h = 0;
      for (const b of blocks) {
        if (b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3') m[b.id] = h++;
      }
    }
    return m;
  }, [blocks, depth]);

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
    />
  ), [
    onChange, c, readOnly, searchQuery, depth, wikiTargets, onWikiNavigate,
    onActiveBlockChange, getRootBlocks, onRootChange, searchScope, searchMatchIndex,
  ]);

  useEffect(() => {
    if (readOnly || depth !== 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedBlockIdsRef.current.size > 0) {
          setSelectedBlockIds(emptySelection());
          setAnchorBlockId(null);
        }
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!shouldDeleteSelectedBlocks(e, selectedBlockIdsRef.current)) return;
      e.preventDefault();
      handleDeleteSelected();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, depth, handleDeleteSelected]);

  useEffect(() => {
    if (depth !== 0) return;

    const runCopy = (e: ClipboardEvent) => {
      if (readOnly) return null;
      return handleEditorCopyEvent(e, getRootBlocks(), selectedBlockIdsRef.current);
    };

    const uninstallDiag = installCopyDiagnostics({
      readOnly,
      depth,
      getRootBlocks,
      getSelectedIds: () => selectedBlockIdsRef.current,
      onCopy: runCopy,
    });

    return uninstallDiag;
  }, [readOnly, depth, getRootBlocks]);

  const editorBody = (
    <>
      <div
        ref={depth === 0 ? editorRootRef : undefined}
        className={`be-editor-root${depth > 0 ? ' be-editor-nested' : ''}${isGutterDragging ? ' be-gutter-dragging' : ''}`}
        style={{ paddingLeft: readOnly ? 0 : (depth > 0 ? 36 : 0), position:'relative' }}
        onMouseDown={depth === 0 && !readOnly ? e => {
          const t = e.target as HTMLElement;
          if (!t.closest('.be-block')) {
            setSelectedBlockIds(emptySelection());
            setAnchorBlockId(null);
          }
        } : undefined}
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
          />
        ))}
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



const noopBlockChange = () => {};


// ── 최상위 BlockEditor ───────────────────────────────────────────────
export const BlockEditor = React.memo(function BlockEditor({
  blocks, onChange, colors, readOnly = false, searchQuery = '', searchScope = 'document',
  searchMatchIndex = 0, wikiTargets = [], onWikiNavigate,
  onActiveBlockChange, externalFocusId, onExternalFocusConsumed,
}: BlockEditorProps) {
  return (
    <>
      <EditorChromeStyles />
      <div
        className={`be-editor-root ${readingRootClass(readOnly)}${readOnly ? '' : ' be-document-edit'}`}
        style={{
          '--be-accent': colors.accent,
          '--be-accent-bg': colors.accentBg,
          '--be-link': colors.linkColor ?? colors.accent,
          '--be-code-bg': colors.codeBg,
          '--be-placeholder-color': colors.textFaint,
          '--be-text': colors.text,
          '--be-doc-width': colors.documentMaxWidth ? `${colors.documentMaxWidth}px` : '720px',
          '--be-font-family': colors.fontFamily ?? 'system-ui, sans-serif',
          '--be-font-size': colors.fontSize ? `${colors.fontSize}px` : '16px',
          '--be-search-hl-bg': colors.searchHlBg ?? colors.accentBg,
          '--be-search-hl-color': colors.searchHlColor ?? colors.text,
          '--be-block-active-bg': colors.blockFocusBg ?? 'transparent',
          '--be-block-selected-bg': colors.blockSelectedBg ?? 'rgba(139,92,246,0.05)',
          '--be-block-active-selected-bg': colors.isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.08)',
          '--be-toggle-bg': colors.toggleBg ?? 'transparent',
          '--be-toggle-hover-bg': colors.isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.04)',
          '--be-toggle-rail': colors.isDark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.16)',
          '--be-toggle-rail-collapsed': colors.isDark ? 'rgba(139,92,246,0.24)' : 'rgba(139,92,246,0.20)',
          '--be-border': colors.border,
          '--be-text-muted': colors.textMuted,
          '--be-menu-shadow': colors.menuShadow ?? '0 8px 24px rgba(0,0,0,0.1)',
        } as CSSProperties}
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
      />
      </div>
      {!readOnly && (
        <div style={{ minHeight:80, cursor:'text' }}
          onClick={() => {
            const last = blocks[blocks.length - 1];
            if (!last || last.type !== 'paragraph' || last.content)
              onChange([...blocks, makeBlock('paragraph')]);
          }}>
          {blocks.length === 0 && (
            <p style={{ color:colors.textFaint, fontSize:15, margin:0, fontStyle:'italic' }}>
              여기를 클릭해 작성 시작…
            </p>
          )}
        </div>
      )}
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
