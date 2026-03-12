import React from "react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Trash2, FolderPlus, Bold, Italic, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Table, CheckSquare, Eye, Edit3,
  RotateCcw, BookOpen, Hash, Quote, AlertTriangle, Star,
  ChevronRight, Tag, Link, AlignLeft, Image as ImageIcon,
  Save,
} from "lucide-react";

// ── KaTeX CDN 로드 ────────────────────────────────────────────────────
function useKaTeX() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if ((window as any).katex) { setReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

// ── KaTeX 렌더링 ──────────────────────────────────────────────────────
function renderKaTeX(html: string): string {
  if (!(window as any).katex) return html;
  // $$...$$  블록 수식
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, expr) => {
    try {
      return `<span class="math-block">${(window as any).katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</span>`;
    } catch { return `<span class="math-err">$$${expr}$$</span>`; }
  });
  // $...$  인라인 수식
  html = html.replace(/\$([^$\n]+)\$/g, (_, expr) => {
    try {
      return `<span class="math-inline">${(window as any).katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })}</span>`;
    } catch { return `<span class="math-err">$${expr}$</span>`; }
  });
  return html;
}

// ── 마크다운 파서 (KaTeX 지원) ────────────────────────────────────────
function parseMarkdown(md: string, allNotes: any[] = [], onLinkClick: any = null) {
  if (!md) return "";
  // 수식 블록은 먼저 플레이스홀더로 치환 (HTML 이스케이프 방지)
  const mathBlocks = [];
  let processed = md
    .replace(/\$\$[\s\S]+?\$\$/g, m => { mathBlocks.push(m); return `%%MATH${mathBlocks.length-1}%%`; })
    .replace(/\$[^$\n]+\$/g, m => { mathBlocks.push(m); return `%%MATH${mathBlocks.length-1}%%`; });

  let html = processed
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\[\[(.+?)\]\]/g, (_, title) => {
      const found = allNotes.find(n => n.title === title && !n.deletedAt);
      return found
        ? `<span class="wiki-link" data-id="${found.id}">[[${title}]]</span>`
        : `<span class="wiki-link-missing">[[${title}]]</span>`;
    })
    .replace(/(^|\s)#([\w가-힣]+)/g, (_, sp, tag) =>
      `${sp}<span class="wiki-tag" data-tag="${tag}">#${tag}</span>`)
    // 이미지 ![alt](data:...) — base64 데이터 URL 지원
    .replace(/!\[([^\]]*)\]\((data:[^)]+)\)/g,
      (_, alt, src) => `<img class="md-img" src="${src}" alt="${alt}"/>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, src) => `<img class="md-img" src="${src}" alt="${alt}"/>`)
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/```([\w]*)\n([\s\S]*?)```/gm, (_, __, code) =>
      `<pre class="md-pre"><code class="md-code">${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/==(.+?)==/g, '<mark class="md-highlight">$1</mark>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="md-check done">✓ $1</div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="md-check">☐ $1</div>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="md-ol">$2</li>')
    .replace(/^[-*] (.+)$/gm, '<li class="md-ul">$1</li>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="md-hr"/>')
    .replace(/\n\n/g, '</p><p class="md-p">')
    .replace(/\n/g, '<br/>');

  // 플레이스홀더를 KaTeX 렌더링된 수식으로 복원
  html = html.replace(/%%MATH(\d+)%%/g, (_, i) => {
    const m = mathBlocks[+i];
    if (!(window as any).katex) return `<code>${m}</code>`;
    const isBlock = m.startsWith("$$");
    const expr = m.replace(/^\$\$?/, "").replace(/\$\$?$/, "").trim();
    try {
      return isBlock
        ? `<span class="math-block">${(window as any).katex.renderToString(expr, { displayMode: true, throwOnError: false })}</span>`
        : `<span class="math-inline">${(window as any).katex.renderToString(expr, { displayMode: false, throwOnError: false })}</span>`;
    } catch { return `<code class="math-err">${m}</code>`; }
  });

  return `<div class="md-root"><p class="md-p">${html}</p></div>`;
}

// ── 목차 추출 ─────────────────────────────────────────────────────────
function extractTOC(body: string) {
  return body.split('\n')
    .map((line, i) => { const m = line.match(/^(#{1,3}) (.+)$/); return m ? { level: m[1].length, text: m[2], line: i } : null; })
    .filter(Boolean);
}

// ── 태그 추출 ─────────────────────────────────────────────────────────
function extractTags(body: string) {
  return [...new Set((body.match(/(^|\s)#([\w가-힣]+)/g) || []).map(m => m.trim().replace('#', '')))];
}

// ── localStorage 영속화 ───────────────────────────────────────────────
const LS_NOTES   = "eju-wiki-notes-v1";
const LS_FOLDERS = "eju-wiki-folders-v1";

function loadLS(key: string, fallback: any): any {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function saveLS(key: string, val: any): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /**/ }
}

// ── 샘플 데이터 ───────────────────────────────────────────────────────
const INIT_FOLDERS = [
  { id: "f1", name: "일본사",   emoji: "🏯", color: "#EF4444" },
  { id: "f2", name: "세계사",   emoji: "🌍", color: "#3B82F6" },
  { id: "f3", name: "지리",     emoji: "🗺️", color: "#10B981" },
  { id: "f4", name: "현대사회", emoji: "🏙️", color: "#8B5CF6" },
  { id: "f5", name: "수학",     emoji: "📐", color: "#F59E0B" },
];

const INIT_NOTES = [
  {
    id: "n1", folderId: "f1", title: "에도 시대 개요",
    body: `# 에도 시대 (1603–1868)

#일본사 #막부

## 주요 특징

**도쿠가와 막부**가 약 260년간 통치. [[메이지 유신]]으로 종결.

### 핵심 정책
1. 참근교대 (参勤交代)
2. 쇄국령
3. 기독교 금지

> 에도 시대는 **조닌 문화**가 꽃핀 시기다.

---

| 연도 | 사건 |
|------|------|
| 1603 | 이에야스 쇼군 취임 |
| 1853 | 페리 내항 |
| 1868 | [[메이지 유신]] |

## 체크리스트
- [x] 참근교대 의의 암기
- [ ] 막말 세력 관계도 작성`,
    updatedAt: Date.now() - 3600000, starred: true, deletedAt: null,
  },
  {
    id: "n2", folderId: "f1", title: "메이지 유신",
    body: `# 메이지 유신 (1868)

#일본사 #근대화

[[에도 시대 개요]]의 막부 체제를 무너뜨림.

## 주요 개혁
- 폐번치현
- ==문명개화== 슬로건
- 지조개정

## 체크리스트
- [x] 배경 정리
- [ ] 폐번치현 의의 암기`,
    updatedAt: Date.now() - 1800000, starred: false, deletedAt: null,
  },
  {
    id: "n3", folderId: "f5", title: "수열 공식 정리",
    body: `# 수열 핵심 공식

#수학 #수열

## 등차수열
- 일반항: $a_n = a_1 + (n-1)d$
- 합: $S_n = \\dfrac{n}{2}(a_1 + a_n)$

## 등비수열
- 일반항: $a_n = a_1 \\cdot r^{n-1}$
- 합 $(r \\neq 1)$: $S_n = \\dfrac{a_1(1-r^n)}{1-r}$

## 가우스 공식
$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$

## 체크리스트
- [x] 등차수열 공식
- [x] 등비수열 공식
- [ ] 점화식 문제 10문제
- [ ] 수학적 귀납법 증명`,
    updatedAt: Date.now() - 7200000, starred: true, deletedAt: null,
  },
];

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  .wiki-wrap{display:flex;height:100vh;background:#0F0F11;color:#E8E6E0;font-family:'Noto Serif JP',Georgia,serif;overflow:hidden}
  ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:#3A3A3C;border-radius:2px}::-webkit-scrollbar-thumb:hover{background:#FACC15}
  .sidebar{width:190px;min-width:190px;background:#141416;border-right:1px solid #222;display:flex;flex-direction:column;transition:width .2s}
  .folder-item{display:flex;align-items:center;gap:7px;padding:6px 11px;cursor:pointer;transition:background .15s;font-size:12px}
  .folder-item:hover{background:#1C1C1E}
  .folder-item.active{background:#1C1C1E;border-right:2px solid #FACC15}
  .folder-item.active .fi-label{color:#FACC15}
  .note-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid #181818;transition:background .15s}
  .note-item:hover{background:#181818}
  .note-item.active{background:#1C1C1E;border-left:2px solid #FACC15}
  .tbtn{background:none;border:none;color:#555;cursor:pointer;padding:4px 6px;border-radius:6px;transition:all .15s;display:flex;align-items:center}
  .tbtn:hover{background:#232323;color:#FACC15}
  .wiki-textarea{width:100%;height:100%;background:transparent;border:none;outline:none;resize:none;color:#E8E6E0;font-family:'Noto Serif JP',serif;font-size:14px;line-height:1.9;padding:20px 24px}
  .md-root{font-size:14px;line-height:1.9;color:#E8E6E0;padding:20px 24px}
  .md-h1{font-size:22px;font-weight:700;color:#FACC15;margin:20px 0 10px;border-bottom:1px solid #222;padding-bottom:6px}
  .md-h2{font-size:17px;font-weight:700;color:#F0E8D0;margin:16px 0 8px}
  .md-h3{font-size:14px;font-weight:600;color:#D4C99A;margin:12px 0 6px}
  .md-p{margin:4px 0}
  .md-bold{color:#FACC15;font-weight:700}
  .md-italic{color:#D4C99A;font-style:italic}
  .md-highlight{background:#FACC1530;color:#FACC15;padding:1px 4px;border-radius:3px}
  .md-inline-code{font-family:'JetBrains Mono',monospace;font-size:12px;background:#1E1E20;color:#A8FF78;padding:1px 5px;border-radius:4px}
  .md-pre{background:#181818;border:1px solid #222;border-radius:7px;padding:14px;margin:10px 0;overflow-x:auto}
  .md-code{font-family:'JetBrains Mono',monospace;font-size:12px;color:#A8FF78;white-space:pre}
  .md-ul,.md-ol{margin:2px 0 2px 18px}.md-ul{list-style:disc}.md-ol{list-style:decimal}
  .md-check{padding:2px 0;color:#666;font-size:13px}.md-check.done{color:#4ADE80;text-decoration:line-through}
  .md-quote{border-left:3px solid #FACC15;padding:6px 14px;margin:10px 0;color:#A09070;font-style:italic;background:#141410;border-radius:0 6px 6px 0}
  .md-hr{border:none;border-top:1px solid #222;margin:16px 0}
  .md-img{max-width:100%;border-radius:8px;margin:8px 0;border:1px solid #222}
  table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px}
  th{background:#1C1C1E;color:#FACC15;padding:7px 10px;text-align:left;border:1px solid #2A2A2C;font-weight:600}
  td{padding:7px 10px;border:1px solid #2A2A2C;color:#BBB}tr:hover td{background:#181818}
  .wiki-link{color:#60A5FA;cursor:pointer;border-bottom:1px solid #60A5FA40;padding-bottom:1px;transition:color .15s}
  .wiki-link:hover{color:#93C5FD}
  .wiki-link-missing{color:#F87171;border-bottom:1px dashed #F8717160;padding-bottom:1px}
  .wiki-tag{color:#A78BFA;background:#8B5CF620;border-radius:4px;padding:1px 6px;font-size:12px;cursor:pointer;transition:background .15s}
  .wiki-tag:hover{background:#8B5CF640}
  .math-block{display:block;overflow-x:auto;padding:10px 0;text-align:center}
  .math-inline{display:inline}
  .math-err{color:#F87171;font-family:'JetBrains Mono',monospace;font-size:12px}
  .wi{background:#1C1C1E;border:1px solid #2A2A2C;color:#E8E6E0;border-radius:7px;padding:6px 10px;font-size:12px;outline:none;font-family:inherit}
  .wi:focus{border-color:#FACC15}
  .bg{background:#FACC15;color:#0F0F11;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
  .bg:hover{background:#FDE047}
  .si{background:#181818;border:1px solid #1E1E20;border-radius:16px;padding:6px 10px 6px 28px;font-size:12px;color:#E8E6E0;outline:none;width:100%;font-family:inherit}
  .si:focus{border-color:#FACC1550}
  .badge{background:#FACC1520;color:#FACC15;border-radius:999px;font-size:10px;font-weight:700;padding:1px 6px}
  .badger{background:#EF444420;color:#F87171;border-radius:999px;font-size:10px;font-weight:700;padding:1px 6px}
  .sec-label{padding:8px 11px 3px;font-size:10px;color:#3A3A3A;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .toc-item{display:flex;align-items:center;gap:4px;padding:3px 8px;cursor:pointer;font-size:11px;color:#555;border-radius:4px;transition:all .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .toc-item:hover{color:#FACC15;background:#1C1C1E}
  .tag-pill{background:#8B5CF620;color:#A78BFA;border-radius:999px;font-size:10px;padding:2px 8px;cursor:pointer;transition:all .15s;border:1px solid transparent}
  .tag-pill:hover{border-color:#8B5CF660}
  .tag-pill.active{background:#8B5CF640;border-color:#8B5CF6}
  .backlink-item{padding:6px 10px;font-size:12px;color:#60A5FA;cursor:pointer;border-radius:5px;transition:background .15s}
  .backlink-item:hover{background:#1C1C1E}
  .save-indicator{font-size:9px;color:#4ADE8080;font-family:monospace;display:flex;align-items:center;gap:3px;transition:opacity .3s}
  .img-thumb{width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #222;cursor:pointer}
`;

function InboxIcon({ size, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
}

export const WikiView = () {
  const katexReady = useKaTeX();

  const [folders, setFolders] = useState(() => loadLS(LS_FOLDERS, INIT_FOLDERS));
  const [notes,   setNotes]   = useState(() => loadLS(LS_NOTES,   INIT_NOTES));
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [activeNoteId,   setActiveNoteId]   = useState(() => loadLS(LS_NOTES, INIT_NOTES)?.[0]?.id ?? null);
  const [searchQuery,    setSearchQuery]     = useState("");
  const [viewMode,       setViewMode]        = useState("split");
  const [showFolderForm, setShowFolderForm]  = useState(false);
  const [newFolderName,  setNewFolderName]   = useState("");
  const [newFolderEmoji, setNewFolderEmoji]  = useState("📄");
  const [activeTag,      setActiveTag]       = useState(null);
  const [rightPanel,     setRightPanel]      = useState("toc");
  const [savedAt,        setSavedAt]         = useState(null); // 저장 표시기
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── localStorage 자동 저장 (500ms 디바운스) ──────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSave = useCallback((newNotes, newFolders) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (newNotes)   saveLS(LS_NOTES, newNotes);
      if (newFolders) saveLS(LS_FOLDERS, newFolders);
      setSavedAt(new Date());
    }, 500);
  }, []);

  // ── 필터링 ──────────────────────────────────────────────────────────
  const visibleNotes = useMemo(() => {
    let list = activeFolderId === "trash"
      ? notes.filter(n => n.deletedAt)
      : activeFolderId === "starred"
        ? notes.filter(n => n.starred && !n.deletedAt)
        : activeFolderId
          ? notes.filter(n => n.folderId === activeFolderId && !n.deletedAt)
          : notes.filter(n => !n.deletedAt);
    if (activeTag) list = list.filter(n => extractTags(n.body).includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, activeFolderId, searchQuery, activeTag]);

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;
  const toc        = useMemo(() => activeNote ? extractTOC(activeNote.body) : [], [activeNote]);
  const backlinks  = useMemo(() => activeNote
    ? notes.filter(n => n.id !== activeNote.id && !n.deletedAt && n.body.includes(`[[${activeNote.title}]]`))
    : [], [notes, activeNote]);
  const allTags    = useMemo(() => {
    const m = {};
    notes.filter(n => !n.deletedAt).forEach(n => extractTags(n.body).forEach(t => { m[t] = (m[t]||0)+1; }));
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  }, [notes]);
  const noteTags = activeNote ? extractTags(activeNote.body) : [];

  // ── CRUD ─────────────────────────────────────────────────────────────
  const createNote = useCallback(() => {
    const id = `n-${Date.now()}`;
    const fid = (activeFolderId && !["trash","starred"].includes(activeFolderId)) ? activeFolderId : null;
    const note = { id, folderId: fid, title: "새 노트", body: "# 새 노트\n\n#태그\n\n내용을 입력하세요.", updatedAt: Date.now(), starred: false, deletedAt: null };
    const next = [note, ...notes];
    setNotes(next); setActiveNoteId(id);
    autoSave(next, null);
  }, [activeFolderId, notes, autoSave]);

  const updateNote = useCallback((id, patch) => {
    const next = notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n);
    setNotes(next);
    autoSave(next, null);
  }, [notes, autoSave]);

  const trashNote  = id => { const next = notes.map(n => n.id===id?{...n,deletedAt:Date.now()}:n); setNotes(next); if(activeNoteId===id) setActiveNoteId(null); autoSave(next,null); };
  const restore    = id => { const next = notes.map(n => n.id===id?{...n,deletedAt:null}:n); setNotes(next); autoSave(next,null); };
  const permDelete = id => { const next = notes.filter(n => n.id!==id); setNotes(next); if(activeNoteId===id) setActiveNoteId(null); autoSave(next,null); };

  const FOLDER_COLORS = ["#EF4444","#F59E0B","#10B981","#3B82F6","#8B5CF6","#EC4899","#14B8A6"];
  const addFolder = () => {
    if (!newFolderName.trim()) return;
    const id = `f-${Date.now()}`;
    const next = [...folders, { id, name: newFolderName.trim(), emoji: newFolderEmoji, color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length] }];
    setFolders(next); setNewFolderName(""); setNewFolderEmoji("📄"); setShowFolderForm(false); setActiveFolderId(id);
    autoSave(null, next);
  };

  // ── 툴바 삽입 ────────────────────────────────────────────────────────
  const insert = (before, after = "") => {
    const ta = textareaRef.current; if (!ta || !activeNote) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = activeNote.body.substring(s, e);
    updateNote(activeNote.id, { body: activeNote.body.substring(0,s) + before + sel + after + activeNote.body.substring(e) });
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s+before.length, s+before.length+sel.length); }, 0);
  };

  // ── 이미지 삽입 (base64) ─────────────────────────────────────────────
  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const alt = file.name.replace(/\.[^.]+$/, "");
      insert(`![${alt}](${dataUrl})`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const TOOLBAR: ({ icon: React.ReactNode; label: string; fn: () => void } | null)[] = [
    { icon: <Heading1 size={13}/>, label:"H1", fn:()=>insert("# ") },
    { icon: <Heading2 size={13}/>, label:"H2", fn:()=>insert("## ") },
    { icon: <Heading3 size={13}/>, label:"H3", fn:()=>insert("### ") },
    null,
    { icon: <Bold size={13}/>,        label:"굵게",       fn:()=>insert("**","**") },
    { icon: <Italic size={13}/>,      label:"기울임",     fn:()=>insert("*","*") },
    { icon: <Code size={13}/>,        label:"코드",       fn:()=>insert("`","`") },
    { icon: <Hash size={13}/>,        label:"하이라이트", fn:()=>insert("==","==") },
    null,
    { icon: <List size={13}/>,        label:"목록",   fn:()=>insert("- ") },
    { icon: <ListOrdered size={13}/>, label:"번호",   fn:()=>insert("1. ") },
    { icon: <CheckSquare size={13}/>, label:"체크",   fn:()=>insert("- [ ] ") },
    { icon: <Quote size={13}/>,       label:"인용",   fn:()=>insert("> ") },
    null,
    { icon: <Table size={13}/>, label:"표", fn:()=>insert("\n| 항목 | 내용 |\n|------|------|\n| 값 1 | 값 2 |\n") },
    { icon: <Link size={13}/>,  label:"페이지 링크", fn:()=>insert("[[","]]") },
    { icon: <Tag size={13}/>,   label:"태그", fn:()=>insert("#") },
    null,
    // 수식 버튼
    { icon: <span style={{fontSize:11,fontFamily:"serif",fontStyle:"italic",fontWeight:700}}>∑</span>, label:"인라인 수식 $...$", fn:()=>insert("$","$") },
    { icon: <span style={{fontSize:11,fontFamily:"serif",fontStyle:"italic",fontWeight:700}}>∫</span>, label:"블록 수식 $$...$$", fn:()=>insert("$$\n","\n$$") },
    null,
    { icon: <ImageIcon size={13}/>, label:"이미지 삽입", fn:()=>imageInputRef.current?.click() },
  ];

  // ── 미리보기 클릭 ────────────────────────────────────────────────────
  const handlePreviewClick = (e) => {
    const wl = e.target.closest('.wiki-link');
    if (wl) { setActiveNoteId(wl.dataset.id); return; }
    const wt = e.target.closest('.wiki-tag');
    if (wt) { setActiveTag(prev => prev===wt.dataset.tag ? null : wt.dataset.tag); return; }
  };

  const trashCount   = notes.filter(n => n.deletedAt).length;
  const starredCount = notes.filter(n => n.starred && !n.deletedAt).length;
  const isTrash      = activeFolderId === "trash";

  const folderLabel = activeFolderId===null ? "전체 노트"
    : activeFolderId==="trash"   ? "🗑 휴지통"
    : activeFolderId==="starred" ? "⭐ 즐겨찾기"
    : (() => { const f=folders.find(f=>f.id===activeFolderId); return f?`${f.emoji} ${f.name}`:""; })();

  return (
    <div className="wiki-wrap">
      <style>{CSS}</style>
      {/* 숨김 파일 입력 */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" style={{display:"none"}} onChange={handleImageInsert}/>

      {/* ── 사이드바 ── */}
      <div className="sidebar">
        <div style={{padding:"13px 11px 9px",borderBottom:"1px solid #1C1C1E",display:"flex",alignItems:"center",gap:7}}>
          <BookOpen size={13} color="#FACC15"/>
          <span style={{fontWeight:700,fontSize:13,color:"#FACC15",letterSpacing:.5}}>EJU Wiki</span>
          <span style={{marginLeft:"auto",fontSize:9,color:"#333",fontFamily:"monospace"}}>v3</span>
        </div>
        <div style={{padding:"7px 9px",borderBottom:"1px solid #1C1C1E",position:"relative"}}>
          <Search size={11} style={{position:"absolute",left:17,top:"50%",transform:"translateY(-50%)",color:"#444"}}/>
          <input className="si" placeholder="검색..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
        </div>

        <div style={{flex:1,overflowY:"auto"}}>
          <div className={`folder-item ${activeFolderId===null&&!activeTag?'active':''}`}
            onClick={()=>{setActiveFolderId(null);setActiveTag(null);setSearchQuery("");}}>
            <InboxIcon size={12} color={activeFolderId===null&&!activeTag?"#FACC15":"#444"}/>
            <span className="fi-label" style={{flex:1}}>전체 노트</span>
            <span className="badge">{notes.filter(n=>!n.deletedAt).length}</span>
          </div>
          {starredCount > 0 && (
            <div className={`folder-item ${activeFolderId==='starred'?'active':''}`} onClick={()=>setActiveFolderId('starred')}>
              <Star size={12} color={activeFolderId==='starred'?"#FACC15":"#555"} fill={activeFolderId==='starred'?"#FACC15":"none"}/>
              <span className="fi-label" style={{flex:1}}>즐겨찾기</span>
              <span className="badge">{starredCount}</span>
            </div>
          )}

          <div className="sec-label">과목</div>
          {folders.map(f => (
            <div key={f.id} className={`folder-item ${activeFolderId===f.id?'active':''}`} onClick={()=>{setActiveFolderId(f.id);setActiveTag(null);}}>
              <span style={{fontSize:13}}>{f.emoji}</span>
              <span className="fi-label" style={{flex:1}}>{f.name}</span>
              <span className="badge" style={{background:f.color+"25",color:f.color}}>{notes.filter(n=>n.folderId===f.id&&!n.deletedAt).length}</span>
            </div>
          ))}
          {showFolderForm ? (
            <div style={{padding:"5px 9px",display:"flex",flexDirection:"column",gap:5}}>
              <div style={{display:"flex",gap:4}}>
                <input className="wi" style={{width:30,padding:"4px 5px",textAlign:"center"}} value={newFolderEmoji} onChange={e=>setNewFolderEmoji(e.target.value)} maxLength={2}/>
                <input className="wi" style={{flex:1}} placeholder="과목명" value={newFolderName} onChange={e=>setNewFolderName(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')addFolder();if(e.key==='Escape')setShowFolderForm(false);}} autoFocus/>
              </div>
              <div style={{display:"flex",gap:4}}>
                <button className="bg" style={{flex:1,padding:"5px"}} onClick={addFolder}>추가</button>
                <button onClick={()=>setShowFolderForm(false)} style={{flex:1,background:"#1C1C1E",border:"none",borderRadius:6,color:"#666",fontSize:11,cursor:"pointer"}}>취소</button>
              </div>
            </div>
          ) : (
            <div className="folder-item" onClick={()=>setShowFolderForm(true)} style={{color:"#3A3A3A",fontSize:11}}>
              <FolderPlus size={11} color="#333"/>
              <span>과목 추가</span>
            </div>
          )}

          {/* 태그 목록 */}
          {allTags.length > 0 && (
            <>
              <div className="sec-label" style={{marginTop:4}}>태그</div>
              <div style={{padding:"3px 9px 8px",display:"flex",flexWrap:"wrap",gap:4}}>
                {allTags.map(([tag, count]) => (
                  <span key={tag} className={`tag-pill ${activeTag===tag?'active':''}`}
                    onClick={()=>setActiveTag(prev=>prev===tag?null:tag)}>
                    #{tag} <span style={{color:"#555",marginLeft:2}}>{count}</span>
                  </span>
                ))}
              </div>
            </>
          )}

          <div style={{borderTop:"1px solid #1C1C1E",marginTop:6}}>
            <div className={`folder-item ${isTrash?'active':''}`} onClick={()=>setActiveFolderId('trash')}>
              <Trash2 size={11} color={isTrash?"#F87171":"#444"}/>
              <span className="fi-label" style={{flex:1,color:isTrash?"#F87171":undefined}}>휴지통</span>
              {trashCount > 0 && <span className="badger">{trashCount}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── 노트 목록 ── */}
      <div style={{width:190,minWidth:190,background:"#0D0D0F",borderRight:"1px solid #1C1C1E",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"9px 10px 7px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1C1C1E"}}>
          <span style={{fontSize:11,color:"#555",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>
            {activeTag ? `#${activeTag}` : folderLabel}
            <span style={{color:"#2A2A2A",marginLeft:4}}>({visibleNotes.length})</span>
          </span>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {activeTag && <button onClick={()=>setActiveTag(null)} className="tbtn" style={{color:"#A78BFA",padding:"2px 4px",fontSize:9}}>✕</button>}
            {!isTrash && <button onClick={createNote} style={{background:"#FACC15",border:"none",borderRadius:5,padding:"2px 7px",cursor:"pointer",color:"#0F0F11",fontWeight:700,fontSize:12,display:"flex",alignItems:"center"}}><Plus size={11}/></button>}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {visibleNotes.length === 0 ? (
            <div style={{padding:20,textAlign:"center",color:"#333",fontSize:12}}>
              {isTrash ? "휴지통이 비어있습니다" : "노트가 없습니다"}
            </div>
          ) : visibleNotes.map(n => {
            const folder = folders.find(f=>f.id===n.folderId);
            const tags = extractTags(n.body);
            const preview = n.body.replace(/(^|\s)#[\w가-힣]+/g,'').replace(/[#*`\[\]=~>$\-]/g,'').split('\n').find(l=>l.trim())||"";
            return (
              <div key={n.id} className={`note-item ${n.id===activeNoteId?'active':''}`} onClick={()=>setActiveNoteId(n.id)}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                  {n.starred && <Star size={9} color="#FACC15" fill="#FACC15"/>}
                  <span style={{fontSize:12,fontWeight:600,color:n.id===activeNoteId?"#FACC15":"#CCC",flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.title}</span>
                </div>
                <div style={{fontSize:10,color:"#444",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:4}}>{preview}</div>
                <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                  {folder && <span style={{fontSize:9,background:folder.color+"18",color:folder.color,borderRadius:3,padding:"1px 4px"}}>{folder.emoji}</span>}
                  {tags.slice(0,2).map(t=><span key={t} style={{fontSize:9,color:"#7C3AED",background:"#7C3AED15",borderRadius:3,padding:"1px 4px"}}>#{t}</span>)}
                  <span style={{fontSize:9,color:"#333",marginLeft:"auto"}}>{new Date(n.updatedAt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 에디터 ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {activeNote ? (
          <>
            {/* 헤더 */}
            <div style={{padding:"7px 13px",borderBottom:"1px solid #1C1C1E",display:"flex",alignItems:"center",gap:6,background:"#0F0F11",flexShrink:0}}>
              <input value={activeNote.title} readOnly={isTrash}
                onChange={e=>updateNote(activeNote.id,{title:e.target.value})}
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#E8E6E0",fontFamily:"'Noto Serif JP',serif",fontSize:15,fontWeight:700}}
                placeholder="제목"/>
              <button onClick={()=>updateNote(activeNote.id,{starred:!activeNote.starred})} className="tbtn">
                <Star size={12} fill={activeNote.starred?"#FACC15":"none"} color={activeNote.starred?"#FACC15":"#444"}/>
              </button>
              {!isTrash && (
                <select value={activeNote.folderId??''} onChange={e=>updateNote(activeNote.id,{folderId:e.target.value||null})}
                  style={{background:"#161616",border:"1px solid #222",color:"#666",borderRadius:5,padding:"3px 6px",fontSize:10,outline:"none",cursor:"pointer"}}>
                  <option value="">미분류</option>
                  {folders.map(f=><option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                </select>
              )}
              <div style={{display:"flex",background:"#161616",borderRadius:7,padding:2,gap:1}}>
                {([["edit", <Edit3 size={11}/>],["split", <AlignLeft size={11}/>],["preview", <Eye size={11}/>]] as const).map(([m,icon])=>(
                  <button key={m} onClick={()=>setViewMode(m)} className="tbtn"
                    style={{padding:"3px 7px",borderRadius:5,background:viewMode===m?"#2A2A2A":"none",color:viewMode===m?"#FACC15":"#444"}}>
                    {icon}
                  </button>
                ))}
              </div>
              {isTrash
                ? <button onClick={()=>restore(activeNote.id)} className="tbtn" style={{color:"#4ADE80"}}><RotateCcw size={12}/></button>
                : <button onClick={()=>trashNote(activeNote.id)} className="tbtn"><Trash2 size={12}/></button>
              }
            </div>

            {/* 툴바 */}
            {!isTrash && (viewMode==='edit'||viewMode==='split') && (
              <div style={{padding:"2px 10px",borderBottom:"1px solid #161616",display:"flex",alignItems:"center",gap:1,flexShrink:0,background:"#0F0F11",flexWrap:"wrap"}}>
                {TOOLBAR.map((btn,i) => btn===null
                  ? <div key={i} style={{width:1,height:13,background:"#222",margin:"0 2px"}}/>
                  : <button key={i} className="tbtn" onClick={btn!.fn} title={btn!.label}>{btn!.icon}</button>
                )}
                {/* 저장 표시기 */}
                {savedAt && (
                  <span className="save-indicator" style={{marginLeft:"auto"}}>
                    <Save size={9}/> {savedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 저장됨
                  </span>
                )}
              </div>
            )}

            {/* 본문 */}
            <div style={{flex:1,display:"flex",minHeight:0}}>
              {(viewMode==='edit'||viewMode==='split') && (
                <div style={{flex:1,overflow:"auto",borderRight:viewMode==='split'?"1px solid #1C1C1E":"none"}}>
                  {isTrash ? (
                    <div style={{padding:20}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12,color:"#F87171",fontSize:12}}>
                        <AlertTriangle size={13}/> 휴지통에 있습니다. 복원 버튼으로 되돌릴 수 있습니다.
                      </div>
                      <div style={{color:"#555",fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{activeNote.body}</div>
                    </div>
                  ) : (
                    <textarea ref={textareaRef} className="wiki-textarea" value={activeNote.body}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>)=>updateNote(activeNote.id,{body:e.target.value})}
                      placeholder={"# 제목\n\n#태그1 #태그2\n\n내용 작성...\n\n수식: $a^2 + b^2 = c^2$\n블록 수식:\n$$\n\\\\sum_{k=1}^{n} k\n$$\n\n이미지: 툴바 📷 버튼\n[[다른 페이지]] 링크"}/>
                  )}
                </div>
              )}
              {(viewMode==='preview'||viewMode==='split') && (
                <div style={{flex:1,overflow:"auto"}} onClick={handlePreviewClick}
                  key={katexReady ? "ready" : "loading"}
                  dangerouslySetInnerHTML={{__html: parseMarkdown(activeNote.body, notes)}}/>
              )}
            </div>
          </>
        ) : (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,color:"#2A2A2A"}}>
            <BookOpen size={40} color="#1C1C1E"/>
            <p style={{fontSize:13,color:"#444"}}>노트를 선택하거나 새로 만드세요</p>
            <button className="bg" onClick={createNote}>+ 새 노트</button>
          </div>
        )}
      </div>

      {/* ── 우측 패널 ── */}
      {activeNote && (
        <div style={{width:180,minWidth:180,background:"#0D0D0F",borderLeft:"1px solid #1C1C1E",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",borderBottom:"1px solid #1C1C1E",flexShrink:0}}>
            {([["toc","목차",<AlignLeft size={11}/>],["backlinks","링크",<Link size={11}/>],["tags","태그",<Tag size={11}/>]] as [string,string,React.ReactNode][]).map(([p,label,icon])=>(
              <button key={p} onClick={()=>setRightPanel(p)}
                style={{flex:1,background:"none",border:"none",borderBottom:rightPanel===p?"2px solid #FACC15":"2px solid transparent",padding:"8px 4px",cursor:"pointer",color:rightPanel===p?"#FACC15":"#444",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",gap:3,transition:"all .15s"}}>
                {icon}{label}
              </button>
            ))}
          </div>

          {rightPanel==="toc" && (
            <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
              {toc.length===0
                ? <p style={{fontSize:11,color:"#333",textAlign:"center",padding:"20px 8px"}}>제목 없음<br/><span style={{fontSize:10}}># ## ###</span></p>
                : toc.map((item,i) => (
                  <div key={i} className="toc-item" style={{paddingLeft:8+(item.level-1)*12}}
                    onClick={()=>{
                      const ta = textareaRef.current;
                      if(ta && viewMode!=='preview') {
                        const pos = activeNote.body.split('\n').slice(0,item.line).join('\n').length;
                        ta.focus(); ta.setSelectionRange(pos,pos);
                        ta.scrollTop = (pos/activeNote.body.length)*ta.scrollHeight;
                      }
                    }}>
                    <span style={{color:item.level===1?"#FACC1570":item.level===2?"#D4C99A60":"#66666070",fontSize:9,marginRight:2}}>H{item.level}</span>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{item.text}</span>
                  </div>
                ))
              }
            </div>
          )}

          {rightPanel==="backlinks" && (
            <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
              <div style={{padding:"0 10px 6px",fontSize:10,color:"#444"}}>이 노트를 참조하는 페이지</div>
              {backlinks.length===0
                ? <p style={{fontSize:11,color:"#2A2A2A",textAlign:"center",padding:"16px 8px"}}>백링크 없음</p>
                : backlinks.map(n => (
                  <div key={n.id} className="backlink-item" onClick={()=>setActiveNoteId(n.id)}>↗ {n.title}</div>
                ))
              }
              {(() => {
                const outLinks = [...(activeNote?.body.matchAll(/\[\[(.+?)\]\]/g)||[])].map(m=>m[1]);
                const found = outLinks.map(t=>notes.find(n=>n.title===t&&!n.deletedAt)).filter(Boolean);
                return found.length > 0 ? (
                  <>
                    <div style={{padding:"8px 10px 4px",fontSize:10,color:"#444",borderTop:"1px solid #1C1C1E",marginTop:4}}>나가는 링크</div>
                    {found.map(n=>(
                      <div key={n.id} className="backlink-item" style={{color:"#86EFAC"}} onClick={()=>setActiveNoteId(n.id)}>→ {n.title}</div>
                    ))}
                  </>
                ) : null;
              })()}
            </div>
          )}

          {rightPanel==="tags" && (
            <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
              <div style={{fontSize:10,color:"#444",marginBottom:8}}>이 노트의 태그</div>
              {noteTags.length===0
                ? <p style={{fontSize:11,color:"#2A2A2A",textAlign:"center",padding:"12px 0"}}>#태그 로 추가</p>
                : <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                  {noteTags.map(t=>(
                    <span key={t} className={`tag-pill ${activeTag===t?'active':''}`}
                      onClick={()=>setActiveTag(prev=>prev===t?null:t)}>#{t}</span>
                  ))}
                </div>
              }
              <div style={{fontSize:10,color:"#444",marginBottom:8,borderTop:"1px solid #1C1C1E",paddingTop:10}}>전체 태그</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {allTags.map(([tag,count])=>(
                  <span key={tag} className={`tag-pill ${activeTag===tag?'active':''}`}
                    onClick={()=>setActiveTag(prev=>prev===tag?null:tag)}>
                    #{tag} <span style={{color:"#555"}}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
