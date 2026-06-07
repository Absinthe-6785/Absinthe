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
import { ChevronRight, Code2 } from 'lucide-react';
import {
  type Block, type BlockType,
  makeBlock, cloneBlockTree,
  updateBlockById, insertBlockAfter, deleteBlockById,
  findBlockById, flattenBlockIds,
  isTextBlockType,
  blocksToMarkdown, markdownToBlocks,
  convertBlock,
  isValidImageUrl,
  imageAltFromUrl,
} from './blockUtils';
import { readBlockText, setCaretOffset } from './editableDom';
import { applyToggleChildEnter, applyToggleHeaderEnter } from './toggleNesting';
import { indentBlock, outdentBlock } from './blockTree';
import { blockPlaceholder } from './blockPlaceholders';
import { resolveSlashCommand } from './slashCommands';
import { collectEditorSearchMatches, shouldHighlightBlock, type EditorSearchScope } from './editorSearch';
import { blockTintStyle } from './blockColors';
import { applyPasteAtBlock } from './blockPaste';
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
  BlockEditorColors, TurnIntoMenuState,
  SlashMenuState, WikiMenuState,
} from './editorTypes';
import { readingRootClass } from './editorReading';
import { BlockContextMenu } from './BlockContextMenu';
import { SelectionToolbar } from './SelectionToolbar';
import { renderInlineMarkdown } from './editableRender';
import { EditableBlock, type EditableBlockProps } from './EditableBlock';
import { WikiMenu } from './WikiMenu';
import { insertWikiAtCaret } from './wikiNavigation';
import {
  dispatchFocusCommand, getFocusHandler, registerFocusHandler,
  type FocusCmd,
} from './selectionState';
import { BlockHandles, blockShellClassName, EditorChromeStyles } from './EditorChrome';

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
  colors: BlockEditorColors; selected: boolean;
  onSelect: (id: string) => void;
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
  getRootBlocks?: () => Block[];
  onRootChange?: (b: Block[]) => void;
  searchQueryFor: (blockId: string) => string;
}

function singleBlockPropsEqual(prev: SingleBlockProps, next: SingleBlockProps): boolean {
  return prev.block === next.block
    && prev.selected === next.selected
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
    && prev.onSelect === next.onSelect
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
    && prev.getRootBlocks === next.getRootBlocks
    && prev.onRootChange === next.onRootChange
    && prev.searchQueryFor === next.searchQueryFor;
}

const SingleBlock = React.memo(function SingleBlock({
  block, colors: c, selected,
  onSelect, onAddBelow, readOnly, searchQuery, depth, wikiTargets, headingIndex,
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
  getRootBlocks,
  onRootChange,
  searchQueryFor,
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
  const isDragging   = dragState?.draggingId === block.id;
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
      controlsVisible={controlsVisible}
      onChromeEnter={onChromeEnter}
      onChromeLeave={onChromeLeave}
      onToggleControlsPin={onToggleControlsPin}
      bindGripPointer={bindGripPointer}
      onOpenTurnInto={onOpenTurnInto}
    />
  );

  const inner = renderInner(block, c, {
    toggleOpen, inline,
    onToggleCollapse: handleToggleCollapse,
    onToggleTodo: handleToggleTodo,
    getBlocks, onChange, searchQuery, depth, wikiTargets,
    readOnly, onSelect, onAddBelow,
    // Phase 2
    onSplitBlock, onMergeWithPrev, onContentChange,
    editableRef,
    // Phase 3
    onSlashOpen, onSlashClose,
    // 위키링크 자동완성
    onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
    // Toggle Step 1
    onToggleAddChild,
    // Toggle Step 2
    onToggleEnter,
    // Table
    onTableChange,
    onNavigateBlock,
    onActiveBlockChange,
    onConvertBlock,
    onIndentBlock,
    onOutdentBlock,
    onPasteAt,
    getRootBlocks: getRootBlocks ?? getBlocks,
    onRootChange: onRootChange ?? onChange,
    searchQueryFor,
  });

  const shellKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); onNavigateBlock(block.id, 'up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onNavigateBlock(block.id, 'down'); }
  }, [block.id, onNavigateBlock]);

  // 토글은 내부 EditableBlock이 있으므로 shell 제외
  const SHELL_NAV_TYPES = new Set<BlockType>(['image', 'divider', 'code', 'math', 'table']);
  const needsShell = !readOnly && SHELL_NAV_TYPES.has(block.type);
  const body = needsShell ? (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={shellKeyDown}
      onFocus={() => { onSelect(block.id); onActiveBlockChange?.(block.id); }}
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
    opacity: isDragging ? 0.4 : 1,
    userSelect: dragState ? 'none' : undefined,
    background: tintStyle.background ?? 'transparent',
  };

  const blockShellClass = blockShellClassName(isActive, selected, controlsVisible);

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
      <div
        className={`be-toggle-wrap${!toggleOpen ? ' be-toggle-collapsed' : ''}${toggleDropActive ? ' be-toggle-drop-active' : ''}`}
        style={{ '--be-toggle-depth': depth } as CSSProperties}
      >
        <div
          {...blockShellProps}
          style={blockShellStyle}
          className={`${blockShellClass} be-toggle-header-block`}
          onMouseEnter={() => onChromeEnter?.(block.id)}
          onMouseLeave={() => onChromeLeave?.()}
          onClick={() => { onSelect(block.id); onActiveBlockChange?.(block.id); }}
        >
          {dropIndicators}
          {handles}
          {renderToggleHeader(block, c, {
            toggleOpen, inline,
            onToggleCollapse: handleToggleCollapse,
            onToggleTodo: handleToggleTodo,
            getBlocks, onChange, searchQuery, depth, wikiTargets,
            readOnly, onSelect, onAddBelow,
            onSplitBlock, onMergeWithPrev, onContentChange,
            editableRef,
            onSlashOpen, onSlashClose,
            onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
            onToggleAddChild, onToggleEnter, onTableChange,
            onNavigateBlock, onActiveBlockChange, onConvertBlock,
            onIndentBlock, onOutdentBlock,
            getRootBlocks: getRootBlocks ?? getBlocks,
            onRootChange: onRootChange ?? onChange,
            searchQueryFor,
          })}
        </div>
        {toggleOpen && renderToggleChildren(block, c, {
          toggleOpen, inline,
          onToggleCollapse: handleToggleCollapse,
          onToggleTodo: handleToggleTodo,
          getBlocks, onChange, searchQuery, depth, wikiTargets,
          readOnly, onSelect, onAddBelow,
          onSplitBlock, onMergeWithPrev, onContentChange,
          editableRef,
          onSlashOpen, onSlashClose,
          onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
          onToggleAddChild, onToggleEnter, onTableChange,
          onNavigateBlock, onActiveBlockChange, onConvertBlock,
          onIndentBlock, onOutdentBlock,
          getRootBlocks: getRootBlocks ?? getBlocks,
          onRootChange: onRootChange ?? onChange,
          searchQueryFor,
        }, toggleDropActive)}
      </div>
    );
  }

  return (
    <div
      {...blockShellProps}
      style={blockShellStyle}
      className={blockShellClass}
      onMouseEnter={() => onChromeEnter?.(block.id)}
      onMouseLeave={() => onChromeLeave?.()}
      onClick={() => { onSelect(block.id); onActiveBlockChange?.(block.id); }}>
      {dropIndicators}
      {handles}
      {body}
    </div>
  );
}, singleBlockPropsEqual);

const hBtn = (c: BlockEditorColors): CSSProperties => ({
  background:c.card, border:`1px solid ${c.border}`, borderRadius: c.radiusBtn ?? 8,
  padding:'3px 4px', cursor:'pointer', color:c.textMuted,
  display:'flex', alignItems:'center', lineHeight:1,
});

// ── 블록 내용 렌더 함수 ───────────────────────────────────────────────
interface RCtx {
  toggleOpen: boolean;
  inline: (s: string) => ReactNode;
  onToggleCollapse: () => void;
  onToggleTodo: () => void;
  getBlocks: () => Block[]; onChange: (b: Block[]) => void;
  searchQuery: string; depth: number; readOnly: boolean;
  wikiTargets: string[];
  onSelect: (id: string) => void;
  onAddBelow: (id: string) => void;
  // Phase 2
  onSplitBlock:    (id: string, before: string, after: string) => void;
  onMergeWithPrev: (id: string, selfContent: string) => void;
  onContentChange: (id: string, content: string) => void;
  editableRef: React.MutableRefObject<HTMLElement | null>;
  // Phase 3
  onSlashOpen:  (state: SlashMenuState) => void;
  onSlashClose: () => void;
  // 위키링크 자동완성
  onWikiOpen:   (state: WikiMenuState) => void;
  onWikiClose:  () => void;
  isMenuOpen:   boolean;
  onWikiNavigate?: (title: string) => void;
  // Toggle Step 1: 빈 자식 영역 클릭 → 자식 블록 생성
  onToggleAddChild: (toggleBlockId: string) => void;
  // Toggle Step 2: 헤더 Enter → 첫 자식 블록 생성 & 포커스
  onToggleEnter: (toggleBlockId: string, currentContent: string) => void;
  // Table: 셀 편집 결과를 부모 blocks로 올림
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
  onNavigateBlock: (fromId: string, dir: 'up' | 'down') => void;
  onActiveBlockChange?: (id: string | null) => void;
  onConvertBlock: (id: string, type: BlockType) => void;
  onIndentBlock?: (id: string) => void;
  onOutdentBlock?: (id: string) => void;
  onPasteAt?: (id: string, start: number, end: number, text: string) => void;
  getRootBlocks: () => Block[];
  onRootChange: (b: Block[]) => void;
  searchQueryFor: (blockId: string) => string;
}

// ── TableBlock: 인라인 편집 가능한 테이블 컴포넌트 ─────────────────────
interface TableBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  searchQuery: string;
  inline: (s: string) => ReactNode;
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
}

function TableBlock({ block, colors: c, readOnly, inline, onTableChange }: TableBlockProps) {
  const headers  = block.tableHeaders ?? [];
  const rows     = block.tableRows    ?? [];
  const colCount = headers.length;

  // 현재 포커스된 셀 [row, col] — row=-1이면 헤더
  const [focusedCell, setFocusedCell] = useState<[number, number] | null>(null);

  // 셀 ref 맵: key = `${row},${col}` (row=-1은 헤더)
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cellKey  = (r: number, ci: number) => `${r},${ci}`;

  // ── 셀 ref 등록 ────────────────────────────────────────────────
  const registerCell = useCallback((r: number, ci: number, el: HTMLElement | null) => {
    const k = cellKey(r, ci);
    if (el) cellRefs.current.set(k, el);
    else    cellRefs.current.delete(k);
  }, []);

  // ── 셀 포커스 이동 ──────────────────────────────────────────────
  const focusCell = useCallback((r: number, ci: number) => {
    const el = cellRefs.current.get(cellKey(r, ci));
    if (el) { el.focus(); setFocusedCell([r, ci]); }
  }, []);

  // ── 데이터 업데이트 헬퍼 ───────────────────────────────────────
  const updateHeader = useCallback((ci: number, val: string) => {
    const next = [...headers];
    next[ci] = val;
    onTableChange(block.id, next, rows);
  }, [block.id, headers, rows, onTableChange]);

  const updateCell = useCallback((r: number, ci: number, val: string) => {
    const next = rows.map((row, ri) =>
      ri === r ? row.map((cell, cj) => cj === ci ? val : cell) : row
    );
    onTableChange(block.id, headers, next);
  }, [block.id, headers, rows, onTableChange]);

  // ── 행 추가 ────────────────────────────────────────────────────
  const addRow = useCallback((afterIdx?: number) => {
    const emptyRow = Array(colCount).fill('');
    const next = afterIdx !== undefined
      ? [...rows.slice(0, afterIdx + 1), emptyRow, ...rows.slice(afterIdx + 1)]
      : [...rows, emptyRow];
    onTableChange(block.id, headers, next);
    // 새 행의 첫 셀로 포커스
    const newRowIdx = afterIdx !== undefined ? afterIdx + 1 : next.length - 1;
    requestAnimationFrame(() => focusCell(newRowIdx, 0));
  }, [block.id, headers, rows, colCount, onTableChange, focusCell]);

  // ── 행 삭제 ────────────────────────────────────────────────────
  const deleteRow = useCallback((r: number) => {
    if (rows.length <= 1) return; // 최소 1행 유지
    const next = rows.filter((_, ri) => ri !== r);
    onTableChange(block.id, headers, next);
    // 삭제 후 이전 행 또는 헤더로 포커스
    requestAnimationFrame(() => {
      const targetRow = r > 0 ? r - 1 : -1;
      focusCell(targetRow, 0);
    });
  }, [block.id, headers, rows, onTableChange, focusCell]);

  // ── 열 추가 ────────────────────────────────────────────────────
  const addCol = useCallback((afterIdx: number) => {
    const nextHeaders = [
      ...headers.slice(0, afterIdx + 1),
      `Col ${headers.length + 1}`,
      ...headers.slice(afterIdx + 1),
    ];
    const nextRows = rows.map(row => [
      ...row.slice(0, afterIdx + 1),
      '',
      ...row.slice(afterIdx + 1),
    ]);
    onTableChange(block.id, nextHeaders, nextRows);
    requestAnimationFrame(() => focusCell(-1, afterIdx + 1));
  }, [block.id, headers, rows, onTableChange, focusCell]);

  // ── 열 삭제 ────────────────────────────────────────────────────
  const deleteCol = useCallback((ci: number) => {
    if (headers.length <= 1) return; // 최소 1열 유지
    const nextHeaders = headers.filter((_, i) => i !== ci);
    const nextRows    = rows.map(row => row.filter((_, i) => i !== ci));
    onTableChange(block.id, nextHeaders, nextRows);
    requestAnimationFrame(() => focusCell(-1, Math.max(0, ci - 1)));
  }, [block.id, headers, rows, onTableChange, focusCell]);

  // ── 키보드 네비게이션 ───────────────────────────────────────────
  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    r: number, ci: number,
  ) => {
    const totalRows = rows.length;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        // 다음 셀
        if (ci < colCount - 1) {
          focusCell(r, ci + 1);
        } else if (r < totalRows - 1) {
          focusCell(r + 1, 0);
        } else {
          // 마지막 셀 Tab → 새 행 추가
          addRow();
        }
      } else {
        // 이전 셀
        if (ci > 0) {
          focusCell(r, ci - 1);
        } else if (r > 0) {
          focusCell(r - 1, colCount - 1);
        } else {
          // 첫 셀 Shift+Tab → 헤더 마지막 열로
          focusCell(-1, colCount - 1);
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (r < totalRows - 1) {
        focusCell(r + 1, ci);
      } else {
        // 마지막 행 Enter → 새 행 추가
        addRow();
      }
    }

    if (e.key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
      setFocusedCell(null);
    }
  }, [rows.length, colCount, focusCell, addRow]);

  const handleHeaderKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    ci: number,
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        if (ci < colCount - 1) focusCell(-1, ci + 1);
        else                   focusCell(0, 0);
      } else {
        if (ci > 0) focusCell(-1, ci - 1);
        else        focusCell(rows.length - 1, colCount - 1);
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      focusCell(0, ci);
    }
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
      setFocusedCell(null);
    }
  }, [colCount, rows.length, focusCell]);

  // ── 열 툴팁 상태 (호버 시 +/× 버튼 표시) ──────────────────────
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  if (!colCount) return <div style={{ color: c.textFaint, fontSize: 13 }}>빈 테이블</div>;

  // readOnly 모드: 기존 렌더 유지
  if (readOnly) {
    return (
      <div style={{ overflowX: 'auto', margin: '4px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
          <thead>
            <tr>{headers.map((h, i) => (
              <th key={i} style={{ border: `1px solid ${c.border}`, padding: '7px 12px', background: c.toolbar, color: c.text, fontWeight: 700, textAlign: 'left' }}>
                {inline(h)}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} style={{ background: r % 2 === 0 ? 'transparent' : c.card }}>
                {headers.map((_, ci) => (
                  <td key={ci} style={{ border: `1px solid ${c.border}`, padding: '6px 12px', color: c.text }}>
                    {inline(row[ci] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── 셀 편집 스타일 ──────────────────────────────────────────────
  const cellEditStyle = (focused: boolean): CSSProperties => ({
    outline: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minWidth: 60,
    width: '100%',
    background: focused ? c.accentBg : 'transparent',
    transition: 'background .1s',
    borderRadius: 3,
    padding: '1px 2px',
    margin: '-1px -2px',
  });

  const thStyle = (ci: number): CSSProperties => ({
    border: `1px solid ${c.border}`,
    padding: '6px 10px',
    background: c.toolbar,
    color: c.text,
    fontWeight: 700,
    textAlign: 'left',
    position: 'relative',
    minWidth: 80,
  });

  const tdStyle = (r: number): CSSProperties => ({
    border: `1px solid ${c.border}`,
    padding: '5px 10px',
    color: c.text,
    background: r % 2 === 0 ? 'transparent' : c.card,
    position: 'relative',
    minWidth: 80,
  });

  const iconBtn = (onClick: () => void, title: string, content: ReactNode, danger = false): ReactNode => (
    <button
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: danger ? `${c.danger}18` : c.card,
        border: `1px solid ${danger ? c.danger + '60' : c.border}`,
        borderRadius: 4, padding: '1px 4px', cursor: 'pointer',
        color: danger ? c.danger : c.textMuted,
        fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center',
      }}
    >{content}</button>
  );

  return (
    <div style={{ overflowX: 'auto', margin: '4px 0' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 14, tableLayout: 'auto' }}>
        {/* ── 헤더 행 ── */}
        <thead>
          <tr>
            {/* 행 조작 버튼 컬럼 (헤더 행) */}
            <td style={{ width: 24, padding: 0, border: 'none' }}/>
            {headers.map((h, ci) => (
              <th
                key={ci}
                style={thStyle(ci)}
                onMouseEnter={() => setHoveredCol(ci)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {/* 열 버튼 (호버 시) */}
                {hoveredCol === ci && (
                  <div style={{
                    position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 2, zIndex: 10, background: c.card,
                    border: `1px solid ${c.border}`, borderRadius: 5, padding: '2px 3px',
                    boxShadow: '0 2px 8px #00000018',
                  }}>
                    {iconBtn(() => addCol(ci), '오른쪽에 열 추가', <Plus size={10}/>)}
                    {iconBtn(() => deleteCol(ci), '열 삭제', <Trash2 size={10}/>, true)}
                  </div>
                )}
                {/* 헤더 셀 contentEditable */}
                <span
                  ref={el => registerCell(-1, ci, el)}
                  contentEditable
                  suppressContentEditableWarning
                  style={cellEditStyle(
                    focusedCell !== null && focusedCell[0] === -1 && focusedCell[1] === ci
                  )}
                  onFocus={() => setFocusedCell([-1, ci])}
                  onBlur={e => {
                    updateHeader(ci, e.currentTarget.innerText.replace(/\n$/, ''));
                    setFocusedCell(null);
                  }}
                  onKeyDown={e => handleHeaderKeyDown(e, ci)}
                  onPaste={e => {
                    e.preventDefault();
                    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                  }}
                  dangerouslySetInnerHTML={{ __html: h }}
                />
              </th>
            ))}
            {/* 열 추가 버튼 */}
            <th style={{ border: 'none', padding: '4px 6px', background: 'transparent', width: 28 }}>
              <button
                onMouseDown={e => { e.preventDefault(); addCol(headers.length - 1); }}
                title="열 추가"
                style={{
                  background: 'none', border: `1px dashed ${c.border}`,
                  borderRadius: 4, padding: '3px 5px', cursor: 'pointer',
                  color: c.textFaint, fontSize: 11, lineHeight: 1,
                }}
              ><Plus size={10}/></button>
            </th>
          </tr>
        </thead>

        {/* ── 데이터 행 ── */}
        <tbody>
          {rows.map((row, r) => (
            <tr
              key={r}
              onMouseEnter={() => setHoveredRow(r)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* 행 삭제 버튼 */}
              <td style={{ width: 24, padding: '0 2px', border: 'none', verticalAlign: 'middle' }}>
                {hoveredRow === r && (
                  <button
                    onMouseDown={e => { e.preventDefault(); deleteRow(r); }}
                    title="행 삭제"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: c.danger, padding: '2px', opacity: 0.7, lineHeight: 1,
                      display: 'flex', alignItems: 'center',
                    }}
                  ><Trash2 size={11}/></button>
                )}
              </td>
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  style={tdStyle(r)}
                  onMouseEnter={() => setHoveredCol(ci)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <span
                    ref={el => registerCell(r, ci, el)}
                    contentEditable
                    suppressContentEditableWarning
                    style={cellEditStyle(
                      focusedCell !== null && focusedCell[0] === r && focusedCell[1] === ci
                    )}
                    onFocus={() => setFocusedCell([r, ci])}
                    onBlur={e => {
                      updateCell(r, ci, e.currentTarget.innerText.replace(/\n$/, ''));
                      setFocusedCell(null);
                    }}
                    onKeyDown={e => handleCellKeyDown(e, r, ci)}
                    onPaste={e => {
                      e.preventDefault();
                      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                    }}
                    dangerouslySetInnerHTML={{ __html: row[ci] ?? '' }}
                  />
                </td>
              ))}
              {/* 열 추가 열 자리 (빈 셀) */}
              <td style={{ border: 'none', width: 28 }}/>
            </tr>
          ))}
        </tbody>

        {/* ── 행 추가 버튼 행 ── */}
        <tfoot>
          <tr>
            <td colSpan={colCount + 2} style={{ border: 'none', padding: '4px 0 2px' }}>
              <button
                onMouseDown={e => { e.preventDefault(); addRow(); }}
                title="행 추가"
                style={{
                  background: 'none', border: `1px dashed ${c.border}`,
                  borderRadius: 5, padding: '3px 12px', cursor: 'pointer',
                  color: c.textFaint, fontSize: 12, display: 'flex',
                  alignItems: 'center', gap: 4,
                }}
              >
                <Plus size={11}/> 행 추가
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── MathBlock: 포커스 시 raw LaTeX, 비포커스 시 KaTeX 렌더 ───────────
interface MathBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (math: string) => void;
}

function MathBlock({ block, colors: c, readOnly, onChange }: MathBlockProps) {
  const expr = block.math ?? '';
  // 빈 수식 블록(예: /math 직후)은 곧바로 편집 상태로 시작
  const [editing, setEditing] = useState(!readOnly && !expr.trim());
  const [draft, setDraft] = useState(expr);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 편집 중이 아닐 때 외부 변경을 draft에 반영
  useEffect(() => { if (!editing) setDraft(expr); }, [expr, editing]);

  // 편집 진입 시 textarea 포커스 (끝으로 캐럿)
  useEffect(() => {
    if (editing) {
      const ta = taRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
  }, [editing]);

  const rendered = useMemo(() => {
    if (typeof window !== 'undefined' && window.katex && expr.trim()) {
      try { return window.katex.renderToString(expr, { displayMode: true, throwOnError: false }); }
      catch { return null; }
    }
    return null;
  }, [expr]);

  // ── readOnly(프리뷰) ──
  if (readOnly) {
    return rendered
      ? <div style={{ textAlign:'center', padding:'8px 0', overflowX:'auto' }} dangerouslySetInnerHTML={{ __html: rendered }}/>
      : <code style={{ background:c.codeBg, padding:'6px 10px', borderRadius:6, display:'block', color: expr.trim() ? c.danger : c.textFaint }}>
          {expr.trim() ? expr : '수식 없음'}
        </code>;
  }

  // ── 편집 모드 (textarea로 raw LaTeX 입력) ──
  if (editing) {
    return (
      <div style={{ margin:'4px 0' }} onClick={e => e.stopPropagation()}>
        <textarea
          ref={taRef}
          value={draft}
          spellCheck={false}
          placeholder="LaTeX 입력 (예: a^2 + b^2 = c^2)"
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          onBlur={() => setEditing(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLTextAreaElement).blur(); }
          }}
          style={{
            width:'100%', minHeight:54, resize:'vertical', boxSizing:'border-box',
            background:c.codeBg, color:c.text, border:`1px solid ${c.accent}`,
            borderRadius:8, padding:'10px 12px', outline:'none',
            fontFamily:'monospace', fontSize:13, lineHeight:1.5,
          }}
        />
        {/* 실시간 미리보기 */}
        {rendered && (
          <div style={{ textAlign:'center', padding:'8px 0', overflowX:'auto', borderTop:`1px dashed ${c.border}`, marginTop:6 }}
            dangerouslySetInnerHTML={{ __html: rendered }}/>
        )}
        <div style={{ fontSize:10, color:c.textFaint, marginTop:3, textAlign:'right' }}>
          KaTeX · Esc 또는 포커스 해제로 완료
        </div>
      </div>
    );
  }

  // ── 비편집(렌더) — 클릭하면 편집 ──
  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="클릭해서 수식 편집"
      style={{ cursor:'text', padding:'6px 0', borderRadius:6 }}>
      {rendered
        ? <div style={{ textAlign:'center', overflowX:'auto' }} dangerouslySetInnerHTML={{ __html: rendered }}/>
        : <code style={{ background:c.codeBg, padding:'6px 10px', borderRadius:6, display:'block', color: expr.trim() ? c.danger : c.textFaint }}>
            {expr.trim() ? expr : '수식 입력 (클릭)'}
          </code>}
    </div>
  );
}

// ── CodeBlock: 언어 라벨 + 편집 가능한 코드 textarea ─────────────────
interface CodeBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { code?: string; language?: string }) => void;
}

function CodeBlock({ block, colors: c, readOnly, onChange }: CodeBlockProps) {
  const code = block.code ?? '';
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 편집 중 캐럿 안정화를 위해 로컬 draft 사용 (외부 변경은 비포커스 시 동기화)
  const [draft, setDraft] = useState(code);
  useEffect(() => {
    if (document.activeElement !== taRef.current) setDraft(code);
  }, [code]);

  // 빈 코드 블록(예: /code 직후)은 마운트 시 포커스
  useEffect(() => {
    if (!readOnly && !code.trim()) taRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (readOnly) {
    return (
      <div style={{ background:c.codeBg, borderRadius:8, overflow:'hidden', margin:'4px 0', border:`1px solid ${c.border}` }}>
        {block.language && (
          <div style={{ padding:'4px 12px', borderBottom:`1px solid ${c.border}`, fontSize:11, color:c.textMuted, fontFamily:'monospace', fontWeight:600 }}>
            {block.language}
          </div>
        )}
        <pre style={{ margin:0, padding:'12px 16px', overflowX:'auto', fontSize:13, lineHeight:1.6 }}>
          <code style={{ color:c.text, fontFamily:'monospace' }}>{code || ' '}</code>
        </pre>
      </div>
    );
  }

  return (
    <div style={{ background:c.codeBg, borderRadius:8, overflow:'hidden', margin:'4px 0', border:`1px solid ${c.border}` }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderBottom:`1px solid ${c.border}` }}>
        <Code2 size={12} color={c.textMuted}/>
        <input
          value={block.language ?? ''}
          onChange={e => onChange({ language: e.target.value })}
          placeholder="language"
          spellCheck={false}
          style={{ background:'transparent', border:'none', outline:'none', color:c.textMuted, fontFamily:'monospace', fontSize:11, fontWeight:600, width:140 }}
        />
      </div>
      <textarea
        ref={taRef}
        value={draft}
        spellCheck={false}
        placeholder="코드 입력…"
        onChange={e => { setDraft(e.target.value); onChange({ code: e.target.value }); }}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const s = ta.selectionStart, en = ta.selectionEnd;
            const next = draft.slice(0, s) + '  ' + draft.slice(en);
            setDraft(next);
            onChange({ code: next });
            requestAnimationFrame(() => { if (taRef.current) taRef.current.selectionStart = taRef.current.selectionEnd = s + 2; });
          }
          if (e.key === 'Escape') (e.currentTarget as HTMLTextAreaElement).blur();
        }}
        style={{
          width:'100%', minHeight:72, resize:'vertical', boxSizing:'border-box',
          background:'transparent', color:c.text, border:'none', outline:'none',
          padding:'12px 16px', fontFamily:'monospace', fontSize:13, lineHeight:1.6,
        }}
      />
    </div>
  );
}

// ── ImageBlock: 업로드 / 드롭 / URL / 리사이즈 / 캡션 ─────────────────
const imgBtnStyle = (c: BlockEditorColors, danger = false): CSSProperties => ({
  background: danger ? `${c.danger}15` : c.card,
  border: `1px solid ${danger ? c.danger + '50' : c.border}`,
  color: danger ? c.danger : c.text,
  borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1,
});

interface ImageBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { src?: string; alt?: string; caption?: string; width?: number }) => void;
}

function ImageBlock({ block, colors: c, readOnly, onChange }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLElement>(null);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [resizingW, setResizingW] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState(block.caption ?? '');

  useEffect(() => { setCaptionDraft(block.caption ?? ''); }, [block.caption]);

  const imgStyle = (width?: number): CSSProperties => ({
    maxWidth: '100%',
    width: width ? width : 'auto',
    borderRadius: 8,
    border: `1px solid ${c.border}`,
    display: 'block',
    margin: '0 auto',
  });

  const applyFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      onChange({ src, alt: block.alt || f.name.replace(/\.[^.]+$/, '') });
      setUrlError('');
      setShowUrl(false);
      setUrlDraft('');
    };
    reader.readAsDataURL(f);
  }, [block.alt, onChange]);

  const applyUrl = useCallback((raw: string) => {
    const url = raw.trim();
    if (!isValidImageUrl(url)) {
      setUrlError('http(s) 또는 data:image URL을 입력하세요');
      return;
    }
    setUrlError('');
    onChange({ src: url, alt: block.alt || imageAltFromUrl(url) });
    setShowUrl(false);
    setUrlDraft('');
  }, [block.alt, onChange]);

  const handleFilesDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const f = Array.from(e.dataTransfer.files).find(x => x.type.startsWith('image/'));
    if (f) applyFile(f);
  }, [applyFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (Array.from(e.dataTransfer.items).some(i => i.kind === 'file' && i.type.startsWith('image/'))) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

  // 클립보드 이미지 붙여넣기
  useEffect(() => {
    if (readOnly) return;
    const el = zoneRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const f = item.getAsFile();
          if (f) applyFile(f);
          return;
        }
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [readOnly, applyFile, block.src]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = wrapRef.current?.querySelector('img');
    const startW = block.width ?? img?.clientWidth ?? 300;
    resizeRef.current = { startX: e.clientX, startW };
    setResizingW(startW);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const delta = e.clientX - resizeRef.current.startX;
    const next = Math.max(80, Math.min(900, Math.round(resizeRef.current.startW + delta)));
    setResizingW(next);
    onChange({ width: next });
  };

  const endResize = () => { resizeRef.current = null; setResizingW(null); };

  const saveCaption = useCallback(() => {
    const trimmed = captionDraft.trim();
    if (trimmed !== (block.caption ?? '')) onChange({ caption: trimmed });
  }, [captionDraft, block.caption, onChange]);

  const dropZoneStyle = (active: boolean): CSSProperties => ({
    border: `2px dashed ${active ? c.accent : c.border}`,
    borderRadius: 10,
    padding: block.src ? '12px' : '22px 16px',
    textAlign: 'center',
    background: active ? c.accentBg : c.card,
    transition: 'border-color .15s, background .15s',
  });

  const hiddenFile = (
    <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
      onChange={e => { const f = e.target.files?.[0]; if (f) applyFile(f); e.target.value = ''; }}/>
  );

  // ── readOnly(프리뷰) ──
  if (readOnly) {
    return (
      <figure className="be-image-block" style={{ margin:'8px 0', textAlign:'center' }}>
        {block.src
          ? <img src={block.src} alt={block.alt ?? ''} style={imgStyle(block.width)}/>
          : <div style={{ background:c.card, border:`2px dashed ${c.border}`, borderRadius:8, padding:'40px 20px', color:c.textFaint, fontSize:13 }}>
              <ImageIcon size={24} style={{ marginBottom:8, opacity:.4 }}/><div>이미지 없음</div>
            </div>}
        {block.caption && <figcaption style={{ fontSize:12, color:c.textMuted, marginTop:6, fontStyle:'italic' }}>{block.caption}</figcaption>}
      </figure>
    );
  }

  // ── 편집: src 없음 → 업로더 ──
  if (!block.src) {
    return (
      <div
        ref={zoneRef}
        className="be-image-block"
        tabIndex={0}
        onClick={e => e.stopPropagation()}
        style={{ margin:'8px 0', outline:'none' }}
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleFilesDrop}
          style={dropZoneStyle(isDragOver)}
        >
          <div style={{ marginBottom:10, color:c.textFaint }}><ImageIcon size={22}/></div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={imgBtnStyle(c)}>파일 업로드</button>
            <button type="button" onClick={() => { setShowUrl(v => !v); setUrlError(''); }} style={imgBtnStyle(c)}>URL 입력</button>
          </div>
          {showUrl && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:10, alignItems:'center' }}>
              <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%', maxWidth:360 }}>
                <input value={urlDraft} autoFocus
                  onChange={e => { setUrlDraft(e.target.value); setUrlError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(urlDraft); } }}
                  placeholder="https://example.com/image.png"
                  style={{ flex:1, background:c.input, border:`1px solid ${urlError ? c.danger : c.inputBdr}`, color:c.text, borderRadius:6, padding:'5px 9px', fontSize:12, outline:'none' }}/>
                <button type="button" onClick={() => applyUrl(urlDraft)} style={imgBtnStyle(c)}>추가</button>
              </div>
              {urlError && <span style={{ fontSize:11, color:c.danger }}>{urlError}</span>}
            </div>
          )}
          <div style={{ fontSize:10, color:c.textFaint, marginTop:8 }}>
            드래그&드롭 · 붙여넣기(Ctrl+V) 지원
          </div>
        </div>
        <input value={captionDraft}
          onChange={e => setCaptionDraft(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); (e.target as HTMLInputElement).blur(); } }}
          placeholder="캡션 (선택)"
          style={{ display:'block', margin:'10px auto 0', width:'70%', maxWidth:420, textAlign:'center', background:'transparent', border:'none', borderBottom:`1px solid ${c.border}`, color:c.textMuted, fontSize:12, fontStyle:'italic', outline:'none', padding:'2px 4px' }}/>
        {hiddenFile}
      </div>
    );
  }

  // ── 편집: src 있음 → 이미지 + 리사이즈 + 교체/삭제 + 캡션 ──
  return (
    <figure
      ref={zoneRef}
      className="be-image-block"
      tabIndex={0}
      onClick={e => e.stopPropagation()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFilesDrop}
      style={{ margin:'8px 0', textAlign:'center', outline:'none' }}
    >
      <div
        ref={wrapRef}
        style={{
          position:'relative', display:'inline-block', maxWidth:'100%',
          ...dropZoneStyle(isDragOver),
          padding: isDragOver ? 8 : 0,
          border: isDragOver ? `2px dashed ${c.accent}` : 'none',
          background: isDragOver ? c.accentBg : 'transparent',
        }}
      >
        <img src={block.src} alt={block.alt ?? ''} style={imgStyle(block.width)}/>
        <div
          role="separator"
          aria-label="이미지 크기 조절"
          onPointerDown={startResize}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          style={{
            position:'absolute', right:-4, bottom:-4, width:14, height:14,
            cursor:'nwse-resize', background:c.accent, borderRadius:3,
            border:`2px solid ${c.card}`, touchAction:'none',
          }}
        />
        {resizingW != null && (
          <span style={{
            position:'absolute', top:-22, right:0, fontSize:10, fontWeight:700,
            color:c.accent, background:c.card, border:`1px solid ${c.border}`,
            borderRadius:4, padding:'1px 6px',
          }}>{resizingW}px</span>
        )}
      </div>
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:8, flexWrap:'wrap' }}>
        <button type="button" onClick={() => fileRef.current?.click()} style={imgBtnStyle(c)}>파일 교체</button>
        <button type="button" onClick={() => { setShowUrl(v => !v); setUrlError(''); }} style={imgBtnStyle(c)}>URL 교체</button>
        <button type="button" onClick={() => onChange({ src: '', width: undefined })} style={imgBtnStyle(c, true)}>삭제</button>
      </div>
      {showUrl && (
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%', maxWidth:360 }}>
            <input value={urlDraft} autoFocus
              onChange={e => { setUrlDraft(e.target.value); setUrlError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(urlDraft); } }}
              placeholder="https://example.com/image.png"
              style={{ flex:1, background:c.input, border:`1px solid ${urlError ? c.danger : c.inputBdr}`, color:c.text, borderRadius:6, padding:'5px 9px', fontSize:12, outline:'none' }}/>
            <button type="button" onClick={() => applyUrl(urlDraft)} style={imgBtnStyle(c)}>적용</button>
          </div>
          {urlError && <span style={{ fontSize:11, color:c.danger }}>{urlError}</span>}
        </div>
      )}
      <input value={captionDraft}
        onChange={e => setCaptionDraft(e.target.value)}
        onBlur={saveCaption}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); (e.target as HTMLInputElement).blur(); } }}
        placeholder="캡션 (선택) — Enter 또는 포커스 해제 시 저장"
        style={{ display:'block', margin:'10px auto 0', width:'70%', maxWidth:420, textAlign:'center', background:'transparent', border:'none', borderBottom:`1px solid ${c.border}`, color:c.textMuted, fontSize:12, fontStyle:'italic', outline:'none', padding:'2px 4px' }}/>
      {hiddenFile}
    </figure>
  );
}

function toggleSharedEditProps(block: Block, ctx: RCtx) {
  return {
    editableRef: ctx.editableRef,
    onSplitBlock: ctx.onSplitBlock,
    onMergeWithPrev: ctx.onMergeWithPrev,
    onContentChange: ctx.onContentChange,
    onSlashOpen: ctx.onSlashOpen,
    onSlashClose: ctx.onSlashClose,
    onWikiOpen: ctx.onWikiOpen,
    onWikiClose: ctx.onWikiClose,
    isMenuOpen: ctx.isMenuOpen,
    onNavigateBlock: ctx.onNavigateBlock,
    onActiveBlockChange: ctx.onActiveBlockChange,
    onWikiNavigate: ctx.onWikiNavigate,
    wikiTargets: ctx.wikiTargets,
    searchQuery: ctx.searchQueryFor(block.id),
    onConvertBlock: ctx.onConvertBlock,
    onIndentBlock: ctx.onIndentBlock,
    onOutdentBlock: ctx.onOutdentBlock,
    onPasteAt: ctx.onPasteAt,
  };
}

function renderToggleHeader(block: Block, c: BlockEditorColors, ctx: RCtx): ReactNode {
  const { inline, readOnly } = ctx;
  const sharedEditProps = toggleSharedEditProps(block, ctx);
  return (
    <div style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'2px 0' }}>
      <button
        type="button"
        aria-label={ctx.toggleOpen ? '접기' : '펼치기'}
        style={{
          color:c.textMuted, background:'none', border:'none', padding:0,
          transition:'transform .18s', transform: ctx.toggleOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          marginTop:3, flexShrink:0, cursor:'pointer', display:'flex',
        }}
        onClick={e => { e.stopPropagation(); ctx.onToggleCollapse(); }}>
        <ChevronRight size={15}/>
      </button>
      {readOnly
        ? <span style={{ fontWeight:600, fontSize:15, color:c.text, lineHeight:1.6 }}>
            {block.content ? inline(block.content) : <span style={{ color:c.textFaint }}>{blockPlaceholder('toggle')}</span>}
          </span>
        : <EditableBlock block={block} colors={c} tag="span"
            style={{ fontWeight:600, fontSize:15, color:c.text, lineHeight:1.6, flex:1, display:'block' }}
            placeholder={blockPlaceholder('toggle')} {...sharedEditProps}
            onEnterOverride={currentContent => ctx.onToggleEnter(block.id, currentContent)}/>
      }
    </div>
  );
}

function renderToggleChildren(
  block: Block,
  c: BlockEditorColors,
  ctx: RCtx,
  toggleDropActive = false,
): ReactNode {
  return (
    <div
      className={`be-toggle-children be-toggle-drop${toggleDropActive ? ' be-toggle-drop-active' : ''}`}
      data-toggle-id={block.id}
      style={{ '--be-toggle-depth': ctx.depth + 1 } as CSSProperties}
    >
      {block.children.length > 0 ? (
        <BlockEditorInner
          blocks={block.children}
          onChange={children => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, children })))}
          colors={c} readOnly={ctx.readOnly} searchQuery={ctx.searchQuery} depth={ctx.depth + 1}
          wikiTargets={ctx.wikiTargets}
          onWikiNavigate={ctx.onWikiNavigate}
          onActiveBlockChange={ctx.onActiveBlockChange}
          externalFocusId={undefined}
          getRootBlocks={ctx.getRootBlocks}
          onRootChange={ctx.onRootChange}
          onEscapeToParentBelow={() => {
            const newBlock = makeBlock('paragraph');
            ctx.onChange(insertBlockAfter(ctx.getBlocks(), block.id, newBlock));
            requestAnimationFrame(() => {
              const h = getFocusHandler(newBlock.id);
              if (h) h({ blockId: newBlock.id, offset: 'start' });
            });
          }}
          onEscapeToParentHeader={() => {
            const h = getFocusHandler(block.id);
            if (h) h({ blockId: block.id, offset: 'end' });
          }}
        />
      ) : !ctx.readOnly && (
        <div
          className="be-toggle-empty"
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); ctx.onToggleAddChild(block.id); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onToggleAddChild(block.id); } }}
        >
          내용 추가…
        </div>
      )}
    </div>
  );
}

function renderInner(block: Block, c: BlockEditorColors, ctx: RCtx): ReactNode {
  const { inline, editableRef, onSplitBlock, onMergeWithPrev, onContentChange, readOnly,
          onSlashOpen, onSlashClose, onWikiOpen, onWikiClose, isMenuOpen } = ctx;

  /** 편집 가능한 텍스트 블록 공통 props */
  const sharedEditProps = {
    editableRef, onSplitBlock, onMergeWithPrev, onContentChange,
    onSlashOpen, onSlashClose,
    onWikiOpen, onWikiClose, isMenuOpen,
    onNavigateBlock: ctx.onNavigateBlock,
    onActiveBlockChange: ctx.onActiveBlockChange,
    onWikiNavigate: ctx.onWikiNavigate,
    wikiTargets: ctx.wikiTargets,
    searchQuery: ctx.searchQueryFor(block.id),
    onConvertBlock: ctx.onConvertBlock,
    onIndentBlock: ctx.onIndentBlock,
    onOutdentBlock: ctx.onOutdentBlock,
    onPasteAt: ctx.onPasteAt,
  };
  const ep = (tag: EditableBlockProps['tag'], style: CSSProperties, placeholder?: string) =>
    !readOnly ? (
      <EditableBlock block={block} colors={c} tag={tag} style={style}
        placeholder={placeholder} {...sharedEditProps}/>
    ) : null;

  switch (block.type) {
    case 'paragraph':
      return readOnly ? (
        <p style={{ margin:'2px 0', lineHeight:1.75, fontSize:15,
          color: block.content ? c.text : c.textFaint, minHeight:26 }}>
          {block.content
            ? inline(block.content)
            : <span style={{ color:c.textFaint, pointerEvents:'none' }}>텍스트 입력…</span>}
        </p>
      ) : (
        <EditableBlock block={block} colors={c} tag="p"
          style={{ margin:'2px 0', lineHeight:1.75, fontSize:15, color:c.text, minHeight:26 }}
          {...sharedEditProps}/>
      );
    case 'heading1':
      return readOnly
        ? <h1 style={{ fontSize:28, fontWeight:800, margin:'16px 0 4px', lineHeight:1.3, color:c.text }}>{inline(block.content)}</h1>
        : ep('h1', { fontSize:28, fontWeight:800, margin:'16px 0 4px', lineHeight:1.3, color:c.text });
    case 'heading2':
      return readOnly
        ? <h2 style={{ fontSize:22, fontWeight:700, margin:'14px 0 3px', lineHeight:1.35, color:c.text }}>{inline(block.content)}</h2>
        : ep('h2', { fontSize:22, fontWeight:700, margin:'14px 0 3px', lineHeight:1.35, color:c.text });
    case 'heading3':
      return readOnly
        ? <h3 style={{ fontSize:17, fontWeight:700, margin:'10px 0 2px', lineHeight:1.4, color:c.text }}>{inline(block.content)}</h3>
        : ep('h3', { fontSize:17, fontWeight:700, margin:'10px 0 2px', lineHeight:1.4, color:c.text });
    case 'bullet':
      return (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'2px 0' }}>
          <span style={{ color:c.accent, fontSize:18, lineHeight:'26px', flexShrink:0 }}>•</span>
          {readOnly
            ? <span style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1, display:'block' }}
                {...sharedEditProps}/>
          }
        </div>
      );
    case 'numbered':
      return (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'2px 0' }}>
          <span style={{ color:c.textMuted, fontSize:14, lineHeight:'26px', flexShrink:0, minWidth:20, fontWeight:500 }}>{numberedMarker(block)}.</span>
          {readOnly
            ? <span style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1, display:'block' }}
                {...sharedEditProps}/>
          }
        </div>
      );
    case 'todo':
      return (
        <div style={{ display:'flex', gap:9, alignItems:'flex-start', padding:'2px 0' }}>
          <button onClick={e => { e.stopPropagation(); ctx.onToggleTodo(); }} style={{
            width:18, height:18, flexShrink:0, marginTop:4,
            border:`2px solid ${block.checked ? c.accent : c.border}`,
            borderRadius:4, background: block.checked ? c.accent : 'transparent',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .1s',
          }}>
            {block.checked && <span style={{ color:'#fff', fontSize:11 }}>✓</span>}
          </button>
          {readOnly
            ? <span style={{
                lineHeight:1.7, fontSize:15, flex:1,
                color: block.checked ? c.textMuted : c.text,
                textDecoration: block.checked ? 'line-through' : 'none',
                opacity: block.checked ? .6 : 1, transition:'all .15s',
              }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{
                  lineHeight:1.7, fontSize:15, flex:1, display:'block',
                  color: block.checked ? c.textMuted : c.text,
                  textDecoration: block.checked ? 'line-through' : 'none',
                  opacity: block.checked ? .6 : 1, transition:'all .15s',
                }}
                {...sharedEditProps}/>
          }
        </div>
      );
    case 'toggle':
      return null;
    case 'quote':
      return readOnly
        ? <blockquote style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
            color:c.textMuted, fontStyle:'italic', fontSize:15, lineHeight:1.7, margin:'4px 0' }}>
            {inline(block.content)}
          </blockquote>
        : <EditableBlock block={block} colors={c} tag="blockquote"
            style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
              color:c.textMuted, fontStyle:'italic', fontSize:15, lineHeight:1.7, margin:'4px 0' }}
            {...sharedEditProps}/>;
    case 'callout':
      return (
        <div className="be-callout" style={{
          background: `linear-gradient(135deg, ${c.calloutBg} 0%, ${c.card} 100%)`,
          borderRadius: 10, padding:'12px 14px',
          display:'flex', gap:12, alignItems:'flex-start', margin:'6px 0',
          border:`1px solid ${c.border}`,
          borderLeft: `4px solid ${c.accent}`,
          boxShadow: `0 1px 3px ${c.border}44`,
        }}>
          <span style={{
            fontSize:20, flexShrink:0, lineHeight:'26px',
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            background: c.accentBg, borderRadius:8,
          }}>{block.calloutIcon ?? '💡'}</span>
          {readOnly
            ? <span style={{ fontSize:14, lineHeight:1.7, color:c.text }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ fontSize:14, lineHeight:1.7, color:c.text, flex:1, display:'block' }}
                {...sharedEditProps}/>
          }
        </div>
      );
    case 'divider':
      return <hr style={{ border:'none', borderTop:`1px solid ${c.border}`, margin:'12px 0' }}/>;
    case 'code':
      return (
        <CodeBlock
          block={block} colors={c} readOnly={readOnly}
          onChange={patch => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, ...patch })))}
        />
      );
    case 'image':
      return (
        <ImageBlock
          block={block} colors={c} readOnly={readOnly}
          onChange={patch => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, ...patch })))}
        />
      );
    case 'table':
      return (
        <TableBlock
          block={block} colors={c}
          readOnly={readOnly} searchQuery={ctx.searchQuery}
          inline={inline}
          onTableChange={ctx.onTableChange}
        />
      );
    case 'math':
      return (
        <MathBlock
          block={block} colors={c} readOnly={readOnly}
          onChange={math => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, math })))}
        />
      );
    default:
      return <p style={{ color:c.text, fontSize:15, lineHeight:1.7 }}>{block.content}</p>;
  }
}

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

  const [selected, setSelected] = useState<string | null>(null);
  const [focusCmd, setFocusCmd] = useState<FocusCmd | null>(null);
  // Phase 3: 슬래시 커맨드
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  // 위키링크 자동완성
  const [wikiMenu, setWikiMenu] = useState<WikiMenuState | null>(null);
  // Phase 3: 드래그&드롭 — root-level only; nested editors share via DragCtx
  const parentDrag = useContext(DragCtx);
  const localDrag = useDragDrop(getRootBlocks, onRootChange);
  const { dragState, bindGripPointer, getDragProps } = depth === 0 ? localDrag : parentDrag!;
  const [handleMenu, setHandleMenu] = useState<TurnIntoMenuState | null>(null);
  const [pinnedControlsId, setPinnedControlsId] = useState<string | null>(null);
  const [chromeHoverId, setChromeHoverId] = useState<string | null>(null);
  const chromeLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleControlsPin = useCallback((id: string) => {
    setPinnedControlsId(prev => (prev === id ? null : id));
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

  const handleAddBelow = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    onChange(insertBlockAfter(blocksRef.current, id, nb));
    setFocusCmd({ blockId: nb.id, offset: 'start' });
    setSelected(nb.id);
  }, [onChange]);

  const handleAddAbove = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    const bs = blocksRef.current;
    const idx = bs.findIndex(b => b.id === id);
    if (idx < 0) return;
    const next = [...bs];
    next.splice(idx, 0, nb);
    onChange(next);
    setFocusCmd({ blockId: nb.id, offset: 'start' });
    setSelected(nb.id);
  }, [onChange]);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteBlockById(blocksRef.current, id);
    onChange(updated.length > 0 ? updated : [makeBlock('paragraph')]);
    setSelected(null);
  }, [onChange]);

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
    setSelected(copy.id);
  }, [onChange]);

  useEffect(() => {
    if (!searchQuery.trim() || searchScope === 'all') return;
    const matches = collectEditorSearchMatches(getRootBlocks(), searchQuery);
    if (!matches.length) return;
    const m = matches[searchMatchIndex % matches.length];
    setSelected(m.blockId);
    handleActiveBlockChange(m.blockId);
    setFocusCmd({ blockId: m.blockId, offset: m.offset });
  }, [searchMatchIndex, searchQuery, searchScope, getRootBlocks, handleActiveBlockChange]);

  const renderBlockMenu = (state: TurnIntoMenuState, onDone: () => void) => {
    const id = state.blockId;
    const root = getRootBlocks();
    return (
      <BlockContextMenu
        blockId={id}
        currentType={findBlockById(blocksRef.current, id)?.type ?? 'paragraph'}
        anchorY={state.anchorY}
        anchorX={state.anchorX}
        colors={c}
        onAddAbove={() => { handleAddAbove(id); onDone(); }}
        onAddBelow={() => { handleAddBelow(id); onDone(); }}
        onDuplicate={() => { handleDuplicate(id); onDone(); }}
        onIndent={() => { handleIndentBlock(id); onDone(); }}
        onOutdent={() => { handleOutdentBlock(id); onDone(); }}
        onMoveIntoToggle={() => { handleMoveIntoPrevToggle(id); onDone(); }}
        onMoveOutOfToggle={() => { handleMoveOutOfToggleBlock(id); onDone(); }}
        canMoveIntoToggle={canMoveIntoPreviousToggle(root, id)}
        canMoveOutOfToggle={isInsideToggle(root, id)}
        onSetTint={tint => { handleSetTint(id, tint); onDone(); }}
        onCopyLink={() => { handleCopyBlockLink(id); onDone(); }}
        onSelect={type => handleConvert(id, type)}
        onDelete={() => { handleDelete(id); onDone(); }}
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
      setSelected(result.focusBlockId);
      return;
    }

    const cur = bs[idx];

    if (isListType(cur.type) && before === '' && after === '') {
      const next = exitEmptyListBlock(bs, id);
      onChange(next);
      setFocusCmd({ blockId: id, offset: 'start' });
      setSelected(id);
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
    setSelected(newBlock.id);
  }, [onChange, onEscapeToParentBelow]);

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
    setSelected(prevId);
  }, [onChange, onEscapeToParentHeader]);

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
    setSelected(result.focusBlockId);
  }, [onChange]);

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
    setSelected(targetId);
    handleActiveBlockChange(targetId);
    setFocusCmd({
      blockId: targetId,
      offset: isTextBlockType(targetBlock.type)
        ? (dir === 'up' ? 'end' : 'start')
        : 'start',
    });
  }, [handleActiveBlockChange]);

  // 외부 포커스 요청 (이미지 삽입 직후 등)
  useEffect(() => {
    if (!externalFocusId) return;
    setSelected(externalFocusId);
    handleActiveBlockChange(externalFocusId);
    setFocusCmd({ blockId: externalFocusId, offset: 'start' });
    onExternalFocusConsumed?.();
  }, [externalFocusId, handleActiveBlockChange, onExternalFocusConsumed]);

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

  const editorBody = (
    <>
      <div
        className={`be-editor-root${depth > 0 ? ' be-editor-nested' : ''}`}
        style={{ paddingLeft: readOnly ? 0 : (depth > 0 ? 36 : 0), position:'relative' }}
      >
        {blocks.map(block => (
          <SingleBlock
            key={block.id} block={block}
            colors={c} selected={selected === block.id}
            activeBlockId={activeBlockId}
            onSelect={setSelected}
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
            getRootBlocks={getRootBlocks}
            onRootChange={onRootChange}
            searchQueryFor={searchQueryFor}
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
        <DragCtx.Provider value={localDrag}>{editorBody}</DragCtx.Provider>
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
          '--be-toggle-bg': colors.toggleBg ?? 'transparent',
          '--be-toggle-rail': colors.isDark ? 'rgba(139,92,246,0.22)' : 'rgba(139,92,246,0.16)',
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
  const blocks = useMemo(() => markdownToBlocks(body), [body]);
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
