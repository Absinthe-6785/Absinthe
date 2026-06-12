import { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Eye, Type,
  RotateCcw, AlertTriangle, Star, CalendarDays,
  Tag, Link, AlignLeft, Image as ImageIcon, Save,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, GitFork, Upload, Keyboard,
  SlidersHorizontal, ArrowRightLeft, LayoutDashboard, Folder, Copy,
} from 'lucide-react';
import type { EditorSearchScope } from './editorSearch';
import { useConfirm } from '../../hooks/useConfirm';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ConfirmModal } from '../common/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { useNotesStore } from '../../store/useNotesStore';
import {
  highlightText,
  extractTOC, extractTags, extractLinks,
  extractLinkContexts,
  findNoteByTitle,
  parseNoteSearchQuery, noteMatchesTagSearch,
  normalizeNoteFolderId,
} from './noteUtils';
import {
  extractMentionContexts,
  buildExpandedGraphData,
  collapseNode,
  expandNode,
  filterNotes,
  formatParsedQuery,
  hasKnowledgeQuerySyntax,
  buildFormulaQueryCatalog,
  knowledgeIndexService,
  parseQuery,
  LinkedReferencesPanel,
  LocalGraphView,
  RelatedNotesPanel,
  SavedViewsSection,
  SmartCollectionsSection,
  RuleCollectionsSection,
  DatabaseViewPanel,
  DatabaseViewsSection,
  PinnedWorkspacesSection,
  RecentWorkSection,
  WorkspaceDashboardView,
  SMART_COLLECTIONS,
  INACTIVE_WORKSPACE,
  useNoteWorkspace,
  createInboxNote,
  buildTaskNote,
  buildJournalNote,
  resolveTaskTemplateId,
  resolveJournalTemplateId,
  TASK_TEMPLATES,
  JOURNAL_TEMPLATES,
  type QuickCaptureInput,
  type CreateTaskInput,
  type CreateJournalInput,
  listTags,
  noteMatchesPageTag,
  NotePropertiesPanel,
  NoteTagsPanel,
  NoteRelationsPanel,
  parseNoteMarkdown,
  serializeNoteMarkdown,
  type SavedView,
  type SmartCollection,
  type RuleCollection,
  type DatabaseView,
  type DatabaseViewPresentation,
  DailyTraceDayView,
  RangeTraceLensView,
  AreaTraceView,
  AreaDiscoveryView,
  EventNoteDialog,
  MilestoneNoteDialog,
  toDateKey,
  formatTraceDayHeading,
  formatAreaRangeHeading,
  formatRangeLensHeading,
  buildDailyTraceProjection,
  buildRangeLensProjection,
  buildAreaTraceProjection,
  buildAreaRangeLensProjection,
  buildAreaDiscoveryProjection,
  currentTraceMonth,
  currentTraceQuarter,
  currentTraceYear,
  rangeTraceMarkCount,
  areaTraceMarkCount,
  areaRangeTraceMarkCount,
  areaDiscoveryObservationCount,
  applyAreaToNote,
  clearAreaFromNote,
  canMarkAsArea,
  isAreaNote,
  listAreaNotes,
  applyEventToNote,
  applyMilestoneToNote,
  clearEventFromNote,
  clearMilestoneFromNote,
  isEventNote,
  isMilestoneNote,
  eventFormValuesFromNote,
  milestoneFormValuesFromNote,
  type EventFormValues,
  type MilestoneFormValues,
  type TraceRangeLens,
} from './features/knowledge';
import type { NoteBase as Note, NoteFolderBase as NoteFolder, TocItem } from './noteUtils';
import type { AppSettings } from '../../types';
import { NoteGraphView } from './NoteGraphView';
import {
  BlockEditor,
  useBlockEditor,
  type BlockEditorColors,
  type BlockEditorHandle,
} from './BlockEditor';
import {
  buildNoteChrome,
  buildBlockEditorColors,
  NOTE_FONT_OPTIONS,
  NOTE_DOCUMENT_MAX_WIDTH,
  NOTE_RADIUS_CARD,
} from './noteEditorTheme';
import { type EditorMode, toggleEditReading } from './editorMode';


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
  searchScope: EditorSearchScope;
  searchMatchIndex: number;
  wikiTargets: string[];
  onWikiNavigate?: (title: string) => void;
}
const NoteBlockEditor = forwardRef<BlockEditorHandle, NoteBlockEditorProps>(function NoteBlockEditor(
  { body, onBodyChange, colors, readOnly, searchQuery, searchScope, searchMatchIndex, wikiTargets, onWikiNavigate },
  ref,
) {
  const {
    blocks, handleBlockChange, undo, redo,
    insertImage, insertEmptyImageBlock, setActiveBlockId, externalFocusId, clearExternalFocus,
    getBlocks, copyDocument,
  } = useBlockEditor(body, onBodyChange);

  useImperativeHandle(ref, () => ({
    insertImage,
    insertEmptyImageBlock,
    getBlocks,
    copyDocument,
  }), [insertImage, insertEmptyImageBlock, getBlocks, copyDocument]);

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
      searchScope={searchScope}
      searchMatchIndex={searchMatchIndex}
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

  const { appSettings, updateSetting } = useAppStore();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const notes = useNotesStore(s => s.notes);
  const folders = useNotesStore(s => s.folders);
  const activeNoteId = useNotesStore(s => s.activeNoteId);
  const isSyncing = useNotesStore(s => s.isSyncing);
  const savedAt = useNotesStore(s => s.savedAt);
  const syncError = useNotesStore(s => s.syncError);
  const setActiveNoteId = useNotesStore(s => s.setActiveNoteId);
  const storeCreateNote = useNotesStore(s => s.createNote);
  const updateNote = useNotesStore(s => s.updateNote);
  const toggleStar = useNotesStore(s => s.toggleStar);
  const storeDuplicateNote = useNotesStore(s => s.duplicateNote);
  const moveNoteToTrash = useNotesStore(s => s.moveNoteToTrash);
  const restoreNote = useNotesStore(s => s.restoreNote);
  const permanentDeleteNote = useNotesStore(s => s.permanentDeleteNote);
  const storeCreateFolder = useNotesStore(s => s.createFolder);
  const storeDeleteFolder = useNotesStore(s => s.deleteFolder);
  const importNote = useNotesStore(s => s.importNote);
  const flushPendingSync = useNotesStore(s => s.flushPendingSync);
  const syncNoteToDB = useNotesStore(s => s.syncNoteToDB);
  const retrySync = useNotesStore(s => s.retrySync);

  const [activeFolderId, setActiveFolderId] = useState<string | null | 'trash' | 'starred'>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<EditorMode>('edit');

  const createNote = useCallback((initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => {
    const id = storeCreateNote({
      title: initial?.title,
      body: initial?.body,
      folderId: initial?.folderId,
      folderContext: initial?.folderId !== undefined ? undefined : activeFolderId,
    });
    setViewMode('edit');
    setTimeout(() => titleInputRef.current?.focus(), 50);
    return id;
  }, [activeFolderId, storeCreateNote]);

  const duplicateNote = useCallback((note: Note) => {
    storeDuplicateNote(note);
  }, [storeDuplicateNote]);

  const createFolder = useCallback((name: string) => {
    const id = storeCreateFolder(name);
    setActiveFolderId(id);
  }, [storeCreateFolder]);

  const deleteFolder = useCallback((id: string) => {
    storeDeleteFolder(id);
    setActiveFolderId(prev => (prev === id ? null : prev));
  }, [storeDeleteFolder]);

  const exportNote = useCallback((note: Note) => {
    const blob = new Blob([serializeNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
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
        const blob = new Blob([serializeNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
  }, [notes]);

  // ── UI 상태 ─────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchScope,    setSearchScope]    = useState<EditorSearchScope>('document');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName,  setNewFolderName]  = useState('');
  const [activeTag,      setActiveTag]      = useState<string | null>(null);
  const [rightPanel,     setRightPanel]     = useState<'toc' | 'links' | 'graph' | 'tags' | 'properties' | 'relations' | 'stats'>('toc');
  const [tocCollapsed,   setTocCollapsed]   = useState<Record<number, boolean>>({});
  const [focusMode,      setFocusMode]      = useState(false);
  const [showShortcuts,  setShowShortcuts]  = useState(false);
  const [sortOrder,      setSortOrder]      = useState<'updated' | 'title' | 'created'>('updated');
  const [showSortMenu,   setShowSortMenu]   = useState(false);
  const [dragNoteId,     setDragNoteId]     = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false); // 기본 숨김 — 미니멀 모드
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // 좌측 사이드바 축소
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [traceDate, setTraceDate] = useState<string | null>(null);
  const [traceRange, setTraceRange] = useState<TraceRangeLens | null>(null);
  const [traceAreaId, setTraceAreaId] = useState<string | null>(null);
  const [traceAreaRange, setTraceAreaRange] = useState<TraceRangeLens | null>(null);
  const [traceDiscoveryMode, setTraceDiscoveryMode] = useState(false);
  const isMobile = useIsMobile();
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const [docCopied, setDocCopied] = useState(false);
  const titleComposingRef = useRef(false);
  const [titleDraft, setTitleDraft] = useState('');
  const docCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type EventDialogState = {
    mode: 'create' | 'edit';
    noteId?: string;
    initialValues: EventFormValues;
  };
  const [eventDialog, setEventDialog] = useState<EventDialogState | null>(null);
  const openCreateEventDialogRef = useRef<(defaults?: Partial<EventFormValues>) => void>(() => {});

  type MilestoneDialogState = {
    noteId: string;
    noteTitle: string;
    initialValues: MilestoneFormValues;
    hasExistingMilestone: boolean;
  };
  const [milestoneDialog, setMilestoneDialog] = useState<MilestoneDialogState | null>(null);

  const resetBrowseScope = useCallback(() => {
    setActiveFolderId(null);
    setActiveTag(null);
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null); setTraceDiscoveryMode(false);
  }, []);

  const createQuickCaptureRef = useRef<(input: QuickCaptureInput) => string | void>(() => {});
  const createTaskRef = useRef<(input: CreateTaskInput) => string | void>(() => {});
  const createJournalRef = useRef<(input: CreateJournalInput) => string | void>(() => {});

  const workspace = useNoteWorkspace({
    notes,
    searchQuery,
    setSearchQuery,
    resetBrowseScope,
    onCreateQuickCapture: input => createQuickCaptureRef.current(input),
    onCreateTask: input => createTaskRef.current(input),
    onCreateJournal: input => createJournalRef.current(input),
  });

  const {
    workspaceActivation,
    setWorkspaceActivation,
    savedViews,
    ruleCollections,
    databaseViews,
    activeSavedView,
    activeSmartCollection,
    activeRuleCollection,
    activeDatabaseView,
    isDatabaseViewMode,
    isDashboardMode,
    dashboard,
    resumeWorkspace,
    recentNotes,
    shouldSkipUserSort,
    smartCollectionCounts,
    ruleCollectionCounts,
    databaseViewCounts,
    activeDatabaseViewNoteCount,
    canSaveCurrentView,
    canCreateRuleCollection,
    canCreateDatabaseView,
    safeNotesForDatabase,
    applyWorkspaceToNotes,
    isWorkspaceKindActive,
    handleActivateSavedView,
    handleClearSavedView,
    handleActivateSmartCollection,
    handleClearSmartCollection,
    handleActivateRuleCollection,
    handleClearRuleCollection,
    handleActivateDatabaseView,
    handleClearDatabaseView,
    handleCreateRuleCollection,
    handleRenameRuleCollection,
    handleDeleteRuleCollection,
    handleCreateDatabaseView,
    handleCreateDatabaseViewFromTemplate,
    handleRenameDatabaseView,
    handleDeleteDatabaseView,
    handleCreateSavedView,
    handleRenameSavedView,
    handleDeleteSavedView,
    patchActiveDatabaseView,
    pinnedWorkspaces,
    recentWork,
    isWorkspacePinned,
    handleActivateWorkspaceRef,
    handleTogglePinWorkspace,
    handleUnpinWorkspace,
    handleMovePinnedWorkspace,
    handleClearRecentWork,
    handleActivateDashboard,
    handleClearDashboard,
    handleResumeLastWorkspace,
    handleLeaveDashboardForNote,
    focusPresets,
    focusPresetTargets,
    focusSession,
    activeFocusPreset,
    isFocusPresetActive,
    focusUiPreferences,
    focusWorkspaceOptions,
    handleCreateFocusPreset,
    handleDeleteFocusPreset,
    handleActivateFocusPreset,
    handleExitFocusPreset,
    quickCapture,
    handleQuickCapture,
    taskTemplates,
    journalTemplates,
    handleCreateTask,
    handleCreateJournal,
    handleCreateTaskDatabase,
    handleCreateJournalDatabase,
  } = workspace;

  const todayTraceKey = toDateKey(new Date());

  const currentTraceMonthKey = currentTraceMonth();
  const currentTraceQuarterKey = currentTraceQuarter();
  const currentTraceYearKey = currentTraceYear();

  const openTraceDay = useCallback((dateKey: string) => {
    setTraceDate(dateKey);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null); setTraceDiscoveryMode(false);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setWorkspaceActivation, setSearchQuery]);

  const openTraceRange = useCallback((lens: TraceRangeLens) => {
    setTraceRange(lens);
    setTraceDate(null);
    setTraceAreaId(null);
    setTraceAreaRange(null); setTraceDiscoveryMode(false);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setWorkspaceActivation, setSearchQuery]);

  const openTraceArea = useCallback((areaNoteId: string) => {
    setTraceAreaId(areaNoteId);
    setTraceAreaRange(null); setTraceDiscoveryMode(false);
    setTraceDate(null);
    setTraceRange(null);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setWorkspaceActivation, setSearchQuery]);

  const openTraceDiscovery = useCallback(() => {
    setTraceDiscoveryMode(true);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDate(null);
    setTraceRange(null);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setWorkspaceActivation, setSearchQuery]);

  const closeTraceLens = useCallback(() => {
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null); setTraceDiscoveryMode(false);
  }, []);

  const isTraceDayMode = traceDate !== null;
  const isTraceRangeMode = traceRange !== null;
  const isTraceAreaMode = traceAreaId !== null;
  const isTraceDiscoveryMode = traceDiscoveryMode;
  const isTraceLensMode = isTraceDayMode || isTraceRangeMode || isTraceAreaMode || isTraceDiscoveryMode;

  const activeNotes = useMemo(() => notes.filter(n => !n.deletedAt), [notes]);
  const areaNotes = useMemo(() => listAreaNotes(activeNotes), [activeNotes]);

  const traceDayProjection = useMemo(
    () => (traceDate ? buildDailyTraceProjection(traceDate, activeNotes) : null),
    [traceDate, activeNotes],
  );

  const traceRangeProjection = useMemo(() => {
    if (!traceRange) return null;
    if (traceRange.kind === 'custom' && (!traceRange.startDate.trim() || !traceRange.endDate.trim())) {
      return null;
    }
    try {
      return buildRangeLensProjection(traceRange, activeNotes);
    } catch {
      return null;
    }
  }, [traceRange, activeNotes]);

  const traceAreaProjection = useMemo(() => {
    if (!traceAreaId) return null;
    if (traceAreaRange) {
      if (traceAreaRange.kind === 'custom' && (!traceAreaRange.startDate.trim() || !traceAreaRange.endDate.trim())) {
        return null;
      }
      try {
        return buildAreaRangeLensProjection(traceAreaId, traceAreaRange, activeNotes);
      } catch {
        return null;
      }
    }
    try {
      return buildAreaTraceProjection(traceAreaId, activeNotes);
    } catch {
      return null;
    }
  }, [traceAreaId, traceAreaRange, activeNotes]);

  const traceDiscoveryProjection = useMemo(
    () => (traceDiscoveryMode ? buildAreaDiscoveryProjection(activeNotes) : null),
    [traceDiscoveryMode, activeNotes],
  );

  const traceLensMarkCount = useMemo(() => {
    if (traceDiscoveryProjection) return areaDiscoveryObservationCount(traceDiscoveryProjection);
    if (traceAreaProjection) {
      return traceAreaRange && 'notesTouched' in traceAreaProjection
        ? areaRangeTraceMarkCount(traceAreaProjection)
        : areaTraceMarkCount(traceAreaProjection);
    }
    if (traceRangeProjection) return rangeTraceMarkCount(traceRangeProjection);
    if (traceDayProjection) {
      return traceDayProjection.milestones.length
        + traceDayProjection.events.length
        + traceDayProjection.activities.length;
    }
    return 0;
  }, [traceDiscoveryProjection, traceAreaProjection, traceAreaRange, traceRangeProjection, traceDayProjection]);

  const openCreateEventDialog = useCallback((defaults?: Partial<EventFormValues>) => {
    setEventDialog({
      mode: 'create',
      initialValues: {
        title: defaults?.title?.trim() ?? '',
        eventDate: defaults?.eventDate ?? toDateKey(new Date()),
        eventTime: defaults?.eventTime,
        eventEndDate: defaults?.eventEndDate,
        eventEndTime: defaults?.eventEndTime,
      },
    });
  }, []);

  const openEditEventDialog = useCallback((note: Note) => {
    setEventDialog({
      mode: 'edit',
      noteId: note.id,
      initialValues: eventFormValuesFromNote(note, toDateKey(new Date())),
    });
  }, []);

  const openMilestoneDialog = useCallback((note: Note) => {
    setMilestoneDialog({
      noteId: note.id,
      noteTitle: note.title.trim() || 'Untitled',
      initialValues: milestoneFormValuesFromNote(note, toDateKey(new Date())),
      hasExistingMilestone: isMilestoneNote(note),
    });
  }, []);

  openCreateEventDialogRef.current = openCreateEventDialog;

  const openCreatedNote = useCallback((id: string) => {
    handleLeaveDashboardForNote(id);
    setActiveNoteId(id);
    setViewMode('edit');
    return id;
  }, [handleLeaveDashboardForNote, setActiveNoteId]);

  const handleEventDialogSave = useCallback((values: EventFormValues) => {
    if (!eventDialog) return;

    if (eventDialog.mode === 'create') {
      const id = storeCreateNote({ title: values.title.trim() || 'Untitled', body: '' });
      const created = useNotesStore.getState().notes.find(n => n.id === id);
      if (created) {
        const withEvent = applyEventToNote(created, values);
        updateNote(id, { title: withEvent.title, properties: withEvent.properties });
      }
      openCreatedNote(id);
    } else if (eventDialog.noteId) {
      const note = useNotesStore.getState().notes.find(n => n.id === eventDialog.noteId);
      if (note) {
        const withEvent = applyEventToNote(note, values);
        updateNote(note.id, { title: withEvent.title, properties: withEvent.properties });
      }
    }

    setEventDialog(null);
  }, [eventDialog, storeCreateNote, updateNote, openCreatedNote]);

  const handleRemoveEventStatus = useCallback(() => {
    if (!eventDialog?.noteId) return;
    const note = useNotesStore.getState().notes.find(n => n.id === eventDialog.noteId);
    if (!note) return;
    const cleared = clearEventFromNote(note);
    updateNote(note.id, { properties: cleared.properties });
    setEventDialog(null);
  }, [eventDialog, updateNote]);

  const handleMilestoneDialogSave = useCallback((values: MilestoneFormValues) => {
    if (!milestoneDialog) return;
    const note = useNotesStore.getState().notes.find(n => n.id === milestoneDialog.noteId);
    if (!note) return;
    const withMilestone = applyMilestoneToNote(note, values);
    updateNote(note.id, { properties: withMilestone.properties });
    setMilestoneDialog(null);
  }, [milestoneDialog, updateNote]);

  const handleRemoveMilestone = useCallback(() => {
    if (!milestoneDialog) return;
    const note = useNotesStore.getState().notes.find(n => n.id === milestoneDialog.noteId);
    if (!note) return;
    const cleared = clearMilestoneFromNote(note);
    updateNote(note.id, { properties: cleared.properties });
    setMilestoneDialog(null);
  }, [milestoneDialog, updateNote]);

  createQuickCaptureRef.current = (input: QuickCaptureInput) => {
    if (input.captureType === 'event') {
      openCreateEventDialogRef.current({
        title: input.title,
        eventDate: toDateKey(new Date()),
      });
      return;
    }
    const id = storeCreateNote({ title: input.title, body: '' });
    const created = notes.find(n => n.id === id);
    if (created) {
      if (input.captureType === 'task') {
        const template = resolveTaskTemplateId(input.taskTemplateId, TASK_TEMPLATES);
        if (template) {
          const taskNote = buildTaskNote(created, template, {
            title: input.title,
            toInbox: true,
          });
          updateNote(id, { title: taskNote.title, properties: taskNote.properties });
        }
      } else {
        const tagged = createInboxNote(created, { captureType: input.captureType });
        updateNote(id, { properties: tagged.properties });
      }
    }
    return openCreatedNote(id);
  };

  createTaskRef.current = (input: CreateTaskInput) => {
    const template = resolveTaskTemplateId(input.templateId, TASK_TEMPLATES);
    if (!template) return;
    const id = storeCreateNote({ title: input.title?.trim() || template.defaultTitle, body: '' });
    const created = notes.find(n => n.id === id);
    if (created) {
      const taskNote = buildTaskNote(created, template, {
        title: input.title,
        toInbox: input.toInbox ?? true,
      });
      updateNote(id, { title: taskNote.title, body: taskNote.body, properties: taskNote.properties });
    }
    return openCreatedNote(id);
  };

  createJournalRef.current = (input: CreateJournalInput) => {
    const template = resolveJournalTemplateId(input.templateId, JOURNAL_TEMPLATES);
    if (!template) return;
    const id = storeCreateNote({ title: input.title?.trim() || template.defaultTitle, body: '' });
    const created = notes.find(n => n.id === id);
    if (created) {
      const journalNote = buildJournalNote(created, template, { title: input.title });
      updateNote(id, {
        title: journalNote.title,
        body: journalNote.body,
        properties: journalNote.properties,
      });
    }
    return openCreatedNote(id);
  };

  const handleActivateDashboardWithTraceClear = useCallback(() => {
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null); setTraceDiscoveryMode(false);
    handleActivateDashboard();
  }, [handleActivateDashboard]);

  const hideSidebarByFocus = isFocusPresetActive && focusUiPreferences.hideSidebar;
  const hideSecondaryByFocus = isFocusPresetActive && focusUiPreferences.hideSecondaryPanels;
  const hideLeftChrome = focusMode || hideSidebarByFocus || isMobile;
  const hideSecondaryChrome = focusMode || hideSecondaryByFocus || isMobile;
  const hideNoteList = isMobile && mobileShowEditor && !!activeNoteId;
  const hideEditorArea = isMobile && !mobileShowEditor;

  useEffect(() => {
    if (isFocusPresetActive && focusUiPreferences.hideGraph && viewMode === 'graph') {
      setViewMode('edit');
    }
  }, [isFocusPresetActive, focusUiPreferences.hideGraph, viewMode]);

  const isWorkspacePanelMode = isDatabaseViewMode || isDashboardMode || isTraceLensMode;
  const activeWorkspaceKind = workspaceActivation.kind === 'none' ? null : workspaceActivation.kind;
  const activeWorkspaceId = workspaceActivation.kind === 'none' || workspaceActivation.kind === 'dashboard'
    ? null
    : workspaceActivation.id;

  const formulaQueryCatalog = useMemo(
    () => buildFormulaQueryCatalog(databaseViews),
    [databaseViews],
  );
  const [expandedGraphNodes, setExpandedGraphNodes] = useState<string[]>([]);
  // ── 이미지 드래그&드롭 ───────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const blockEditorRef = useRef<BlockEditorHandle>(null);
  const [databaseCreateSignal, setDatabaseCreateSignal] = useState(0);

  useEffect(() => {
    if (isDashboardMode || isWorkspaceKindActive(workspaceActivation, 'smart-collection')) {
      setWorkspaceExpanded(true);
    }
  }, [isDashboardMode, workspaceActivation, isWorkspaceKindActive]);

  useEffect(() => {
    if (databaseCreateSignal > 0) setWorkspaceExpanded(true);
  }, [databaseCreateSignal]);

  const noteUpdate = useCallback((id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => {
    updateNote(id, patch);
  }, [updateNote]);

  // ── 필터링 ──────────────────────────────────────────────────────
  const knowledgeQueryInfo = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !hasKnowledgeQuerySyntax(trimmed)) {
      return { active: false as const, label: null, error: null as string | null };
    }
    const parsed = parseQuery(trimmed);
    if (parsed.error) {
      return { active: true as const, label: null, error: parsed.error };
    }
    return { active: true as const, label: formatParsedQuery(parsed), error: null };
  }, [searchQuery]);

  const visibleNotes = useMemo(() => {
    const safeNotes = Array.isArray(notes) ? notes : [];
    let list: Note[] =
      activeFolderId === 'trash'   ? safeNotes.filter(n => n.deletedAt) :
      activeFolderId === 'starred' ? safeNotes.filter(n => n.starred && !n.deletedAt) :
      activeFolderId               ? safeNotes.filter(n => n.folderId === activeFolderId && !n.deletedAt) :
                                     safeNotes.filter(n => !n.deletedAt);
    if (activeTag) {
      const taggedIds = new Set(knowledgeIndexService.getNotesWithTag(activeTag));
      list = list.filter(n => taggedIds.has(n.id));
    }
    list = applyWorkspaceToNotes(list);
    if (searchQuery.trim()) {
      if (knowledgeQueryInfo.active) {
        list = filterNotes(list, knowledgeIndexService, searchQuery, {
          formulaColumns: formulaQueryCatalog,
        }).notes;
      } else {
        const parsed = parseNoteSearchQuery(searchQuery);
        if (parsed.mode === 'tag') {
          list = list.filter(n =>
            noteMatchesTagSearch(n.body ?? '', parsed.value) ||
            noteMatchesPageTag(n, parsed.value),
          );
        } else {
          const q = parsed.value.toLowerCase();
          list = list.filter(n =>
            (n.title ?? '').toLowerCase().includes(q) ||
            (n.body ?? '').toLowerCase().includes(q) ||
            extractTags(n.body ?? '').some(t => t.toLowerCase().includes(q)) ||
            noteMatchesPageTag(n, q)
          );
        }
      }
    }
    // 정렬 — smart collections with explicit ordering skip user sort preference
    if (!shouldSkipUserSort) {
      list = [...list].sort((a, b) => {
        if (sortOrder === 'title')   return (a.title ?? '').localeCompare(b.title ?? '');
        if (sortOrder === 'created') return Number((a.id ?? '').split('-')[1] || 0) - Number((b.id ?? '').split('-')[1] || 0);
        return b.updatedAt - a.updatedAt;
      });
    }
    return list;
  }, [notes, activeFolderId, searchQuery, activeTag, sortOrder, knowledgeQueryInfo.active, applyWorkspaceToNotes, shouldSkipUserSort, formulaQueryCatalog]);

  // ── 파생 상태 — 모두 useMemo로 메모화 ─────────────────────────────
  const activeNote = useMemo(
    () => notes.find(n => n.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  useEffect(() => {
    if (!titleComposingRef.current) {
      setTitleDraft(activeNote?.title ?? '');
    }
  }, [activeNote?.id, activeNote?.title]);

  useEffect(() => {
    if (activeNoteId) setMobileShowEditor(true);
    else setMobileShowEditor(false);
  }, [activeNoteId]);

  useEffect(() => () => {
    if (docCopyTimerRef.current) clearTimeout(docCopyTimerRef.current);
  }, []);

  const handleCopyDocument = useCallback(async () => {
    const ok = await blockEditorRef.current?.copyDocument();
    if (!ok) return;
    setDocCopied(true);
    if (docCopyTimerRef.current) clearTimeout(docCopyTimerRef.current);
    docCopyTimerRef.current = setTimeout(() => setDocCopied(false), 1500);
  }, []);

  const handleTitleChange = useCallback((value: string) => {
    setTitleDraft(value);
    if (!titleComposingRef.current && activeNoteId) {
      noteUpdate(activeNoteId, { title: value });
    }
  }, [activeNoteId, noteUpdate]);

  const handleTitleCompositionEnd = useCallback((value: string) => {
    titleComposingRef.current = false;
    setTitleDraft(value);
    if (activeNoteId) noteUpdate(activeNoteId, { title: value });
  }, [activeNoteId, noteUpdate]);

  const handleActiveBodyChange = useCallback(
    (md: string) => { if (activeNoteId) noteUpdate(activeNoteId, { body: md }); },
    [activeNoteId, noteUpdate],
  );

  useEffect(() => { setSearchMatchIdx(0); }, [searchQuery, activeNoteId, searchScope]);

  const editorSearchQuery = searchScope === 'all' ? '' : searchQuery;

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
  const pageReferences = useMemo(
    () => (activeNote ? knowledgeIndexService.getPageReferences(activeNote, notes) : null),
    [activeNote, notes],
  );

  // Linked reference excerpts — contextual paragraphs from referring pages
  const backlinkContexts = useMemo(
    () => (activeNote ? extractLinkContexts(activeNote.title ?? '', notes) : []),
    [notes, activeNote?.id, activeNote?.title],
  );

  const mentioningNotes = useMemo(
    () => (activeNote ? knowledgeIndexService.getMentioningNotes(activeNote.id, { excludeNoteId: activeNote.id }) : []),
    [activeNote, notes],
  );

  const mentionContexts = useMemo(() => {
    if (!activeNote) return [];
    const sourceIds = new Set(mentioningNotes.map(r => r.noteId));
    return extractMentionContexts(activeNote.title ?? '', notes, sourceIds);
  }, [activeNote, notes, mentioningNotes]);

  const relatedNotes = useMemo(
    () => (activeNote ? knowledgeIndexService.getRelatedNotes(activeNote.id) : []),
    [activeNote, notes],
  );

  useEffect(() => {
    setExpandedGraphNodes([]);
  }, [activeNote?.id]);

  const localGraphData = useMemo(
    () => (activeNote
      ? buildExpandedGraphData({
        centerId: activeNote.id,
        centerTitle: activeNote.title ?? '',
        expandedNodeIds: expandedGraphNodes,
        service: knowledgeIndexService,
      })
      : null),
    [activeNote, notes, expandedGraphNodes],
  );

  const handleExpandGraphNode = useCallback((noteId: string) => {
    if (!activeNote) return;
    const baseGraph = buildExpandedGraphData({
      centerId: activeNote.id,
      centerTitle: activeNote.title ?? '',
      expandedNodeIds: [],
      service: knowledgeIndexService,
    });
    const expandableIds = baseGraph.nodes
      .filter(node => node.expandable)
      .map(node => node.noteId);
    setExpandedGraphNodes(prev => expandNode(prev, noteId, expandableIds));
  }, [activeNote]);

  const handleCollapseGraphNode = useCallback((noteId: string) => {
    setExpandedGraphNodes(prev => collapseNode(prev, noteId));
  }, []);
  const allTags = useMemo(
    () => knowledgeIndexService.getAllTags(),
    [notes],
  );
  const noteTags = useMemo(
    () => (activeNote ? listTags(activeNote) : []),
    [activeNote?.id, activeNote?.properties],
  );

  const resolvedOutgoingRelations = useMemo(
    () => (activeNote ? knowledgeIndexService.resolveRelationTargets(activeNote.id) : []),
    [activeNote, notes],
  );

  const incomingRelationDisplays = useMemo(
    () => {
      if (!activeNote) return [];
      return knowledgeIndexService.getIncomingRelations(activeNote.id).map(edge => {
        const sourceTitle = knowledgeIndexService.getNoteTitle(edge.sourceId);
        return {
          edge,
          sourceTitle,
          missing: !sourceTitle,
        };
      });
    },
    [activeNote, notes],
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
        const raw = ev.target?.result as string;
        const { body, properties } = parseNoteMarkdown(raw);
        const title = file.name.replace(/\.md$/i, '');
        const id = `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        importNote({
          id, title, body, updatedAt: Date.now(),
          folderId: normalizeNoteFolderId(activeFolderId),
          deletedAt: null, starred: false,
          properties,
        });
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
  const syncShortcutRef = useRef({
    flushPendingSync,
    syncNoteToDB,
    getActiveNote: () => null as Note | null,
  });
  useEffect(() => {
    shortcutRef.current = { showSortMenu, viewMode, activeNote, createNote, duplicateNote };
    syncShortcutRef.current = {
      flushPendingSync,
      syncNoteToDB,
      getActiveNote: () => useNotesStore.getState().notes.find(n => n.id === activeNoteId) ?? null,
    };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { showSortMenu: sm, activeNote: an, createNote: cn, duplicateNote: dn } = shortcutRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (sm && e.key === 'Escape') { setShowSortMenu(false); return; }
      if (!mod) return;

      // ── Save (Ctrl+S) — debounce flush + 즉시 cloud sync ─────
      if (e.key === 's') {
        e.preventDefault();
        const { flushPendingSync: flush, syncNoteToDB: sync, getActiveNote } = syncShortcutRef.current;
        flush();
        const note = getActiveNote();
        if (note) void sync(note);
        return;
      }

      const target = e.target;
      if (
        target instanceof HTMLElement
        && target.closest('[contenteditable="true"], .be-editable')
      ) {
        return;
      }

      switch (e.key) {
        case 'n': e.preventDefault(); cn(); break;
        case 'd': e.preventDefault(); { if (an) dn(an); } break;
        case 'e': e.preventDefault(); setViewMode(v => toggleEditReading(v)); break;
        case 'g': e.preventDefault(); setViewMode(v => v === 'graph' ? 'edit' : 'graph'); break;
        case 'f': e.preventDefault(); setFocusMode(v => !v); break;
        case '/': e.preventDefault(); setShowShortcuts(v => !v); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 핸들러는 마운트 시 한 번만 등록 — 최신 값은 shortcutRef를 통해 읽음

  // 위키링크 따라가기 — 있으면 이동, 없으면 [[제목]] 노트 자동 생성
  const navigateToWiki = useCallback((title: string, opts?: { preferReading?: boolean }) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const found = findNoteByTitle(trimmed, notes);
    if (found) {
      setActiveNoteId(found.id);
      if (opts?.preferReading) setViewMode('reading');
      return;
    }
    createNote({ title: trimmed, body: '' });
  }, [notes, setActiveNoteId, setViewMode, createNote]);

  // TOC 점프 — 헤딩 블록(data-be-heading=순번)으로 스크롤. edit/reading 공통.
  const scrollToHeading = useCallback((headingIdx: number) => {
    const el = document.querySelector(`[data-be-heading="${headingIdx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Reading mode click delegation — be-wikilink / be-tag data attributes
  const handleReadingModeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wl = target.closest('.be-wikilink') as HTMLElement | null;
    if (wl?.dataset.wiki) {
      navigateToWiki(wl.dataset.wiki, { preferReading: true });
      return;
    }
    const tg = target.closest('.be-tag') as HTMLElement | null;
    if (tg?.dataset.tag) {
      const tag = tg.dataset.tag;
      setActiveFolderId(null);
      setActiveTag(prev => prev === tag ? null : (tag ?? null));
      setSearchQuery('');
      return;
    }
    // 편집 가능한 셀/체크박스 등 인터랙티브 요소 클릭은 무시
    if (target.closest('[contenteditable], button, input, textarea, .be-block .be-handles, .be-block-handle-menu, .be-slash-menu')) return;
    if (e.detail === 2) setViewMode('edit');
  }, [navigateToWiki]);

  // ── Obsidian-style 색상 + 사용자 글자/강조색 ─────────────────────
  const c = useMemo(
    () => buildNoteChrome(dark, appSettings),
    [dark, appSettings.notesTextColor, appSettings.notesAccentColor],
  );

  const blockColors = useMemo(
    () => buildBlockEditorColors(c, dark, appSettings),
    [c, dark, appSettings.notesFontFamily, appSettings.notesFontSize, appSettings.notesTextColor, appSettings.notesAccentColor],
  );

  // 매 렌더마다 filter() 반복 방지
  const trashCount      = useMemo(() => notes.filter(n => n.deletedAt).length,              [notes]);
  const starredCount    = useMemo(() => notes.filter(n => n.starred && !n.deletedAt).length, [notes]);
  const activeNoteCount = useMemo(() => notes.filter(n => !n.deletedAt).length,              [notes]);
  const isTrash      = activeFolderId === 'trash';

  const handleToggleAreaNote = useCallback(() => {
    if (!activeNote || isTrash) return;
    if (isAreaNote(activeNote)) {
      updateNote(activeNote.id, { properties: clearAreaFromNote(activeNote).properties });
      if (traceAreaId === activeNote.id) {
        setTraceAreaId(null);
        setTraceAreaRange(null); setTraceDiscoveryMode(false);
      }
      return;
    }
    if (!canMarkAsArea(activeNote)) return;
    updateNote(activeNote.id, { properties: applyAreaToNote(activeNote).properties });
  }, [activeNote, isTrash, traceAreaId, updateNote]);

  const folderLabel = useMemo(() =>
    activeFolderId === null    ? 'All Notes' :
    activeFolderId === 'trash' ? '🗑 Trash' :
    (folders.find(f => f.id === activeFolderId)?.name ?? ''),
    [activeFolderId, folders]
  );

  // 렌더마다 새 배열 생성 방지 — icon은 JSX이므로 useMemo로 안정화
  const VIEW_MODES = useMemo(() => [
    { key: 'reading' as const, icon: <Eye size={11}/>,     label: 'Read' },
    { key: 'graph'   as const, icon: <GitFork size={11}/>, label: 'Graph' },
  ], []);
  const RIGHT_PANELS = useMemo(() => [
    { key: 'toc'        as const, label: 'Outline', icon: <AlignLeft size={11}/> },
    { key: 'links'      as const, label: 'Links',   icon: <Link size={11}/> },
    { key: 'graph'      as const, label: 'Graph',   icon: <GitFork size={11}/> },
    { key: 'properties' as const, label: 'Props',   icon: <SlidersHorizontal size={11}/> },
    { key: 'tags'       as const, label: 'Tags',    icon: <Tag size={11}/> },
    { key: 'relations'  as const, label: 'Relations', icon: <ArrowRightLeft size={11}/> },
    { key: 'stats'      as const, label: 'Stats',   icon: <span style={{ fontSize: 10, fontWeight: 700 }}>#</span> },
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
    .bhl{background:${dark ? '#3d3860' : '#e8e4ff'};color:${c.text};padding:1px 4px;border-radius:3px}
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
    .bwl{color:${c.accent};cursor:pointer;border-bottom:1px solid ${c.accent}55;padding-bottom:1px;font-weight:500}
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
    .bshl{background:${dark ? '#3d3860' : '#e8e4ff'};color:${c.text};border-radius:2px;padding:0 2px}
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
    <div style={{ display: 'flex', height: '100%', background: c.wrap, color: c.text, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>
      <input ref={importInputRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={handleImport} multiple/>

      {/* ── 포커스 모드 오버레이 ── */}
      {hideLeftChrome && <div className="focus-overlay" onClick={() => {
        if (isFocusPresetActive) handleExitFocusPreset();
        else setFocusMode(false);
      }}/>}

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
              ['Ctrl + E',         'Toggle Reading Mode'],
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
              ['Click [[link]]',   'Follow link · create if missing (reading mode)'],
              ['#tag in search',   'Filter notes by tag'],
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
      {!hideLeftChrome && (
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
                  <Folder size={14} color={activeFolderId === f.id ? c.accent : c.textMuted}/>
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
                <input
                  ref={searchInputRef}
                  className="bwsi"
                  style={{ fontSize: 11, paddingRight: searchQuery.trim() ? 24 : undefined }}
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              {knowledgeQueryInfo.active && knowledgeQueryInfo.error && (
                <div style={{ padding: '4px 10px', fontSize: 10, color: c.danger, borderBottom: `1px solid ${c.sideBdr}` }}>
                  {knowledgeQueryInfo.error}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className={`bfi ${activeFolderId === null && !activeTag && workspaceActivation.kind === 'none' && !isTraceLensMode ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); setWorkspaceActivation(INACTIVE_WORKSPACE); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}>
                  <span style={{ flex: 1 }}>All Notes</span>
                  <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>
                    {notes.filter(n => !n.deletedAt).length}
                  </span>
                </div>
                <div
                  className={`bfi ${isTraceDayMode && traceDate === todayTraceKey ? 'active' : ''}`}
                  onClick={() => openTraceDay(todayTraceKey)}
                >
                  <span style={{ flex: 1 }}>Today</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'month' && traceRange.year === currentTraceMonthKey.year && traceRange.month === currentTraceMonthKey.month ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'month', ...currentTraceMonthKey })}
                >
                  <span style={{ flex: 1 }}>This Month</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'quarter' && traceRange.year === currentTraceQuarterKey.year && traceRange.quarter === currentTraceQuarterKey.quarter ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'quarter', ...currentTraceQuarterKey })}
                >
                  <span style={{ flex: 1 }}>This Quarter</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'year' && traceRange.year === currentTraceYearKey ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'year', year: currentTraceYearKey })}
                >
                  <span style={{ flex: 1 }}>This Year</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'custom' ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'custom', startDate: '', endDate: '', label: '' })}
                >
                  <span style={{ flex: 1 }}>Custom Range</span>
                </div>
                <div className="bseclbl">Areas</div>
                {areaNotes.map(area => (
                  <div
                    key={area.id}
                    className={`bfi ${isTraceAreaMode && traceAreaId === area.id ? 'active' : ''}`}
                    onClick={() => openTraceArea(area.id)}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {area.title.trim() || 'Untitled'}
                    </span>
                  </div>
                ))}
                <div
                  className={`bfi ${isTraceDiscoveryMode ? 'active' : ''}`}
                  onClick={openTraceDiscovery}
                >
                  <span style={{ flex: 1 }}>Discover Patterns</span>
                </div>
                <div className={`bfi ${activeFolderId === 'starred' ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId('starred' as any); setActiveTag(null); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}>
                  <Star size={10} color={activeFolderId === 'starred' ? c.accent : c.textMuted} fill={activeFolderId === 'starred' ? c.accent : 'none'}/>
                  <span style={{ flex: 1 }}>Starred</span>
                  {starredCount > 0 && <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>{starredCount}</span>}
                </div>
                <div className="bseclbl">Folders</div>
                {folders.map(f => (
                  <div key={f.id} className={`bfi ${activeFolderId === f.id ? 'active' : ''}`}
                    onClick={() => { setActiveFolderId(f.id); setActiveTag(null); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}
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
                          onClick={() => { setActiveFolderId(null); setSearchQuery(''); setActiveTag(prev => prev === tag ? null : tag); setWorkspaceActivation(INACTIVE_WORKSPACE); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}>
                          #{tag} <span style={{ color: c.textMuted, marginLeft: 1 }}>{count}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
                  <div
                    className="bseclbl"
                    onClick={() => setWorkspaceExpanded(v => !v)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {workspaceExpanded
                      ? <ChevronDown size={10} style={{ flexShrink: 0, color: c.textFaint }} />
                      : <ChevronRight size={10} style={{ flexShrink: 0, color: c.textFaint }} />}
                    <span>Workspace</span>
                  </div>
                  {workspaceExpanded && (
                    <>
                      <div
                        className={`bfi ${isDashboardMode ? 'active' : ''}`}
                        onClick={handleActivateDashboardWithTraceClear}
                        style={{ gap: 4, fontSize: 11 }}
                      >
                        <LayoutDashboard size={10} color={isDashboardMode ? c.accent : c.textMuted} />
                        <span style={{ flex: 1 }}>Dashboard</span>
                      </div>
                      <SmartCollectionsSection
                        colors={c}
                        collections={SMART_COLLECTIONS}
                        activeCollectionId={isWorkspaceKindActive(workspaceActivation, 'smart-collection') ? workspaceActivation.id : null}
                        counts={smartCollectionCounts}
                        onActivate={handleActivateSmartCollection}
                        onClearActive={handleClearSmartCollection}
                        isPinned={id => isWorkspacePinned('smart-collection', id)}
                        onTogglePin={collection => handleTogglePinWorkspace({
                          kind: 'smart-collection',
                          id: collection.id,
                          name: collection.name,
                          subtitle: collection.description,
                        })}
                      />
                    </>
                  )}
                </div>
                <PinnedWorkspacesSection
                  colors={c}
                  pinned={pinnedWorkspaces}
                  activeKind={activeWorkspaceKind}
                  activeId={activeWorkspaceId}
                  onActivate={handleActivateWorkspaceRef}
                  onUnpin={handleUnpinWorkspace}
                  onMovePinned={handleMovePinnedWorkspace}
                />
                <RecentWorkSection
                  colors={c}
                  recent={recentWork}
                  activeKind={activeWorkspaceKind}
                  activeId={activeWorkspaceId}
                  isPinned={isWorkspacePinned}
                  onActivate={entry => handleActivateWorkspaceRef(entry.workspace)}
                  onTogglePin={entry => handleTogglePinWorkspace(entry.workspace)}
                  onClearRecent={handleClearRecentWork}
                />
                <RuleCollectionsSection
                  colors={c}
                  collections={ruleCollections}
                  activeCollectionId={isWorkspaceKindActive(workspaceActivation, 'rule-collection') ? workspaceActivation.id : null}
                  counts={ruleCollectionCounts}
                  canCreateFromCurrent={canCreateRuleCollection}
                  currentQuery={searchQuery.trim()}
                  onActivate={handleActivateRuleCollection}
                  onClearActive={handleClearRuleCollection}
                  onCreate={handleCreateRuleCollection}
                  onRename={handleRenameRuleCollection}
                  onDelete={handleDeleteRuleCollection}
                  isPinned={id => isWorkspacePinned('rule-collection', id)}
                  onTogglePin={collection => handleTogglePinWorkspace({
                    kind: 'rule-collection',
                    id: collection.id,
                    name: collection.name,
                    subtitle: collection.query,
                  })}
                />
                <DatabaseViewsSection
                  colors={c}
                  views={databaseViews}
                  activeViewId={isWorkspaceKindActive(workspaceActivation, 'database-view') ? workspaceActivation.id : null}
                  counts={databaseViewCounts}
                  canCreateFromCurrent={canCreateDatabaseView}
                  currentQuery={searchQuery.trim()}
                  onActivate={handleActivateDatabaseView}
                  onClearActive={handleClearDatabaseView}
                  onCreate={handleCreateDatabaseView}
                  onCreateFromTemplate={handleCreateDatabaseViewFromTemplate}
                  onRename={handleRenameDatabaseView}
                  onDelete={handleDeleteDatabaseView}
                  isPinned={id => isWorkspacePinned('database-view', id)}
                  onTogglePin={view => handleTogglePinWorkspace({
                    kind: 'database-view',
                    id: view.id,
                    name: view.name,
                    subtitle: view.query,
                  })}
                  openCreateFormSignal={databaseCreateSignal}
                />
                <SavedViewsSection
                  colors={c}
                  views={savedViews}
                  activeViewId={isWorkspaceKindActive(workspaceActivation, 'saved-view') ? workspaceActivation.id : null}
                  canSaveCurrent={canSaveCurrentView}
                  onActivate={handleActivateSavedView}
                  onClearActive={handleClearSavedView}
                  onCreate={handleCreateSavedView}
                  onRename={handleRenameSavedView}
                  onDelete={handleDeleteSavedView}
                  isPinned={id => isWorkspacePinned('saved-view', id)}
                  onTogglePin={view => handleTogglePinWorkspace({
                    kind: 'saved-view',
                    id: view.id,
                    name: view.name,
                    subtitle: view.query,
                  })}
                />
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
      {/* ── Note List / Database Table ── */}
      <div style={{
        width: hideLeftChrome ? 0 : (hideSecondaryChrome || hideNoteList ? 0 : (isWorkspacePanelMode ? '45%' : (isMobile ? '100%' : 200))),
        minWidth: hideLeftChrome ? 0 : (hideSecondaryChrome || hideNoteList ? 0 : (isWorkspacePanelMode ? 280 : (isMobile ? 0 : 200))),
        overflow: 'hidden',
        background: c.notelist,
        borderRight: `1px solid ${c.sideBdr}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: isWorkspacePanelMode ? 1 : 0,
        transition: 'width .2s, min-width .2s',
        zIndex: 99,
      }}>
        <div style={{ padding: '8px 10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${c.sideBdr}` }}>
          <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
            {isTraceDiscoveryMode
              ? 'Discover Patterns'
              : isTraceAreaMode && traceAreaProjection
              ? (traceAreaRange
                ? formatAreaRangeHeading(traceAreaProjection.areaTitle, traceAreaRange)
                : traceAreaProjection.areaTitle)
              : isTraceRangeMode && traceRange
              ? formatRangeLensHeading(traceRange)
              : isTraceDayMode && traceDate
              ? formatTraceDayHeading(traceDate)
              : isDashboardMode
              ? dashboard.name
              : activeDatabaseView
              ? activeDatabaseView.name
              : activeSmartCollection
              ? activeSmartCollection.name
              : activeRuleCollection
              ? activeRuleCollection.name
              : activeSavedView
              ? activeSavedView.name
              : knowledgeQueryInfo.active
              ? (knowledgeQueryInfo.error ? 'Invalid query' : knowledgeQueryInfo.label)
              : activeTag ? `#${activeTag}` : folderLabel}
            <span style={{ color: c.textFaint, marginLeft: 4 }}>
              ({isTraceLensMode ? traceLensMarkCount : isDatabaseViewMode ? activeDatabaseViewNoteCount : isDashboardMode ? recentNotes.length : visibleNotes.length})
            </span>
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', position: 'relative' }}>
            {searchQuery.trim() && (
              <button onClick={handleClearSavedView} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title="Clear query">✕</button>
            )}
            {isTraceLensMode && (
              <button onClick={closeTraceLens} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title="Leave trace view">✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'dashboard') && !searchQuery.trim() && (
              <button onClick={handleClearDashboard} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title="Leave dashboard">✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'database-view') && !searchQuery.trim() && (
              <button onClick={handleClearDatabaseView} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title="Clear database view">✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'smart-collection') && !searchQuery.trim() && (
              <button onClick={handleClearSmartCollection} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title="Clear collection">✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'rule-collection') && !searchQuery.trim() && !isWorkspaceKindActive(workspaceActivation, 'smart-collection') && (
              <button onClick={handleClearRuleCollection} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title="Clear collection">✕</button>
            )}
            {activeTag && workspaceActivation.kind === 'none' && !searchQuery.trim() && (
              <button onClick={() => setActiveTag(null)} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }}>✕</button>
            )}
            {!isWorkspacePanelMode && (
              <>
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
              <button onClick={() => openCreateEventDialog()} className="btbtn" title="Create event">
                <CalendarDays size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={() => createNote()} style={{ background: c.accent, border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: dark ? '#0F0F11' : '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                <Plus size={12}/>
              </button>
            )}
              </>
            )}
          </div>
        </div>
        {isTraceDiscoveryMode ? (
          <AreaDiscoveryView
            colors={c}
            notes={activeNotes}
            activeNoteId={activeNoteId}
            onSelectNote={setActiveNoteId}
          />
        ) : isTraceAreaMode && traceAreaId ? (
          <AreaTraceView
            colors={c}
            areaNoteId={traceAreaId}
            areaRange={traceAreaRange}
            notes={activeNotes}
            activeNoteId={activeNoteId}
            onSelectNote={setActiveNoteId}
            onAreaRangeChange={setTraceAreaRange}
          />
        ) : isTraceRangeMode && traceRange ? (
          <RangeTraceLensView
            colors={c}
            lens={traceRange}
            notes={activeNotes}
            activeNoteId={activeNoteId}
            onSelectNote={setActiveNoteId}
            onLensChange={setTraceRange}
          />
        ) : isTraceDayMode && traceDate ? (
          <DailyTraceDayView
            colors={c}
            date={traceDate}
            notes={activeNotes}
            activeNoteId={activeNoteId}
            onSelectNote={setActiveNoteId}
            onDateChange={setTraceDate}
          />
        ) : isDashboardMode ? (
          <WorkspaceDashboardView
            colors={c}
            dashboard={dashboard}
            pinned={pinnedWorkspaces}
            recent={recentWork}
            resumeWorkspace={resumeWorkspace}
            recentNotes={recentNotes}
            onActivateWorkspace={handleActivateWorkspaceRef}
            onResumeWorkspace={handleResumeLastWorkspace}
            onSelectNote={noteId => {
              handleLeaveDashboardForNote(noteId);
              setActiveNoteId(noteId);
            }}
            quickActions={{
              onNewNote: () => createNote(),
              onNewDatabaseView: () => {
                setSidebarCollapsed(false);
                setDatabaseCreateSignal(signal => signal + 1);
              },
              onOpenSearch: () => {
                setSidebarCollapsed(false);
                searchInputRef.current?.focus();
              },
              onOpenGraph: () => setViewMode('graph'),
            }}
            focus={{
              presets: focusPresets,
              presetTargets: focusPresetTargets,
              activePresetId: focusSession.activePresetId,
              workspaceOptions: focusWorkspaceOptions,
              onCreatePreset: handleCreateFocusPreset,
              onDeletePreset: handleDeleteFocusPreset,
              onActivatePreset: handleActivateFocusPreset,
              onExitPreset: handleExitFocusPreset,
            }}
            quickCapture={{
              taskTemplates,
              onCapture: handleQuickCapture,
            }}
            productivity={{
              taskTemplates,
              journalTemplates,
              onCreateTask: handleCreateTask,
              onCreateJournal: handleCreateJournal,
              onCreateTaskDatabase: handleCreateTaskDatabase,
              onCreateJournalDatabase: handleCreateJournalDatabase,
            }}
          />
        ) : isDatabaseViewMode && activeDatabaseView ? (
          <DatabaseViewPanel
            colors={c}
            view={activeDatabaseView}
            notes={safeNotesForDatabase}
            service={knowledgeIndexService}
            activeNoteId={activeNoteId}
            onSelectNote={setActiveNoteId}
            onViewChange={patchActiveDatabaseView}
          />
        ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleNotes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
              {isTrash ? 'Trash is empty' : 'No notes'}
            </div>
          ) : visibleNotes.map(n => {
            const folder  = folders.find(f => f.id === n.folderId);
            const tags    = listTags(n).slice(0, 2);
            const rawPreview = n.body.replace(/(^|\s)#[\w\uAC00-\uD7A3]+/g, '').replace(/[#*`[\]=~>$-]/g, '').split('\n').find(l => l.trim()) || '';
            const hlTitle   = searchQuery.trim() ? highlightText(n.title || 'Untitled', searchQuery) : (n.title || 'Untitled');
            const hlPreview = searchQuery.trim() ? highlightText(rawPreview, searchQuery) : rawPreview;
            return (
              <div key={n.id}
                className={`bni ${n.id === activeNoteId ? 'active' : ''} ${dragNoteId === n.id ? 'bnote-drag' : ''}`}
                onClick={() => { setActiveNoteId(n.id); if (isMobile) setMobileShowEditor(true); }}
                draggable={!isTrash}
                onDragStart={() => setDragNoteId(n.id)}
                onDragEnd={() => setDragNoteId(null)}
                title="Drag to folder · Ctrl+D to duplicate"
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateNote(n); } }}
                tabIndex={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  {n.starred && <Star size={9} color={c.accent} fill={c.accent} style={{ flexShrink: 0 }}/>}
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
        )}
      </div>

      {/* ── Editor Area ── */}
      <div style={{ flex: 1, display: hideEditorArea ? 'none' : 'flex', flexDirection: 'column', minWidth: 0, background: c.editor }}>
        {activeNote ? (
          <>
            {/* Note Header */}
            <div style={{ padding: isMobile ? '7px 10px' : '7px 13px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 6, background: c.editor, flexShrink: 0, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {isMobile && (
                <button type="button" className="btbtn" onClick={() => { setMobileShowEditor(false); setActiveNoteId(null); }}
                  style={{ padding: '2px 4px', color: c.textMuted }} title="Back to notes">
                  <ChevronLeft size={14}/>
                </button>
              )}
              {isFocusPresetActive && activeFocusPreset && (
                <button
                  type="button"
                  className="btbtn"
                  onClick={handleExitFocusPreset}
                  style={{ fontSize: 10, color: c.accent, whiteSpace: 'nowrap' }}
                  title="Exit focus mode"
                >
                  Exit Focus
                </button>
              )}
              <input ref={titleInputRef} value={titleDraft} readOnly={isTrash}
                onChange={e => handleTitleChange(e.target.value)}
                onCompositionStart={() => { titleComposingRef.current = true; }}
                onCompositionEnd={e => handleTitleCompositionEnd(e.currentTarget.value)}
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: isMobile ? 16 : 15, fontWeight: 700 }}
                placeholder="Title"/>
              {!isTrash && (
                <select value={activeNote.folderId ?? ''} onChange={e => noteUpdate(activeNote.id, { folderId: e.target.value || null })}
                  style={{ background: c.input, border: `1px solid ${c.inputBdr}`, color: c.textMuted, borderRadius: 5, padding: '3px 6px', fontSize: 10, outline: 'none', cursor: 'pointer' }}>
                  <option value="">No Folder</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
              {/* Cloud sync status */}
              {!isTrash && (
                syncError ? (
                  <button type="button" onClick={retrySync} className="btbtn" title="Retry cloud sync"
                    style={{ fontSize: 9, color: c.danger, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px' }}>
                    <AlertTriangle size={10}/> {syncError}
                  </button>
                ) : isSyncing ? (
                  <span style={{ fontSize: 9, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.textMuted, opacity: 0.6, animation: 'pulse 1s infinite' }}/>
                    syncing…
                  </span>
                ) : savedAt ? (
                  <span style={{ fontSize: 9, color: c.green, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Save size={9}/> {savedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null
              )}
              {/* View: edit default · Reading / Graph secondary */}
              <div style={{ display: 'flex', background: c.toolbar, borderRadius: 7, padding: 2, gap: 1 }}>
                {VIEW_MODES.map(({ key, icon }) => (
                  <button
                    key={key}
                    title={key === 'reading' ? 'Reading mode (Ctrl+E)' : 'Graph (Ctrl+G)'}
                    onClick={() => {
                      if (key === 'reading') setViewMode(v => toggleEditReading(v));
                      else setViewMode(v => v === 'graph' ? 'edit' : 'graph');
                    }}
                    className="btbtn"
                    style={{
                      padding: '3px 7px', borderRadius: 5,
                      background: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.card : 'none',
                      color: (key === 'reading' ? viewMode === 'reading' : viewMode === 'graph') ? c.accent : c.textMuted,
                    }}>
                    {icon}
                  </button>
                ))}
              </div>
              {/* Event / milestone note actions */}
              {!isTrash && (
                <button
                  type="button"
                  onClick={() => openEditEventDialog(activeNote)}
                  className="btbtn"
                  style={{ fontSize: 10, color: isEventNote(activeNote) ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
                  title={isEventNote(activeNote) ? 'Edit event' : 'Mark as event'}
                >
                  {isEventNote(activeNote) ? 'Edit Event' : 'Mark Event'}
                </button>
              )}
              {!isTrash && (
                <button
                  type="button"
                  onClick={() => openMilestoneDialog(activeNote)}
                  className="btbtn"
                  style={{ fontSize: 10, color: isMilestoneNote(activeNote) ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
                  title={isMilestoneNote(activeNote) ? 'Edit milestone' : 'Mark as milestone'}
                >
                  {isMilestoneNote(activeNote) ? 'Edit Milestone' : 'Mark Milestone'}
                </button>
              )}
              {!isTrash && (isAreaNote(activeNote) || canMarkAsArea(activeNote)) && (
                <button
                  type="button"
                  onClick={handleToggleAreaNote}
                  className="btbtn"
                  style={{ fontSize: 10, color: isAreaNote(activeNote) ? c.accent : c.textMuted, whiteSpace: 'nowrap' }}
                  title={isAreaNote(activeNote) ? 'Clear area designation' : 'Mark as area hub'}
                >
                  {isAreaNote(activeNote) ? 'Clear Area' : 'Mark Area'}
                </button>
              )}
              {/* Star */}
              {!isTrash && (
                <button onClick={() => toggleStar(activeNote.id)} className="btbtn" title={activeNote.starred ? 'Unstar' : 'Star'}>
                  <Star size={13} color={activeNote.starred ? c.accent : c.textMuted} fill={activeNote.starred ? c.accent : 'none'}/>
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
              {/* Copy document */}
              {!isTrash && (
                <button onClick={() => void handleCopyDocument()} className="btbtn"
                  title={docCopied ? 'Copied' : 'Copy document'}
                  style={{ color: docCopied ? c.green : c.textMuted }}>
                  <Copy size={12}/>
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
                <NoteGraphView notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={activeNoteId} onSelect={id => { setActiveNoteId(id); setViewMode('edit'); }} dark={dark}/>
              </div>
            ) : (
              <>
                {/* Toolbar - edit 모드에서만 (블록 에디터: 슬래시 커맨드 기반) */}
                {!isTrash && viewMode === 'edit' && (
                  <div style={{ padding: '5px 12px', borderBottom: `1px solid ${c.toolBdr}`, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: c.toolbar, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: c.textMuted, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: c.text }}>/</kbd>
                      블록 추가 ·
                      <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>⌘B</kbd> 굵게 ·
                      <kbd style={{ background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: 4, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>⌘⇧1</kbd> 제목
                    </span>
                    {searchQuery.trim() && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, flexWrap: 'wrap' }}>
                        {(['block', 'document', 'all'] as const).map(scope => (
                          <button key={scope} type="button" className="btbtn"
                            onClick={() => setSearchScope(scope)}
                            style={{
                              fontSize: 10, padding: '2px 8px',
                              background: searchScope === scope ? c.accentBg : c.card,
                              color: searchScope === scope ? c.accent : c.textMuted,
                              border: `1px solid ${searchScope === scope ? c.accent : c.toolBdr}`,
                              borderRadius: 5, cursor: 'pointer',
                            }}>
                            {scope === 'block' ? '현재 블록' : scope === 'document' ? '현재 문서' : '전체 노트'}
                          </button>
                        ))}
                        {searchScope !== 'all' && (
                          <>
                            <button type="button" className="btbtn" title="이전 (↑)"
                              onClick={() => setSearchMatchIdx(i => Math.max(0, i - 1))}
                              style={{ padding: '2px 5px' }}><ChevronUp size={12}/></button>
                            <button type="button" className="btbtn" title="다음 (↓)"
                              onClick={() => setSearchMatchIdx(i => i + 1)}
                              style={{ padding: '2px 5px' }}><ChevronDown size={12}/></button>
                          </>
                        )}
                      </div>
                    )}
                    <button onClick={() => importInputRef.current?.click()} className="btbtn" title="Import .md files" style={{ marginLeft: 4 }}>
                      <Upload size={13}/>
                    </button>
                    <button onClick={insertEmptyImageBlockAtCursor} className="btbtn" title="커서 위치에 이미지 블록 삽입">
                      <ImageIcon size={13}/>
                    </button>
                    <div
                      style={{ position: 'relative', marginLeft: 'auto' }}
                      onMouseLeave={e => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowAppearance(false);
                      }}>
                      <button
                        type="button"
                        onClick={() => setShowAppearance(v => !v)}
                        className="btbtn"
                        title="글꼴·색상 설정"
                        style={{ color: showAppearance ? c.accent : c.textMuted }}>
                        <Type size={13}/>
                      </button>
                      {showAppearance && (
                        <div style={{
                          position: 'absolute', top: '100%', right: 0, paddingTop: 6, zIndex: 50,
                        }}>
                        <div style={{
                          background: c.card, border: `1px solid ${c.toolBdr}`, borderRadius: NOTE_RADIUS_CARD,
                          padding: '12px 14px', width: 240, boxShadow: '0 8px 28px #00000020',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted, marginBottom: 10 }}>편집기 모양</div>
                          <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>글꼴</label>
                          <select
                            value={appSettings.notesFontFamily ?? 'system'}
                            onChange={e => updateSetting('notesFontFamily', e.target.value as AppSettings['notesFontFamily'])}
                            style={{ width: '100%', marginBottom: 10, background: c.input, border: `1px solid ${c.inputBdr}`, color: c.text, borderRadius: 6, padding: '5px 8px', fontSize: 12 }}>
                            {NOTE_FONT_OPTIONS.map(o => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                          <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>
                            글자 크기 ({appSettings.notesFontSize ?? 16}px)
                          </label>
                          <input
                            type="range" min={12} max={22} step={1}
                            value={appSettings.notesFontSize ?? 16}
                            onChange={e => updateSetting('notesFontSize', Number(e.target.value))}
                            style={{ width: '100%', marginBottom: 10 }}
                          />
                          <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>본문 색상</label>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            <input
                              type="color"
                              value={appSettings.notesTextColor?.trim() || (dark ? '#dcddde' : '#2e3338')}
                              onChange={e => updateSetting('notesTextColor', e.target.value)}
                              style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none' }}
                            />
                            <button type="button" className="btbtn" style={{ fontSize: 10 }}
                              onClick={() => updateSetting('notesTextColor', '')}>
                              기본값
                            </button>
                          </div>
                          <label style={{ display: 'block', fontSize: 11, color: c.textMuted, marginBottom: 4 }}>링크·강조 색</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="color"
                              value={appSettings.notesAccentColor?.trim() || (dark ? '#7f6df2' : '#7c3aed')}
                              onChange={e => updateSetting('notesAccentColor', e.target.value)}
                              style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none' }}
                            />
                            <button type="button" className="btbtn" style={{ fontSize: 10 }}
                              onClick={() => updateSetting('notesAccentColor', '')}>
                              기본값
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: c.textFaint, marginTop: 10 }}>
                            문서 폭 {NOTE_DOCUMENT_MAX_WIDTH}px
                          </div>
                        </div>
                        </div>
                      )}
                    </div>
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
                  {viewMode !== 'graph' && (
                    isTrash ? (
                      <div style={{ padding: '40px 60px', maxWidth: 860, margin: '0 auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16, color: c.danger, fontSize: 13 }}>
                          <AlertTriangle size={14}/> In Trash — restore to edit
                        </div>
                        <div style={{ color: c.textMuted, fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{activeNote.body}</div>
                      </div>
                    ) : (
                      <div
                        onClick={viewMode === 'reading' ? handleReadingModeClick : undefined}
                        style={{ minHeight: '100%', padding: isMobile ? '12px 0 48px' : '24px 0 80px' }}>
                        {viewMode === 'reading' && (
                          <div style={{ maxWidth: isMobile ? '100%' : 720, margin: '0 auto 8px', padding: isMobile ? '0 12px' : '0 16px', fontSize: 11, color: c.textMuted }}>
                            Reading mode — double-click or <kbd style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, border: `1px solid ${c.toolBdr}` }}>Ctrl+E</kbd> to edit
                          </div>
                        )}
                        <NoteBlockEditor
                          ref={blockEditorRef}
                          key={activeNote.id}
                          body={activeNote.body}
                          onBodyChange={handleActiveBodyChange}
                          colors={blockColors}
                          readOnly={viewMode === 'reading'}
                          searchQuery={editorSearchQuery}
                          searchScope={searchScope}
                          searchMatchIndex={searchMatchIdx}
                          wikiTargets={wikiTargets}
                          onWikiNavigate={navigateToWiki}
                        />
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          // Graph View without active note
          viewMode === 'graph' ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <NoteGraphView notes={Array.isArray(notes) ? notes : []} folders={folders} activeNoteId={null} onSelect={id => { setActiveNoteId(id); setViewMode('edit'); }} dark={dark}/>
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
      {activeNote && viewMode !== 'graph' && showRightPanel && !hideSecondaryByFocus && (
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
          {rightPanel === 'links' && activeNote && pageReferences && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <LinkedReferencesPanel
                colors={c}
                activeNoteTitle={activeNote.title ?? ''}
                incoming={pageReferences.incoming}
                contexts={backlinkContexts}
                mentioning={mentioningNotes}
                mentionContexts={mentionContexts}
                outgoing={pageReferences.outgoing}
                onNavigateToNote={setActiveNoteId}
                onNavigateToWiki={navigateToWiki}
              />
              <RelatedNotesPanel
                colors={c}
                related={relatedNotes}
                onNavigateToNote={setActiveNoteId}
              />
            </div>
          )}

          {rightPanel === 'graph' && activeNote && localGraphData && (
            <LocalGraphView
              colors={c}
              graphData={localGraphData}
              onNavigate={setActiveNoteId}
              onExpandNode={handleExpandGraphNode}
              onCollapseNode={handleCollapseGraphNode}
            />
          )}

          {/* Properties */}
          {rightPanel === 'properties' && activeNote && (
            <NotePropertiesPanel
              colors={c}
              note={activeNote}
              onUpdateProperties={properties => noteUpdate(activeNote.id, { properties })}
            />
          )}

          {rightPanel === 'tags' && activeNote && (
            <NoteTagsPanel
              colors={c}
              note={activeNote}
              allTags={allTags}
              activeTag={activeTag}
              onUpdateTags={properties => noteUpdate(activeNote.id, { properties })}
              onSelectTag={tag => {
                setActiveFolderId(null);
                setSearchQuery('');
                setActiveTag(tag);
              }}
            />
          )}

          {rightPanel === 'relations' && activeNote && (
            <NoteRelationsPanel
              colors={c}
              note={activeNote}
              wikiTargets={wikiTargets}
              outgoing={resolvedOutgoingRelations}
              incoming={incomingRelationDisplays}
              onUpdateRelations={relations => noteUpdate(activeNote.id, { relations })}
              onNavigateToNote={setActiveNoteId}
              onResolveTargetId={title =>
                knowledgeIndexService.resolveNoteId(title)
                ?? findNoteByTitle(title, notes)?.id
              }
            />
          )}

          {/* Stats */}
          {rightPanel === 'stats' && (() => {
            const body = activeNote.body;
            const words = body.trim() ? body.trim().split(/\s+/).length : 0;
            const chars = body.length;
            const lines = body.split('\n').length;
            const readMin = Math.max(1, Math.ceil(words / 200));
            const linkCount = extractLinks(body).length;
            const tagCount  = noteTags.length;
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
                      {allTags.slice(0, 20).map(({ tag, count }) => {
                        const maxCount = allTags[0]?.count ?? 1;
                        const size = 9 + Math.round((count / maxCount) * 8);
                        const opacity = 0.5 + (count / maxCount) * 0.5;
                        return (
                          <span key={tag}
                            style={{ fontSize: size, color: c.tagTxt, background: c.tag, padding: '2px 7px', borderRadius: 999, opacity, border: activeTag?.toLowerCase() === tag.toLowerCase() ? `1px solid ${c.tagTxt}` : '1px solid transparent' }}
                            onClick={() => { setActiveFolderId(null); setSearchQuery(''); setActiveTag(prev => prev?.toLowerCase() === tag.toLowerCase() ? null : tag); }}>
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
      {eventDialog && (
        <EventNoteDialog
          colors={c}
          mode={eventDialog.mode}
          initialValues={eventDialog.initialValues}
          onSave={handleEventDialogSave}
          onRemoveEvent={eventDialog.mode === 'edit' ? handleRemoveEventStatus : undefined}
          onClose={() => setEventDialog(null)}
        />
      )}
      {milestoneDialog && (
        <MilestoneNoteDialog
          colors={c}
          noteTitle={milestoneDialog.noteTitle}
          initialValues={milestoneDialog.initialValues}
          hasExistingMilestone={milestoneDialog.hasExistingMilestone}
          onSave={handleMilestoneDialogSave}
          onRemoveMilestone={milestoneDialog.hasExistingMilestone ? handleRemoveMilestone : undefined}
          onClose={() => setMilestoneDialog(null)}
        />
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