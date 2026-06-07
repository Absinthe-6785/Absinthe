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
  ChevronRight, Plus,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Code2,
  Image as ImageIcon, Minus, Table2, Quote, Zap, Type,
  Trash2, ArrowUp, ArrowDown, Bold, Italic, Hash,
} from 'lucide-react';
import {
  type Block, type BlockType,
  makeBlock,
  updateBlockById, insertBlockAfter, deleteBlockById,
  findBlockById, flattenBlockIds, insertImageAfter,
  isTextBlockType,
  BLOCK_TYPE_MENU, filterBlockMenu, TURN_INTO_TYPES,
  blocksToMarkdown, markdownToBlocks,
  convertBlock,
  isValidImageUrl,
  imageAltFromUrl,
} from './blockUtils';
import { normalizeWikiTitle } from './noteUtils';
import { selectionHasFormat, splitMarkdownAt, toggleMarkdownWrap } from './inlineFormat';

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

function resolveTextOffset(el: HTMLElement, offset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null = null;
  while ((node = walker.nextNode())) {
    const len = (node.textContent ?? '').length;
    if (remaining <= len) return { node, offset: remaining };
    remaining -= len;
  }
  return null;
}

/** contentEditable 요소 내 텍스트 구간 선택 */
function setSelectionOffsets(el: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const s = resolveTextOffset(el, start);
  const e = resolveTextOffset(el, end);
  if (!s || !e) {
    setCaretOffset(el, end);
    return;
  }
  const range = document.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
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

// ── 드래그&드롭 훅 ────────────────────────────────────────────────────
interface DragState {
  draggingId:  string;           // 드래그 중인 블록 id
  overId:      string | null;    // 현재 hover 블록 id
  overPos:     'before' | 'after' | null; // 삽입 위치
}

interface UseDragDropResult {
  dragState:    DragState | null;
  /** ⋮⋮ 클릭 → onClick, 6px+ 이동 → 드래그 */
  bindGripPointer: (id: string, e: React.PointerEvent, onClick?: () => void) => void;
  getDragProps: (id: string) => {
    onPointerEnter: (e: React.PointerEvent) => void;
    'data-drag-id': string;
  };
}

const DRAG_THRESHOLD_PX = 6;
const HANDLE_HIT_PX = 32;

/** Notion-style 6-dot drag grip (⠿) */
function BlockGripIcon() {
  return (
    <span className="be-grip-icon" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="be-grip-dot" />
      ))}
    </span>
  );
}

function useDragDrop(
  blocks: Block[],
  onReorder: (newBlocks: Block[]) => void,
): UseDragDropResult {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  dragStateRef.current = dragState;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const bindGripPointer = useCallback((id: string, e: React.PointerEvent, onClick?: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        setDragState({ draggingId: id, overId: null, overPos: null });
      }

      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      const blockEl = els.find(
        el => el.classList.contains('be-block') &&
              el.getAttribute('data-drag-id') !== id
      ) as HTMLElement | undefined;

      if (!blockEl) {
        setDragState(s => s?.draggingId === id ? { ...s, overId: null, overPos: null } : s);
        return;
      }

      const overId   = blockEl.getAttribute('data-drag-id') ?? '';
      const rect     = blockEl.getBoundingClientRect();
      const overPos: 'before' | 'after' = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDragState(s => s?.draggingId === id ? { ...s, overId, overPos } : null);
    };

    const onUp = () => {
      if (!dragging) {
        onClick?.();
      } else {
        const st = dragStateRef.current;
        const bs = blocksRef.current;
        if (st?.overId && st.overPos && st.draggingId === id) {
          const from = bs.findIndex(b => b.id === st.draggingId);
          const to   = bs.findIndex(b => b.id === st.overId);
          if (from >= 0 && to >= 0 && from !== to) {
            const next = [...bs];
            const [moved] = next.splice(from, 1);
            const insertAt = st.overPos === 'before'
              ? (to > from ? to - 1 : to)
              : (to > from ? to     : to + 1);
            next.splice(Math.max(0, insertAt), 0, moved);
            onReorder(next);
          }
        }
        setDragState(null);
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [onReorder]);

  const getDragProps = useCallback((id: string) => ({
    onPointerEnter: (_e: React.PointerEvent) => {
      if (dragStateRef.current?.draggingId) {
        // handled via pointermove on window
      }
    },
    'data-drag-id': id,
  }), []);

  return { dragState, bindGripPointer, getDragProps };
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

interface TurnIntoMenuState {
  blockId:  string;
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
  blockFocusBg?: string;
  blockFocusBorder?: string;
  blockSelectedBg?: string;
  blockHoverBg?: string;
  toolbarActiveFg?: string;
  radiusBtn?: number;
  radiusCard?: number;
  radiusModal?: number;
  searchHlBg?: string;
  searchHlColor?: string;
  linkColor?: string;
  fontFamily?: string;
  fontSize?: number;
  documentMaxWidth?: number;
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
  /** edit 모드 Ctrl/Cmd+클릭으로 [[제목]] 따라가기 */
  onWikiNavigate?: (title: string) => void;
  /** 포커스된 블록 id — 이미지 삽입 위치 등 */
  onActiveBlockChange?: (id: string | null) => void;
  /** 외부에서 특정 블록으로 포커스 이동 요청 */
  externalFocusId?: string | null;
  onExternalFocusConsumed?: () => void;
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

// ── 인라인 마크다운 렌더러 (readOnly 렌더 전용) ──────────────────────
// 위키링크/태그는 data 속성을 부여해 상위 컨테이너에서 클릭 위임으로 처리한다.
// 인라인 수식 $...$ 은 window.katex로 렌더(미로드 시 코드로 폴백).
function renderInlineMarkdown(text: string, c: BlockEditorColors, searchQuery = '', wikiTargets: string[] = []): ReactNode {
  const wikiSet = new Set(wikiTargets.map(normalizeWikiTitle));
  const esc = (s: string) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // 1. 인라인 수식 보호 — esc/다른 치환 영향을 받지 않도록 플레이스홀더로 분리
  const math: string[] = [];
  const work = text.replace(/\$([^$\n]+)\$/g, (_m, expr: string) => {
    let rendered: string;
    if (typeof window !== 'undefined' && window.katex) {
      try { rendered = window.katex.renderToString(expr, { displayMode: false, throwOnError: false }); }
      catch { rendered = `<code style="background:${c.codeBg};color:${c.danger};padding:1px 5px;border-radius:4px">${esc('$' + expr + '$')}</code>`; }
    } else {
      rendered = `<code style="background:${c.codeBg};color:${c.accent};padding:1px 5px;border-radius:4px;font-size:.88em">${esc(expr)}</code>`;
    }
    math.push(rendered);
    return `\u0000M${math.length - 1}\u0000`;
  });

  let html = esc(work)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/~~(.+?)~~/g,         '<del>$1</del>')
    .replace(/==(.+?)==/g,         `<mark style="background:${c.accentBg};color:${c.accent}">$1</mark>`)
    .replace(/`([^`]+)`/g,         `<code style="background:${c.codeBg};color:${c.accent};padding:1px 5px;border-radius:4px;font-size:.88em">$1</code>`)
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = wikiSet.size > 0 && !wikiSet.has(normalizeWikiTitle(t));
      const color  = broken ? c.textMuted : c.accent;
      const deco   = broken ? 'underline dashed' : 'underline';
      const extra  = broken ? ';opacity:0.85;font-style:italic' : '';
      const title  = broken ? ' title="Create note"' : '';
      return `<span class="be-wikilink${broken ? ' be-wikilink-broken' : ''}" data-wiki="${t.replace(/"/g,'&quot;')}"${title} style="color:${color};text-decoration:${deco};text-underline-offset:2px;cursor:pointer${extra}">${t}</span>`;
    })
    .replace(/(^|\s)#([\w\uAC00-\uD7A3]+)/g, (_m, sp: string, tag: string) =>
      `${sp}<span class="be-tag" data-tag="${tag.replace(/"/g,'&quot;')}" style="color:${c.accent};opacity:.85;cursor:pointer">#${tag}</span>`);

  if (searchQuery.trim()) {
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html = html.replace(new RegExp(`(${q})`, 'gi'), '<mark style="background:#fbbf24;color:#000">$1</mark>');
  }

  // 2. 수식 복원 (검색 하이라이트가 katex HTML을 건드리지 않도록 마지막에)
  html = html.replace(/\u0000M(\d+)\u0000/g, (_m, i: string) => math[Number(i)]);

  return <span dangerouslySetInnerHTML={{ __html: html }}/>;
}

/** 편집 중 Live Preview — 마크다운 문자는 유지하고 시각만 포맷 (캐럿 offset 보존) */
function liveInlineHtml(text: string, c: BlockEditorColors, wikiTargets: string[] = [], searchQuery = ''): string {
  if (!text) return '';
  const wikiSet = new Set(wikiTargets.map(normalizeWikiTitle));
  const esc = (s: string) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const escAttr = (s: string) => s.replace(/"/g, '&quot;');

  const math: string[] = [];
  let work = text.replace(/\$([^$\n]+)\$/g, (_m, expr: string) => {
    math.push(`<code class="be-live-code">${esc(expr)}</code>`);
    return `\u0000M${math.length - 1}\u0000`;
  });

  let html = esc(work)
    .replace(/\n/g, '<br>')
    .replace(/\[\[(.+?)\]\]/g, (_m, t: string) => {
      const broken = wikiSet.size > 0 && !wikiSet.has(normalizeWikiTitle(t));
      const cls = broken ? 'be-wiki-chip be-wiki-chip-broken' : 'be-wiki-chip';
      return `<span class="${cls}" data-wiki="${escAttr(t)}"><span class="be-bracket">[[</span>${esc(t)}<span class="be-bracket">]]</span></span>`;
    })
    .replace(/(^|\s)(#[\w\uAC00-\uD7A3]+)/g, (_m, sp: string, tag: string) =>
      `${sp}<span class="be-tag-chip" data-tag="${escAttr(tag.slice(1))}">${tag}</span>`)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em><span class="be-mark">***</span>$1<span class="be-mark">***</span></em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong><span class="be-mark">**</span>$1<span class="be-mark">**</span></strong>')
    .replace(/\*(.+?)\*/g,         '<em><span class="be-mark">*</span>$1<span class="be-mark">*</span></em>')
    .replace(/~~(.+?)~~/g,         '<del><span class="be-mark">~~</span>$1<span class="be-mark">~~</span></del>')
    .replace(/==(.+?)==/g,         `<mark class="be-live-mark"><span class="be-mark">==</span>$1<span class="be-mark">==</span></mark>`)
    .replace(/`([^`]+)`/g,         `<code class="be-live-code"><span class="be-mark">\`</span>$1<span class="be-mark">\`</span></code>`);

  if (searchQuery.trim()) {
    const q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html = html.replace(new RegExp(`(${q})`, 'gi'), '<mark class="be-search-hl">$1</mark>');
  }

  html = html.replace(/\u0000M(\d+)\u0000/g, (_m, i: string) => math[Number(i)]);
  return html;
}

function getPlainSelectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const preStart = range.cloneRange();
  preStart.selectNodeContents(el);
  preStart.setEnd(range.startContainer, range.startOffset);
  const preEnd = range.cloneRange();
  preEnd.selectNodeContents(el);
  preEnd.setEnd(range.endContainer, range.endOffset);
  const start = preStart.toString().length;
  const end = preEnd.toString().length;
  return start === end ? null : { start, end };
}

function applyWrapToSelection(
  el: HTMLElement,
  before: string,
  after: string,
  onText: (text: string) => void,
  afterApply?: (el: HTMLElement, text: string, selection: { start: number; end: number }) => void,
): boolean {
  const sel = getPlainSelectionOffsets(el);
  if (!sel) return false;
  const text = getElText(el);
  const result = toggleMarkdownWrap(text, sel.start, sel.end, before, after);
  onText(result.text);
  if (afterApply) afterApply(el, result.text, { start: result.selStart, end: result.selEnd });
  else {
    el.innerText = result.text;
    setSelectionOffsets(el, result.selStart, result.selEnd);
  }
  return true;
}

function paintEditableLive(
  el: HTMLElement,
  text: string,
  c: BlockEditorColors,
  wikiTargets: string[],
  searchQuery: string,
  caretOffset?: number,
  selection?: { start: number; end: number },
) {
  el.innerHTML = liveInlineHtml(text, c, wikiTargets, searchQuery);
  if (selection) setSelectionOffsets(el, selection.start, selection.end);
  else if (caretOffset != null) setCaretOffset(el, caretOffset);
}

// ── SingleBlock ───────────────────────────────────────────────────────
interface SingleBlockProps {
  block: Block;
  colors: BlockEditorColors; selected: boolean;
  onSelect: (id: string) => void; onOpenMenu: (s: BlockMenuState) => void;
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
    && prev.onOpenMenu === next.onOpenMenu
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
    && prev.onChromeLeave === next.onChromeLeave;
}

const SingleBlock = React.memo(function SingleBlock({
  block, colors: c, selected,
  onSelect, onOpenMenu, onAddBelow, readOnly, searchQuery, depth, wikiTargets, headingIndex,
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
}: SingleBlockProps) {
  const { getBlocks, onChange } = useBlocksCtx();
  const [toggleOpen, setToggleOpen] = useState(!block.collapsed);
  const shellRef = useRef<HTMLDivElement>(null);

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
    focusRegistry.set(block.id, handler);
    return () => { focusRegistry.delete(block.id); };
  }, [block.id, block.type]);

  // 외부 focusCmd가 이 블록을 가리키면 실행
  useEffect(() => {
    if (focusCmd && focusCmd.blockId === block.id) {
      const handler = focusRegistry.get(block.id);
      if (handler) handler(focusCmd);
    }
  }, [focusCmd, block.id]);

  const inline = (text: string) => renderInlineMarkdown(text, c, searchQuery, wikiTargets);

  // ── 드래그 인디케이터 계산 ──────────────────────────────────────
  const isDragging   = dragState?.draggingId === block.id;
  const isOverBefore = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'before';
  const isOverAfter  = !isDragging && dragState?.overId === block.id && dragState?.overPos === 'after';
  const isActive     = activeBlockId === block.id;

  const dropLineStyle: CSSProperties = {
    position: 'absolute', left: 0, right: 0, height: 2,
    background: c.accent, borderRadius: 1, zIndex: 10,
    pointerEvents: 'none',
    boxShadow: `0 0 6px ${c.accent}88`,
  };

  const handles = !readOnly && (
    <div
      className="be-handles"
      onMouseDown={e => e.stopPropagation()}
      onMouseEnter={() => onChromeEnter?.(block.id)}
      onMouseLeave={() => onChromeLeave?.()}
      style={{
        position:'absolute', left:-(HANDLE_HIT_PX * 2 + 6), top:'50%', transform:'translateY(-50%)',
        display:'flex', flexDirection:'row', alignItems:'center', gap:2,
      }}>
      <button
        type="button"
        className="be-add-btn be-handle-btn"
        onClick={e => { e.stopPropagation(); onAddBelow(block.id); }}
        title="아래에 블록 추가">
        <Plus size={16} strokeWidth={2.25}/>
      </button>
      <button
        type="button"
        className={`be-grip be-handle-btn${controlsVisible ? ' be-grip-pinned' : ''}`}
        onPointerDown={e => {
          const gripEl = e.currentTarget as HTMLElement;
          bindGripPointer(block.id, e, () => {
            onToggleControlsPin?.(block.id);
            const rect = gripEl.getBoundingClientRect();
            onOpenTurnInto({ blockId: block.id, anchorY: rect.top, anchorX: rect.right + 2 });
          });
        }}
        title="드래그: 이동 · 클릭: Turn Into">
        <BlockGripIcon />
      </button>
    </div>
  );

  const inner = renderInner(block, c, {
    toggleOpen, inline,
    onToggleCollapse: handleToggleCollapse,
    onToggleTodo: handleToggleTodo,
    getBlocks, onChange, searchQuery, depth, wikiTargets,
    readOnly, onSelect, onOpenMenu, onAddBelow,
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

  return (
    <div
      {...getDragProps(block.id)}
      data-be-heading={headingIndex}
      style={{
        position:'relative', marginLeft: depth > 0 ? depth * 20 : 0,
        borderRadius: 6,
        padding: (isActive || selected) ? '4px 8px 4px 10px' : '1px 0 1px 3px',
        outline: 'none',
        border: 'none',
        borderLeft: (isActive || selected) ? `3px solid ${c.accent}` : '3px solid transparent',
        transition: 'border-color .12s, background .12s',
        opacity: isDragging ? 0.4 : 1,
        userSelect: dragState ? 'none' : undefined,
        background: isActive
          ? (c.blockFocusBg ?? 'rgba(139,92,246,0.04)')
          : selected
            ? (c.blockSelectedBg ?? 'rgba(139,92,246,0.03)')
            : undefined,
      }}
      className={`be-block${isActive ? ' be-block-active' : ''}${selected ? ' be-block-selected' : ''}${controlsVisible ? ' be-controls-visible' : ''}`}
      onMouseEnter={() => onChromeEnter?.(block.id)}
      onMouseLeave={() => onChromeLeave?.()}
      onClick={() => { onSelect(block.id); onActiveBlockChange?.(block.id); }}>
      {isOverBefore && <div style={{ ...dropLineStyle, top: -1 }}/>}
      {handles}
      {body}
      {isOverAfter  && <div style={{ ...dropLineStyle, bottom: -1 }}/>}
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
  onWikiNavigate?: (title: string) => void;
  // Toggle Step 2: Enter 동작을 완전히 대체하는 콜백 (toggle 헤더 전용)
  onEnterOverride?: (currentContent: string) => void;
  onNavigateBlock: (fromId: string, dir: 'up' | 'down') => void;
  onActiveBlockChange?: (id: string | null) => void;
  wikiTargets?: string[];
  searchQuery?: string;
  onConvertBlock?: (id: string, type: BlockType) => void;
}

function EditableBlock({
  block, colors: c, placeholder = '텍스트 입력…',
  style, className, editableRef,
  onSplitBlock, onMergeWithPrev, onContentChange, tag = 'p',
  onSlashOpen, onSlashClose,
  onWikiOpen, onWikiClose, isMenuOpen, onWikiNavigate,
  onEnterOverride, onNavigateBlock, onActiveBlockChange,
  wikiTargets = [], searchQuery = '',
  onConvertBlock,
}: EditableBlockProps) {
  const Tag = tag as React.ElementType;
  const composingRef = useRef(false);
  const liveRafRef = useRef<number | null>(null);

  const paintLive = useCallback((el: HTMLElement, restoreCaret = true) => {
    const plain = getElText(el);
    const caret = restoreCaret ? getCaretOffset(el) : undefined;
    paintEditableLive(el, plain, c, wikiTargets, searchQuery, caret);
  }, [c, wikiTargets, searchQuery]);

  // contentEditable DOM 동기화 (외부 content 변경 시)
  const lastContent = useRef(block.content);
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    if (block.content !== lastContent.current) {
      if (document.activeElement !== el) {
        paintEditableLive(el, block.content, c, wikiTargets, searchQuery);
        lastContent.current = block.content;
      }
    }
  }, [block.content, editableRef, c, wikiTargets, searchQuery]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || el.innerHTML) return;
    paintEditableLive(el, block.content, c, wikiTargets, searchQuery);
    lastContent.current = block.content;
  }, [block.content, editableRef, c, wikiTargets, searchQuery]);

  useEffect(() => () => {
    if (liveRafRef.current != null) cancelAnimationFrame(liveRafRef.current);
  }, []);

  const handleInput = useCallback((e: React.FormEvent<HTMLElement>) => {
    const el   = e.currentTarget;
    const text = getElText(el);
    lastContent.current = text;
    onContentChange(block.id, text);

    if (!composingRef.current) {
      if (liveRafRef.current != null) cancelAnimationFrame(liveRafRef.current);
      liveRafRef.current = requestAnimationFrame(() => {
        liveRafRef.current = null;
        paintLive(el, true);
      });
    }

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
  }, [block.id, onContentChange, onSlashOpen, onSlashClose, onWikiOpen, onWikiClose, paintLive]);

  const applyInlineFormat = useCallback((before: string, after: string) => {
    const el = editableRef.current;
    if (!el) return;
    applyWrapToSelection(el, before, after, (text) => {
      lastContent.current = text;
      onContentChange(block.id, text);
    }, (target, text, selection) => {
      paintEditableLive(target, text, c, wikiTargets, searchQuery, undefined, selection);
    });
  }, [block.id, onContentChange, c, wikiTargets, searchQuery, editableRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;

    // ── 인라인/블록 단축키 (메뉴 열림 시 제외) ─────────────────────
    if (mod && !isMenuOpen) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        applyInlineFormat('**', '**');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        applyInlineFormat('*', '*');
        return;
      }
      if (e.code === 'Backquote') {
        e.preventDefault();
        applyInlineFormat('`', '`');
        return;
      }
      if (key === 'k' && e.shiftKey) {
        e.preventDefault();
        applyInlineFormat('[[', ']]');
        return;
      }
      if (key === 'h' && e.shiftKey) {
        e.preventDefault();
        applyInlineFormat('#', '');
        return;
      }
      if (e.shiftKey && onConvertBlock) {
        if (key === '0') { e.preventDefault(); onConvertBlock(block.id, 'paragraph'); return; }
        if (key === '1') { e.preventDefault(); onConvertBlock(block.id, 'heading1'); return; }
        if (key === '2') { e.preventDefault(); onConvertBlock(block.id, 'heading2'); return; }
        if (key === '3') { e.preventDefault(); onConvertBlock(block.id, 'heading3'); return; }
        if (key === '7') { e.preventDefault(); onConvertBlock(block.id, 'todo'); return; }
        if (key === '8') { e.preventDefault(); onConvertBlock(block.id, 'toggle'); return; }
        if (key === '9') { e.preventDefault(); onConvertBlock(block.id, 'callout'); return; }
        if (key === 'c') { e.preventDefault(); onConvertBlock(block.id, 'code'); return; }
      }
    }

    // ── 슬래시/위키 메뉴가 열려있으면 탐색/선택은 메뉴에 위임 ───────
    // (블록 분리/병합보다 우선 — 메뉴의 window 리스너가 Enter/방향키 처리)
    if (isMenuOpen) {
      if (e.key === 'Enter')                              { e.preventDefault(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown')   { e.preventDefault(); return; }
      if (e.key === 'Escape')                             { onSlashClose(); onWikiClose(); return; }
    }

    // ── Shift+Enter: 블록 내 줄바꿈 ───────────────────────────────
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onSlashClose();
      onWikiClose();
      const text = lastContent.current;
      const offset = getCaretOffset(el);
      const next = text.slice(0, offset) + '\n' + text.slice(offset);
      lastContent.current = next;
      onContentChange(block.id, next);
      paintEditableLive(el, next, c, wikiTargets, searchQuery, offset + 1);
      return;
    }

    // ── Enter: 블록 분리 (또는 toggle 헤더 override) ──────────────
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSlashClose();
      onWikiClose();
      // Toggle Step 2: toggle 헤더일 때는 자식 블록 생성으로 대체
      if (onEnterOverride) {
        onEnterOverride(getElText(el));
        return;
      }
      const text   = lastContent.current;
      const offset = getCaretOffset(el);
      const { before, after } = splitMarkdownAt(text, offset);
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

    // ── ↑/↓: 블록 경계에서 이웃 블록으로 이동 ───────────────────
    if (e.key === 'ArrowUp') {
      const offset = getCaretOffset(el);
      if (offset === 0) { e.preventDefault(); onNavigateBlock(block.id, 'up'); return; }
    }
    if (e.key === 'ArrowDown') {
      const text = getElText(el);
      if (getCaretOffset(el) === text.length) { e.preventDefault(); onNavigateBlock(block.id, 'down'); return; }
    }

    // ── Escape: 슬래시/위키 메뉴 닫기 ────────────────────────────
    if (e.key === 'Escape') {
      onSlashClose();
      onWikiClose();
    }
  }, [block.id, onSplitBlock, onMergeWithPrev, onSlashClose, onWikiClose, onEnterOverride, isMenuOpen, onNavigateBlock, applyInlineFormat, onConvertBlock, c, wikiTargets, searchQuery, onContentChange]);

  const handleFocus = useCallback(() => {
    onActiveBlockChange?.(block.id);
    const el = editableRef.current;
    if (el && getElText(el) !== block.content) {
      paintEditableLive(el, block.content, c, wikiTargets, searchQuery);
    }
  }, [block.content, editableRef, block.id, onActiveBlockChange, c, wikiTargets, searchQuery]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    paintLive(e.currentTarget, false);
  }, [paintLive]);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLElement>) => {
    composingRef.current = false;
    paintLive(e.currentTarget, true);
  }, [paintLive]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLElement>) => {
    // 서식 없이 순수 텍스트만 붙여넣기
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Ctrl/Cmd+클릭으로 클릭 위치의 [[제목]] 따라가기 (일반 클릭은 캐럿 배치 유지)
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!onWikiNavigate || !(e.ctrlKey || e.metaKey)) return;
    const el = e.currentTarget;
    const text   = getElText(el);
    const offset = getCaretOffset(el);
    const re = /\[\[([^\]\n]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (offset >= m.index && offset <= m.index + m[0].length) {
        e.preventDefault();
        onWikiNavigate(m[1]);
        return;
      }
    }
  }, [onWikiNavigate]);

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
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      onClick={handleClick}
      data-placeholder={placeholder}
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
    searchQuery: ctx.searchQuery,
    onConvertBlock: ctx.onConvertBlock,
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
        <div className="be-toggle" style={{
          background: c.toggleBg,
          borderRadius: 10,
          border: `1px solid ${c.border}`,
          margin: '6px 0',
          overflow: 'hidden',
          transition: 'box-shadow .15s',
          boxShadow: ctx.toggleOpen ? `0 1px 0 ${c.accent}22 inset` : 'none',
        }}>
          <div style={{
            display:'flex', gap:8, alignItems:'flex-start', padding:'8px 12px',
            borderBottom: ctx.toggleOpen ? `1px solid ${c.border}` : 'none',
          }}>
            <button
              type="button"
              aria-label={ctx.toggleOpen ? '접기' : '펼치기'}
              style={{
                color:c.accent, background:'none', border:'none', padding:0,
                transition:'transform .18s', transform: ctx.toggleOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                marginTop:3, flexShrink:0, cursor:'pointer', display:'flex',
              }}
              onClick={e => { e.stopPropagation(); ctx.onToggleCollapse(); }}>
              <ChevronRight size={16}/>
            </button>
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
            <div style={{ padding:'8px 12px 10px 36px', background: `${c.bg}88` }}>
              {block.children.length > 0 ? (
                <BlockEditorInner
                  blocks={block.children}
                  onChange={children => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, children })))}
                  colors={c} readOnly={ctx.readOnly} searchQuery={ctx.searchQuery} depth={ctx.depth + 1}
                  wikiTargets={ctx.wikiTargets}
                  onWikiNavigate={ctx.onWikiNavigate}
                  onActiveBlockChange={ctx.onActiveBlockChange}
                  externalFocusId={undefined}
                  // Toggle Step 3: 자식 → 부모 탈출 콜백
                  onEscapeToParentBelow={() => {
                    // toggle 바로 아래에 새 paragraph 삽입 + 포커스
                    const newBlock = makeBlock('paragraph');
                    ctx.onChange(insertBlockAfter(ctx.getBlocks(), block.id, newBlock));
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
                placeholder="콜아웃 텍스트…" {...sharedEditProps}/>
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
}

function BlockEditorInner({ blocks, onChange, colors: c, readOnly, searchQuery, depth,
  wikiTargets, onWikiNavigate, onActiveBlockChange,
  externalFocusId, onExternalFocusConsumed,
  onEscapeToParentBelow, onEscapeToParentHeader,
}: BlockEditorInnerProps) {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const handleActiveBlockChange = useCallback((id: string | null) => {
    setActiveBlockId(id);
    onActiveBlockChange?.(id);
  }, [onActiveBlockChange]);

  const blocksCtx = useMemo<BlocksCtxValue>(() => ({
    getBlocks: () => blocksRef.current,
    onChange,
  }), [onChange]);

  const [selected, setSelected] = useState<string | null>(null);
  const [blockMenu, setBlockMenu] = useState<BlockMenuState | null>(null);
  const [focusCmd, setFocusCmd] = useState<FocusCmd | null>(null);
  // Phase 3: 슬래시 커맨드
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  // 위키링크 자동완성
  const [wikiMenu, setWikiMenu] = useState<WikiMenuState | null>(null);
  // Phase 3: 드래그&드롭
  const { dragState, bindGripPointer, getDragProps } = useDragDrop(blocks, onChange);
  const [turnIntoMenu, setTurnIntoMenu] = useState<TurnIntoMenuState | null>(null);
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
    || turnIntoMenu?.blockId === blockId
    || chromeHoverId === blockId,
  [pinnedControlsId, turnIntoMenu, chromeHoverId]);

  const getBlockType = useCallback(
    (blockId: string) => findBlockById(blocksRef.current, blockId)?.type,
    [],
  );

  useEffect(() => {
    if (!pinnedControlsId && !turnIntoMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.be-handles, .be-turn-into-menu')) return;
      setPinnedControlsId(null);
      setTurnIntoMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinnedControlsId, turnIntoMenu]);

  const handleAddBelow = useCallback((id: string) => {
    const nb = makeBlock('paragraph');
    onChange(insertBlockAfter(blocksRef.current, id, nb));
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
    setBlockMenu(null);
    setTurnIntoMenu(null);
    setPinnedControlsId(null);
    setFocusCmd({ blockId: id, offset: 'end' });
  }, [onChange]);

  // ── Phase 2: 블록 분리 (Enter) ───────────────────────────────────
  const handleSplitBlock = useCallback((id: string, before: string, after: string) => {
    const bs = blocksRef.current;
    const idx = bs.findIndex(b => b.id === id);
    if (idx < 0) return;

    // Toggle Step 3: 마지막 자식이 빈 paragraph + Enter → 부모 toggle 아래로 탈출
    const isLast    = idx === bs.length - 1;
    const isEmpty   = before === '' && after === '';
    const isPara    = bs[idx].type === 'paragraph';
    if (isLast && isEmpty && isPara && onEscapeToParentBelow) {
      // 빈 자식 블록 삭제 후 부모에 탈출 신호
      const cleaned = bs.filter(b => b.id !== id);
      onChange(cleaned.length > 0 ? cleaned : []);
      onEscapeToParentBelow();
      return;
    }

    const cur = bs[idx];
    const updatedCur: Block = { ...cur, content: before };
    const newType: BlockType = ['heading1','heading2','heading3'].includes(cur.type)
      ? 'paragraph' : cur.type;
    const newBlock: Block = makeBlock(newType, {
      content: after,
      indent:  cur.indent,
      checked: false,
    });

    const next = [...bs];
    next[idx] = updatedCur;
    next.splice(idx + 1, 0, newBlock);
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
      const handler = focusRegistry.get(newChild.id);
      if (handler) handler({ blockId: newChild.id, offset: 'start' });
    });
  }, [onChange]);

  // ── Toggle Step 2: 헤더 Enter → 자식 블록 생성 & 포커스 ──────────
  const handleToggleEnter = useCallback((toggleBlockId: string, currentContent: string) => {
    const newChild = makeBlock('paragraph');
    onChange(updateBlockById(blocksRef.current, toggleBlockId, b => {
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

    setSlashMenu(null);
    // 타입 변환 후 해당 블록 포커스 (끝)
    setFocusCmd({ blockId, offset: 'end' });
  }, [slashMenu, onChange]);

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
        paintEditableLive(el, newText, c, wikiTargets, searchQuery, idx + ins.length);
        if (wikiMenu) handleContentChange(wikiMenu.blockId, getElText(el));
      }
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

  return (
  <BlocksCtx.Provider value={blocksCtx}>
    <>
      <div className="be-editor-root" style={{ paddingLeft: depth > 0 ? 0 : (readOnly ? 0 : 44), position:'relative' }}>
        {blocks.map(block => (
          <SingleBlock
            key={block.id} block={block}
            colors={c} selected={selected === block.id}
            activeBlockId={activeBlockId}
            onSelect={setSelected} onOpenMenu={setBlockMenu}
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
            onOpenTurnInto={setTurnIntoMenu}
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
          />
        ))}
      </div>
      {!readOnly && (
        <SelectionToolbar
          colors={c}
          wikiTargets={wikiTargets}
          searchQuery={searchQuery}
          onContentChange={handleContentChange}
          onConvertBlock={handleConvert}
          getBlockType={getBlockType}
        />
      )}
      {turnIntoMenu && (
        <TurnIntoMenu
          blockId={turnIntoMenu.blockId}
          currentType={findBlockById(blocksRef.current, turnIntoMenu.blockId)?.type ?? 'paragraph'}
          anchorY={turnIntoMenu.anchorY}
          anchorX={turnIntoMenu.anchorX}
          colors={c}
          onSelect={type => handleConvert(turnIntoMenu.blockId, type)}
          onClose={() => { setTurnIntoMenu(null); setPinnedControlsId(null); }}
          onChromeEnter={handleChromeEnter}
          onChromeLeave={handleChromeLeave}
        />
      )}
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
  </BlocksCtx.Provider>
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
      borderRadius: c.radiusModal ?? 16, boxShadow:'0 8px 24px rgba(0,0,0,0.1)',
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

// ── Turn Into 메뉴 (블록 hover ⋮⋮) ────────────────────────────────────
interface TurnIntoMenuProps {
  blockId: string;
  currentType: BlockType;
  anchorY: number;
  anchorX: number;
  colors: BlockEditorColors;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  onChromeEnter?: (id: string) => void;
  onChromeLeave?: () => void;
}

function TurnIntoMenu({
  blockId, currentType, anchorY, anchorX, colors: c, onSelect, onClose,
  onChromeEnter, onChromeLeave,
}: TurnIntoMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const items = useMemo(
    () => TURN_INTO_TYPES.map(t => BLOCK_TYPE_MENU.find(m => m.type === t)).filter((m): m is NonNullable<typeof m> => m != null),
    [],
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const top  = Math.min(anchorY, window.innerHeight - 320);
  const left = Math.min(anchorX, window.innerWidth  - 210);

  return (
    <div
      ref={menuRef}
      className="be-turn-into-menu"
      onMouseEnter={() => onChromeEnter?.(blockId)}
      onMouseLeave={() => onChromeLeave?.()}
      style={{
      position:'fixed', top, left, zIndex:400,
      background:c.card, border:`1px solid ${c.border}`,
      borderRadius: c.radiusModal ?? 16, boxShadow:'0 8px 24px rgba(0,0,0,0.1)',
      width:196, overflow:'hidden', padding:'6px 0',
    }}>
      <div style={{ padding:'4px 12px 8px', fontSize:10, fontWeight:700, color:c.textFaint, letterSpacing:0.8, textTransform:'uppercase' }}>
        Turn Into
      </div>
      {items.map(item => {
        const active = item.type === currentType;
        return (
          <button
            key={item.type}
            type="button"
            onMouseDown={e => { e.preventDefault(); onSelect(item.type); }}
            style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'7px 12px', background: active ? c.accentBg : 'none',
              border:'none', cursor:'pointer', textAlign:'left',
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = c.cardHov; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
          >
            <span style={{ width:24, display:'flex', alignItems:'center', justifyContent:'center', color:c.accent, flexShrink:0 }}>
              {blockIcon(item.type)}
            </span>
            <span style={{ fontSize:13, fontWeight: active ? 700 : 500, color:c.text }}>{item.label}</span>
          </button>
        );
      })}
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

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    items.forEach(item => { (g[item.group] ??= []).push(item); });
    return g;
  }, [items]);

  const flatItems = useMemo(() => Object.values(grouped).flat(), [grouped]);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor(v => Math.min(v + 1, flatItems.length - 1)); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setCursor(v => Math.max(v - 1, 0)); }
      if (e.key === 'Enter')      { e.preventDefault(); if (flatItems[cursor]) onSelect(flatItems[cursor].type); }
      if (e.key === 'Escape')     { onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [flatItems, cursor, onSelect, onClose]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block:'nearest' });
  }, [cursor]);

  const groupLabels: Record<string, string> = { text:'텍스트', list:'목록', media:'미디어', embed:'임베드' };
  const top  = Math.min(anchorY + 8, window.innerHeight - 380);
  const left = Math.min(anchorX,     window.innerWidth  - 260);

  return (
    <div ref={menuRef} className="be-slash-menu" style={{
      position:'fixed', top, left, zIndex:400,
      background:c.card, border:`1px solid ${c.border}`,
      borderRadius: c.radiusModal ?? 16, boxShadow:'0 8px 24px rgba(0,0,0,0.1)',
      width:248, maxHeight:360, overflowY:'auto', padding:'6px 0',
    }}>
      <div style={{ padding:'6px 12px 8px', borderBottom:`1px solid ${c.border}`, marginBottom:4 }}>
        <div style={{ fontSize:10, color:c.textFaint, fontWeight:700, letterSpacing:0.8, marginBottom:4 }}>
          {query ? `"${query}" 검색` : '블록 추가'}
        </div>
        <div style={{ fontSize:11, color:c.textMuted }}>
          {query ? 'Enter로 선택 · ↑↓ 이동' : 'heading · todo · toggle · callout …'}
        </div>
      </div>
      {items.length === 0 && <div style={{ padding:12, color:c.textFaint, fontSize:13, textAlign:'center' }}>결과 없음</div>}
      {Object.entries(grouped).map(([group, gItems]) => (
        <div key={group}>
          {!query && (
            <div style={{ padding:'4px 12px 2px', fontSize:9, color:c.textFaint, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
              {groupLabels[group] ?? group}
            </div>
          )}
          {gItems.map(item => {
            const idx = flatItems.indexOf(item);
            const active = cursor === idx;
            return (
              <button key={item.type} data-idx={idx} type="button" onClick={() => onSelect(item.type)}
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
      borderRadius: c.radiusModal ?? 16, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
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

const noopBlockChange = () => {};

// ── 툴바 툴팁 ─────────────────────────────────────────────────────────
function ToolbarTip({
  label, hint, children, colors: c, radius,
}: { label: string; hint?: string; children: ReactNode; colors: BlockEditorColors; radius?: number }) {
  const tipRadius = radius ?? c.radiusBtn ?? 8;
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: c.card, border: `1px solid ${c.border}`, borderRadius: tipRadius,
          padding: '4px 8px', whiteSpace: 'nowrap', zIndex: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{label}</div>
          {hint && <div style={{ fontSize: 10, color: c.textMuted, marginTop: 1 }}>{hint}</div>}
        </div>
      )}
    </div>
  );
}

// ── 선택 텍스트 포맷 툴바 ─────────────────────────────────────────────
interface SelectionToolbarProps {
  colors: BlockEditorColors;
  wikiTargets: string[];
  searchQuery: string;
  onContentChange: (blockId: string, content: string) => void;
  onConvertBlock: (blockId: string, type: BlockType) => void;
  getBlockType: (blockId: string) => BlockType | undefined;
}

interface ToolbarFormatState {
  bold: boolean;
  italic: boolean;
  code: boolean;
  wiki: boolean;
  tag: boolean;
  heading: BlockType | null;
}

const EMPTY_FORMATS: ToolbarFormatState = {
  bold: false, italic: false, code: false, wiki: false, tag: false, heading: null,
};

function deriveToolbarFormats(
  host: HTMLElement,
  blockId: string | null,
  getBlockType: (id: string) => BlockType | undefined,
): ToolbarFormatState {
  if (!blockId) return EMPTY_FORMATS;
  const text = getElText(host);
  const offsets = getPlainSelectionOffsets(host);
  if (!offsets) return EMPTY_FORMATS;
  const { start, end } = offsets;
  const selected = text.slice(start, end);
  const blockType = getBlockType(blockId);
  return {
    bold: selectionHasFormat(text, start, end, '**', '**'),
    italic: selectionHasFormat(text, start, end, '*', '*'),
    code: selectionHasFormat(text, start, end, '`', '`'),
    wiki: selectionHasFormat(text, start, end, '[[', ']]'),
    tag: text[start] === '#' && end > start && !selected.includes(' '),
    heading: blockType === 'heading1' || blockType === 'heading2' || blockType === 'heading3'
      ? blockType
      : null,
  };
}

function SelectionToolbar({
  colors: c, wikiTargets, searchQuery, onContentChange, onConvertBlock, getBlockType,
}: SelectionToolbarProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [formats, setFormats] = useState<ToolbarFormatState>(EMPTY_FORMATS);
  const blockIdRef = useRef<string | null>(null);
  const editableRef = useRef<HTMLElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        blockIdRef.current = null;
        editableRef.current = null;
        savedRangeRef.current = null;
        setFormats(EMPTY_FORMATS);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const host = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement)
        ?.closest('[contenteditable="true"]') as HTMLElement | null;
      if (!host?.closest('.be-editor-root')) {
        setPos(null);
        blockIdRef.current = null;
        editableRef.current = null;
        savedRangeRef.current = null;
        setFormats(EMPTY_FORMATS);
        return;
      }
      const blockEl = host.closest('.be-block') as HTMLElement | null;
      const blockId = blockEl?.getAttribute('data-drag-id') ?? null;
      blockIdRef.current = blockId;
      editableRef.current = host;
      savedRangeRef.current = range.cloneRange();

      setFormats(deriveToolbarFormats(host, blockId, getBlockType));

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      setPos({ top: rect.top - 46, left: rect.left + rect.width / 2 });
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('keyup', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('keyup', update);
    };
  }, [getBlockType]);

  const applyFormat = useCallback((before: string, after: string) => {
    const blockId = blockIdRef.current;
    const el = editableRef.current;
    if (!el || !blockId) return;

    el.focus();
    const sel = window.getSelection();
    if (savedRangeRef.current && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current.cloneRange());
      } catch {
        // stale range — fall through with current selection
      }
    }

    applyWrapToSelection(el, before, after, (text) => {
      onContentChange(blockId, text);
    }, (target, text, selection) => {
      paintEditableLive(target, text, c, wikiTargets, searchQuery, undefined, selection);
      requestAnimationFrame(() => {
        setFormats(deriveToolbarFormats(target, blockId, getBlockType));
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
      });
    });
  }, [c, wikiTargets, searchQuery, onContentChange, getBlockType]);

  if (!pos) return null;

  const activeFg = c.toolbarActiveFg ?? '#FFFFFF';
  const btnRadius = c.radiusBtn ?? 8;

  const iconBtn = (icon: ReactNode, label: string, hint: string | undefined, active: boolean, fn: () => void) => (
    <ToolbarTip label={label} hint={hint} colors={c} radius={btnRadius}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={e => { e.preventDefault(); fn(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32,
          border: 'none', borderRadius: btnRadius, cursor: 'pointer',
          background: active ? c.accent : 'transparent',
          color: active ? activeFg : c.textMuted,
          transition: 'background .12s, color .12s',
        }}
        onMouseEnter={e => {
          if (active) return;
          (e.currentTarget as HTMLButtonElement).style.background = c.cardHov;
          (e.currentTarget as HTMLButtonElement).style.color = c.text;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = active ? c.accent : 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = active ? activeFg : c.textMuted;
        }}
      >
        {icon}
      </button>
    </ToolbarTip>
  );

  const convertHeading = (type: BlockType) => {
    const blockId = blockIdRef.current;
    if (blockId) onConvertBlock(blockId, type);
  };

  return (
    <div
      className="be-selection-toolbar"
      style={{
        position:'fixed', top: Math.max(8, pos.top), left: pos.left,
        transform:'translateX(-50%)', zIndex:400,
        display:'flex', alignItems:'center', gap:3, flexWrap:'nowrap',
        padding:'5px 8px', borderRadius: c.radiusCard ?? 12,
        background:c.card, border:`1px solid ${c.border}`,
        boxShadow:'0 4px 12px rgba(0,0,0,0.08)',
      }}
      onMouseDown={e => e.preventDefault()}
    >
      {iconBtn(<Bold size={14}/>, '굵게', 'Ctrl+B', formats.bold, () => applyFormat('**', '**'))}
      {iconBtn(<Italic size={14}/>, '기울임', 'Ctrl+I', formats.italic, () => applyFormat('*', '*'))}
      {iconBtn(<Code2 size={14}/>, '코드', 'Ctrl+`', formats.code, () => applyFormat('`', '`'))}
      <span style={{ width:1, height:18, background:c.border, margin:'0 1px', flexShrink:0 }}/>
      {iconBtn(<Heading1 size={14}/>, '제목 1', 'Ctrl+Shift+1', formats.heading === 'heading1', () => convertHeading('heading1'))}
      {iconBtn(<Heading2 size={14}/>, '제목 2', 'Ctrl+Shift+2', formats.heading === 'heading2', () => convertHeading('heading2'))}
      {iconBtn(<Heading3 size={14}/>, '제목 3', 'Ctrl+Shift+3', formats.heading === 'heading3', () => convertHeading('heading3'))}
      <span style={{ width:1, height:18, background:c.border, margin:'0 1px', flexShrink:0 }}/>
      {iconBtn(<span style={{ fontSize:11, fontWeight:700 }}>[[]]</span>, '위키 링크', 'Ctrl+Shift+K', formats.wiki, () => applyFormat('[[', ']]'))}
      {iconBtn(<Hash size={14}/>, '태그', 'Ctrl+Shift+H', formats.tag, () => applyFormat('#', ''))}
    </div>
  );
}

// ── 최상위 BlockEditor ───────────────────────────────────────────────
export const BlockEditor = React.memo(function BlockEditor({
  blocks, onChange, colors, readOnly = false, searchQuery = '', wikiTargets = [], onWikiNavigate,
  onActiveBlockChange, externalFocusId, onExternalFocusConsumed,
}: BlockEditorProps) {
  return (
    <>
      <style>{`
        .be-block::before {
          content: '';
          position: absolute;
          left: -80px;
          top: -8px;
          bottom: -8px;
          width: 80px;
        }
        .be-handles { opacity: 0; pointer-events: none; transition: opacity .12s; }
        .be-block:hover .be-handles,
        .be-block.be-controls-visible .be-handles,
        .be-handles:hover { opacity: 1 !important; pointer-events: auto !important; }
        .be-handle-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--be-text-muted, #71717A);
          padding: 0;
          transition: opacity .12s, background .12s, color .12s;
        }
        .be-add-btn { cursor: pointer; }
        .be-grip { cursor: grab; touch-action: none; }
        .be-grip:active { cursor: grabbing; }
        .be-grip-icon {
          display: grid;
          grid-template-columns: repeat(2, 4px);
          gap: 3px 4px;
        }
        .be-grip-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.45;
        }
        .be-handle-btn:hover,
        .be-controls-visible .be-handle-btn {
          background: var(--be-accent-bg, rgba(139,92,246,0.08));
          color: var(--be-accent, #8B5CF6);
        }
        .be-handle-btn:hover .be-grip-dot { opacity: 0.85; }
        .be-block-active { scroll-margin: 80px; }
        .be-block:hover:not(.be-block-active):not(.be-block-selected) {
          background: var(--be-block-hover-bg, rgba(139,92,246,0.015));
        }
        .be-document {
          max-width: var(--be-doc-width, 720px);
          margin: 0 auto;
          font-family: var(--be-font-family, system-ui, sans-serif);
          font-size: var(--be-font-size, 16px);
          color: var(--be-text, inherit);
        }
        [contenteditable]:empty::before {
          content: attr(data-placeholder);
          color: var(--be-placeholder-color, #aaa);
          pointer-events: none;
          position: absolute;
        }
        [contenteditable] { position: relative; }
        [contenteditable]:focus { outline: none; }
        .be-mark {
          opacity: 0.35;
          font-size: 0.82em;
          font-weight: 400;
          user-select: none;
          pointer-events: none;
        }
        .be-wiki-chip {
          display: inline;
          color: var(--be-link, var(--be-accent, #8B5CF6));
          background: var(--be-accent-bg, rgba(139,92,246,0.08));
          border-radius: 4px;
          padding: 0 2px;
        }
        .be-wiki-chip .be-bracket { opacity: 0.4; font-size: 0.85em; }
        .be-wiki-chip-broken { opacity: 0.75; font-style: italic; }
        .be-tag-chip {
          display: inline;
          color: var(--be-accent, #8B5CF6);
          background: var(--be-accent-bg, rgba(139,92,246,0.08));
          border-radius: 999px;
          padding: 0 6px;
          font-size: 0.92em;
          font-weight: 500;
        }
        .be-live-code {
          background: var(--be-code-bg, #f1f5f9);
          color: var(--be-accent, #8B5CF6);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.88em;
          font-family: ui-monospace, monospace;
        }
        .be-live-mark {
          background: var(--be-accent-bg, #eef2ff);
          color: var(--be-accent, #8B5CF6);
          border-radius: 3px;
          padding: 0 2px;
        }
        .be-search-hl {
          background: var(--be-search-hl-bg, #e8e4ff);
          color: var(--be-search-hl-color, inherit);
          border-radius: 2px;
        }
        .be-selection-toolbar button:active { transform: scale(0.94); }
        .be-turn-into-menu { margin-left: -4px; }
        .be-turn-into-menu::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 0;
          bottom: 0;
          width: 16px;
        }
      `}</style>
      <div
        className="be-editor-root be-document"
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
          '--be-block-hover-bg': colors.blockHoverBg ?? 'rgba(139,92,246,0.015)',
        } as CSSProperties}
      >
      <BlockEditorInner
        blocks={blocks} onChange={onChange} colors={colors}
        readOnly={readOnly} searchQuery={searchQuery} depth={0}
        wikiTargets={wikiTargets}
        onWikiNavigate={onWikiNavigate}
        onActiveBlockChange={onActiveBlockChange}
        externalFocusId={externalFocusId}
        onExternalFocusConsumed={onExternalFocusConsumed}
      />
      </div>
      {!readOnly && (
        <div style={{ minHeight:80, cursor:'text', paddingLeft:44 }}
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

/** readOnly 프리뷰 — undo/history 없이 body → Block[] 1회 파싱만 수행 */
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

/** NoteView에서 ref로 호출하는 BlockEditor API */
export interface BlockEditorHandle {
  /** src가 있으면 채워진 이미지 블록, 없으면 빈 블록(업로드/URL UI) */
  insertImage: (src?: string, alt?: string) => void;
  insertEmptyImageBlock: () => void;
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

  const activeBlockIdRef = useRef<string | null>(null);
  const [externalFocusId, setExternalFocusId] = useState<string | null>(null);

  const setActiveBlockId = useCallback((id: string | null) => {
    activeBlockIdRef.current = id;
  }, []);

  const insertImage = useCallback((src: string = '', alt: string = '') => {
    const { blocks: next, imageId } = insertImageAfter(blocks, activeBlockIdRef.current, src, alt);
    handleBlockChange(next);
    activeBlockIdRef.current = imageId;
    setExternalFocusId(imageId);
  }, [blocks, handleBlockChange]);

  const insertEmptyImageBlock = useCallback(() => insertImage('', ''), [insertImage]);

  const clearExternalFocus = useCallback(() => setExternalFocusId(null), []);

  return {
    blocks, handleBlockChange, undo, redo,
    insertImage, insertEmptyImageBlock, setActiveBlockId, externalFocusId, clearExternalFocus,
  };
}

declare global {
  interface Window {
    katex?: { renderToString: (expr: string, opts?: object) => string };
  }
}
