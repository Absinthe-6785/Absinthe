import React, {
  useState, useRef, useCallback, useEffect,
  type CSSProperties,
} from 'react';
import {
  type Block, type BlockType,
  updateBlockById,
  isTextBlockType,
} from '../../../blockUtils';
import { readBlockText, setCaretOffset } from '../../../editableDom';
import { blockTintStyle } from '../../../blockColors';
import {
  isPasteTraceActive,
  traceRenderBlock,
} from '../../../pastePipelineTrace';
import { blockLayoutIndentPx } from '../../../listBlocks';
import {
  DropInsertIndicator,
  type DragState,
} from '../../../editorDragDrop';
import type {
  BlockEditorColors, BlockRenderContext, TurnIntoMenuState,
  SlashMenuState, WikiMenuState,
} from '../../../editorTypes';
import { renderBlockContent } from '../../../blockRegistry';
import { SafeBlockRenderer } from '../../../SafeBlockRenderer';
import { ToggleBlock } from '../../../ToggleBlock';
import type { ToggleNestedRenderer } from '../../../toggleRender';
import {
  registerFocusHandler,
  type FocusCmd,
} from '../features/selection';
import { useVirtualNavigation } from '../performance/VirtualNavigationContext';
import { BlockGutter, BlockHandles, blockShellClassName } from '../../../EditorChrome';
import { renderInlineMarkdown } from '../../../editableRender';
import { useBlocksCtx } from '../contexts/BlocksContext';

const getElText = readBlockText;

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
  onToggleEnter: (toggleBlockId: string, before: string, after: string) => void;
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
  showPersistentPlaceholder?: (blockId: string) => boolean;
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
    && prev.renderToggleNested === next.renderToggleNested
    && prev.showPersistentPlaceholder === next.showPersistentPlaceholder;
}

export const SingleBlock = React.memo(function SingleBlock({
  block, colors: c, isSelected,
  onBlockSelect, onAddBelow, readOnly, searchQuery, depth, wikiTargets, headingIndex,
  onSplitBlock, onMergeWithPrev, onContentChange,
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
  showPersistentPlaceholder,
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
  const virtualNavigation = useVirtualNavigation();

  const applyFocusCommand = useCallback((cmd: FocusCmd) => {
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
  }, [block.type]);

  // 포커스 레지스트리 + pending queue replay on mount (virtualization-safe)
  useEffect(() => {
    const handler = (cmd: FocusCmd) => { applyFocusCommand(cmd); };
    const unregister = registerFocusHandler(block.id, handler);
    const pending = virtualNavigation?.consumePendingFocus(block.id);
    if (pending) {
      requestAnimationFrame(() => applyFocusCommand(pending));
    }
    return unregister;
  }, [block.id, applyFocusCommand, virtualNavigation]);

  const inline = (text: string) => renderInlineMarkdown(text, c, searchQuery, wikiTargets);

  // ── 드래그 인디케이터 계산 ──────────────────────────────────────
  const isDragging   = dragState?.draggingIds.includes(block.id) ?? false;
  const isOverBefore = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'before';
  const isOverAfter  = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'after';
  const isOverInside = !isDragging && block.type === 'toggle' && dragState?.overId === block.id && dragState?.overPos === 'inside';
  const isActive     = activeBlockId === block.id;
  const layoutIndent = blockLayoutIndentPx(block, depth);

  if (isPasteTraceActive() && depth === 0) {
    const rendered = block.type === 'toggle' ? 'ToggleBlock'
      : block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3'
        ? `EditableBlock/${block.type}`
        : block.type === 'paragraph' ? 'EditableBlock/paragraph'
          : `SingleBlock/${block.type}`;
    traceRenderBlock(block, rendered);
  }

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
    showPersistentPlaceholder,
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
    applyFocusCommand({ blockId: block.id, offset: 'end' });
  }, [readOnly, block.id, onBlockSelect, onActiveBlockChange, applyFocusCommand]);

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
