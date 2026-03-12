import { useState, useMemo, useCallback, useRef, useEffect, ReactNode } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Bold, Italic, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Table, CheckSquare, Eye, Edit3,
  RotateCcw, Hash, Quote, AlertTriangle, Star,
  Tag, Link, AlignLeft, Image as ImageIcon, Save,
  ChevronDown, ChevronRight, GitFork,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

// ── Board 전용 타입 ───────────────────────────────────────────────────
interface Note {
  id: string;
  folderId: string | null;
  title: string;
  body: string;
  updatedAt: number;
  deletedAt: number | null;
}
interface NoteFolder {
  id: string;
  name: string;
  createdAt: number;
}

// ── Board 전용 localStorage ──────────────────────────────────────────
const LS_NOTES   = 'board-notes-v1';
const LS_FOLDERS = 'board-folders-v1';
const LS_ACTIVE  = 'board-active-v1';

function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; }
  catch { return fallback; }
}
function saveLS(key: string, val: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}

const INIT_FOLDERS: NoteFolder[] = [];
const INIT_NOTES: Note[] = [];

// ── KaTeX ─────────────────────────────────────────────────────────────
declare global {
  interface Window {
    katex?: { renderToString: (expr: string, opts?: object) => string };
  }
}
function useKaTeX(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.katex) { setReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

// ── 타입 ─────────────────────────────────────────────────────────────
interface TocItem { level: number; text: string; line: number; collapsed: boolean; }
interface ToolbarItem { icon: ReactNode; label: string; fn: () => void; }

// ── 마크다운 파서 ──────────────────────────────────────────────────────
function parseMarkdown(md: string, allNotes: Note[]): string {
  if (!md) return '';
  const mathBlocks: string[] = [];
  let text = md
    .replace(/\$\$[\s\S]+?\$\$/g, m => { mathBlocks.push(m); return `%%M${mathBlocks.length - 1}%%`; })
    .replace(/\$[^$\n]+\$/g,      m => { mathBlocks.push(m); return `%%M${mathBlocks.length - 1}%%`; });

  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[\[(.+?)\]\]/g, (_, t: string) => {
      const f = allNotes.find(n => n.title === t && !n.deletedAt);
      return f ? `<span class="bwl" data-id="${f.id}">[[${t}]]</span>`
               : `<span class="bwlm">[[${t}]]</span>`;
    })
    .replace(/(^|\s)#([\w\uAC00-\uD7A3]+)/g, (_: string, sp: string, tag: string) =>
      `${sp}<span class="bwtag" data-tag="${tag}">#${tag}</span>`)
    .replace(/!\[([^\]]*)\]\((data:[^)]+)\)/g, (_: string, alt: string, src: string) =>
      `<img class="bimg" src="${src}" alt="${alt}"/>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_: string, alt: string, src: string) =>
      `<img class="bimg" src="${src}" alt="${alt}"/>`)
    .replace(/^### (.+)$/gm, '<h3 class="bh3">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="bh2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="bh1">$1</h1>')
    .replace(/```[\w]*\n([\s\S]*?)```/gm, (_: string, code: string) =>
      `<pre class="bpre"><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g,        '<code class="bcode">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,    '<strong class="bbold">$1</strong>')
    .replace(/\*(.+?)\*/g,        '<em class="bital">$1</em>')
    .replace(/~~(.+?)~~/g,        '<del>$1</del>')
    .replace(/==(.+?)==/g,        '<mark class="bhl">$1</mark>')
    .replace(/^- \[x\] (.+)$/gm,  '<div class="bchk done">✓ $1</div>')
    .replace(/^- \[ \] (.+)$/gm,  '<div class="bchk">☐ $1</div>')
    .replace(/^(\d+)\. (.+)$/gm,  '<li class="bol">$2</li>')
    .replace(/^[-*] (.+)$/gm,     '<li class="bul">$1</li>')
    .replace(/^&gt; (.+)$/gm,     '<blockquote class="bquote">$1</blockquote>')
    .replace(/^---$/gm,           '<hr class="bhr"/>')
    .replace(/\n\n/g, '</p><p class="bpara">')
    .replace(/\n/g,   '<br/>');

  html = html.replace(/%%M(\d+)%%/g, (_, idx: string) => {
    const m = mathBlocks[Number(idx)];
    if (!window.katex) return `<code>${m}</code>`;
    const isBlock = m.startsWith('$$');
    const expr = m.replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();
    try {
      return isBlock
        ? `<span class="bmathb">${window.katex.renderToString(expr, { displayMode: true,  throwOnError: false })}</span>`
        : `<span class="bmathi">${window.katex.renderToString(expr, { displayMode: false, throwOnError: false })}</span>`;
    } catch { return `<code class="bmerr">${m}</code>`; }
  });
  return `<div class="broot"><p class="bpara">${html}</p></div>`;
}

// ── 목차 추출 ─────────────────────────────────────────────────────────
function extractTOC(body: string): TocItem[] {
  return body.split('\n')
    .map((line, i) => {
      const m = line.match(/^(#{1,3}) (.+)$/);
      return m ? { level: m[1].length, text: m[2], line: i, collapsed: false } : null;
    })
    .filter((x): x is TocItem => x !== null);
}

// ── 태그 추출 ─────────────────────────────────────────────────────────
function extractTags(body: string): string[] {
  return [...new Set(
    (body.match(/(^|\s)#([\w\uAC00-\uD7A3]+)/g) || []).map(m => m.trim().replace('#', ''))
  )];
}

// ── 링크 추출 ─────────────────────────────────────────────────────────
function extractLinks(body: string): string[] {
  return [...(body.matchAll(/\[\[(.+?)\]\]/g))].map(m => m[1]);
}

// ── 그래프 뷰 컴포넌트 ───────────────────────────────────────────────
interface GraphNode { id: string; title: string; x: number; y: number; links: number; }
interface GraphEdge { from: string; to: string; }

function GraphView({
  notes, activeNoteId, onSelect, dark,
}: {
  notes: Note[]; activeNoteId: string | null; onSelect: (id: string) => void; dark: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [nodePos, setNodePos] = useState<Record<string, { x: number; y: number }>>({});
  const dragOffset = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = notes.filter(n => !n.deletedAt);

  // 링크 맵 구축
  const { nodes, edges } = useMemo<{ nodes: GraphNode[]; edges: GraphEdge[] }>(() => {
    const titleToId: Record<string, string> = {};
    visible.forEach(n => { titleToId[n.title] = n.id; });

    const linkCount: Record<string, number> = {};
    const edgeSet = new Set<string>();
    const edgeList: GraphEdge[] = [];

    visible.forEach(n => {
      extractLinks(n.body).forEach(title => {
        const toId = titleToId[title];
        if (!toId) return;
        const key = [n.id, toId].sort().join('→');
        if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push({ from: n.id, to: toId }); }
        linkCount[n.id]  = (linkCount[n.id]  || 0) + 1;
        linkCount[toId]  = (linkCount[toId]   || 0) + 1;
      });
    });

    // Force-layout 초기 위치 (원형 배치)
    const cx = size.w / 2, cy = size.h / 2;
    const r  = Math.min(size.w, size.h) * 0.35;
    const ns: GraphNode[] = visible.map((n, i) => {
      const angle = (2 * Math.PI * i) / visible.length - Math.PI / 2;
      return {
        id: n.id, title: n.title,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        links: linkCount[n.id] || 0,
      };
    });
    return { nodes: ns, edges: edgeList };
  }, [visible.length, visible.map(n => n.id + n.title).join(), size.w, size.h]);

  // 실제 위치 = nodePos override 또는 초기 계산값
  const getPos = (id: string, node: GraphNode) =>
    nodePos[id] ? nodePos[id] : { x: node.x, y: node.y };

  // 드래그
  const onMouseDown = (e: React.MouseEvent, id: string) => {
    const pos = getPos(id, nodes.find(n => n.id === id)!);
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragging(id);
    e.preventDefault();
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setNodePos(prev => ({
        ...prev,
        [dragging]: { x: e.clientX - dragOffset.current.dx, y: e.clientY - dragOffset.current.dy },
      }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const bg    = dark ? '#18181A' : '#F8F9FA';
  const edge  = dark ? '#D1D5DB30' : '#CBD5E130';
  const edgeA = dark ? '#6B7280'   : '#9CA3AF';
  const nodeC = dark ? '#2C2C2E'   : '#FFFFFF';
  const nodeB = dark ? '#4B5563'   : '#E5E7EB';
  const txtC  = dark ? '#E5E7EB'   : '#1F2937';
  const actC  = dark ? '#FACC15'   : '#2563EB';
  const hovC  = dark ? '#FDE04740' : '#DBEAFE';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: bg }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={edgeA}/>
          </marker>
        </defs>
        {/* edges */}
        {edges.map((e, i) => {
          const fn = nodes.find(n => n.id === e.from); const tn = nodes.find(n => n.id === e.to);
          if (!fn || !tn) return null;
          const fp = getPos(fn.id, fn), tp = getPos(tn.id, tn);
          const isActive = e.from === activeNoteId || e.to === activeNoteId;
          return (
            <line key={i} x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
              stroke={isActive ? actC : edgeA} strokeWidth={isActive ? 1.5 : 1}
              strokeOpacity={isActive ? 0.8 : 0.4} markerEnd="url(#arr)"/>
          );
        })}
        {/* nodes */}
        {nodes.map(node => {
          const pos   = getPos(node.id, node);
          const r     = 6 + Math.min(node.links * 2, 10);
          const isAct = node.id === activeNoteId;
          const isHov = node.id === hovered;
          const label = node.title.length > 14 ? node.title.slice(0, 13) + '…' : node.title;
          return (
            <g key={node.id} style={{ cursor: 'pointer' }}
              onClick={() => onSelect(node.id)}
              onMouseDown={e => onMouseDown(e, node.id)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}>
              {isHov && <circle cx={pos.x} cy={pos.y} r={r + 5} fill={hovC}/>}
              <circle cx={pos.x} cy={pos.y} r={r}
                fill={isAct ? actC : nodeC}
                stroke={isAct ? actC : (isHov ? actC : nodeB)}
                strokeWidth={isAct ? 0 : 1.5}/>
              <text x={pos.x} y={pos.y + r + 13} textAnchor="middle"
                fontSize="10" fill={isAct ? actC : txtC} fontWeight={isAct ? '700' : '400'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 10,
        color: dark ? '#555' : '#9CA3AF' }}>
        {visible.length} notes · {edges.length} links · drag to reposition
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export const WikiView = () => {
  const katexReady = useKaTeX();

  // ── appSettings만 스토어에서 (다크모드 동기화) ──────────────────
  const { appSettings } = useAppStore();
  const dark = appSettings.darkMode;

  // ── Board 전용 상태 ─────────────────────────────────────────────
  const [notes,   setNotes]   = useState<Note[]>(      () => loadLS<Note[]>(LS_NOTES, INIT_NOTES));
  const [folders, setFolders] = useState<NoteFolder[]>(() => loadLS<NoteFolder[]>(LS_FOLDERS, INIT_FOLDERS));
  const [activeNoteId,   setActiveNoteIdRaw]   = useState<string | null>(() => loadLS<string | null>(LS_ACTIVE, null));
  const [activeFolderId, setActiveFolderId]     = useState<string | null>(null);

  const setActiveNoteId = (id: string | null) => {
    setActiveNoteIdRaw(id);
    saveLS(LS_ACTIVE, id);
  };

  // ── Board CRUD ──────────────────────────────────────────────────
  const createNote = useCallback(() => {
    const id = `bn-${Date.now()}`;
    const fid = (activeFolderId && activeFolderId !== 'trash') ? activeFolderId : null;
    const note: Note = { id, folderId: fid, title: 'New Note', body: '', updatedAt: Date.now(), deletedAt: null };
    setNotes(prev => { const next = [note, ...prev]; saveLS(LS_NOTES, next); return next; });
    setActiveNoteId(id);
  }, [activeFolderId]);

  const moveNoteToTrash = useCallback((id: string) => {
    setNotes(prev => { const next = prev.map(n => n.id === id ? { ...n, deletedAt: Date.now() } : n); saveLS(LS_NOTES, next); return next; });
    setActiveNoteId(null);
  }, []);

  const restoreNote = useCallback((id: string) => {
    setNotes(prev => { const next = prev.map(n => n.id === id ? { ...n, deletedAt: null, updatedAt: Date.now() } : n); saveLS(LS_NOTES, next); return next; });
    setActiveNoteId(id);
  }, []);

  const permanentDeleteNote = useCallback((id: string) => {
    setNotes(prev => { const next = prev.filter(n => n.id !== id); saveLS(LS_NOTES, next); return next; });
    setActiveNoteId(null);
  }, []);

  const createFolder = useCallback((name: string) => {
    const id = `bf-${Date.now()}`;
    setFolders(prev => { const next = [...prev, { id, name, createdAt: Date.now() }]; saveLS(LS_FOLDERS, next); return next; });
    setActiveFolderId(id);
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders(prev => { const next = prev.filter(f => f.id !== id); saveLS(LS_FOLDERS, next); return next; });
    setNotes(prev => { const next = prev.map(n => n.folderId === id ? { ...n, folderId: null } : n); saveLS(LS_NOTES, next); return next; });
    if (activeFolderId === id) setActiveFolderId(null);
  }, [activeFolderId]);

  // ── UI 상태 ─────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  const [viewMode,       setViewMode]       = useState<'edit' | 'split' | 'preview' | 'graph'>('split');
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const [activeTag,      setActiveTag]      = useState<string | null>(null);
  const [rightPanel,     setRightPanel]     = useState<'toc' | 'links' | 'tags'>('toc');
  const [savedAt,        setSavedAt]        = useState<Date | null>(null);
  const [tocCollapsed,   setTocCollapsed]   = useState<Record<number, boolean>>({});

  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteUpdate = useCallback((id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => {
    setNotes(prev => { const next = prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n); saveLS(LS_NOTES, next); return next; });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedAt(new Date()), 600);
  }, []);

  // ── 필터링 ──────────────────────────────────────────────────────
  const visibleNotes = useMemo(() => {
    let list: Note[] =
      activeFolderId === 'trash'   ? notes.filter(n => n.deletedAt) :
      activeFolderId === 'starred' ? notes.filter(n => !n.deletedAt) : // starred 없으면 전체
      activeFolderId               ? notes.filter(n => n.folderId === activeFolderId && !n.deletedAt) :
                                     notes.filter(n => !n.deletedAt);
    if (activeTag)          list = list.filter(n => extractTags(n.body).includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }
    return list;
  }, [notes, activeFolderId, searchQuery, activeTag]);

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  const toc = useMemo(() => activeNote ? extractTOC(activeNote.body) : [], [activeNote?.body]);

  // TOC 접기 - 해당 heading 아래 낮은 레벨 모두 collapse
  const toggleTocCollapse = (idx: number) => {
    setTocCollapsed(prev => ({ ...prev, [idx]: !prev[idx] }));
  };
  const visibleToc = useMemo(() => {
    const result: (TocItem & { idx: number; hasChildren: boolean })[] = [];
    const collapsedLevels = new Set<number>();
    toc.forEach((item, idx) => {
      // 상위 헤딩 중 collapse된 것 있으면 숨김
      let hidden = false;
      for (const lvl of collapsedLevels) {
        if (item.level > lvl) { hidden = true; break; }
      }
      if (hidden) return;
      // 이 헤딩이 collapsed면 하위 레벨 숨김 등록
      if (tocCollapsed[idx]) collapsedLevels.add(item.level);
      else collapsedLevels.delete(item.level);
      const hasChildren = toc.slice(idx + 1).some(t => t.level > item.level);
      result.push({ ...item, idx, hasChildren });
    });
    return result;
  }, [toc, tocCollapsed]);

  const backlinks = useMemo(() =>
    activeNote ? notes.filter(n => n.id !== activeNote.id && !n.deletedAt && n.body.includes(`[[${activeNote.title}]]`)) : [],
    [notes, activeNote]
  );
  const allTags = useMemo(() => {
    const m: Record<string, number> = {};
    notes.filter(n => !n.deletedAt).forEach(n =>
      extractTags(n.body).forEach(t => { m[t] = (m[t] || 0) + 1; })
    );
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [notes]);
  const noteTags = activeNote ? extractTags(activeNote.body) : [];

  // ── 폴더 ────────────────────────────────────────────────────────
  const addFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName(''); setShowFolderForm(false);
  };

  // ── 텍스트 삽입 ─────────────────────────────────────────────────
  const insert = (before: string, after = '') => {
    const ta = textareaRef.current; if (!ta || !activeNote) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = activeNote.body.substring(s, e);
    noteUpdate(activeNote.id, { body: activeNote.body.substring(0, s) + before + sel + after + activeNote.body.substring(e) });
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); }, 0);
  };

  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => insert(`![${file.name.replace(/\.[^.]+$/, '')}](${ev.target?.result as string})`);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const TOOLBAR: (ToolbarItem | null)[] = [
    { icon: <Heading1 size={13}/>, label: 'H1', fn: () => insert('# ') },
    { icon: <Heading2 size={13}/>, label: 'H2', fn: () => insert('## ') },
    { icon: <Heading3 size={13}/>, label: 'H3', fn: () => insert('### ') },
    null,
    { icon: <Bold size={13}/>,        label: 'Bold',      fn: () => insert('**', '**') },
    { icon: <Italic size={13}/>,      label: 'Italic',    fn: () => insert('*', '*') },
    { icon: <Code size={13}/>,        label: 'Code',      fn: () => insert('`', '`') },
    { icon: <Hash size={13}/>,        label: 'Highlight', fn: () => insert('==', '==') },
    null,
    { icon: <List size={13}/>,        label: 'List',    fn: () => insert('- ') },
    { icon: <ListOrdered size={13}/>, label: 'Numbered', fn: () => insert('1. ') },
    { icon: <CheckSquare size={13}/>, label: 'Checkbox', fn: () => insert('- [ ] ') },
    { icon: <Quote size={13}/>,       label: 'Quote',   fn: () => insert('> ') },
    null,
    { icon: <Table size={13}/>, label: 'Table',     fn: () => insert('\n| Col 1 | Col 2 |\n|-------|-------|\n| val 1 | val 2 |\n') },
    { icon: <Link size={13}/>,  label: 'Wiki Link', fn: () => insert('[[', ']]') },
    { icon: <Tag size={13}/>,   label: 'Tag',       fn: () => insert('#') },
    null,
    { icon: <span style={{ fontSize: 11, fontFamily: 'serif', fontStyle: 'italic', fontWeight: 700 }}>∑</span>, label: 'Inline Math', fn: () => insert('$', '$') },
    { icon: <span style={{ fontSize: 11, fontFamily: 'serif', fontStyle: 'italic', fontWeight: 700 }}>∫</span>, label: 'Block Math',  fn: () => insert('$$\n', '\n$$') },
    null,
    { icon: <ImageIcon size={13}/>, label: 'Insert Image', fn: () => imageInputRef.current?.click() },
  ];

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wl = target.closest('.bwl') as HTMLElement | null;
    if (wl?.dataset.id) { setActiveNoteId(wl.dataset.id); return; }
    const wt = target.closest('.bwtag') as HTMLElement | null;
    if (wt?.dataset.tag) setActiveTag(prev => prev === wt.dataset.tag ? null : (wt.dataset.tag ?? null));
  };

  // ── 색상 테마 ─────────────────────────────────────────────────────
  const c = {
    wrap:      dark ? '#18181A' : '#F1F3F5',
    sidebar:   dark ? '#1C1C1E' : '#FFFFFF',
    sideBdr:   dark ? '#2A2A2C' : '#E5E7EB',
    notelist:  dark ? '#141416' : '#F9FAFB',
    editor:    dark ? '#18181A' : '#FFFFFF',
    toolbar:   dark ? '#1C1C1E' : '#F3F4F6',
    toolBdr:   dark ? '#222'    : '#E5E7EB',
    card:      dark ? '#2C2C2E' : '#FFFFFF',
    cardHov:   dark ? '#323234' : '#F3F4F6',
    cardAct:   dark ? '#3A3A3C' : '#EFF6FF',
    cardActBdr:dark ? '#FACC15' : '#2563EB',
    text:      dark ? '#E8E6E0' : '#1F2937',
    textMuted: dark ? '#6B7280' : '#6B7280',
    textFaint: dark ? '#3A3A3C' : '#D1D5DB',
    accent:    dark ? '#FACC15' : '#2563EB',
    accentBg:  dark ? '#FACC1520' : '#EFF6FF',
    input:     dark ? '#2C2C2E' : '#F9FAFB',
    inputBdr:  dark ? '#3A3A3C' : '#E5E7EB',
    badge:     dark ? '#FACC1520' : '#DBEAFE',
    badgeTxt:  dark ? '#FACC15'  : '#1D4ED8',
    tag:       dark ? '#8B5CF620' : '#F3E8FF',
    tagTxt:    dark ? '#A78BFA'   : '#7C3AED',
    danger:    dark ? '#F87171'   : '#EF4444',
    green:     dark ? '#4ADE80'   : '#16A34A',
    textarea:  dark ? '#18181A'   : '#FFFFFF',
  };

  const trashCount   = notes.filter(n => n.deletedAt).length;
  const isTrash      = activeFolderId === 'trash';

  const folderLabel =
    activeFolderId === null      ? 'All Notes' :
    activeFolderId === 'trash'   ? '🗑 Trash' :
    (() => { const f = folders.find(f => f.id === activeFolderId); return f ? f.name : ''; })();

  const VIEW_MODES: { key: 'edit' | 'split' | 'preview' | 'graph'; icon: ReactNode; label: string }[] = [
    { key: 'edit',    icon: <Edit3 size={11}/>,   label: 'Edit' },
    { key: 'split',   icon: <AlignLeft size={11}/>, label: 'Split' },
    { key: 'preview', icon: <Eye size={11}/>,     label: 'Preview' },
    { key: 'graph',   icon: <GitFork size={11}/>, label: 'Graph' },
  ];
  const RIGHT_PANELS: { key: 'toc' | 'links' | 'tags'; label: string; icon: ReactNode }[] = [
    { key: 'toc',   label: 'Outline', icon: <AlignLeft size={11}/> },
    { key: 'links', label: 'Links',   icon: <Link size={11}/> },
    { key: 'tags',  label: 'Tags',    icon: <Tag size={11}/> },
  ];

  // ── CSS (클래스 접두 b = board) ──────────────────────────────────
  const CSS = `
    .broot{font-size:14px;line-height:1.85;padding:20px 24px}
    .bh1{font-size:20px;font-weight:700;margin:18px 0 8px;border-bottom:1px solid ${c.textFaint};padding-bottom:5px;color:${c.accent}}
    .bh2{font-size:16px;font-weight:700;margin:14px 0 6px;color:${c.text}}
    .bh3{font-size:13px;font-weight:600;margin:10px 0 4px;color:${c.textMuted}}
    .bpara{margin:3px 0}
    .bbold{font-weight:700;color:${c.text}}
    .bital{font-style:italic;color:${c.textMuted}}
    .bhl{background:${dark ? '#FACC1530' : '#FEF08A80'};color:${dark ? '#FACC15' : '#854D0E'};padding:1px 4px;border-radius:3px}
    .bcode{font-family:'JetBrains Mono',monospace;font-size:12px;background:${dark ? '#2C2C2E' : '#F3F4F6'};color:${dark ? '#A8FF78' : '#0F172A'};padding:1px 5px;border-radius:4px}
    .bpre{background:${dark ? '#1C1C1E' : '#F8FAFC'};border:1px solid ${c.sideBdr};border-radius:8px;padding:14px;margin:8px 0;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:12px;color:${dark ? '#A8FF78' : '#0F172A'};white-space:pre}
    .bul,.bol{margin:2px 0 2px 18px}
    .bchk{padding:2px 0;color:${c.textMuted};font-size:13px}
    .bchk.done{color:${c.green};text-decoration:line-through}
    .bquote{border-left:3px solid ${c.accent};padding:6px 14px;margin:10px 0;color:${c.textMuted};font-style:italic;background:${c.accentBg};border-radius:0 6px 6px 0}
    .bhr{border:none;border-top:1px solid ${c.textFaint};margin:14px 0}
    .bimg{max-width:100%;border-radius:8px;margin:8px 0;border:1px solid ${c.sideBdr}}
    table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px}
    th{background:${c.accentBg};color:${c.accent};padding:7px 10px;text-align:left;border:1px solid ${c.sideBdr};font-weight:600}
    td{padding:7px 10px;border:1px solid ${c.sideBdr};color:${c.text}}
    tr:hover td{background:${c.cardHov}}
    .bwl{color:${dark ? '#60A5FA' : '#2563EB'};cursor:pointer;border-bottom:1px solid ${dark ? '#60A5FA40' : '#93C5FD'};padding-bottom:1px}
    .bwl:hover{opacity:.8}
    .bwlm{color:${c.danger};border-bottom:1px dashed ${c.danger}40;padding-bottom:1px}
    .bwtag{color:${c.tagTxt};background:${c.tag};border-radius:4px;padding:1px 6px;font-size:12px;cursor:pointer}
    .bwtag:hover{opacity:.8}
    .bmathb{display:block;overflow-x:auto;padding:10px 0;text-align:center}
    .bmathi{display:inline}
    .bmerr{color:${c.danger};font-size:12px}
    .btbtn{background:none;border:none;color:${c.textMuted};cursor:pointer;padding:4px 6px;border-radius:5px;transition:all .12s;display:flex;align-items:center}
    .btbtn:hover{background:${c.cardHov};color:${c.accent}}
    .bfi{display:flex;align-items:center;gap:7px;padding:6px 11px;cursor:pointer;transition:background .12s;font-size:12px;color:${c.text}}
    .bfi:hover{background:${c.cardHov}}
    .bfi.active{background:${c.accentBg};border-right:2px solid ${c.accent};color:${c.accent}}
    .bni{padding:8px 10px;cursor:pointer;border-bottom:1px solid ${c.sideBdr};transition:background .12s}
    .bni:hover{background:${c.cardHov}}
    .bni.active{background:${c.cardAct};border-left:2px solid ${c.cardActBdr}}
    .bwi{background:${c.input};border:1px solid ${c.inputBdr};color:${c.text};border-radius:7px;padding:6px 10px;font-size:12px;outline:none}
    .bwi:focus{border-color:${c.accent}}
    .bwbg{background:${c.accent};color:${dark ? '#0F0F11' : '#FFFFFF'};border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}
    .bwbg:hover{opacity:.9}
    .bwsi{background:${c.input};border:1px solid ${c.inputBdr};border-radius:16px;padding:6px 10px 6px 28px;font-size:12px;color:${c.text};outline:none;width:100%}
    .bwsi:focus{border-color:${c.accent}80}
    .bseclbl{padding:8px 11px 3px;font-size:10px;color:${c.textFaint};font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .btoc{display:flex;align-items:center;gap:3px;padding:3px 8px;cursor:pointer;font-size:11px;color:${c.textMuted};border-radius:4px;transition:all .12s}
    .btoc:hover{color:${c.accent};background:${c.cardHov}}
    .btpill{background:${c.tag};color:${c.tagTxt};border-radius:999px;font-size:10px;padding:2px 8px;cursor:pointer;border:1px solid transparent}
    .btpill:hover{border-color:${c.tagTxt}60}
    .btpill.active{border-color:${c.tagTxt}}
    .bbl{padding:6px 10px;font-size:12px;color:${dark ? '#60A5FA' : '#2563EB'};cursor:pointer;border-radius:5px}
    .bbl:hover{background:${c.cardHov}}
    .wiki-textarea{width:100%;height:100%;background:${c.textarea};border:none;outline:none;resize:none;color:${c.text};font-size:14px;line-height:1.85;padding:20px 24px;font-family:inherit}
  `;

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.wrap, color: c.text, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      <style>{CSS}</style>
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageInsert}/>

      {/* ── Left Sidebar ── */}
      <div style={{ width: 200, minWidth: 200, background: c.sidebar, borderRight: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: c.accent, letterSpacing: -.3 }}>Board</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: c.textFaint, fontFamily: 'monospace', background: c.accentBg, padding: '1px 5px', borderRadius: 4, color: c.accent }}>β</span>
        </div>
        {/* Search */}
        <div style={{ padding: '7px 9px', borderBottom: `1px solid ${c.sideBdr}`, position: 'relative' }}>
          <Search size={11} style={{ position: 'absolute', left: 17, top: '50%', transform: 'translateY(-50%)', color: c.textMuted }}/>
          <input className="bwsi" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* All Notes */}
          <div className={`bfi ${activeFolderId === null && !activeTag ? 'active' : ''}`}
            onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); }}>
            <span style={{ flex: 1 }}>All Notes</span>
            <span style={{ fontSize: 10, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>
              {notes.filter(n => !n.deletedAt).length}
            </span>
          </div>

          {/* Folders */}
          <div className="bseclbl">Folders</div>
          {folders.map(f => (
            <div key={f.id} className={`bfi ${activeFolderId === f.id ? 'active' : ''}`}
              onClick={() => { setActiveFolderId(f.id); setActiveTag(null); }}
              style={{ gap: 5 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 10, color: c.textMuted }}>
                {notes.filter(n => n.folderId === f.id && !n.deletedAt).length}
              </span>
              <button onClick={e => { e.stopPropagation(); deleteFolder(f.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: '1px 3px', borderRadius: 3, opacity: 0 }}
                className="folder-del"
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                <Trash2 size={10}/>
              </button>
            </div>
          ))}
          {showFolderForm ? (
            <div style={{ padding: '5px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input className="bwi" style={{ width: '100%' }} placeholder="Folder name"
                value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setShowFolderForm(false); }}
                autoFocus/>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="bwbg" style={{ flex: 1, padding: '4px' }} onClick={addFolder}>Add</button>
                <button onClick={() => setShowFolderForm(false)}
                  style={{ flex: 1, background: c.cardHov, border: 'none', borderRadius: 6, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '4px' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bfi" onClick={() => setShowFolderForm(true)} style={{ color: c.textMuted, fontSize: 11 }}>
              <FolderPlus size={11} color={c.textMuted}/>
              <span>New Folder</span>
            </div>
          )}

          {/* Tags */}
          {allTags.length > 0 && (
            <>
              <div className="bseclbl" style={{ marginTop: 4 }}>Tags</div>
              <div style={{ padding: '3px 9px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allTags.map(([tag, count]) => (
                  <span key={tag} className={`btpill ${activeTag === tag ? 'active' : ''}`}
                    onClick={() => setActiveTag(prev => prev === tag ? null : tag)}>
                    #{tag} <span style={{ color: c.textMuted, marginLeft: 2 }}>{count}</span>
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Trash */}
          <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
            <div className={`bfi ${isTrash ? 'active' : ''}`} onClick={() => setActiveFolderId('trash')}>
              <Trash2 size={11} color={isTrash ? c.danger : c.textMuted}/>
              <span style={{ flex: 1, color: isTrash ? c.danger : undefined }}>Trash</span>
              {trashCount > 0 && <span style={{ fontSize: 10, background: `${c.danger}20`, color: c.danger, borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>{trashCount}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Note List ── */}
      <div style={{ width: 200, minWidth: 200, background: c.notelist, borderRight: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '8px 10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${c.sideBdr}` }}>
          <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
            {activeTag ? `#${activeTag}` : folderLabel}
            <span style={{ color: c.textFaint, marginLeft: 4 }}>({visibleNotes.length})</span>
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {activeTag && <button onClick={() => setActiveTag(null)} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }}>✕</button>}
            {!isTrash && (
              <button onClick={() => createNote()} style={{ background: c.accent, border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: dark ? '#0F0F11' : '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                <Plus size={12}/>
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleNotes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
              {isTrash ? 'Trash is empty' : 'No notes'}
            </div>
          ) : visibleNotes.map(n => {
            const folder  = folders.find(f => f.id === n.folderId);
            const tags    = extractTags(n.body).slice(0, 2);
            const preview = n.body.replace(/(^|\s)#[\w\uAC00-\uD7A3]+/g, '').replace(/[#*`[\]=~>$-]/g, '').split('\n').find(l => l.trim()) || '';
            return (
              <div key={n.id} className={`bni ${n.id === activeNoteId ? 'active' : ''}`} onClick={() => setActiveNoteId(n.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: n.id === activeNoteId ? c.accent : c.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.title || 'Untitled'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: c.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{preview}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  {folder && <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 3, padding: '1px 4px' }}>{folder.name}</span>}
                  {tags.map(t => <span key={t} style={{ fontSize: 9, color: c.tagTxt, background: c.tag, borderRadius: 3, padding: '1px 4px' }}>#{t}</span>)}
                  <span style={{ fontSize: 9, color: c.textFaint, marginLeft: 'auto' }}>
                    {new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Editor Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: c.editor }}>
        {activeNote ? (
          <>
            {/* Note Header */}
            <div style={{ padding: '7px 13px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 6, background: c.editor, flexShrink: 0 }}>
              <input value={activeNote.title} readOnly={isTrash}
                onChange={e => noteUpdate(activeNote.id, { title: e.target.value })}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: 15, fontWeight: 700 }}
                placeholder="Title"/>
              {!isTrash && (
                <select value={activeNote.folderId ?? ''} onChange={e => noteUpdate(activeNote.id, { folderId: e.target.value || null })}
                  style={{ background: c.input, border: `1px solid ${c.inputBdr}`, color: c.textMuted, borderRadius: 5, padding: '3px 6px', fontSize: 10, outline: 'none', cursor: 'pointer' }}>
                  <option value="">No Folder</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
              {/* View Mode Toggle */}
              <div style={{ display: 'flex', background: c.toolbar, borderRadius: 7, padding: 2, gap: 1 }}>
                {VIEW_MODES.map(({ key, icon, label }) => (
                  <button key={key} onClick={() => setViewMode(key)} className="btbtn"
                    style={{ padding: '3px 7px', borderRadius: 5, background: viewMode === key ? c.card : 'none', color: viewMode === key ? c.accent : c.textMuted }}>
                    {icon}
                  </button>
                ))}
              </div>
              {isTrash
                ? <button onClick={() => restoreNote(activeNote.id)} className="btbtn" style={{ color: c.green }}><RotateCcw size={12}/></button>
                : <button onClick={() => moveNoteToTrash(activeNote.id)} className="btbtn"><Trash2 size={12}/></button>
              }
            </div>

            {/* Graph View (full area) */}
            {viewMode === 'graph' ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <GraphView notes={notes} activeNoteId={activeNoteId} onSelect={id => { setActiveNoteId(id); setViewMode('split'); }} dark={dark}/>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                {!isTrash && (viewMode === 'edit' || viewMode === 'split') && (
                  <div style={{ padding: '2px 10px', borderBottom: `1px solid ${c.toolBdr}`, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, background: c.toolbar, flexWrap: 'wrap' }}>
                    {TOOLBAR.map((btn, i) =>
                      btn === null
                        ? <div key={i} style={{ width: 1, height: 13, background: c.sideBdr, margin: '0 2px' }}/>
                        : <button key={i} className="btbtn" onClick={btn.fn} title={btn.label}>{btn.icon}</button>
                    )}
                    {savedAt && (
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: c.green, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Save size={9}/> {savedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} saved
                      </span>
                    )}
                  </div>
                )}

                {/* Body */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                  {(viewMode === 'edit' || viewMode === 'split') && (
                    <div style={{ flex: 1, overflow: 'auto', borderRight: viewMode === 'split' ? `1px solid ${c.sideBdr}` : 'none' }}>
                      {isTrash ? (
                        <div style={{ padding: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, color: c.danger, fontSize: 12 }}>
                            <AlertTriangle size={13}/> In Trash — restore to edit
                          </div>
                          <div style={{ color: c.textMuted, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{activeNote.body}</div>
                        </div>
                      ) : (
                        <textarea ref={textareaRef} className="wiki-textarea"
                          value={activeNote.body}
                          onChange={e => noteUpdate(activeNote.id, { body: e.target.value })}
                          placeholder={'# Title\n\n#tag1 #tag2\n\nStart writing...\n\nMath: $a^2+b^2=c^2$\nBlock: $$\\sum_{k=1}^{n}k$$\n\nWiki link: [[Note Title]]'}/>
                      )}
                    </div>
                  )}
                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div style={{ flex: 1, overflow: 'auto', color: c.text }}
                      key={katexReady ? 'ready' : 'loading'}
                      onClick={handlePreviewClick}
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(activeNote.body, notes) }}/>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          // Graph View without active note
          viewMode === 'graph' ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <GraphView notes={notes} activeNoteId={null} onSelect={id => { setActiveNoteId(id); setViewMode('split'); }} dark={dark}/>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: c.textMuted }}>
              <div style={{ fontSize: 32 }}>📋</div>
              <p style={{ fontSize: 13 }}>Select a note or create a new one</p>
              <button className="bwbg" onClick={() => createNote()}>+ New Note</button>
              <button onClick={() => setViewMode('graph')}
                style={{ background: 'none', border: `1px solid ${c.inputBdr}`, borderRadius: 7, padding: '6px 14px', fontSize: 12, color: c.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <GitFork size={12}/> View Graph
              </button>
            </div>
          )
        )}
      </div>

      {/* ── Right Panel ── */}
      {activeNote && viewMode !== 'graph' && (
        <div style={{ width: 190, minWidth: 190, background: c.sidebar, borderLeft: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${c.sideBdr}`, flexShrink: 0 }}>
            {RIGHT_PANELS.map(({ key, label, icon }) => (
              <button key={key} onClick={() => setRightPanel(key)}
                style={{ flex: 1, background: 'none', border: 'none', borderBottom: rightPanel === key ? `2px solid ${c.accent}` : '2px solid transparent', padding: '8px 4px', cursor: 'pointer', color: rightPanel === key ? c.accent : c.textMuted, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Outline (TOC) with collapse */}
          {rightPanel === 'toc' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {visibleToc.length === 0
                ? <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '20px 8px' }}>No headings<br/><span style={{ fontSize: 10 }}># ## ###</span></p>
                : visibleToc.map(item => (
                  <div key={item.idx} className="btoc" style={{ paddingLeft: 8 + (item.level - 1) * 12 }}
                    onClick={() => {
                      if (item.hasChildren) { toggleTocCollapse(item.idx); return; }
                      const ta = textareaRef.current;
                      if (ta && viewMode !== 'preview') {
                        const pos = activeNote.body.split('\n').slice(0, item.line).join('\n').length;
                        ta.focus(); ta.setSelectionRange(pos, pos);
                        ta.scrollTop = (pos / activeNote.body.length) * ta.scrollHeight;
                      }
                    }}>
                    {item.hasChildren
                      ? (tocCollapsed[item.idx]
                          ? <ChevronRight size={9} style={{ flexShrink: 0, color: c.textFaint }}/>
                          : <ChevronDown  size={9} style={{ flexShrink: 0, color: c.textFaint }}/>)
                      : <span style={{ width: 9, display: 'inline-block', flexShrink: 0 }}/>
                    }
                    <span style={{ fontSize: 8, color: item.level === 1 ? c.accent : c.textFaint, marginRight: 2, fontWeight: 700 }}>H{item.level}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                      onClick={e => {
                        if (item.hasChildren) return; // 이미 처리됨
                        e.stopPropagation();
                        const ta = textareaRef.current;
                        if (ta && viewMode !== 'preview') {
                          const pos = activeNote.body.split('\n').slice(0, item.line).join('\n').length;
                          ta.focus(); ta.setSelectionRange(pos, pos);
                        }
                      }}>
                      {item.text}
                    </span>
                  </div>
                ))
              }
            </div>
          )}

          {/* Links */}
          {rightPanel === 'links' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textMuted, fontWeight: 600 }}>Backlinks</div>
              {backlinks.length === 0
                ? <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 8px' }}>No backlinks</p>
                : backlinks.map(n => (
                  <div key={n.id} className="bbl" onClick={() => setActiveNoteId(n.id)}>↗ {n.title}</div>
                ))
              }
              {(() => {
                const outLinks = extractLinks(activeNote.body);
                const found = outLinks.map(t => notes.find(n => n.title === t && !n.deletedAt)).filter((n): n is Note => n !== undefined);
                return found.length > 0 ? (
                  <>
                    <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 600, borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>Outgoing</div>
                    {found.map(n => (
                      <div key={n.id} className="bbl" style={{ color: c.green }} onClick={() => setActiveNoteId(n.id)}>→ {n.title}</div>
                    ))}
                  </>
                ) : null;
              })()}
            </div>
          )}

          {/* Tags */}
          {rightPanel === 'tags' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 8 }}>This note's tags</div>
              {noteTags.length === 0
                ? <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 0' }}>No tags · use #tag</p>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                    {noteTags.map(t => (
                      <span key={t} className={`btpill ${activeTag === t ? 'active' : ''}`}
                        onClick={() => setActiveTag(prev => prev === t ? null : t)}>#{t}</span>
                    ))}
                  </div>
                )
              }
              <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 8, borderTop: `1px solid ${c.sideBdr}`, paddingTop: 10 }}>All Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allTags.map(([tag, count]) => (
                  <span key={tag} className={`btpill ${activeTag === tag ? 'active' : ''}`}
                    onClick={() => setActiveTag(prev => prev === tag ? null : tag)}>
                    #{tag} <span style={{ color: c.textMuted }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Permanent delete for trash */}
          {isTrash && (
            <div style={{ padding: 8, borderTop: `1px solid ${c.sideBdr}`, flexShrink: 0 }}>
              <button onClick={() => permanentDeleteNote(activeNote.id)}
                style={{ width: '100%', background: `${c.danger}15`, border: `1px solid ${c.danger}40`, color: c.danger, borderRadius: 6, padding: '6px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                Delete Permanently
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
