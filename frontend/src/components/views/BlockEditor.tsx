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
  useState, useRef, useCallback, useMemo, useEffect,
  type ReactNode, type CSSProperties,
} from 'react';
import {
  ChevronRight, Plus, GripVertical,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Code2,
  Image as ImageIcon, Minus, Table2, Quote, Zap, Type,
  Trash2, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  type Block, type BlockType,
  makeBlock,
  updateBlockById, insertBlockAfter, deleteBlockById,
  findBlockById, flattenBlockIds,
  BLOCK_TYPE_MENU, filterBlockMenu,
  blocksToMarkdown, markdownToBlocks,
} from './blockUtils';

// ── 커서 유틸리티 ────────────────────────────────────────────────────

/** contentEditable 요소 내 텍스트 오프셋으로 캐럿 복원 */
function setCaretOffset(el: HTMLElement, offset: number) {
  const range = document.createRange();
  const sel   = window.getSelection();
  if (!sel) return;

  // 텍스트 노드를 순서대로 탐색
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null = null;

  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length;
    if (remaining <= len) {
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
  }

  // offset이 전체 길이를 초과하면 맨 끝에 위치
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** contentEditable 요소 내 현재 캐럿 오프셋 반환 */
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const pre   = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

/** contentEditable 요소의 현재 텍스트 내용 반환 */
function getElText(el: HTMLElement): string {
  return el.innerText.replace(/\n$/, ''); // 브라우저가 붙이는 trailing \n 제거
}

// ── 전역 포커스 레지스트리 ────────────────────────────────────────────
// BlockEditorInner → SingleBlock 간 포커스 명령 전달
type FocusCmd = { blockId: string; offset: 'start' | 'end' | number };
const focusRegistry = new Map<string, (cmd: FocusCmd) => void>();

// ── 드래그&드롭 훅 ────────────────────────────────────────────────────
interface DragState {
  draggingId:  string;           // 드래그 중인 블록 id
  overId:      string | null;    // 현재 hover 블록 id
  overPos:     'before' | 'after' | null; // 삽입 위치
}

interface UseDragDropResult {
  dragState:    DragState | null;
  startDrag:    (id: string, e: React.PointerEvent) => void;
  getDragProps: (id: string) => {
    onPointerEnter: (e: React.PointerEvent) => void;
    'data-drag-id': string;
  };
}

function useDragDrop(
  blocks: Block[],
  onReorder: (newBlocks: Block[]) => void,
): UseDragDropResult {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragState({ draggingId: id, overId: null, overPos: null });

    const onMove = (ev: PointerEvent) => {
      // 커서 아래 가장 가까운 be-block 찾기
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      const blockEl = els.find(
        el => el.classList.contains('be-block') &&
              el.getAttribute('data-drag-id') !== id
      ) as HTMLElement | undefined;

      if (!blockEl) {
        setDragState(s => s ? { ...s, overId: null, overPos: null } : null);
        return;
      }

      const overId   = blockEl.getAttribute('data-drag-id') ?? '';
      const rect     = blockEl.getBoundingClientRect();
      const overPos: 'before' | 'after' = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDragState(s => s ? { ...s, overId, overPos } : null);
    };

    const onUp = () => {
      const st = dragStateRef.current;
      if (st?.overId && st.overPos) {
        const from = blocks.findIndex(b => b.id === st.draggingId);
        const to   = blocks.findIndex(b => b.id === st.overId);
        if (from >= 0 && to >= 0 && from !== to) {
          const next = [...blocks];
          const [moved] = next.splice(from, 1);
          const insertAt = st.overPos === 'before'
            ? (to > from ? to - 1 : to)
            : (to > from ? to     : to + 1);
          next.splice(Math.max(0, insertAt), 0, moved);
          onReorder(next);
        }
      }
      setDragState(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [blocks, onReorder]);

  const getDragProps = useCallback((id: string) => ({
    onPointerEnter: (_e: React.PointerEvent) => {
      if (dragStateRef.current?.draggingId) {
        // handled via pointermove on window
      }
    },
    'data-drag-id': id,
  }), []);

  return { dragState, startDrag, getDragProps };
}

// ── 슬래시 커맨드 상태 타입 ──────────────────────────────────────────
interface SlashMenuState {
  blockId:  string;
  query:    string;     // '/' 이후 입력된 검색어
  anchorY:  number;
  anchorX:  number;
}

// ── 위키링크 자동완성 상태 타입 ──────────────────────────────────────
interface WikiMenuState {
  blockId:  string;
  query:    string;     // '[[' 이후 입력된 검색어
  anchorY:  number;
  anchorX:  number;
}

// ── 색상 팔레트 (NoteView의 c 객체와 동일 구조) ─────────────────────
export interface BlockEditorColors {
  bg:         string;
  text:       string;
  textMuted:  string;
  textFaint:  string;
  accent:     string;
  accentBg:   string;
  border:     string;
  card:       string;
  cardHov:    string;
  input:      string;
  inputBdr:   string;
  toolbar:    string;
  danger:     string;
  green:      string;
  codeBg:     string;
  calloutBg:  string;
  toggleBg:   string;
  quoteBdr:   string;
  selection:  string;
}

// ── Props ────────────────────────────────────────────────────────────
interface BlockEditorProps {
  blocks:       Block[];
  onChange:     (blocks: Block[]) => void;
  colors:       BlockEditorColors;
  readOnly?:    boolean;
  searchQuery?: string;
  /** 위키링크 [[ 자동완성 후보 (노트 제목 목록) */
  wikiTargets?: string[];
}

interface BlockMenuState { blockId: string; anchorY: number; anchorX: number; }

// ── 블록 타입 → 아이콘 ───────────────────────────────────────────────
function blockIcon(type: BlockType): ReactNode {
  const s = 12;
  const map: Partial<Record<BlockType, ReactNode>> = {
    heading1: <Heading1 size={s}/>, heading2: <Heading2 size={s}/>, heading3: <Heading3 size={s}/>,
    bullet: <List size={s}/>, numbered: <ListOrdered size={s}/>, todo: <CheckSquare size={s}/>,
    code: <Code2 size={s}/>, image: <ImageIcon size={s}/>, divider: <Minus size={s}/>,
    table: <Table2 size={s}/>, quote: <Quote size={s}/>, callout: <Zap size={s}/>,
    toggle: <ChevronRight size={s}/>, math: <span style={{fontSize:11,fontWeight:700}}>∑</span>,
  };
  return map[type] ?? <Type size={s}/>;
}

// ── 인라인 마크다운 렌더러 ───────────────────────────────────────────
function renderInlineMarkdown(text: string, c: BlockEditorColors, searchQuery = ''): ReactNode {
  const esc = (s: string) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let html = esc(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/~~(.+?)~~/g,         '<del>$1</del>')
    .replace(/==(.+?)==/g,         `<mark style="background:${c.accentBg};color:${c.accent}">$1</mark>`)
    .replace(/`([^`]+)`/g,         `<code style="background:${c.codeBg};color:${c.accent};padding:1px 5px;border-radius:4px;font-size:.88em">$1</code>`)
    .replace(/\[\[(.+?)\]\]/g,     `<span style="color:${c.accent};text-decoration:underline;cursor:pointer">$1</span>`)
    .replace(/(^|\s)#([\w\uAC00-\uD7A3]+)/g, `$1<span style="color:${c.accent};opacity:.8">#$2</span>`);
  if (searchQuery.trim()) {
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html = html.replace(new RegExp(`(${q})`, 'gi'), '<mark style="background:#fbbf24;color:#000">$1</mark>');
  }
  return <span dangerouslySetInnerHTML={{ __html: html }}/>;
}

// ── SingleBlock ───────────────────────────────────────────────────────
interface SingleBlockProps {
  block: Block; blocks: Block[]; onChange: (b: Block[]) => void;
  colors: BlockEditorColors; selected: boolean;
  onSelect: (id: string) => void; onOpenMenu: (s: BlockMenuState) => void;
  onAddBelow: (id: string) => void; readOnly: boolean;
  searchQuery: string; depth: number; wikiTargets: string[];
  // Phase 2: 편집 콜백
  onSplitBlock:    (id: string, before: string, after: string) => void;
  onMergeWithPrev: (id: string, selfContent: string) => void;
  onContentChange: (id: string, content: string) => void;
  focusCmd?: FocusCmd | null;
  // Phase 3: 드래그&드롭
  dragState:  DragState | null;
  startDrag:  (id: string, e: React.PointerEvent) => void;
  getDragProps: (id: string) => { onPointerEnter: (e: React.PointerEvent) => void; 'data-drag-id': string };
  // Phase 3: 슬래시 커맨드
  onSlashOpen:  (state: SlashMenuState) => void;
  onSlashClose: () => void;
  // 위키링크 자동완성
  onWikiOpen:   (state: WikiMenuState) => void;
  onWikiClose:  () => void;
  isMenuOpen:   boolean;   // 이 블록을 대상으로 슬래시/위키 메뉴가 열려있는지
  // Toggle Step 1
  onToggleAddChild: (toggleBlockId: string) => void;
  // Toggle Step 2
  onToggleEnter: (toggleBlockId: string, currentContent: string) => void;
  // Table
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
}

const SingleBlock = React.memo(function SingleBlock({
  block, blocks, onChange, colors: c, selected,
  onSelect, onOpenMenu, onAddBelow, readOnly, searchQuery, depth, wikiTargets,
  onSplitBlock, onMergeWithPrev, onContentChange, focusCmd,
  dragState, startDrag, getDragProps,
  onSlashOpen, onSlashClose,
  onWikiOpen, onWikiClose, isMenuOpen,
  onToggleAddChild,
  onToggleEnter,
  onTableChange,
}: SingleBlockProps) {
  const [toggleOpen, setToggleOpen] = useState(!block.collapsed);

  const handleToggleTodo = useCallback(() => {
    onChange(updateBlockById(blocks, block.id, b => ({ ...b, checked: !b.checked })));
  }, [blocks, block.id, onChange]);

  const handleToggleCollapse = useCallback(() => {
    setToggleOpen(v => !v);
    onChange(updateBlockById(blocks, block.id, b => ({ ...b, collapsed: !b.collapsed })));
  }, [blocks, block.id, onChange]);

  const editableRef = useRef<HTMLElement | null>(null);

  // 포커스 레지스트리에 등록
  useEffect(() => {
    const handler = (cmd: FocusCmd) => {
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
    };
    focusRegistry.set(block.id, handler);
    return () => { focusRegistry.delete(block.id); };
  }, [block.id]);

  // 외부 focusCmd가 이 블록을 가리키면 실행
  useEffect(() => {
    if (focusCmd && focusCmd.blockId === block.id) {
      const handler = focusRegistry.get(block.id);
      if (handler) handler(focusCmd);
    }
  }, [focusCmd, block.id]);

  const inline = (text: string) => renderInlineMarkdown(text, c, searchQuery);

  // ── 드래그 인디케이터 계산 ──────────────────────────────────────
  const isDragging   = dragState?.draggingId === block.id;
  const isOverBefore = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'before';
  const isOverAfter  = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'after';

  const dropLineStyle: CSSProperties = {
    position: 'absolute', left: 0, right: 0, height: 2,
    background: c.accent, borderRadius: 1, zIndex: 10,
    pointerEvents: 'none',
    boxShadow: `0 0 6px ${c.accent}88`,
  };

  const handles = !readOnly && (
    <div className="be-handles" style={{
      position:'absolute', left:-52, top:'50%', transform:'translateY(-50%)',
      display:'flex', alignItems:'center', gap:2,
      opacity:0, transition:'opacity .12s', pointerEvents:'none',
    }}>
      <button style={hBtn(c)} onClick={() => onAddBelow(block.id)} title="블록 추가">
        <Plus size={11}/>
      </button>
      {/* Phase 3: GripVertical이 드래그 핸들 역할 */}
      <button
        style={{ ...hBtn(c), cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => startDrag(block.id, e)}
        title="드래그해서 이동">
        <GripVertical size={11}/>
      </button>
    </div>
  );

  const inner = renderInner(block, c, {
    toggleOpen, inline,
    onToggleCollapse: handleToggleCollapse,
    onToggleTodo: handleToggleTodo,
    blocks, onChange, searchQuery, depth, wikiTargets,
    readOnly, onSelect, onOpenMenu, onAddBelow,
    // Phase 2
    onSplitBlock, onMergeWithPrev, onContentChange,
    editableRef,
    // Phase 3
    onSlashOpen, onSlashClose,
    // 위키링크 자동완성
    onWikiOpen, onWikiClose, isMenuOpen,
    // Toggle Step 1
    onToggleAddChild,
    // Toggle Step 2
    onToggleEnter,
    // Table
    onTableChange,
  });

  return (
    <div
      {...getDragProps(block.id)}
      style={{
        position:'relative', marginLeft: depth > 0 ? depth * 20 : 0,
        borderRadius:6, padding:'1px 0',
        outline: selected ? `2px solid ${c.accent}` : 'none',
        outlineOffset:2, transition:'outline .1s',
        opacity: isDragging ? 0.4 : 1,
        userSelect: dragState ? 'none' : undefined,
      }}
      className="be-block"
      onClick={() => onSelect(block.id)}>
      {isOverBefore && <div style={{ ...dropLineStyle, top: -1 }}/>}
      {handles}
      {inner}
      {isOverAfter  && <div style={{ ...dropLineStyle, bottom: -1 }}/>}
    </div>
  );
});

const hBtn = (c: BlockEditorColors): CSSProperties => ({
  background:c.card, border:`1px solid ${c.border}`, borderRadius:5,
  padding:'3px 4px', cursor:'pointer', color:c.textMuted,
  display:'flex', alignItems:'center', lineHeight:1,
});

// ── 블록 내용 렌더 함수 ───────────────────────────────────────────────
interface RCtx {
  toggleOpen: boolean;
  inline: (s: string) => ReactNode;
  onToggleCollapse: () => void;
  onToggleTodo: () => void;
  blocks: Block[]; onChange: (b: Block[]) => void;
  searchQuery: string; depth: number; readOnly: boolean;
  wikiTargets: string[];
  onSelect: (id: string) => void;
  onOpenMenu: (s: BlockMenuState) => void;
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
  // Toggle Step 1: 빈 자식 영역 클릭 → 자식 블록 생성
  onToggleAddChild: (toggleBlockId: string) => void;
  // Toggle Step 2: 헤더 Enter → 첫 자식 블록 생성 & 포커스
  onToggleEnter: (toggleBlockId: string, currentContent: string) => void;
  // Table: 셀 편집 결과를 부모 blocks로 올림
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
}

// ── EditableBlock: contentEditable 인라인 편집기 ─────────────────────
interface EditableBlockProps {
  block: Block;
  colors: BlockEditorColors;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  editableRef: React.MutableRefObject<HTMLElement | null>;
  onSplitBlock:    (id: string, before: string, after: string) => void;
  onMergeWithPrev: (id: string, selfContent: string) => void;
  onContentChange: (id: string, content: string) => void;
  /** 래퍼 태그 (p, h1, h2, …, span). 기본값: 'p' */
  tag?: keyof React.JSX.IntrinsicElements;
  // Phase 3: 슬래시 커맨드
  onSlashOpen:  (state: SlashMenuState) => void;
  onSlashClose: () => void;
  // 위키링크 자동완성
  onWikiOpen:   (state: WikiMenuState) => void;
  onWikiClose:  () => void;
  isMenuOpen:   boolean;
  // Toggle Step 2: Enter 동작을 완전히 대체하는 콜백 (toggle 헤더 전용)
  onEnterOverride?: (currentContent: string) => void;
}

function EditableBlock({
  block, colors: c, placeholder = '텍스트 입력…',
  style, className, editableRef,
  onSplitBlock, onMergeWithPrev, onContentChange, tag = 'p',
  onSlashOpen, onSlashClose,
  onWikiOpen, onWikiClose, isMenuOpen,
  onEnterOverride,
}: EditableBlockProps) {
  const Tag = tag as React.ElementType;

  // contentEditable DOM 동기화 (외부 content 변경 시)
  const lastContent = useRef(block.content);
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    if (block.content !== lastContent.current) {
      // 포커스 중이 아닐 때만 DOM 덮어쓰기 (편집 중 충돌 방지)
      if (document.activeElement !== el) {
        el.innerText = block.content;
        lastContent.current = block.content;
      }
    }
  }, [block.content, editableRef]);

  const handleInput = useCallback((e: React.FormEvent<HTMLElement>) => {
    const el   = e.currentTarget;
    const text = getElText(el);
    lastContent.current = text;
    onContentChange(block.id, text);

    const offset  = getCaretOffset(el);
    const before  = text.slice(0, offset);

    // ── 위키링크 [[ 자동완성 감지 ─────────────────────────────────
    // 캐럿 앞에서 닫히지 않은 '[[' 이후 텍스트를 쿼리로 사용
    const wikiMatch = before.match(/\[\[([^\]\n]*)$/);
    if (wikiMatch) {
      const rect = el.getBoundingClientRect();
      onWikiOpen({ blockId: block.id, query: wikiMatch[1], anchorY: rect.bottom, anchorX: rect.left });
      onSlashClose();
      return;
    }
    onWikiClose();

    // ── 슬래시 커맨드 감지 ─────────────────────────────────────────
    const slashIdx = before.lastIndexOf('/');

    if (slashIdx !== -1) {
      // '/' 앞이 공백이거나 줄 첫 문자여야 함 (단어 중간 슬래시 무시)
      const charBefore = before[slashIdx - 1];
      if (slashIdx === 0 || charBefore === ' ' || charBefore === '\n') {
        const query = before.slice(slashIdx + 1);
        // 쿼리에 공백이 없어야 유효 (슬래시 커맨드 범위)
        if (!query.includes(' ')) {
          const rect = el.getBoundingClientRect();
          onSlashOpen({
            blockId: block.id,
            query,
            anchorY: rect.bottom,
            anchorX: rect.left,
          });
          return;
        }
      }
    }
    onSlashClose();
  }, [block.id, onContentChange, onSlashOpen, onSlashClose, onWikiOpen, onWikiClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;

    // ── 슬래시/위키 메뉴가 열려있으면 탐색/선택은 메뉴에 위임 ───────
    // (블록 분리/병합보다 우선 — 메뉴의 window 리스너가 Enter/방향키 처리)
    if (isMenuOpen) {
      if (e.key === 'Enter')                              { e.preventDefault(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown')   { e.preventDefault(); return; }
      if (e.key === 'Escape')                             { onSlashClose(); onWikiClose(); return; }
    }

    // ── Enter: 블록 분리 (또는 toggle 헤더 override) ──────────────
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSlashClose();
      // Toggle Step 2: toggle 헤더일 때는 자식 블록 생성으로 대체
      if (onEnterOverride) {
        onEnterOverride(getElText(el));
        return;
      }
      const text   = getElText(el);
      const offset = getCaretOffset(el);
      const before = text.slice(0, offset);
      const after  = text.slice(offset);
      onSplitBlock(block.id, before, after);
      return;
    }

    // ── Backspace: 커서가 맨 앞 → 이전 블록과 병합 ───────────────
    if (e.key === 'Backspace') {
      const offset = getCaretOffset(el);
      if (offset === 0) {
        e.preventDefault();
        onSlashClose();
        onMergeWithPrev(block.id, getElText(el));
        return;
      }
    }

    // ── Escape: 슬래시/위키 메뉴 닫기 ────────────────────────────
    if (e.key === 'Escape') {
      onSlashClose();
      onWikiClose();
    }
  }, [block.id, onSplitBlock, onMergeWithPrev, onSlashClose, onWikiClose, onEnterOverride, isMenuOpen]);

  const handleFocus = useCallback(() => {
    // contentEditable 최초 포커스 시 innerText를 block.content로 초기화
    const el = editableRef.current;
    if (el && el.innerText.replace(/\n$/, '') !== block.content) {
      el.innerText = block.content;
    }
  }, [block.content, editableRef]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLElement>) => {
    // 서식 없이 순수 텍스트만 붙여넣기
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <Tag
      ref={(el: HTMLElement | null) => { editableRef.current = el; }}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{
        outline: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style,
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
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

function renderInner(block: Block, c: BlockEditorColors, ctx: RCtx): ReactNode {
  const { inline, editableRef, onSplitBlock, onMergeWithPrev, onContentChange, readOnly,
          onSlashOpen, onSlashClose, onWikiOpen, onWikiClose, isMenuOpen } = ctx;

  /** 편집 가능한 텍스트 블록 공통 props */
  const sharedEditProps = {
    editableRef, onSplitBlock, onMergeWithPrev, onContentChange,
    onSlashOpen, onSlashClose,
    onWikiOpen, onWikiClose, isMenuOpen,
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
          placeholder="텍스트 입력…" {...sharedEditProps}/>
      );
    case 'heading1':
      return readOnly
        ? <h1 style={{ fontSize:28, fontWeight:800, margin:'16px 0 4px', lineHeight:1.3, color:c.text }}>{inline(block.content)}</h1>
        : ep('h1', { fontSize:28, fontWeight:800, margin:'16px 0 4px', lineHeight:1.3, color:c.text }, '제목 1');
    case 'heading2':
      return readOnly
        ? <h2 style={{ fontSize:22, fontWeight:700, margin:'14px 0 3px', lineHeight:1.35, color:c.text }}>{inline(block.content)}</h2>
        : ep('h2', { fontSize:22, fontWeight:700, margin:'14px 0 3px', lineHeight:1.35, color:c.text }, '제목 2');
    case 'heading3':
      return readOnly
        ? <h3 style={{ fontSize:17, fontWeight:700, margin:'10px 0 2px', lineHeight:1.4, color:c.text }}>{inline(block.content)}</h3>
        : ep('h3', { fontSize:17, fontWeight:700, margin:'10px 0 2px', lineHeight:1.4, color:c.text }, '제목 3');
    case 'bullet':
      return (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'2px 0' }}>
          <span style={{ color:c.accent, fontSize:18, lineHeight:'26px', flexShrink:0 }}>•</span>
          {readOnly
            ? <span style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1, display:'block' }}
                placeholder="목록 항목…" {...sharedEditProps}/>
          }
        </div>
      );
    case 'numbered':
      return (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'2px 0' }}>
          <span style={{ color:c.accent, fontSize:14, lineHeight:'26px', flexShrink:0, minWidth:20, fontWeight:700 }}>1.</span>
          {readOnly
            ? <span style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1, display:'block' }}
                placeholder="번호 항목…" {...sharedEditProps}/>
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
                placeholder="할 일 항목…" {...sharedEditProps}/>
          }
        </div>
      );
    case 'toggle':
      return (
        <div style={{ background: ctx.toggleOpen ? ctx.toggleOpen && c.toggleBg : 'transparent', borderRadius:8, transition:'background .15s' }}>
          <div style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'6px 8px', borderRadius:8 }}>
            <span
              style={{ color:c.accent, transition:'transform .18s', transform: ctx.toggleOpen ? 'rotate(90deg)' : 'rotate(0deg)', marginTop:3, flexShrink:0, cursor:'pointer' }}
              onClick={e => { e.stopPropagation(); ctx.onToggleCollapse(); }}>
              <ChevronRight size={15}/>
            </span>
            {readOnly
              ? <span style={{ fontWeight:600, fontSize:15, color:c.text, lineHeight:1.6 }}>
                  {block.content ? inline(block.content) : <span style={{ color:c.textFaint }}>토글 제목…</span>}
                </span>
              : <EditableBlock block={block} colors={c} tag="span"
                  style={{ fontWeight:600, fontSize:15, color:c.text, lineHeight:1.6, flex:1, display:'block' }}
                  placeholder="토글 제목…" {...sharedEditProps}
                  onEnterOverride={currentContent => ctx.onToggleEnter(block.id, currentContent)}/>
            }
          </div>
          {ctx.toggleOpen && (
            <div style={{ paddingLeft:28, paddingBottom:8 }}>
              {block.children.length > 0 ? (
                <BlockEditorInner
                  blocks={block.children}
                  onChange={children => ctx.onChange(updateBlockById(ctx.blocks, block.id, b => ({ ...b, children })))}
                  colors={c} readOnly={ctx.readOnly} searchQuery={ctx.searchQuery} depth={ctx.depth + 1}
                  wikiTargets={ctx.wikiTargets}
                  // Toggle Step 3: 자식 → 부모 탈출 콜백
                  onEscapeToParentBelow={() => {
                    // toggle 바로 아래에 새 paragraph 삽입 + 포커스
                    const newBlock = makeBlock('paragraph');
                    ctx.onChange(insertBlockAfter(ctx.blocks, block.id, newBlock));
                    requestAnimationFrame(() => {
                      const h = focusRegistry.get(newBlock.id);
                      if (h) h({ blockId: newBlock.id, offset: 'start' });
                    });
                  }}
                  onEscapeToParentHeader={() => {
                    // toggle 헤더 EditableBlock으로 포커스 복귀 (끝 위치)
                    const h = focusRegistry.get(block.id);
                    if (h) h({ blockId: block.id, offset: 'end' });
                  }}
                />
              ) : !ctx.readOnly && (
                // Toggle Step 1: 빈 영역 클릭 → 자식 블록 자동 생성
                <div
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); ctx.onToggleAddChild(block.id); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onToggleAddChild(block.id); } }}
                  style={{
                    color: c.textFaint, fontSize:13, fontStyle:'italic',
                    padding:'4px 6px', borderRadius:6, cursor:'text',
                    border:`1px dashed transparent`,
                    transition:'border-color .15s, background .15s',
                    userSelect:'none',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = c.border;
                    (e.currentTarget as HTMLElement).style.background  = c.cardHov;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.background  = 'transparent';
                  }}
                >
                  클릭해서 내용 추가…
                </div>
              )}
            </div>
          )}
        </div>
      );
    case 'quote':
      return readOnly
        ? <blockquote style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
            color:c.textMuted, fontStyle:'italic', fontSize:15, lineHeight:1.7, margin:'4px 0' }}>
            {inline(block.content)}
          </blockquote>
        : <EditableBlock block={block} colors={c} tag="blockquote"
            style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
              color:c.textMuted, fontStyle:'italic', fontSize:15, lineHeight:1.7, margin:'4px 0' }}
            placeholder="인용 텍스트…" {...sharedEditProps}/>;
    case 'callout':
      return (
        <div style={{ background:c.calloutBg, borderRadius:8, padding:'10px 14px',
          display:'flex', gap:10, alignItems:'flex-start', margin:'4px 0', border:`1px solid ${c.border}` }}>
          <span style={{ fontSize:18, flexShrink:0, lineHeight:'24px' }}>{block.calloutIcon ?? '💡'}</span>
          {readOnly
            ? <span style={{ fontSize:14, lineHeight:1.7, color:c.text }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ fontSize:14, lineHeight:1.7, color:c.text, flex:1, display:'block' }}
                placeholder="콜아웃 텍스트…" {...sharedEditProps}/>
          }
        </div>
      );
    case 'divider':
      return <hr style={{ border:'none', borderTop:`1px solid ${c.border}`, margin:'12px 0' }}/>;
    case 'code':
      return (
        <div style={{ background:c.codeBg, borderRadius:8, overflow:'hidden', margin:'4px 0', border:`1px solid ${c.border}` }}>
          {block.language && (
            <div style={{ padding:'4px 12px', borderBottom:`1px solid ${c.border}`, fontSize:11, color:c.textMuted, fontFamily:'monospace', fontWeight:600 }}>
              {block.language}
            </div>
          )}
          <pre style={{ margin:0, padding:'12px 16px', overflowX:'auto', fontSize:13, lineHeight:1.6 }}>
            <code style={{ color:c.text, fontFamily:'monospace' }}>{block.code ?? ''}</code>
          </pre>
        </div>
      );
    case 'image':
      return (
        <figure style={{ margin:'8px 0', textAlign:'center' }}>
          {block.src
            ? <img src={block.src} alt={block.alt ?? ''} style={{ maxWidth:'100%', borderRadius:8, border:`1px solid ${c.border}` }}/>
            : <div style={{ background:c.card, border:`2px dashed ${c.border}`, borderRadius:8, padding:'40px 20px', color:c.textFaint, fontSize:13 }}>
                <ImageIcon size={24} style={{ marginBottom:8, opacity:.4 }}/><div>이미지 없음</div>
              </div>
          }
          {block.caption && <figcaption style={{ fontSize:12, color:c.textMuted, marginTop:6, fontStyle:'italic' }}>{block.caption}</figcaption>}
        </figure>
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
    case 'math': {
      const expr = block.math ?? '';
      if (typeof window !== 'undefined' && window.katex) {
        try {
          const html = window.katex.renderToString(expr, { displayMode:true, throwOnError:false });
          return <div style={{ textAlign:'center', padding:'8px 0', overflowX:'auto' }} dangerouslySetInnerHTML={{ __html:html }}/>;
        } catch { /* fall through */ }
      }
      return <code style={{ background:c.codeBg, padding:'6px 10px', borderRadius:6, display:'block', color:c.text }}>{expr}</code>;
    }
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
  // Toggle Step 3: 자식 → 부모 탈출 콜백
  onEscapeToParentBelow?:  () => void;  // 마지막 빈 자식 Enter → toggle 아래 새 블록
  onEscapeToParentHeader?: () => void;  // 첫 자식 Backspace → toggle 헤더로 포커스
}

function BlockEditorInner({ blocks, onChange, colors: c, readOnly, searchQuery, depth,
  wikiTargets,
  onEscapeToParentBelow, onEscapeToParentHeader,
}: BlockEditorInnerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [blockMenu, setBlockMenu] = useState<BlockMenuState | null>(null);
  const [focusCmd, setFocusCmd] = useState<FocusCmd | null>(null);
  // Phase 3: 슬래시 커맨드
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  // 위키링크 자동완성
  const [wikiMenu, setWikiMenu] = useState<WikiMenuState | null>(null);
  // Phase 3: 드래그&드롭
  const { dragState, startDrag, getDragProps } = useDragDrop(blocks, onChange);

  const handleAddBelow = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    onChange(insertBlockAfter(blocks, id, nb));
    setFocusCmd({ blockId: nb.id, offset: 'start' });
    setSelected(nb.id);
  }, [blocks, onChange]);

  const handleDelete = useCallback((id: string) => {
    const updated = deleteBlockById(blocks, id);
    onChange(updated.length > 0 ? updated : [makeBlock('paragraph')]);
    setSelected(null);
  }, [blocks, onChange]);

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  }, [blocks, onChange]);

  const handleConvert = useCallback((id: string, newType: BlockType) => {
    onChange(updateBlockById(blocks, id, b => ({ ...b, type: newType })));
    setBlockMenu(null);
  }, [blocks, onChange]);

  // ── Phase 2: 블록 분리 (Enter) ───────────────────────────────────
  const handleSplitBlock = useCallback((id: string, before: string, after: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;

    // Toggle Step 3: 마지막 자식이 빈 paragraph + Enter → 부모 toggle 아래로 탈출
    const isLast    = idx === blocks.length - 1;
    const isEmpty   = before === '' && after === '';
    const isPara    = blocks[idx].type === 'paragraph';
    if (isLast && isEmpty && isPara && onEscapeToParentBelow) {
      // 빈 자식 블록 삭제 후 부모에 탈출 신호
      const cleaned = blocks.filter(b => b.id !== id);
      onChange(cleaned.length > 0 ? cleaned : []);
      onEscapeToParentBelow();
      return;
    }

    const cur = blocks[idx];
    const updatedCur: Block = { ...cur, content: before };
    const newType: BlockType = ['heading1','heading2','heading3'].includes(cur.type)
      ? 'paragraph' : cur.type;
    const newBlock: Block = makeBlock(newType, {
      content: after,
      indent:  cur.indent,
      checked: false,
    });

    const next = [...blocks];
    next[idx] = updatedCur;
    next.splice(idx + 1, 0, newBlock);
    onChange(next);

    setFocusCmd({ blockId: newBlock.id, offset: 'start' });
    setSelected(newBlock.id);
  }, [blocks, onChange, onEscapeToParentBelow]);

  // ── Phase 2: 블록 병합 (Backspace at start) ──────────────────────
  const handleMergeWithPrev = useCallback((id: string, selfContent: string) => {
    const ids = flattenBlockIds(blocks);
    const pos  = ids.indexOf(id);

    // Toggle Step 3: 첫 번째 자식의 커서가 맨 앞 + 빈 내용 → 헤더로 탈출
    if (pos === 0 && selfContent === '' && onEscapeToParentHeader) {
      // 빈 첫 자식 삭제
      const cleaned = blocks.filter(b => b.id !== id);
      onChange(cleaned.length > 0 ? cleaned : []);
      onEscapeToParentHeader();
      return;
    }

    if (pos <= 0) return;

    const prevId    = ids[pos - 1];
    const prevBlock = findBlockById(blocks, prevId);
    if (!prevBlock) return;

    const mergedContent = prevBlock.content + selfContent;
    const mergeOffset   = prevBlock.content.length;

    let next = updateBlockById(blocks, prevId, b => ({ ...b, content: mergedContent }));
    next = deleteBlockById(next, id);
    onChange(next);

    setFocusCmd({ blockId: prevId, offset: mergeOffset });
    setSelected(prevId);
  }, [blocks, onChange, onEscapeToParentHeader]);

  // ── Phase 2: 블록 content 변경 ───────────────────────────────────
  const handleContentChange = useCallback((id: string, content: string) => {
    onChange(updateBlockById(blocks, id, b => ({ ...b, content })));
  }, [blocks, onChange]);

  // ── Toggle Step 1: 빈 toggle에 첫 자식 블록 생성 ─────────────────
  const handleToggleAddChild = useCallback((toggleBlockId: string) => {
    const newChild = makeBlock('paragraph');
    onChange(updateBlockById(blocks, toggleBlockId, b => ({
      ...b,
      collapsed: false,
      children: [newChild],
    })));
    // 새로 생성된 자식 블록으로 포커스
    requestAnimationFrame(() => {
      const handler = focusRegistry.get(newChild.id);
      if (handler) handler({ blockId: newChild.id, offset: 'start' });
    });
  }, [blocks, onChange]);

  // ── Toggle Step 2: 헤더 Enter → 자식 블록 생성 & 포커스 ──────────
  const handleToggleEnter = useCallback((toggleBlockId: string, currentContent: string) => {
    const newChild = makeBlock('paragraph');
    onChange(updateBlockById(blocks, toggleBlockId, b => {
      // 헤더 content를 currentContent로 업데이트 (캐럿 위치 이후 텍스트 있을 경우 대비)
      const updated: Block = { ...b, content: currentContent, collapsed: false };
      // 자식이 이미 있으면 맨 앞에 삽입, 없으면 새로 생성
      return { ...updated, children: [newChild, ...b.children] };
    }));
    // 새 자식으로 포커스
    requestAnimationFrame(() => {
      const handler = focusRegistry.get(newChild.id);
      if (handler) handler({ blockId: newChild.id, offset: 'start' });
    });
  }, [blocks, onChange]);

  // ── Table: 셀/행/열 변경 ─────────────────────────────────────────
  const handleTableChange = useCallback((
    blockId: string, headers: string[], rows: string[][],
  ) => {
    onChange(updateBlockById(blocks, blockId, b => ({
      ...b, tableHeaders: headers, tableRows: rows,
    })));
  }, [blocks, onChange]);
  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!slashMenu) return;
    const { blockId, query } = slashMenu;

    // 현재 블록 content에서 '/쿼리' 부분 제거
    onChange(updateBlockById(blocks, blockId, b => {
      const slashIdx = b.content.lastIndexOf('/' + query);
      const cleaned  = slashIdx >= 0
        ? b.content.slice(0, slashIdx) + b.content.slice(slashIdx + 1 + query.length)
        : b.content;
      return { ...b, type, content: cleaned };
    }));

    setSlashMenu(null);
    // 타입 변환 후 해당 블록 포커스 (끝)
    setFocusCmd({ blockId, offset: 'end' });
  }, [slashMenu, blocks, onChange]);

  // ── 위키링크 선택 → 포커스된 contentEditable에 직접 [[제목]] 삽입 ──
  // 상태 round-trip 대신 DOM을 직접 조작해 캐럿 위치를 정확히 유지한다.
  const handleWikiSelect = useCallback((title: string) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.isContentEditable) {
      const text  = el.innerText.replace(/\n$/, '');
      const caret = getCaretOffset(el);
      const before = text.slice(0, caret);
      const idx = before.lastIndexOf('[[');
      if (idx >= 0) {
        const ins     = `[[${title}]]`;
        const newText = text.slice(0, idx) + ins + text.slice(caret);
        el.innerText = newText;
        setCaretOffset(el, idx + ins.length);
        if (wikiMenu) handleContentChange(wikiMenu.blockId, getElText(el));
      }
    }
    setWikiMenu(null);
  }, [wikiMenu, handleContentChange]);

  // focusCmd 소비 후 리셋
  useEffect(() => {
    if (focusCmd) {
      const t = setTimeout(() => setFocusCmd(null), 100);
      return () => clearTimeout(t);
    }
  }, [focusCmd]);

  return (
    <>
      <div style={{ paddingLeft: depth > 0 ? 0 : 52, position:'relative' }}>
        {blocks.map(block => (
          <SingleBlock
            key={block.id} block={block} blocks={blocks} onChange={onChange}
            colors={c} selected={selected === block.id}
            onSelect={setSelected} onOpenMenu={setBlockMenu}
            onAddBelow={handleAddBelow} readOnly={readOnly}
            searchQuery={searchQuery} depth={depth} wikiTargets={wikiTargets}
            onSplitBlock={handleSplitBlock}
            onMergeWithPrev={handleMergeWithPrev}
            onContentChange={handleContentChange}
            focusCmd={focusCmd}
            dragState={dragState}
            startDrag={startDrag}
            getDragProps={getDragProps}
            onSlashOpen={setSlashMenu}
            onSlashClose={() => setSlashMenu(null)}
            onWikiOpen={setWikiMenu}
            onWikiClose={() => setWikiMenu(null)}
            isMenuOpen={slashMenu?.blockId === block.id || wikiMenu?.blockId === block.id}
            onToggleAddChild={handleToggleAddChild}
            onToggleEnter={handleToggleEnter}
            onTableChange={handleTableChange}
          />
        ))}
      </div>
      {blockMenu && (
        <BlockContextMenu
          blockId={blockMenu.blockId} anchorY={blockMenu.anchorY} anchorX={blockMenu.anchorX}
          colors={c}
          onClose={() => setBlockMenu(null)}
          onDelete={() => { handleDelete(blockMenu.blockId); setBlockMenu(null); }}
          onMoveUp={() => { handleMove(blockMenu.blockId, 'up'); setBlockMenu(null); }}
          onMoveDown={() => { handleMove(blockMenu.blockId, 'down'); setBlockMenu(null); }}
          onConvert={type => handleConvert(blockMenu.blockId, type)}
        />
      )}
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
}

// ── 블록 컨텍스트 메뉴 ──────────────────────────────────────────────
interface BlockContextMenuProps {
  blockId: string; anchorY: number; anchorX: number;
  colors: BlockEditorColors;
  onClose: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void;
  onConvert: (type: BlockType) => void;
}

function BlockContextMenu({ anchorY, anchorX, colors: c, onClose, onDelete, onMoveUp, onMoveDown, onConvert }: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const top  = Math.min(anchorY, window.innerHeight - 440);
  const left = Math.min(anchorX, window.innerWidth  - 220);

  const mi = (icon: ReactNode, label: string, fn: () => void, danger = false) => (
    <button onClick={fn} style={{
      display:'flex', alignItems:'center', gap:8, width:'100%',
      padding:'7px 12px', background:'none', border:'none',
      cursor:'pointer', fontSize:13, color: danger ? c.danger : c.text, textAlign:'left',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = c.cardHov)}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {icon}{label}
    </button>
  );
  const sec = (label: string) => (
    <div style={{ padding:'5px 12px 2px', fontSize:9, fontWeight:700, color:c.textFaint, letterSpacing:1, textTransform:'uppercase' }}>
      {label}
    </div>
  );

  return (
    <div ref={menuRef} style={{
      position:'fixed', top, left, zIndex:300,
      background:c.card, border:`1px solid ${c.border}`,
      borderRadius:10, boxShadow:'0 8px 32px #00000025',
      minWidth:200, overflow:'hidden', padding:'6px 0',
    }}>
      {sec('이동')}
      {mi(<ArrowUp size={12}/>,   '위로 이동',   onMoveUp)}
      {mi(<ArrowDown size={12}/>, '아래로 이동', onMoveDown)}
      {sec('블록 변환')}
      <div style={{ maxHeight:220, overflowY:'auto' }}>
        {BLOCK_TYPE_MENU.map(m => (
          <button key={m.type} onClick={() => onConvert(m.type)} style={{
            display:'flex', alignItems:'center', gap:8, width:'100%',
            padding:'6px 12px', background:'none', border:'none',
            cursor:'pointer', fontSize:12, color:c.text, textAlign:'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = c.cardHov)}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <span style={{ width:18, fontSize:13, textAlign:'center', flexShrink:0 }}>{m.icon}</span>
            <span style={{ flex:1 }}>{m.label}</span>
            <span style={{ color:c.textFaint, fontSize:11 }}>{m.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ borderTop:`1px solid ${c.border}`, margin:'4px 0' }}/>
      {mi(<Trash2 size={12}/>, '삭제', onDelete, true)}
    </div>
  );
}

// ── 슬래시 커맨드 메뉴 ──────────────────────────────────────────────
interface SlashMenuProps {
  query: string; anchorY: number; anchorX: number;
  colors: BlockEditorColors;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashMenu({ query, anchorY, anchorX, colors: c, onSelect, onClose }: SlashMenuProps) {
  const [cursor, setCursor] = useState(0);
  const items   = useMemo(() => filterBlockMenu(query), [query]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor(v => Math.min(v+1, items.length-1)); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setCursor(v => Math.max(v-1, 0)); }
      if (e.key === 'Enter')      { e.preventDefault(); if (items[cursor]) onSelect(items[cursor].type); }
      if (e.key === 'Escape')     { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, cursor, onSelect, onClose]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block:'nearest' });
  }, [cursor]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    items.forEach(item => { (g[item.group] ??= []).push(item); });
    return g;
  }, [items]);

  const groupLabels: Record<string, string> = { text:'텍스트', list:'목록', media:'미디어', embed:'임베드' };
  const top  = Math.min(anchorY + 8, window.innerHeight - 360);
  const left = Math.min(anchorX,     window.innerWidth  - 240);
  let gi = 0;

  return (
    <div ref={menuRef} style={{
      position:'fixed', top, left, zIndex:400,
      background:c.card, border:`1px solid ${c.border}`,
      borderRadius:12, boxShadow:'0 8px 32px #00000030',
      width:230, maxHeight:340, overflowY:'auto', padding:'6px 0',
    }}>
      <div style={{ padding:'3px 12px 6px', fontSize:10, color:c.textFaint, borderBottom:`1px solid ${c.border}`, marginBottom:4 }}>
        {query ? `"${query}" 검색 결과` : '블록 타입 선택'}
      </div>
      {items.length === 0 && <div style={{ padding:12, color:c.textFaint, fontSize:13, textAlign:'center' }}>결과 없음</div>}
      {Object.entries(grouped).map(([group, gItems]) => (
        <div key={group}>
          <div style={{ padding:'4px 12px 2px', fontSize:9, color:c.textFaint, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
            {groupLabels[group] ?? group}
          </div>
          {gItems.map(item => {
            const idx = gi++;
            const active = cursor === idx;
            return (
              <button key={item.type} data-idx={idx} onClick={() => onSelect(item.type)}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'7px 12px', background: active ? c.accentBg : 'none',
                  border:'none', cursor:'pointer', textAlign:'left' }}
                onMouseEnter={() => setCursor(idx)}>
                <span style={{ width:28, height:28, borderRadius:6, background:c.toolbar,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, flexShrink:0, color:c.accent }}>
                  {item.icon}
                </span>
                <span>
                  <div style={{ fontSize:13, fontWeight:600, color:c.text }}>{item.label}</div>
                  <div style={{ fontSize:11, color:c.textMuted }}>{item.desc}</div>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── 위키링크 자동완성 메뉴 ──────────────────────────────────────────
interface WikiMenuProps {
  query: string; targets: string[]; anchorY: number; anchorX: number;
  colors: BlockEditorColors;
  onSelect: (title: string) => void;
  onClose: () => void;
}

export function WikiMenu({ query, targets, anchorY, anchorX, colors: c, onSelect, onClose }: WikiMenuProps) {
  const [cursor, setCursor] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q ? targets.filter(t => t.toLowerCase().includes(q)) : targets;
    return list.slice(0, 8);
  }, [query, targets]);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(v => Math.min(v + 1, items.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(v => Math.max(v - 1, 0)); }
      if (e.key === 'Enter')     { if (items[cursor]) { e.preventDefault(); onSelect(items[cursor]); } }
      if (e.key === 'Escape')    { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [items, cursor, onSelect, onClose]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const top  = Math.min(anchorY + 8, window.innerHeight - 300);
  const left = Math.min(anchorX,     window.innerWidth  - 240);

  return (
    <div ref={menuRef} style={{
      position: 'fixed', top, left, zIndex: 400,
      background: c.card, border: `1px solid ${c.border}`,
      borderRadius: 12, boxShadow: '0 8px 32px #00000030',
      width: 230, maxHeight: 300, overflowY: 'auto', padding: '6px 0',
    }}>
      <div style={{ padding: '3px 12px 6px', fontSize: 10, color: c.textFaint, borderBottom: `1px solid ${c.border}`, marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>
        노트 링크
      </div>
      {items.length === 0 && (
        <div style={{ padding: 12, color: c.textFaint, fontSize: 13, textAlign: 'center' }}>
          {query ? '일치하는 노트 없음' : '노트 없음'}
        </div>
      )}
      {items.map((title, idx) => {
        const active = cursor === idx;
        return (
          <button key={title + idx} data-idx={idx}
            onMouseDown={e => { e.preventDefault(); onSelect(title); }}
            onMouseEnter={() => setCursor(idx)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '7px 12px', background: active ? c.accentBg : 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 11, color: c.textFaint, flexShrink: 0 }}>📄</span>
            <span style={{ fontSize: 13, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── 최상위 BlockEditor ───────────────────────────────────────────────
export function BlockEditor({ blocks, onChange, colors, readOnly = false, searchQuery = '', wikiTargets = [] }: BlockEditorProps) {
  return (
    <>
      <style>{`
        .be-block:hover .be-handles { opacity: 1 !important; pointer-events: auto !important; }
        [contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: var(--be-placeholder-color, #aaa);
          pointer-events: none;
          position: absolute;
        }
        [contenteditable] { position: relative; }
        [contenteditable]:focus { outline: none; }
      `}</style>
      <BlockEditorInner
        blocks={blocks} onChange={onChange} colors={colors}
        readOnly={readOnly} searchQuery={searchQuery} depth={0}
        wikiTargets={wikiTargets}
      />
      {!readOnly && (
        <div style={{ minHeight:80, cursor:'text', paddingLeft:52 }}
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
}

// ── NoteView 연동 어댑터 훅 ──────────────────────────────────────────
/**
 * useBlockEditor — body(마크다운) ↔ Block[] 양방향 바인딩 + undo/redo
 *
 * undo/redo는 마크다운 스냅샷 스택으로 관리한다.
 *  - 빠른 연속 입력은 COALESCE_MS 윈도우로 묶어 하나의 undo 스텝으로 만든다.
 *  - 외부에서 body가 바뀌면(예: 이미지 append) 블록을 다시 파싱하고 히스토리에 기록.
 */
const COALESCE_MS = 500;
const HISTORY_LIMIT = 200;

export function useBlockEditor(body: string, onBodyChange: (md: string) => void) {
  const [blocks, setBlocks] = useState<Block[]>(() => markdownToBlocks(body));
  const prevBodyRef = useRef(body);

  // 히스토리: past/future는 마크다운 스냅샷 스택, lastMd는 현재 직렬화 값
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastMdRef  = useRef(body);
  const lastSnapTimeRef = useRef(0);

  useEffect(() => {
    if (body !== prevBodyRef.current) {
      // 외부 변경(append 등) — 현재 상태를 히스토리에 적재 후 교체
      if (body !== lastMdRef.current) {
        historyRef.current.past.push(lastMdRef.current);
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
        historyRef.current.future = [];
        lastSnapTimeRef.current = Date.now();
      }
      prevBodyRef.current = body;
      lastMdRef.current = body;
      setBlocks(markdownToBlocks(body));
    }
  }, [body]);

  const handleBlockChange = useCallback((newBlocks: Block[]) => {
    const md = blocksToMarkdown(newBlocks);
    if (md !== lastMdRef.current) {
      const now = Date.now();
      // 직전 상태를 히스토리에 적재 (연속 입력은 COALESCE_MS 동안 묶음)
      if (now - lastSnapTimeRef.current > COALESCE_MS) {
        historyRef.current.past.push(lastMdRef.current);
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
        historyRef.current.future = [];
        lastSnapTimeRef.current = now;
      }
    }
    setBlocks(newBlocks);
    lastMdRef.current = md;
    prevBodyRef.current = md;
    onBodyChange(md);
  }, [onBodyChange]);

  const applyMd = useCallback((md: string) => {
    lastMdRef.current = md;
    prevBodyRef.current = md;
    lastSnapTimeRef.current = Date.now();
    setBlocks(markdownToBlocks(md));
    onBodyChange(md);
  }, [onBodyChange]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop() as string;
    h.future.push(lastMdRef.current);
    applyMd(prev);
  }, [applyMd]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop() as string;
    h.past.push(lastMdRef.current);
    applyMd(next);
  }, [applyMd]);

  return { blocks, handleBlockChange, undo, redo };
}

declare global {
  interface Window {
    katex?: { renderToString: (expr: string, opts?: object) => string };
  }
}
