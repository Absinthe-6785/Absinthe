import { useState, useMemo, useCallback, useRef, useEffect, ReactNode } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Bold, Italic, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Table, CheckSquare, Eye, Edit3,
  RotateCcw, Hash, Quote, AlertTriangle, Star,
  Tag, Link, AlignLeft, Image as ImageIcon, Save,
  ChevronDown, ChevronRight, GitFork, Maximize2, Minimize2, Upload, Keyboard,
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
  starred: boolean;
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

// ── 검색어 하이라이트 ─────────────────────────────────────────────────
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bshl">$1</mark>');
}

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

// ── 그래프 뷰 (Force-Directed) ───────────────────────────────────────
interface GraphNode { id: string; title: string; x: number; y: number; vx: number; vy: number; links: number; }
interface GraphEdge { from: string; to: string; }

function GraphView({
  notes, activeNoteId, onSelect, dark,
}: {
  notes: Note[]; activeNoteId: string | null; onSelect: (id: string) => void; dark: boolean;
}) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const frameRef  = useRef<number>(0);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // nodes/edges는 ref로 관리 (애니메이션 루프에서 직접 변경)
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [tick, setTick] = useState(0); // 렌더 트리거

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

  const visible = useMemo(() => notes.filter(n => !n.deletedAt), [notes]);

  // 노트가 바뀌면 그래프 재초기화
  useEffect(() => {
    const titleToId: Record<string, string> = {};
    visible.forEach(n => { titleToId[n.title] = n.id; });

    const linkCount: Record<string, number> = {};
    const edgeSet = new Set<string>();
    const edgeList: GraphEdge[] = [];
    visible.forEach(n => {
      extractLinks(n.body).forEach(title => {
        const toId = titleToId[title];
        if (!toId) return;
        const key = [n.id, toId].sort().join('|');
        if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push({ from: n.id, to: toId }); }
        linkCount[n.id] = (linkCount[n.id] || 0) + 1;
        linkCount[toId] = (linkCount[toId] || 0) + 1;
      });
    });
    edgesRef.current = edgeList;

    // 기존 위치 보존하면서 새 노트만 랜덤 배치
    const existing = Object.fromEntries(nodesRef.current.map(n => [n.id, n]));
    const cx = size.w / 2, cy = size.h / 2;
    nodesRef.current = visible.map(n => existing[n.id] ?? {
      id: n.id, title: n.title,
      x: cx + (Math.random() - 0.5) * 300,
      y: cy + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0, links: linkCount[n.id] || 0,
    });
    // links 카운트 갱신
    nodesRef.current.forEach(nd => { nd.links = linkCount[nd.id] || 0; nd.title = visible.find(n => n.id === nd.id)?.title ?? nd.title; });
  }, [visible.map(n => n.id).join(), size.w, size.h]);

  // Force-directed 애니메이션 루프
  useEffect(() => {
    let alpha = 1.0;
    const REPEL = 3000, ATTRACT = 0.05, CENTER = 0.008, DAMPING = 0.85, LINK_DIST = 130;

    const step = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (ns.length === 0 || alpha < 0.005) { setTick(t => t + 1); return; }

      alpha *= 0.97;

      // repulsion between all nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y;
          const dist2 = dx * dx + dy * dy + 1;
          const force = REPEL / dist2;
          const fx = force * dx / Math.sqrt(dist2), fy = force * dy / Math.sqrt(dist2);
          ns[i].vx -= fx; ns[i].vy -= fy;
          ns[j].vx += fx; ns[j].vy += fy;
        }
      }
      // attraction along edges
      es.forEach(e => {
        const a = ns.find(n => n.id === e.from), b = ns.find(n => n.id === e.to);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - LINK_DIST) * ATTRACT;
        const fx = force * dx / dist, fy = force * dy / dist;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });
      // center gravity
      const cx = size.w / 2, cy = size.h / 2;
      ns.forEach(n => {
        n.vx += (cx - n.x) * CENTER;
        n.vy += (cy - n.y) * CENTER;
      });
      // integrate (skip dragged node)
      ns.forEach(n => {
        if (n.id === dragging) return;
        n.vx *= DAMPING; n.vy *= DAMPING;
        n.x  += n.vx * alpha;
        n.y  += n.vy * alpha;
        // boundary
        n.x = Math.max(30, Math.min(size.w - 30, n.x));
        n.y = Math.max(30, Math.min(size.h - 30, n.y));
      });
      setTick(t => t + 1);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [visible.map(n => n.id).join(), size.w, size.h, dragging]);

  // 드래그
  const onMouseDown = (e: React.MouseEvent, id: string) => {
    const nd = nodesRef.current.find(n => n.id === id);
    if (!nd) return;
    dragOffset.current = { dx: e.clientX - nd.x, dy: e.clientY - nd.y };
    setDragging(id);
    e.preventDefault();
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const nd = nodesRef.current.find(n => n.id === dragging);
      if (!nd) return;
      nd.x = e.clientX - dragOffset.current.dx;
      nd.y = e.clientY - dragOffset.current.dy;
      nd.vx = 0; nd.vy = 0;
      setTick(t => t + 1);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const bg    = dark ? '#18181A' : '#F8F9FA';
  const edgeC = dark ? '#6B7280' : '#9CA3AF';
  const nodeC = dark ? '#2C2C2E' : '#FFFFFF';
  const nodeB = dark ? '#4B5563' : '#E5E7EB';
  const txtC  = dark ? '#E5E7EB' : '#374151';
  const actC  = dark ? '#FACC15' : '#2563EB';
  const hovBg = dark ? '#FACC1425' : '#DBEAFE';

  const ns = nodesRef.current;
  const es = edgesRef.current;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: bg }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <marker id="garr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={edgeC}/>
          </marker>
        </defs>
        {es.map((e, i) => {
          const a = ns.find(n => n.id === e.from), b = ns.find(n => n.id === e.to);
          if (!a || !b) return null;
          const isAct = e.from === activeNoteId || e.to === activeNoteId;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={isAct ? actC : edgeC} strokeWidth={isAct ? 1.5 : 1}
            strokeOpacity={isAct ? 0.9 : 0.45} markerEnd="url(#garr)"/>;
        })}
        {ns.map(node => {
          const r     = 7 + Math.min(node.links * 2, 10);
          const isAct = node.id === activeNoteId;
          const isHov = node.id === hovered;
          const label = node.title.length > 16 ? node.title.slice(0, 15) + '…' : node.title;
          return (
            <g key={node.id} style={{ cursor: 'pointer' }}
              onClick={() => onSelect(node.id)}
              onMouseDown={e => onMouseDown(e, node.id)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}>
              {isHov && <circle cx={node.x} cy={node.y} r={r + 6} fill={hovBg}/>}
              <circle cx={node.x} cy={node.y} r={r}
                fill={isAct ? actC : nodeC}
                stroke={isAct || isHov ? actC : nodeB} strokeWidth={1.5}/>
              {node.starred && <text x={node.x + r - 2} y={node.y - r + 4} fontSize="9" textAnchor="middle" style={{ pointerEvents: 'none' }}>★</text>}
              <text x={node.x} y={node.y + r + 14} textAnchor="middle"
                fontSize="10" fill={isAct ? actC : txtC} fontWeight={isAct ? '700' : '400'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: dark ? '#444' : '#9CA3AF' }}>
        {ns.length} notes · {es.length} links · drag nodes to reposition
      </div>
      {activeNoteId && (
        <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 10, color: actC, fontWeight: 600 }}>
          {ns.find(n => n.id === activeNoteId)?.title}
        </div>
      )}
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
    const note: Note = { id, folderId: fid, title: 'New Note', body: '', updatedAt: Date.now(), deletedAt: null, starred: false };
    setNotes(prev => { const next = [note, ...prev]; saveLS(LS_NOTES, next); return next; });
    setActiveNoteId(id);
  }, [activeFolderId]);

  const toggleStar = useCallback((id: string) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n);
      saveLS(LS_NOTES, next);
      return next;
    });
  }, []);

  const exportNote = useCallback((note: Note) => {
    const blob = new Blob([note.body], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-') || 'untitled'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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

  const duplicateNote = useCallback((note: Note) => {
    const id = `bn-${Date.now()}`;
    const copy: Note = { ...note, id, title: note.title + ' (copy)', updatedAt: Date.now(), deletedAt: null };
    setNotes(prev => { const next = [copy, ...prev]; saveLS(LS_NOTES, next); return next; });
    setActiveNoteId(id);
  }, []);

  // ── UI 상태 ─────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  const [viewMode,       setViewMode]       = useState<'edit' | 'split' | 'preview' | 'graph'>('split');
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const [activeTag,      setActiveTag]      = useState<string | null>(null);
  const [rightPanel,     setRightPanel]     = useState<'toc' | 'links' | 'tags' | 'stats'>('toc');
  const [savedAt,        setSavedAt]        = useState<Date | null>(null);
  const [tocCollapsed,   setTocCollapsed]   = useState<Record<number, boolean>>({});
  const [focusMode,      setFocusMode]      = useState(false);
  const [showShortcuts,  setShowShortcuts]  = useState(false);
  const [sortOrder,      setSortOrder]      = useState<'updated' | 'title' | 'created'>('updated');
  const [showSortMenu,   setShowSortMenu]   = useState(false);
  const [dragNoteId,     setDragNoteId]     = useState<string | null>(null);
  // [[ 자동완성
  const [acQuery,  setAcQuery]  = useState('');
  const [acIndex,  setAcIndex]  = useState(0);
  const [acVisible,setAcVisible]= useState(false);
  const [acPos,    setAcPos]    = useState({ top: 0, left: 0 });

  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const importInputRef= useRef<HTMLInputElement>(null);
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteUpdate = useCallback((id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred'>>) => {
    setNotes(prev => { const next = prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n); saveLS(LS_NOTES, next); return next; });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedAt(new Date()), 600);
  }, []);

  // ── 필터링 ──────────────────────────────────────────────────────
  const visibleNotes = useMemo(() => {
    let list: Note[] =
      activeFolderId === 'trash'   ? notes.filter(n => n.deletedAt) :
      activeFolderId === 'starred' ? notes.filter(n => n.starred && !n.deletedAt) :
      activeFolderId               ? notes.filter(n => n.folderId === activeFolderId && !n.deletedAt) :
                                     notes.filter(n => !n.deletedAt);
    if (activeTag)          list = list.filter(n => extractTags(n.body).includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }
    // 정렬
    list = [...list].sort((a, b) => {
      if (sortOrder === 'title')   return (a.title || '').localeCompare(b.title || '');
      if (sortOrder === 'created') return Number(a.id.split('-')[1] || 0) - Number(b.id.split('-')[1] || 0);
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [notes, activeFolderId, searchQuery, activeTag, sortOrder]);

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

  // ── .md 파일 Import ─────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const body = ev.target?.result as string;
        const title = file.name.replace(/\.md$/i, '');
        const id = `bn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const fid = (activeFolderId && activeFolderId !== 'trash') ? activeFolderId : null;
        const note: Note = { id, folderId: fid, title, body, updatedAt: Date.now(), deletedAt: null, starred: false };
        setNotes(prev => { const next = [note, ...prev]; saveLS(LS_NOTES, next); return next; });
        setActiveNoteId(id);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  // ── [[ 자동완성 ─────────────────────────────────────────────────
  const acCandidates = useMemo(() => {
    if (!acQuery) return [];
    const q = acQuery.toLowerCase();
    return notes.filter(n => !n.deletedAt && n.title.toLowerCase().includes(q)).slice(0, 8);
  }, [notes, acQuery]);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeNote) return;
    const val = e.target.value;
    noteUpdate(activeNote.id, { body: val });
    // [[ 감지
    const pos = e.target.selectionStart;
    const before = val.slice(0, pos);
    const match = before.match(/\[\[([^\]\n]*)$/);
    if (match) {
      setAcQuery(match[1]);
      setAcIndex(0);
      setAcVisible(true);
      // 커서 위치 계산
      const ta = e.target;
      const linesBefore = before.split('\n');
      const lineNum = linesBefore.length - 1;
      const lineH = 24;
      setAcPos({ top: (lineNum + 1) * lineH + 4, left: 180 });
    } else {
      setAcVisible(false);
    }
  };

  const applyAutoComplete = (title: string) => {
    const ta = textareaRef.current; if (!ta || !activeNote) return;
    const pos = ta.selectionStart;
    const body = activeNote.body;
    const before = body.slice(0, pos);
    const match = before.match(/\[\[([^\]\n]*)$/);
    if (!match) return;
    const start = pos - match[0].length;
    const newBody = body.slice(0, start) + `[[${title}]]` + body.slice(pos);
    noteUpdate(activeNote.id, { body: newBody });
    setAcVisible(false);
    setTimeout(() => {
      const newPos = start + title.length + 4;
      ta.focus(); ta.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acVisible) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => Math.min(i + 1, acCandidates.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setAcIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (acCandidates[acIndex]) { e.preventDefault(); applyAutoComplete(acCandidates[acIndex].title); return; }
      }
      if (e.key === 'Escape') { setAcVisible(false); return; }
    }
  };

  // ── 전역 단축키 ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (showSortMenu && e.key === 'Escape') { setShowSortMenu(false); return; }
      if (!mod) return;
      switch (e.key) {
        case 'n': e.preventDefault(); createNote(); break;
        case 'd': e.preventDefault(); { const n = notes.find(x => x.id === activeNoteId); if (n) duplicateNote(n); } break;
        case 'e': e.preventDefault(); setViewMode(v => v === 'preview' ? 'split' : 'preview'); break;
        case 'g': e.preventDefault(); setViewMode(v => v === 'graph' ? 'split' : 'graph'); break;
        case 'f': e.preventDefault(); setFocusMode(v => !v); break;
        case '/': e.preventDefault(); setShowShortcuts(v => !v); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createNote, duplicateNote, notes, activeNoteId, showSortMenu]);

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
    { icon: <Upload size={13}/>,    label: 'Import .md',   fn: () => importInputRef.current?.click() },
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
  const starredCount = notes.filter(n => n.starred && !n.deletedAt).length;
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
  const RIGHT_PANELS: { key: 'toc' | 'links' | 'tags' | 'stats'; label: string; icon: ReactNode }[] = [
    { key: 'toc',   label: 'Outline', icon: <AlignLeft size={11}/> },
    { key: 'links', label: 'Links',   icon: <Link size={11}/> },
    { key: 'tags',  label: 'Tags',    icon: <Tag size={11}/> },
    { key: 'stats', label: 'Stats',   icon: <span style={{ fontSize: 10, fontWeight: 700 }}>#</span> },
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
    .bshl{background:${dark ? '#FACC1550' : '#FEF08A'};color:${dark ? '#FACC15' : '#854D0E'};border-radius:2px;padding:0 1px}
    .bac-item{padding:7px 12px;font-size:13px;cursor:pointer;border-radius:5px;transition:background .1s;color:${c.text}}
    .bac-item:hover,.bac-item.active{background:${c.accentBg};color:${c.accent}}
    .bsc-row{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid ${c.sideBdr};font-size:13px}
    .bsc-key{background:${c.toolbar};border:1px solid ${c.toolBdr};border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace;color:${c.text}}
    .focus-overlay{position:fixed;inset:0;background:${dark ? '#000' : '#fff'};opacity:.92;z-index:98;pointer-events:none}
    .bsort-menu{position:absolute;top:30px;right:0;background:${c.card};border:1px solid ${c.sideBdr};border-radius:8px;box-shadow:0 4px 16px #00000020;z-index:100;overflow:hidden;min-width:120px}
    .bsort-item{padding:7px 12px;font-size:12px;cursor:pointer;color:${c.text};display:flex;align-items:center;gap:6px}
    .bsort-item:hover{background:${c.cardHov}}
    .bsort-item.active{color:${c.accent};font-weight:600}
    .bstat-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${c.sideBdr}40;font-size:12px}
    .bstat-val{font-weight:700;color:${c.accent}}
    .btag-cloud span{display:inline-block;border-radius:999px;cursor:pointer;transition:all .1s}
    .btag-cloud span:hover{opacity:.8}
    .bdrag-over{background:${c.accentBg} !important;border:1px dashed ${c.accent} !important}
    .bnote-drag{opacity:.4}
  `;

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.wrap, color: c.text, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>
      <input ref={imageInputRef}  type="file" accept="image/*"  style={{ display: 'none' }} onChange={handleImageInsert}/>
      <input ref={importInputRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={handleImport} multiple/>

      {/* ── 포커스 모드 오버레이 ── */}
      {focusMode && <div className="focus-overlay" onClick={() => setFocusMode(false)}/>}

      {/* ── 단축키 모달 ── */}
      {showShortcuts && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowShortcuts(false)}>
          <div style={{ background: c.card, borderRadius: 12, padding: '20px 24px', width: 340, boxShadow: '0 8px 32px #00000030' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: c.text }}>Keyboard Shortcuts</div>
            {[
              ['Ctrl + N',   'New Note'],
              ['Ctrl + D',   'Duplicate Note'],
              ['Ctrl + E',   'Toggle Preview'],
              ['Ctrl + G',   'Toggle Graph View'],
              ['Ctrl + F',   'Focus Mode'],
              ['Ctrl + /',   'Show Shortcuts'],
              ['[[...]]',    'Wiki link autocomplete'],
              ['↑ ↓ Enter',  'Navigate autocomplete'],
              ['Esc',        'Close autocomplete / modal'],
            ].map(([key, desc]) => (
              <div key={key} className="bsc-row">
                <span style={{ color: c.textMuted }}>{desc}</span>
                <span className="bsc-key">{key}</span>
              </div>
            ))}
            <button onClick={() => setShowShortcuts(false)}
              style={{ marginTop: 14, width: '100%', background: c.accentBg, border: 'none', borderRadius: 7, padding: '8px', color: c.accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Left Sidebar ── */}
      <div style={{ width: focusMode ? 0 : 200, minWidth: focusMode ? 0 : 200, overflow: 'hidden', background: c.sidebar, borderRight: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .2s, min-width .2s', zIndex: 99 }}>
        {/* Header */}
        <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: c.accent, letterSpacing: -.3 }}>Board</span>
          <span style={{ fontSize: 9, color: c.accent, fontFamily: 'monospace', background: c.accentBg, padding: '1px 5px', borderRadius: 4 }}>β</span>
          <button onClick={() => setShowShortcuts(true)} className="btbtn" style={{ marginLeft: 'auto', padding: '2px 4px' }} title="Keyboard Shortcuts (Ctrl+/)">
            <Keyboard size={12}/>
          </button>
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

          {/* Starred */}
          <div className={`bfi ${activeFolderId === 'starred' ? 'active' : ''}`}
            onClick={() => { setActiveFolderId('starred'); setActiveTag(null); }}>
            <Star size={11} color={activeFolderId === 'starred' ? c.accent : c.textMuted} fill={activeFolderId === 'starred' ? c.accent : 'none'}/>
            <span style={{ flex: 1 }}>Starred</span>
            {starredCount > 0 && <span style={{ fontSize: 10, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>{starredCount}</span>}
          </div>

          {/* Folders */}
          <div className="bseclbl">Folders</div>
          {folders.map(f => (
            <div key={f.id} className={`bfi ${activeFolderId === f.id ? 'active' : ''}`}
              onClick={() => { setActiveFolderId(f.id); setActiveTag(null); }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bdrag-over'); }}
              onDragLeave={e => e.currentTarget.classList.remove('bdrag-over')}
              onDrop={e => {
                e.currentTarget.classList.remove('bdrag-over');
                if (dragNoteId) { noteUpdate(dragNoteId, { folderId: f.id }); setDragNoteId(null); }
              }}
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
      <div style={{ width: focusMode ? 0 : 200, minWidth: focusMode ? 0 : 200, overflow: 'hidden', background: c.notelist, borderRight: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .2s, min-width .2s', zIndex: 99 }}>
        <div style={{ padding: '8px 10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${c.sideBdr}` }}>
          <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
            {activeTag ? `#${activeTag}` : folderLabel}
            <span style={{ color: c.textFaint, marginLeft: 4 }}>({visibleNotes.length})</span>
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', position: 'relative' }}>
            {activeTag && <button onClick={() => setActiveTag(null)} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }}>✕</button>}
            {/* 정렬 */}
            <button className="btbtn" style={{ padding: '2px 5px', fontSize: 9, color: c.textMuted }} onClick={() => setShowSortMenu(v => !v)}
              title="Sort">
              {sortOrder === 'updated' ? '⏱' : sortOrder === 'title' ? 'Az' : '📅'}
            </button>
            {showSortMenu && (
              <div className="bsort-menu" onClick={e => e.stopPropagation()}>
                {(['updated', 'title', 'created'] as const).map(s => (
                  <div key={s} className={`bsort-item ${sortOrder === s ? 'active' : ''}`}
                    onClick={() => { setSortOrder(s); setShowSortMenu(false); }}>
                    {s === 'updated' ? '⏱ Last Modified' : s === 'title' ? 'Az Title' : '📅 Created'}
                  </div>
                ))}
              </div>
            )}
            {!isTrash && (
              <button onClick={() => importInputRef.current?.click()} className="btbtn" title="Import .md files">
                <Upload size={11}/>
              </button>
            )}
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
            const rawPreview = n.body.replace(/(^|\s)#[\w\uAC00-\uD7A3]+/g, '').replace(/[#*`[\]=~>$-]/g, '').split('\n').find(l => l.trim()) || '';
            const hlTitle   = searchQuery.trim() ? highlightText(n.title || 'Untitled', searchQuery) : (n.title || 'Untitled');
            const hlPreview = searchQuery.trim() ? highlightText(rawPreview, searchQuery) : rawPreview;
            return (
              <div key={n.id}
                className={`bni ${n.id === activeNoteId ? 'active' : ''} ${dragNoteId === n.id ? 'bnote-drag' : ''}`}
                onClick={() => setActiveNoteId(n.id)}
                draggable={!isTrash}
                onDragStart={() => setDragNoteId(n.id)}
                onDragEnd={() => setDragNoteId(null)}
                title="Drag to folder · Ctrl+D to duplicate"
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateNote(n); } }}
                tabIndex={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  {n.starred && <Star size={9} color={dark ? '#FACC15' : '#F59E0B'} fill={dark ? '#FACC15' : '#F59E0B'} style={{ flexShrink: 0 }}/>}
                  <span style={{ fontSize: 12, fontWeight: 600, color: n.id === activeNoteId ? c.accent : c.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    dangerouslySetInnerHTML={{ __html: hlTitle }}/>
                </div>
                <div style={{ fontSize: 10, color: c.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}
                  dangerouslySetInnerHTML={{ __html: hlPreview }}/>
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
              {/* Star */}
              {!isTrash && (
                <button onClick={() => toggleStar(activeNote.id)} className="btbtn" title={activeNote.starred ? 'Unstar' : 'Star'}>
                  <Star size={13} color={activeNote.starred ? (dark ? '#FACC15' : '#F59E0B') : c.textMuted} fill={activeNote.starred ? (dark ? '#FACC15' : '#F59E0B') : 'none'}/>
                </button>
              )}
              {/* Duplicate */}
              {!isTrash && (
                <button onClick={() => duplicateNote(activeNote)} className="btbtn" title="Duplicate (Ctrl+D)">
                  <span style={{ fontSize: 11 }}>⎘</span>
                </button>
              )}
              {/* Export */}
              <button onClick={() => exportNote(activeNote)} className="btbtn" title="Export as .md">
                <Save size={12}/>
              </button>
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
                        <div style={{ position: 'relative', height: '100%' }}>
                          <textarea ref={textareaRef} className="wiki-textarea"
                            value={activeNote.body}
                            onChange={handleEditorChange}
                            onKeyDown={handleEditorKeyDown}
                            placeholder={'# Title\n\n#tag1 #tag2\n\nStart writing...\n\nMath: $a^2+b^2=c^2$\nBlock: $$\\sum_{k=1}^{n}k$$\n\nWiki link: [[Note Title]]'}/>
                          {/* [[ 자동완성 드롭다운 */}
                          {acVisible && acCandidates.length > 0 && (
                            <div style={{
                              position: 'absolute', top: acPos.top, left: Math.min(acPos.left, 300),
                              background: c.card, border: `1px solid ${c.sideBdr}`, borderRadius: 8,
                              boxShadow: '0 4px 20px #00000025', zIndex: 50, minWidth: 200, maxHeight: 220, overflowY: 'auto',
                            }}>
                              <div style={{ padding: '4px 10px 3px', fontSize: 9, color: c.textFaint, borderBottom: `1px solid ${c.sideBdr}`, fontWeight: 700, letterSpacing: 1 }}>
                                LINK TO NOTE
                              </div>
                              {acCandidates.map((n, i) => (
                                <div key={n.id} className={`bac-item ${i === acIndex ? 'active' : ''}`}
                                  onMouseDown={e => { e.preventDefault(); applyAutoComplete(n.title); }}>
                                  <span style={{ fontSize: 10, color: c.textFaint, marginRight: 6 }}>📄</span>
                                  {n.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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

          {/* Stats */}
          {rightPanel === 'stats' && (() => {
            const body = activeNote.body;
            const words = body.trim() ? body.trim().split(/\s+/).length : 0;
            const chars = body.length;
            const lines = body.split('\n').length;
            const readMin = Math.max(1, Math.ceil(words / 200));
            const linkCount = extractLinks(body).length;
            const tagCount  = extractTags(body).length;
            const headings  = (body.match(/^#{1,3} /gm) || []).length;
            const codeBlocks = (body.match(/```/g) || []).length / 2;
            const created = Number(activeNote.id.split('-')[1] || 0);
            return (
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Note Stats</div>
                {[
                  ['Words', words],
                  ['Characters', chars],
                  ['Lines', lines],
                  ['Read time', `~${readMin} min`],
                  ['Headings', headings],
                  ['Wiki links', linkCount],
                  ['Tags', tagCount],
                  ['Code blocks', Math.floor(codeBlocks)],
                ].map(([label, val]) => (
                  <div key={label as string} className="bstat-row">
                    <span style={{ color: c.textMuted }}>{label}</span>
                    <span className="bstat-val">{val}</span>
                  </div>
                ))}
                {created > 0 && (
                  <div style={{ marginTop: 10, fontSize: 10, color: c.textFaint }}>
                    Created {new Date(created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                {/* 태그 클라우드 */}
                {allTags.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 700, margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Tag Cloud</div>
                    <div className="btag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {allTags.slice(0, 20).map(([tag, count]) => {
                        const maxCount = allTags[0][1];
                        const size = 9 + Math.round((count / maxCount) * 8);
                        const opacity = 0.5 + (count / maxCount) * 0.5;
                        return (
                          <span key={tag}
                            style={{ fontSize: size, color: c.tagTxt, background: c.tag, padding: '2px 7px', borderRadius: 999, opacity, border: activeTag === tag ? `1px solid ${c.tagTxt}` : '1px solid transparent' }}
                            onClick={() => setActiveTag(prev => prev === tag ? null : tag)}>
                            #{tag}
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
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
