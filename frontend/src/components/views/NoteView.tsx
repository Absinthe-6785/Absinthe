import { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Eye, Edit3,
  RotateCcw, AlertTriangle, Star,
  Tag, Link, AlignLeft, Image as ImageIcon, Save,
  ChevronDown, ChevronRight, GitFork, Upload, Keyboard,
} from 'lucide-react';
import { useConfirm } from '../../hooks/useConfirm';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { authFetch } from '../../lib/supabase';
import { API_URL } from '../../lib/config';
import {
  NV_NOTES_KEY, NV_FOLDERS_KEY, NV_ACTIVE_KEY,
  nvLoadNotes, nvLoadFolders, nvSaveNotes, nvSaveFolders,
  highlightText,
  extractTOC, extractTags, extractLinks,
  extractLinkContexts,
} from './noteUtils';
import type { NoteBase as Note, NoteFolderBase as NoteFolder, TocItem } from './noteUtils';
import { NoteGraphView } from './NoteGraphView';
import { BlockEditorPreview, useBlockEditor, type BlockEditorColors, type BlockEditorHandle } from './BlockEditor';


// ── KaTeX 동적 로드 훅 ───────────────────────────────────────────────
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

// ── 블록 에디터 어댑터 ────────────────────────────────────────────────
// useBlockEditor 훅은 조건부로 호출할 수 없으므로 별도 컴포넌트로 분리한다.
// 부모에서 key={note.id}로 마운트해 노트 전환 시 블록 상태가 초기화되도록 한다.
interface NoteBlockEditorProps {
  body: string;
  onBodyChange: (md: string) => void;
  colors: BlockEditorColors;
  readOnly: boolean;
  searchQuery: string;
  wikiTargets: string[];
  onWikiNavigate?: (title: string) => void;
}
const NoteBlockEditor = forwardRef<BlockEditorHandle, NoteBlockEditorProps>(function NoteBlockEditor(
  { body, onBodyChange, colors, readOnly, searchQuery, wikiTargets, onWikiNavigate },
  ref,
) {
  const {
    blocks, handleBlockChange, undo, redo,
    insertImage, insertEmptyImageBlock, setActiveBlockId, externalFocusId, clearExternalFocus,
  } = useBlockEditor(body, onBodyChange);

  useImperativeHandle(ref, () => ({ insertImage, insertEmptyImageBlock }), [insertImage, insertEmptyImageBlock]);

  // Ctrl+Z / Ctrl+Y(또는 Ctrl+Shift+Z) — capture 단계에서 가로채 블록 단위 undo/redo 실행.
  // capture + stopImmediatePropagation으로 NoteView 전역 단축키와 충돌 방지.
  useEffect(() => {
    if (readOnly) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey)              { e.preventDefault(); e.stopImmediatePropagation(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); e.stopImmediatePropagation(); redo(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [undo, redo, readOnly]);

  return (
    <BlockEditor
      blocks={blocks}
      onChange={handleBlockChange}
      colors={colors}
      readOnly={readOnly}
      searchQuery={searchQuery}
      wikiTargets={wikiTargets}
      onWikiNavigate={onWikiNavigate}
      onActiveBlockChange={setActiveBlockId}
      externalFocusId={externalFocusId}
      onExternalFocusConsumed={clearExternalFocus}
    />
  );
});

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export const NoteView = () => {
  const katexReady = useKaTeX();

  // ── 전역 스토어 — appSettings(darkMode)만 참조 ────────────────────
  // 설계 의도: NoteView는 PlannerView(Memo)와 완전히 독립된 노트 시스템.
  //   - 노트/폴더 상태는 NoteView 전용 localStorage 키(NV_NOTES_KEY 등)에서 관리.
  //   - useAppStore의 notes/folders는 PlannerView Memo 전용이며 NoteView와 공유하지 않음.
  //   - 두 상태가 충돌하지 않는 이유: 키가 다르고(NV_NOTES_KEY vs planner-notes-v2)
  //     DB 엔드포인트(/api/notes)는 upsert 방식이므로 각자 독립적으로 sync.
  //   - 향후 통합이 필요하다면 useAppStore의 notes를 제거하고 NoteView 쪽으로 일원화 권장.
  const { appSettings } = useAppStore();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  // ── DB sync 헬퍼 (fire-and-forget, 실패해도 localStorage 유지) ───
  const syncNoteToDB = useCallback(async (note: Note) => {
    try {
      await authFetch(`${API_URL}/api/notes`, {
        method: 'POST',
        body: JSON.stringify({
          id: note.id, title: note.title, body: note.body,
          updated_at: note.updatedAt, folder_id: note.folderId,
          deleted_at: note.deletedAt, starred: note.starred ?? false,
        }),
      });
    } catch { /**/ }
  }, []);

  const removeNoteFromDB = useCallback(async (id: string) => {
    try { await authFetch(`${API_URL}/api/notes/${id}`, { method: 'DELETE' }); } catch { /**/ }
  }, []);

  const syncFolderToDB = useCallback(async (folder: NoteFolder) => {
    try {
      await authFetch(`${API_URL}/api/note_folders`, {
        method: 'POST',
        body: JSON.stringify({ id: folder.id, name: folder.name, created_at: folder.createdAt }),
      });
    } catch { /**/ }
  }, []);

  const removeFolderFromDB = useCallback(async (id: string) => {
    try { await authFetch(`${API_URL}/api/note_folders/${id}`, { method: 'DELETE' }); } catch { /**/ }
  }, []);

  // ── NoteView 전용 독립 상태 (PlannerView Memo와 완전 분리) ───────
  const [notes,   setNotes]   = useState<Note[]>(() => { const n = nvLoadNotes(); return Array.isArray(n) ? n : []; });
  const [folders, setFolders] = useState<NoteFolder[]>(nvLoadFolders);
  const [activeNoteId,   setActiveNoteIdRaw]   = useState<string | null>(() => {
    try { return localStorage.getItem(NV_ACTIVE_KEY) || nvLoadNotes()[0]?.id || null; } catch { return null; }
  });
  const [activeFolderId, setActiveFolderId] = useState<string | null | 'trash'>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const setActiveNoteId = useCallback((id: string | null) => {
    setActiveNoteIdRaw(id);
    try { localStorage.setItem(NV_ACTIVE_KEY, id ?? ''); } catch { /**/ }
  }, []);

  // ── 최초 마운트 시 DB에서 노트/폴더 로드 ────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsSyncing(true);
      try {
        // 폴더 먼저
        const fRes = await authFetch(`${API_URL}/api/note_folders`);
        if (fRes.ok) {
          const raw = await fRes.json();
          const dbFolders: NoteFolder[] = raw.map((f: { id: string; name: string; created_at: number }) => ({
            id: f.id, name: f.name, createdAt: f.created_at,
          }));
          if (dbFolders.length > 0) {
            setFolders(dbFolders);
            nvSaveFolders(dbFolders);
          }
        }
        // 노트
        const nRes = await authFetch(`${API_URL}/api/notes`);
        if (nRes.ok) {
          const raw = await nRes.json();
          const localNotes = nvLoadNotes();
          const dbNotes: Note[] = raw.map((n: { id: string; title: string; body: string; updated_at: number; folder_id?: string | null; deleted_at?: number | null; starred?: boolean }) => {
            const local = localNotes.find(l => l.id === n.id);
            // 충돌 해결: updatedAt이 더 최신인 쪽을 우선
            const localIsNewer = local && local.updatedAt > n.updated_at;
            return {
              id: n.id,
              title:     localIsNewer ? (local.title ?? '') : (n.title ?? ''),
              body:      localIsNewer ? (local.body  ?? '') : (n.body  ?? ''),
              updatedAt: localIsNewer ? local.updatedAt     : n.updated_at,
              folderId:  n.folder_id  != null ? n.folder_id  : (local?.folderId  ?? null),
              deletedAt: n.deleted_at !== undefined ? (n.deleted_at ?? null) : (local?.deletedAt ?? null),
              // starred: 로컬이 더 최신이면 로컬, 아니면 DB 값 사용 (양쪽 모두 보존)
              starred:   localIsNewer ? (local.starred ?? false) : (n.starred ?? local?.starred ?? false),
            };
          });
          // 로컬에만 있는 노트(DB에 없는 것) → DB에 업로드 (실패해도 계속 진행)
          const dbIds = new Set(raw.map((n: { id: string }) => n.id));
          const localOnly = localNotes.filter(l => !dbIds.has(l.id) && !l.deletedAt);
          if (localOnly.length > 0) {
            await Promise.allSettled(localOnly.map(note => syncNoteToDB(note)));
          }
          // 30일 지난 휴지통 자동 제거
          const MONTH = 30 * 24 * 60 * 60 * 1000;
          const valid = dbNotes.filter(n => !n.deletedAt || Date.now() - n.deletedAt < MONTH);
          if (dbNotes.length > 0) {  // DB에 노트가 있으면 항상 setNotes (valid가 0이어도)
            setNotes(valid);
            nvSaveNotes(valid);
            // activeNoteId가 유효한지 확인
            setActiveNoteIdRaw(prev => {
              const stillValid = valid.some(n => n.id === prev && !n.deletedAt);
              const next = stillValid ? prev : (valid.find(n => !n.deletedAt)?.id ?? null);
              try { localStorage.setItem(NV_ACTIVE_KEY, next ?? ''); } catch { /**/ }
              return next;
            });
          } else if (dbNotes.length === 0) {
            // DB 완전히 비어있으면 localStorage 노트를 DB에 업로드
            const local = nvLoadNotes();
            await Promise.allSettled(local.map(note => syncNoteToDB(note)));
          }
        }
      } catch { /**/ } finally {
        setIsSyncing(false);
      }
    };
    load();
  }, []); // intentional: run once on mount only

  // ── UI 전용 상태만 로컬로 유지 ──────────────────────────────────
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [viewMode,       setViewMode]       = useState<'edit' | 'preview' | 'graph'>('preview');

  const createNote = useCallback(() => {
    const id = `note-${Date.now()}`;
    const folderId = (activeFolderId === null || activeFolderId === 'trash') ? null : activeFolderId;
    const note: Note = { id, title: '', body: '', updatedAt: Date.now(), folderId, deletedAt: null, starred: false };
    setNotes(prev => { const u = [note, ...prev]; nvSaveNotes(u); return u; });
    setActiveNoteId(id);
    setViewMode('edit');
    setTimeout(() => titleInputRef.current?.focus(), 50);
    syncNoteToDB(note);
    return id;
  }, [activeFolderId, setActiveNoteId, setViewMode, syncNoteToDB]);

  // debounce ref — body 타이핑 중 과도한 DB 요청 방지
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateNote = useCallback((id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred'>>) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n);
      nvSaveNotes(updated);
      // body 변경은 600ms debounce, 나머지(title, folderId, starred)는 즉시 sync
      const updatedNote = updated.find(n => n.id === id);
      if (updatedNote) {
        if ('body' in patch) {
          if (syncTimer.current) clearTimeout(syncTimer.current);
          syncTimer.current = setTimeout(() => syncNoteToDB(updatedNote), 600);
        } else {
          syncNoteToDB(updatedNote);
        }
      }
      return updated;
    });
  }, [syncNoteToDB]);

  const toggleStar = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n);
      nvSaveNotes(updated);
      const note = updated.find(n => n.id === id);
      if (note) syncNoteToDB(note);
      return updated;
    });
  }, [syncNoteToDB]);

  const exportNote = useCallback((note: Note) => {
    const blob = new Blob([note.body], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-') || 'untitled'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // 전체 노트 ZIP 없이 개별 .md 파일로 순차 다운로드 (삭제된 노트 제외)
  const exportAllNotes = useCallback(() => {
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    // 파일명 중복 방지를 위해 인덱스 추가
    const nameCount: Record<string, number> = {};
    active.forEach((note, idx) => {
      const safeName = (note.title ?? 'untitled').replace(/[/\\?%*:|"<>]/g, '-') || 'untitled';
      const count = nameCount[safeName] ?? 0;
      nameCount[safeName] = count + 1;
      const fileName = count > 0 ? `${safeName}_${count}.md` : `${safeName}.md`;
      // 순차 다운로드 (브라우저 팝업 차단 방지)
      setTimeout(() => {
        const blob = new Blob([note.body ?? ''], { type: 'text/markdown;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
  }, [notes]);

  const createFolder = useCallback((name: string) => {
    const folder: NoteFolder = { id: `folder-${Date.now()}`, name, createdAt: Date.now() };
    setFolders(prev => { const u = [...prev, folder]; nvSaveFolders(u); return u; });
    setActiveFolderId(folder.id);
    syncFolderToDB(folder);
  }, [syncFolderToDB]);

  const duplicateNote = useCallback((note: Note) => {
    const id = `note-${Date.now()}`;
    const copy: Note = { ...note, id, title: note.title + ' (copy)', updatedAt: Date.now(), deletedAt: null };
    setNotes(prev => { const u = [copy, ...prev]; nvSaveNotes(u); return u; });
    setActiveNoteId(id);
    syncNoteToDB(copy);
  }, [setActiveNoteId, syncNoteToDB]);

  const moveNoteToTrash = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, deletedAt: Date.now() } : n);
      nvSaveNotes(updated);
      const nextActive = updated.find(n => !n.deletedAt)?.id ?? null;
      setActiveNoteId(nextActive);
      const trashed = updated.find(n => n.id === id);
      if (trashed) syncNoteToDB(trashed);
      return updated;
    });
  }, [setActiveNoteId, syncNoteToDB]);

  const restoreNote = useCallback((id: string) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, deletedAt: null, updatedAt: Date.now() } : n);
      nvSaveNotes(updated);
      const restored = updated.find(n => n.id === id);
      if (restored) syncNoteToDB(restored);
      return updated;
    });
    setActiveNoteId(id);
  }, [setActiveNoteId, syncNoteToDB]);

  const permanentDeleteNote = useCallback((id: string) => {
    // 단일 setNotes 호출로 이중 렌더 제거
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      nvSaveNotes(updated);
      const next = updated.find(n => !n.deletedAt)?.id ?? null;
      setActiveNoteId(next);
      return updated;
    });
    removeNoteFromDB(id);
  }, [setActiveNoteId, removeNoteFromDB]);

  const deleteFolder = useCallback((id: string) => {
    setNotes(prev => {
      const affected = new Set(prev.filter(n => n.folderId === id).map(n => n.id));
      const updated = prev.map(n => affected.has(n.id) ? { ...n, folderId: null } : n);
      nvSaveNotes(updated);
      // 이 폴더에 속했던 노트들만 DB 반영 (전체 folderId=null 노트 재sync 방지)
      updated.filter(n => affected.has(n.id)).forEach(n => syncNoteToDB(n));
      return updated;
    });
    setFolders(prev => {
      const updated = prev.filter(f => f.id !== id);
      nvSaveFolders(updated);
      return updated;
    });
    setActiveFolderId(prev => prev === id ? null : prev);
    removeFolderFromDB(id);
  }, [syncNoteToDB, removeFolderFromDB]);

  // ── UI 상태 ─────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
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
  const [showRightPanel, setShowRightPanel] = useState(false); // 기본 숨김 — 미니멀 모드
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // 좌측 사이드바 축소
  // ── 이미지 드래그&드롭 ───────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const blockEditorRef = useRef<BlockEditorHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteUpdate = useCallback((id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred'>>) => {
    updateNote(id, patch);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedAt(new Date()), 600);
  }, [updateNote]);

  // ── 필터링 ──────────────────────────────────────────────────────
  const visibleNotes = useMemo(() => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    let list: Note[] =
      activeFolderId === 'trash'   ? safeNotes.filter(n => n.deletedAt) :
      activeFolderId === 'starred' ? safeNotes.filter(n => n.starred && !n.deletedAt) :
      activeFolderId               ? safeNotes.filter(n => n.folderId === activeFolderId && !n.deletedAt) :
                                     safeNotes.filter(n => !n.deletedAt);
    if (activeTag)          list = list.filter(n => extractTags(n.body ?? '').includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n => (n.title ?? '').toLowerCase().includes(q) || (n.body ?? '').toLowerCase().includes(q));
    }
    // 정렬
    list = [...list].sort((a, b) => {
      if (sortOrder === 'title')   return (a.title ?? '').localeCompare(b.title ?? '');
      if (sortOrder === 'created') return Number((a.id ?? '').split('-')[1] || 0) - Number((b.id ?? '').split('-')[1] || 0);
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [notes, activeFolderId, searchQuery, activeTag, sortOrder]);

  // ── 파생 상태 — 모두 useMemo로 메모화 ─────────────────────────────
  const activeNote = useMemo(
    () => notes.find(n => n.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  const handleActiveBodyChange = useCallback(
    (md: string) => { if (activeNoteId) noteUpdate(activeNoteId, { body: md }); },
    [activeNoteId, noteUpdate],
  );

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

  // 위키링크 [[ 자동완성 후보 — 삭제되지 않은 노트의 제목
  const wikiTargets = useMemo(
    () => notes.filter(n => !n.deletedAt && (n.title ?? '').trim()).map(n => n.title),
    [notes]
  );
  const backlinks = useMemo(() =>
    activeNote
      ? notes.filter(n => n.id !== activeNote.id && !n.deletedAt && (n.body ?? '').includes(`[[${activeNote.title ?? ''}]]`))
      : [],
    [notes, activeNote?.id, activeNote?.title]
  );

  // 백링크 컨텍스트 — 각 백링크 노트에서 [[제목]] 포함 문단 발췌
  const backlinkContexts = useMemo(() =>
    activeNote
      ? extractLinkContexts(activeNote.title ?? '', notes)
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, activeNote?.id, activeNote?.title]
  );
  const allTags = useMemo(() => {
    const m: Record<string, number> = {};
    notes.filter(n => !n.deletedAt).forEach(n =>
      extractTags(n.body ?? '').forEach(t => { m[t] = (m[t] || 0) + 1; })
    );
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [notes]);
  // noteTags: activeNote.body가 바뀔 때만 재계산
  const noteTags = useMemo(
    () => activeNote ? extractTags(activeNote.body) : [],
    [activeNote?.body]
  );

  // ── 폴더 ────────────────────────────────────────────────────────
  const addFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName(''); setShowFolderForm(false);
  }, [newFolderName, createFolder]);

  // 포커스된 블록 뒤에 이미지 삽입 (edit 모드 BlockEditor ref 경유)
  const insertImageAtCursor = useCallback((name: string, src: string) => {
    if (viewMode !== 'edit' || !blockEditorRef.current) return;
    blockEditorRef.current.insertImage(src, name);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedAt(new Date()), 600);
  }, [viewMode]);

  const insertEmptyImageBlockAtCursor = useCallback(() => {
    if (viewMode !== 'edit' || !blockEditorRef.current) return;
    blockEditorRef.current.insertEmptyImageBlock();
  }, [viewMode]);

  // ── 이미지 드래그&드롭 (에디터 영역 — 이미지 블록 위는 제외) ─────
  const handleEditorDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!activeNote || viewMode !== 'edit') return;
    if ((e.target as HTMLElement).closest('.be-image-block')) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => insertImageAtCursor(file.name.replace(/\.[^.]+$/, ''), ev.target?.result as string);
      reader.readAsDataURL(file);
    });
  }, [activeNote, viewMode, insertImageAtCursor]);

  // ── .md 파일 Import ─────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const body = ev.target?.result as string;
        const title = file.name.replace(/\.md$/i, '');
        const id = `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const note: Note = { id, title, body, updatedAt: Date.now(), folderId: activeFolderId === 'trash' ? null : activeFolderId, deletedAt: null, starred: false };
        setNotes(prev => { const u = [note, ...prev]; nvSaveNotes(u); return u; });
        setActiveNoteId(id);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  // ── 전역 단축키 — ref 패턴으로 핸들러를 한 번만 등록 ─────────────
  // 가변 값은 ref에 저장해 stale closure 없이 항상 최신 값 읽기
  const shortcutRef = useRef({
    showSortMenu, viewMode, activeNote, createNote, duplicateNote,
  });
  useEffect(() => {
    shortcutRef.current = { showSortMenu, viewMode, activeNote, createNote, duplicateNote };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { showSortMenu: sm, activeNote: an, createNote: cn, duplicateNote: dn } = shortcutRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (sm && e.key === 'Escape') { setShowSortMenu(false); return; }
      if (!mod) return;

      // ── Save (Ctrl+S) — 즉시 저장 표시 ─────────────────────
      if (e.key === 's') {
        e.preventDefault();
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSavedAt(new Date());
        return;
      }

      switch (e.key) {
        case 'n': e.preventDefault(); cn(); break;
        case 'd': e.preventDefault(); { if (an) dn(an); } break;
        case 'e': e.preventDefault(); setViewMode(v => v === 'preview' ? 'edit' : 'preview'); break;
        case 'g': e.preventDefault(); setViewMode(v => v === 'graph' ? 'preview' : 'graph'); break;
        case 'f': e.preventDefault(); setFocusMode(v => !v); break;
        case '/': e.preventDefault(); setShowShortcuts(v => !v); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 핸들러는 마운트 시 한 번만 등록 — 최신 값은 shortcutRef를 통해 읽음

  // 위키링크 따라가기 — 제목이 일치하는(삭제되지 않은) 노트로 이동
  const navigateToWiki = useCallback((title: string) => {
    const found = notes.find(n => n.title === title && !n.deletedAt);
    if (found) setActiveNoteId(found.id);
  }, [notes, setActiveNoteId]);

  // TOC 점프 — 헤딩 블록(data-be-heading=순번)으로 스크롤. edit/preview 공통.
  const scrollToHeading = useCallback((headingIdx: number) => {
    const el = document.querySelector(`[data-be-heading="${headingIdx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // 블록 readOnly 프리뷰용 클릭 위임 — be-wikilink / be-tag data 속성 처리
  const handleBlockPreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wl = target.closest('.be-wikilink') as HTMLElement | null;
    if (wl?.dataset.wiki) {
      const title = wl.dataset.wiki;
      const found = notes.find(n => n.title === title && !n.deletedAt);
      if (found) setActiveNoteId(found.id);
      return;
    }
    const tg = target.closest('.be-tag') as HTMLElement | null;
    if (tg?.dataset.tag) {
      const tag = tg.dataset.tag;
      setActiveTag(prev => prev === tag ? null : (tag ?? null));
      return;
    }
    // 편집 가능한 셀/체크박스 등 인터랙티브 요소 클릭은 무시
    if (target.closest('[contenteditable], button, input, textarea, .be-block .be-handles')) return;
    if (e.detail === 2) setViewMode('edit');
  }, [notes, setActiveNoteId]);

  // ── 색상 테마 (dark 바뀔 때만 재생성) ──────────────────────────────
  const c = useMemo(() => ({
    wrap:      dark ? '#18181A' : '#F5F4F0',
    sidebar:   dark ? '#1C1C1E' : '#FAFAF8',
    sideBdr:   dark ? '#2A2A2C' : '#E8E5DE',
    notelist:  dark ? '#141416' : '#F2F0EA',
    editor:    dark ? '#18181A' : '#FAFAF8',
    toolbar:   dark ? '#1C1C1E' : '#F0EDE5',
    toolBdr:   dark ? '#222'    : '#E2DDD5',
    card:      dark ? '#2C2C2E' : '#FFFFFF',
    cardHov:   dark ? '#323234' : '#F0EDE5',
    cardAct:   dark ? '#3A3A3C' : '#FFF8E1',
    cardActBdr:dark ? '#FACC15' : '#D4A000',
    text:      dark ? '#E8E6E0' : '#1C1C1E',
    textMuted: dark ? '#6B7280' : '#6B6860',
    textFaint: dark ? '#3A3A3C' : '#C8C4B8',
    accent:    dark ? '#FACC15' : '#B8860B',
    accentBg:  dark ? '#FACC1520' : '#FFF8DC',
    input:     dark ? '#2C2C2E' : '#F5F3EC',
    inputBdr:  dark ? '#3A3A3C' : '#DDD9CF',
    badge:     dark ? '#FACC1520' : '#FFF3CD',
    badgeTxt:  dark ? '#FACC15'   : '#92660A',
    tag:       dark ? '#8B5CF620' : '#F5F0E8',
    tagTxt:    dark ? '#A78BFA'   : '#7A6544',
    danger:    dark ? '#F87171'   : '#DC2626',
    green:     dark ? '#4ADE80'   : '#15803D',
  }), [dark]);

  // ── 블록 에디터 색상 팔레트 (c → BlockEditorColors 매핑) ──────────
  const blockColors = useMemo<BlockEditorColors>(() => ({
    bg:         c.editor,
    text:       c.text,
    textMuted:  c.textMuted,
    textFaint:  c.textFaint,
    accent:     c.accent,
    accentBg:   c.accentBg,
    border:     c.sideBdr,
    card:       c.card,
    cardHov:    c.cardHov,
    input:      c.input,
    inputBdr:   c.inputBdr,
    toolbar:    c.toolbar,
    danger:     c.danger,
    green:      c.green,
    codeBg:     dark ? '#1C1C1E' : '#F5F2EA',
    calloutBg:  c.accentBg,
    toggleBg:   dark ? '#FACC1510' : '#FFF8E1',
    quoteBdr:   c.textFaint,
    selection:  c.accentBg,
  }), [c, dark]);

  // 매 렌더마다 filter() 반복 방지
  const trashCount      = useMemo(() => notes.filter(n => n.deletedAt).length,              [notes]);
  const starredCount    = useMemo(() => notes.filter(n => n.starred && !n.deletedAt).length, [notes]);
  const activeNoteCount = useMemo(() => notes.filter(n => !n.deletedAt).length,              [notes]);
  const isTrash      = activeFolderId === 'trash';

  const folderLabel = useMemo(() =>
    activeFolderId === null    ? 'All Notes' :
    activeFolderId === 'trash' ? '🗑 Trash' :
    (folders.find(f => f.id === activeFolderId)?.name ?? ''),
    [activeFolderId, folders]
  );

  // 렌더마다 새 배열 생성 방지 — icon은 JSX이므로 useMemo로 안정화
  const VIEW_MODES = useMemo(() => [
    { key: 'edit'    as const, icon: <Edit3 size={11}/>,   label: 'Edit' },
    { key: 'preview' as const, icon: <Eye size={11}/>,     label: 'Read' },
    { key: 'graph'   as const, icon: <GitFork size={11}/>, label: 'Graph' },
  ], []);
  const RIGHT_PANELS = useMemo(() => [
    { key: 'toc'   as const, label: 'Outline', icon: <AlignLeft size={11}/> },
    { key: 'links' as const, label: 'Links',   icon: <Link size={11}/> },
    { key: 'tags'  as const, label: 'Tags',    icon: <Tag size={11}/> },
    { key: 'stats' as const, label: 'Stats',   icon: <span style={{ fontSize: 10, fontWeight: 700 }}>#</span> },
  ], []);

  // ── CSS (c가 바뀔 때만 재생성) ──────────────────────────────────
  const CSS = useMemo(() => `
    /* ── 프리뷰 렌더 ── */
    .broot{font-size:15px;line-height:1.9;padding:40px 60px;max-width:860px;margin:0 auto;color:${c.text}}
    .bh1{font-size:26px;font-weight:800;margin:32px 0 10px;color:${c.text};letter-spacing:-.5px}
    .bh2{font-size:20px;font-weight:700;margin:24px 0 8px;color:${c.text}}
    .bh3{font-size:16px;font-weight:600;margin:16px 0 6px;color:${c.textMuted}}
    .bpara{margin:4px 0;min-height:1.4em}
    .bempty{height:10px}
    .bbold{font-weight:700}
    .bital{font-style:italic;color:${c.textMuted}}
    .bhl{background:${dark ? '#FACC1530' : '#FFF3A3'};color:${dark ? '#FACC15' : '#7A5500'};padding:1px 4px;border-radius:3px}
    .bcode{font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;background:${dark ? '#2C2C2E' : '#F0EDE5'};color:${dark ? '#A8FF78' : '#5C3A1E'};padding:2px 6px;border-radius:4px}
    .bpre{background:${dark ? '#1C1C1E' : '#F5F2EA'};border:1px solid ${c.sideBdr};border-radius:10px;padding:18px 20px;margin:12px 0;overflow-x:auto;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;color:${dark ? '#A8FF78' : '#3D2B1A'};white-space:pre;line-height:1.6}
    .bul-group,.bol-group{margin:6px 0 6px 4px;padding:0;list-style:none}
    .bul{position:relative;padding:2px 0 2px 18px;color:${c.text}}
    .bul::before{content:'•';position:absolute;left:4px;color:${c.textMuted}}
    .bol{position:relative;padding:2px 0 2px 18px;color:${c.text};counter-increment:listctr}
    .bchk{padding:3px 0;color:${c.textMuted};font-size:14px;display:flex;align-items:baseline;gap:6px}
    .bchk.done{color:${c.green};text-decoration:line-through;opacity:.75}
    .bhr{border:none;border-top:1px solid ${c.sideBdr};margin:20px 0}
    .bimg{max-width:100%;border-radius:10px;margin:10px 0;border:1px solid ${c.sideBdr}}
    table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;border-radius:8px;overflow:hidden}
    th{background:${dark ? '#2C2C2E' : '#F0EDE5'};color:${c.text};padding:9px 14px;text-align:left;border:1px solid ${c.sideBdr};font-weight:600;font-size:13px}
    td{padding:9px 14px;border:1px solid ${c.sideBdr};color:${c.text};font-size:13px}
    tr:nth-child(even) td{background:${dark ? '#1E1E20' : '#FAF8F3'}}
    tr:hover td{background:${c.cardHov}}
    .bwl{color:${dark ? '#FACC15' : '#92660A'};cursor:pointer;border-bottom:1px solid ${dark ? '#FACC1560' : '#D4A00060'};padding-bottom:1px;font-weight:500}
    .bwl:hover{opacity:.75}
    .bwlm{color:${c.danger};border-bottom:1px dashed ${c.danger}50;padding-bottom:1px}
    .bwtag{color:${c.tagTxt};background:${c.tag};border-radius:4px;padding:1px 7px;font-size:12px;cursor:pointer;font-weight:500}
    .bwtag:hover{opacity:.8}
    .bmathb{overflow-x:auto;padding:12px 0;text-align:center;display:block}
    .bmathi{display:inline}
    .bmerr{color:${c.danger};font-size:12px}
    /* ── Notion 스타일 토글 ── */
    .btoggle{margin:4px 0;border-radius:6px}
    .btsummary{cursor:pointer;padding:4px 6px;border-radius:6px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;color:${c.text};user-select:none}
    .btsummary::before{content:'▶';font-size:9px;color:${c.textMuted};transition:transform .15s;flex-shrink:0}
    details[open] > .btsummary::before{transform:rotate(90deg)}
    .btsummary:hover{background:${c.cardHov}}
    .btbody{padding:4px 0 4px 22px;border-left:2px solid ${c.textFaint};margin-left:10px}
    /* ── 에디터/UI ── */
    .btbtn{background:none;border:none;color:${c.textMuted};cursor:pointer;padding:4px 6px;border-radius:5px;transition:all .12s;display:flex;align-items:center}
    .btbtn:hover{background:${c.cardHov};color:${c.accent}}
    .bfi{display:flex;align-items:center;gap:7px;padding:6px 11px;cursor:pointer;transition:background .12s;font-size:12px;color:${c.text}}
    .bfi:hover{background:${c.cardHov}}
    .bfi.active{background:${c.accentBg};border-right:2px solid ${c.accent};color:${c.accent};font-weight:600}
    .bni{padding:8px 10px;cursor:pointer;border-bottom:1px solid ${c.sideBdr};transition:background .12s}
    .bni:hover{background:${c.cardHov}}
    .bni.active{background:${c.cardAct};border-left:3px solid ${c.cardActBdr}}
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
    .btpill.active{border-color:${c.tagTxt};font-weight:600}
    .bbl{padding:6px 10px;font-size:12px;color:${c.accent};cursor:pointer;border-radius:5px}
    .bbl:hover{background:${c.cardHov}}
    .bshl{background:${dark ? '#FACC1550' : '#FFE88A'};color:${dark ? '#FACC15' : '#7A5500'};border-radius:2px;padding:0 2px}
    .bsc-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${c.sideBdr};font-size:13px}
    .bsc-key{background:${c.toolbar};border:1px solid ${c.toolBdr};border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace;color:${c.text}}
    .focus-overlay{position:fixed;inset:0;background:${dark ? '#000' : '#FAF8F3'};opacity:.94;z-index:98;pointer-events:none}
    .bsort-menu{position:absolute;top:30px;right:0;background:${c.card};border:1px solid ${c.sideBdr};border-radius:8px;box-shadow:0 4px 16px #00000015;z-index:100;overflow:hidden;min-width:130px}
    .bsort-item{padding:7px 12px;font-size:12px;cursor:pointer;color:${c.text};display:flex;align-items:center;gap:6px}
    .bsort-item:hover{background:${c.cardHov}}
    .bsort-item.active{color:${c.accent};font-weight:600}
    .bstat-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${c.sideBdr}40;font-size:12px}
    .bstat-val{font-weight:700;color:${c.accent}}
    .btag-cloud span{display:inline-block;border-radius:999px;cursor:pointer;transition:all .1s}
    .btag-cloud span:hover{opacity:.75}
    .bdrag-over{background:${c.accentBg} !important;border:1px dashed ${c.accent} !important;border-radius:6px}
    .bnote-drag{opacity:.35}
    /* ── 드래그&드롭 에디터 오버레이 ── */
    .editor-drop-zone{position:relative}
    .editor-drop-overlay{position:absolute;inset:0;background:${c.accentBg};border:3px dashed ${c.accent};border-radius:12px;display:flex;align-items:center;justify-content:center;z-index:20;pointer-events:none;font-size:15px;color:${c.accent};font-weight:700;gap:8px;opacity:.92}
    /* ── 아이콘 사이드바 ── */
    .bicon-bar{display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:2px}
    .bicon-btn{background:none;border:none;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:${c.textMuted};transition:all .12s;position:relative}
    .bicon-btn:hover{background:${c.cardHov};color:${c.accent}}
    .bicon-btn.active{background:${c.accentBg};color:${c.accent}}
    .bicon-tooltip{position:absolute;left:42px;background:${c.card};border:1px solid ${c.sideBdr};color:${c.text};font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;z-index:200;box-shadow:0 2px 8px #00000015}
    .bicon-btn:hover .bicon-tooltip{opacity:1}
  `, [c]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.wrap, color: c.text, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>
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
              ['Ctrl + N',         'New Note'],
              ['Ctrl + D',         'Duplicate Note'],
              ['Ctrl + E',         'Toggle Preview'],
              ['Ctrl + G',         'Toggle Graph View'],
              ['Ctrl + F',         'Focus Mode'],
              ['Ctrl + /',         'Show Shortcuts'],
              [null, null],
              ['Ctrl + S',         'Save (instant)'],
              ['Ctrl + Z',         'Undo (edit mode)'],
              ['Ctrl + Y / ⇧+Z',  'Redo (edit mode)'],
              [null, null],
              ['/',                'Slash command — insert block'],
              ['[[...]]',          'Wiki link autocomplete'],
              ['Ctrl + Click',     'Follow wiki link (edit mode)'],
              ['↑ ↓ Enter',        'Navigate menus'],
              ['Esc',              'Close / cancel'],
            ].map(([key, desc], i) => (
              key === null
                ? <div key={i} style={{ height: 1, background: c.textFaint, margin: '6px 0' }} />
                : <div key={key} className="bsc-row">
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
      {!focusMode && (
        <div style={{ width: sidebarCollapsed ? 44 : 185, minWidth: sidebarCollapsed ? 44 : 185, background: c.sidebar, borderRight: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .2s, min-width .2s', overflow: 'hidden', zIndex: 99 }}>
          {sidebarCollapsed ? (
            <div className="bicon-bar" style={{ flex: 1 }}>
              <button className="bicon-btn" onClick={() => setSidebarCollapsed(false)} style={{ marginBottom: 4 }}>
                <ChevronRight size={14}/>
                <span className="bicon-tooltip">Expand sidebar</span>
              </button>
              <div style={{ width: 20, height: 1, background: c.sideBdr, margin: '2px 0 6px' }}/>
              <button className={`bicon-btn ${activeFolderId === null && !activeTag ? 'active' : ''}`}
                onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); }}>
                <AlignLeft size={14}/>
                <span className="bicon-tooltip">All Notes ({activeNoteCount})</span>
              </button>
              <button className={`bicon-btn ${activeFolderId === 'starred' ? 'active' : ''}`}
                onClick={() => { setActiveFolderId('starred' as any); setActiveTag(null); }}>
                <Star size={14} fill={activeFolderId === 'starred' ? c.accent : 'none'} color={activeFolderId === 'starred' ? c.accent : c.textMuted}/>
                <span className="bicon-tooltip">Starred</span>
              </button>
              {folders.map(f => (
                <button key={f.id} className={`bicon-btn ${activeFolderId === f.id ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId(f.id); setActiveTag(null); }}>
                  <span style={{ fontSize: 14 }}>📁</span>
                  <span className="bicon-tooltip">{f.name} ({notes.filter(n => n.folderId === f.id && !n.deletedAt).length})</span>
                </button>
              ))}
              <div style={{ flex: 1 }}/>
              <button className={`bicon-btn ${isTrash ? 'active' : ''}`}
                onClick={() => setActiveFolderId('trash')} style={{ color: isTrash ? c.danger : c.textMuted }}>
                <Trash2 size={14}/>
                {trashCount > 0 && <span className="bicon-tooltip">Trash ({trashCount})</span>}
                {trashCount === 0 && <span className="bicon-tooltip">Trash</span>}
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 10px 8px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: c.accent, letterSpacing: -.3 }}>Note</span>
                <span style={{ fontSize: 9, color: c.accent, fontFamily: 'monospace', background: c.accentBg, padding: '1px 4px', borderRadius: 3 }}>β</span>
                <div style={{ flex: 1 }}/>
                <button onClick={() => setShowShortcuts(true)} className="btbtn" style={{ padding: '2px 3px' }} title="Shortcuts"><Keyboard size={11}/></button>
                <button onClick={() => setSidebarCollapsed(true)} className="btbtn" style={{ padding: '2px 3px' }} title="Collapse">
                  <ChevronRight size={11} style={{ transform: 'rotate(180deg)' }}/>
                </button>
              </div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${c.sideBdr}`, position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: c.textMuted }}/>
                <input className="bwsi" style={{ fontSize: 11 }} placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className={`bfi ${activeFolderId === null && !activeTag ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); }}>
                  <span style={{ flex: 1 }}>All Notes</span>
                  <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>
                    {notes.filter(n => !n.deletedAt).length}
                  </span>
                </div>
                <div className={`bfi ${activeFolderId === 'starred' ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId('starred' as any); setActiveTag(null); }}>
                  <Star size={10} color={activeFolderId === 'starred' ? c.accent : c.textMuted} fill={activeFolderId === 'starred' ? c.accent : 'none'}/>
                  <span style={{ flex: 1 }}>Starred</span>
                  {starredCount > 0 && <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>{starredCount}</span>}
                </div>
                <div className="bseclbl">Folders</div>
                {folders.map(f => (
                  <div key={f.id} className={`bfi ${activeFolderId === f.id ? 'active' : ''}`}
                    onClick={() => { setActiveFolderId(f.id); setActiveTag(null); }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bdrag-over'); }}
                    onDragLeave={e => e.currentTarget.classList.remove('bdrag-over')}
                    onDrop={e => { e.currentTarget.classList.remove('bdrag-over'); if (dragNoteId) { noteUpdate(dragNoteId, { folderId: f.id }); setDragNoteId(null); } }}
                    style={{ gap: 4 }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{f.name}</span>
                    <span style={{ fontSize: 9, color: c.textMuted }}>{notes.filter(n => n.folderId === f.id && !n.deletedAt).length}</span>
                    <button onClick={e => { e.stopPropagation(); deleteFolder(f.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: '1px 2px', borderRadius: 3, opacity: 0 }}
                      className="folder-del"
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                      <Trash2 size={9}/>
                    </button>
                  </div>
                ))}
                {showFolderForm ? (
                  <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input className="bwi" style={{ width: '100%', fontSize: 11 }} placeholder="Folder name"
                      value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setShowFolderForm(false); }}
                      autoFocus/>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="bwbg" style={{ flex: 1, padding: '3px', fontSize: 11 }} onClick={addFolder}>Add</button>
                      <button onClick={() => setShowFolderForm(false)}
                        style={{ flex: 1, background: c.cardHov, border: 'none', borderRadius: 5, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '3px' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="bfi" onClick={() => setShowFolderForm(true)} style={{ color: c.textMuted, fontSize: 10 }}>
                    <FolderPlus size={10} color={c.textMuted}/><span>New Folder</span>
                  </div>
                )}
                {allTags.length > 0 && (
                  <>
                    <div className="bseclbl" style={{ marginTop: 4 }}>Tags</div>
                    <div style={{ padding: '3px 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {allTags.map(([tag, count]) => (
                        <span key={tag} className={`btpill ${activeTag === tag ? 'active' : ''}`}
                          onClick={() => setActiveTag(prev => prev === tag ? null : tag)}>
                          #{tag} <span style={{ color: c.textMuted, marginLeft: 1 }}>{count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
                  <div className={`bfi ${isTrash ? 'active' : ''}`} onClick={() => setActiveFolderId('trash')}>
                    <Trash2 size={10} color={isTrash ? c.danger : c.textMuted}/>
                    <span style={{ flex: 1, color: isTrash ? c.danger : undefined }}>Trash</span>
                    {trashCount > 0 && <span style={{ fontSize: 9, background: `${c.danger}20`, color: c.danger, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>{trashCount}</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
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
              <button onClick={exportAllNotes} className="btbtn" title={`Export all ${activeNoteCount} notes as .md`}>
                <Save size={11}/>
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
              <input ref={titleInputRef} value={activeNote.title} readOnly={isTrash}
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
                  <Star size={13} color={activeNote.starred ? (dark ? '#FACC15' : '#B8860B') : c.textMuted} fill={activeNote.starred ? (dark ? '#FACC15' : '#B8860B') : 'none'}/>
                </button>
              )}
              {/* Duplicate */}
              {!isTrash && (
                <button onClick={() => duplicateNote(activeNote)} className="btbtn" title="Duplicate (Ctrl+D)">
                  <span style={{ fontSize: 11 }}>⎘</span>
                </button>
              )}
              {/* Right panel toggle */}
              <button onClick={() => setShowRightPanel(v => !v)} className="btbtn" title="Toggle sidebar"
                style={{ color: showRightPanel ? c.accent : c.textMuted }}>
                <AlignLeft size={12}/>
              </button>
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
                <NoteGraphView notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={activeNoteId} onSelect={id => { setActiveNoteId(id); setViewMode('preview'); }} dark={dark}/>
              </div>
            ) : (
              <>
                {/* Toolbar - edit 모드에서만 (블록 에디터: 슬래시 커맨드 기반) */}
                {!isTrash && viewMode === 'edit' && (
                  <div style={{ padding: '5px 12px', borderBottom: `1px solid ${c.toolBdr}`, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: c.toolbar, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: c.text }}>/</kbd>
                      입력으로 블록 추가 · 드래그로 순서 변경 · Ctrl+클릭으로 [[링크]] 이동
                    </span>
                    <button onClick={() => importInputRef.current?.click()} className="btbtn" title="Import .md files" style={{ marginLeft: 4 }}>
                      <Upload size={13}/>
                    </button>
                    <button onClick={insertEmptyImageBlockAtCursor} className="btbtn" title="Insert image block at cursor">
                      <ImageIcon size={13}/>
                    </button>
                    {isSyncing && (
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.textMuted, opacity: 0.6, animation: 'pulse 1s infinite' }}/> syncing...
                      </span>
                    )}
                    {!isSyncing && savedAt && (
                      <span style={{ marginLeft: isSyncing ? 4 : 'auto', fontSize: 9, color: c.green, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Save size={9}/> {savedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} saved
                      </span>
                    )}
                  </div>
                )}

                {/* Body — 드래그&드롭 + 단일 컬럼 전체 너비 */}
                <div
                  className="editor-drop-zone"
                  style={{ flex: 1, overflow: 'auto', position: 'relative' }}
                  onDragOver={e => { e.preventDefault(); if (Array.from(e.dataTransfer.items).some(i => i.kind === 'file' && i.type.startsWith('image/'))) setIsDragOver(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
                  onDrop={handleEditorDrop}>
                  {isDragOver && (
                    <div className="editor-drop-overlay">
                      <ImageIcon size={22}/> Drop image to insert
                    </div>
                  )}
                  {viewMode === 'edit' && (
                    isTrash ? (
                      <div style={{ padding: '40px 60px', maxWidth: 860, margin: '0 auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, color: c.danger, fontSize: 13 }}>
                          <AlertTriangle size={14}/> In Trash — restore to edit
                        </div>
                        <div style={{ color: c.textMuted, fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{activeNote.body}</div>
                      </div>
                    ) : (
                      <div style={{ minHeight: '100%', padding: '24px 0 80px' }}>
                        <NoteBlockEditor
                          ref={blockEditorRef}
                          key={activeNote.id}
                          body={activeNote.body}
                          onBodyChange={handleActiveBodyChange}
                          colors={blockColors}
                          readOnly={false}
                          searchQuery={searchQuery}
                          wikiTargets={wikiTargets}
                          onWikiNavigate={navigateToWiki}
                        />
                      </div>
                    )
                  )}
                  {viewMode === 'preview' && (
                    <div onClick={handleBlockPreviewClick} style={{ minHeight: '100%', padding: '24px 16px 80px', maxWidth: 900, margin: '0 auto' }}>
                      <BlockEditorPreview
                        key={`${activeNote.id}-preview-${katexReady}`}
                        body={activeNote.body}
                        colors={blockColors}
                        searchQuery={searchQuery}
                        wikiTargets={wikiTargets}
                        onWikiNavigate={navigateToWiki}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          // Graph View without active note
          viewMode === 'graph' ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <NoteGraphView notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={null} onSelect={id => { setActiveNoteId(id); setViewMode('preview'); }} dark={dark}/>
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
      {activeNote && viewMode !== 'graph' && showRightPanel && (
        <div style={{ width: 210, minWidth: 210, background: c.sidebar, borderLeft: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
                      scrollToHeading(item.idx);
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
                        scrollToHeading(item.idx);
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
              {/* ── Backlinks with context ── */}
              <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textMuted, fontWeight: 600 }}>
                Backlinks {backlinks.length > 0 && <span style={{ color: c.accent }}>({backlinks.length})</span>}
              </div>
              {backlinks.length === 0
                ? <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 8px' }}>No backlinks</p>
                : backlinkContexts.map(ctx => (
                  <div key={ctx.noteId}
                    style={{
                      margin: '0 8px 6px',
                      borderRadius: 7,
                      border: `1px solid ${c.sideBdr}`,
                      background: c.cardHov,
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    onClick={() => setActiveNoteId(ctx.noteId)}
                  >
                    {/* 노트 제목 행 */}
                    <div style={{
                      padding: '5px 9px 4px',
                      display: 'flex', alignItems: 'center', gap: 5,
                      borderBottom: ctx.excerpts.length > 0 ? `1px solid ${c.sideBdr}` : 'none',
                    }}>
                      <span style={{ fontSize: 10, color: c.accent, flexShrink: 0 }}>↗</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: c.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ctx.noteTitle}
                      </span>
                    </div>
                    {/* 발췌 문단들 */}
                    {ctx.excerpts.map((excerpt, ei) => {
                      // [[제목]] 부분을 강조 표시
                      const target = `[[${activeNote!.title ?? ''}]]`;
                      const parts  = excerpt.split(target);
                      return (
                        <div key={ei} style={{
                          padding: '4px 9px 5px',
                          fontSize: 10, lineHeight: 1.55,
                          color: c.textMuted,
                          borderTop: ei > 0 ? `1px dashed ${c.sideBdr}` : 'none',
                        }}>
                          {parts.map((part, pi) => (
                            <span key={pi}>
                              {part}
                              {pi < parts.length - 1 && (
                                <mark style={{
                                  background: dark ? '#FACC1433' : '#DBEAFE',
                                  color: dark ? '#FACC14' : '#1D4ED8',
                                  borderRadius: 3,
                                  padding: '0 2px',
                                  fontWeight: 600,
                                }}>
                                  {target}
                                </mark>
                              )}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))
              }
              {/* ── Outgoing links ── */}
              {(() => {
                const outLinks = extractLinks(activeNote.body);
                const found = outLinks.map(t => notes.find(n => n.title === t && !n.deletedAt)).filter((n): n is Note => n !== undefined);
                return found.length > 0 ? (
                  <>
                    <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 600, borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
                      Outgoing {<span style={{ color: c.green }}>({found.length})</span>}
                    </div>
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
              <button onClick={() => showConfirm(
                  'Delete this note permanently? This cannot be undone.',
                  () => permanentDeleteNote(activeNote.id),
                  { confirmLabel: 'Delete', variant: 'destructive' }
                )}
                style={{ width: '100%', background: `${c.danger}15`, border: `1px solid ${c.danger}40`, color: c.danger, borderRadius: 6, padding: '6px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                Delete Permanently
              </button>
            </div>
          )}
        </div>
      )}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={handleConfirm}
          onCancel={clearConfirm}
          darkMode={dark}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
        />
      )}
    </div>
  );
};