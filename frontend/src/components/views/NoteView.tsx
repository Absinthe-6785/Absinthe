import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Eye, Type,
  RotateCcw, AlertTriangle, Star, CalendarDays,
  Tag, Link, AlignLeft, Image as ImageIcon, Save,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, GitFork, Upload, Keyboard,
  SlidersHorizontal, ArrowRightLeft, LayoutDashboard, Folder, Copy, Lightbulb, Zap, Compass, Orbit, History,
  Clock, Calendar, FileText,
} from 'lucide-react';
import type { EditorSearchScope } from './editorSearch';
import { useConfirm } from '../../hooks/useConfirm';
import { useViewportLayout } from '../../hooks/useViewportLayout';
import { useModalA11y } from '../../hooks/useModalA11y';
import { ConfirmModal } from '../common/ConfirmModal';
import { SkipLink } from '../common/SkipLink';
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
import { displayNoteTitle } from './noteDisplayTitle';
import { collectCitationsFromMarkdown } from './citationUtils';
import {
  buildExpandedGraphData,
  collapseNode,
  expandNode,
  filterNotes,
  formatParsedQuery,
  hasKnowledgeQuerySyntax,
  buildFormulaQueryCatalog,
  knowledgeIndexService,
  parseQuery,
  BacklinkPanel,
  ReferenceExplorerPanel,
  buildKnowledgeMaintenanceData,
  buildStudyNote,
  buildConceptHub,
  buildLearningPath,
  getLearningPathId,
  buildProjectEditorData,
  findSmartCollection,
  setStudyProjectContainer,
  isStudyProjectContainer,
  getStudyProjectDescription,
  getStudyProjectStatus,
  filterStudyProjectContainers,
  setProjectMilestone,
  isProjectMilestone,
  getMilestoneStatus,
  getMilestoneTargetDate,
  getMilestoneProjectId,
  ProjectEditorPanel,
  MilestoneEditorPanel,
  setWeakTopic,
  isWeakTopic,
  extractNoteReferenceSummary,
  getNoteKind,
  setNoteKind,
  promoteNoteKind,
  filterNotesByKind,
  getLinkedStudyProjectId,
  formatLearningPathLabel,
  getProperty,
  buildReadingNote,
  BibliographyPanel,
  ReadingSourceLinkPanel,
  linkReadingNoteToSource,
  unlinkReadingNoteFromSource,
  getLinkedSourceNoteId,
  NoteClassificationSelector,
  LiteratureWorkflowIndicator,
  WeakTopicToggle,
  ConceptHubPanel,
  ConceptRelationsPanel,
  LearningPathPanel,
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
  addTag,
  SUBJECT_DASHBOARDS,
  noteMatchesPageTag,
  NotePropertiesPanel,
  NoteTagsPanel,
  NoteRelationsPanel,
  CosmosInsightsPanel,
  CosmosActionsPanel,
  parseNoteMarkdown,
  serializeNoteMarkdown,
  type SavedView,
  type SmartCollection,
  type SmartCollectionId,
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
  type AreaRangeTraceProjection,
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
import { WorkspaceSearchPalette } from './features/knowledge/components/WorkspaceSearchPalette';
import { CreateProjectDialog, type CreateProjectFormValues } from './features/knowledge/components/CreateProjectDialog';
import { CreateMilestoneDialog, type CreateMilestoneFormValues } from './features/knowledge/components/CreateMilestoneDialog';
import { TagChip, TagChipRow } from './features/knowledge/components/TagChip';
import { KnowledgeContextPanel, type KnowledgeContextTab } from './features/knowledge/components/KnowledgeContextPanel';
import { KnowledgePanelEmpty } from './features/knowledge/components/KnowledgePanelSection';
import { DiscoveryPanel } from './features/knowledge/components/DiscoveryPanel';
import { TimelinePanel } from './features/knowledge/components/TimelinePanel';
import { OutlinePanel } from './features/knowledge/components/OutlinePanel';
import { LinksContextPanel, CosmosContextFooter } from './features/knowledge/components/LinksContextPanel';
import { NoteContextStrip } from './features/knowledge/components/NoteContextStrip';
import { classifyGraphNodeTier } from './features/knowledge/graph/knowledgeUniverse/graphNodeTier';
import type { AppSettings } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { NoteGraphView } from './NoteGraphView';
import { type BlockEditorHandle } from './BlockEditor';
import {
  buildNoteChrome,
  buildBlockEditorColors,
} from './noteEditorTheme';
import { type EditorMode } from './editorMode';
import {
  flashHeadingElement,
  navigateToHeading,
} from './outlineNavigation';
import {
  resolveNextTocKeyboardIndex,
  resolveTocOpenIndex,
} from './tocKeyboardNavigation';
import { useTocScrollSpy } from './useTocScrollSpy';
import type { VirtualScrollApiRef } from './features/block-editor/performance';
import { footnoteAnchorId } from './footnoteUtils';
import { useNoteViewState, useNoteViewDashboard, useNoteViewPanels, useNoteViewActions, NoteContextPanelBody, NoteViewSidebar, NoteViewEditorArea } from './noteview/index';


// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export const NoteView = () => {
  const { t, lang } = useTranslation();

  const { appSettings, updateSetting } = useAppStore();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  // ── A. Store selectors ────────────────────────────────────────────
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
  const storeRenameFolder = useNotesStore(s => s.renameFolder);
  const storeDeleteFolder = useNotesStore(s => s.deleteFolder);
  const importNote = useNotesStore(s => s.importNote);
  const flushPendingSync = useNotesStore(s => s.flushPendingSync);
  const syncNoteToDB = useNotesStore(s => s.syncNoteToDB);
  const retrySync = useNotesStore(s => s.retrySync);

  // ── B. Derived state (note identity) ──────────────────────────────
  const activeNote = useMemo(
    () => notes.find(n => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  // ── Local UI state ────────────────────────────────────────────────
  const {
    activeFolderId, setActiveFolderId,
    titleInputRef,
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    searchScope, setSearchScope,
    searchMatchIdx, setSearchMatchIdx,
    showFolderForm, setShowFolderForm,
    newFolderName, setNewFolderName,
    renamingFolderId, setRenamingFolderId,
    renameVal, setRenameVal,
    activeTocIdx, setActiveTocIdx,
    tocKeyboardIdx, setTocKeyboardIdx,
    activeTag, setActiveTag,
    rightPanel, setRightPanel,
    timelineMode, setTimelineMode,
    timelineInitialArea, setTimelineInitialArea,
    tocCollapsed, setTocCollapsed,
    focusMode, setFocusMode,
    showShortcuts, setShowShortcuts,
    sortOrder, setSortOrder,
    showSortMenu, setShowSortMenu,
    dragNoteId, setDragNoteId,
    showRightPanel, setShowRightPanel,
    headerTagsExpanded, setHeaderTagsExpanded,
    sidebarCollapsed, setSidebarCollapsed,
    workspaceExpanded, setWorkspaceExpanded,
    editingLearningPathId, setEditingLearningPathId,
    showAppearance, setShowAppearance,
    traceDate, setTraceDate,
    traceRange, setTraceRange,
    traceAreaId, setTraceAreaId,
    traceAreaRange, setTraceAreaRange,
    traceDiscoveryMode, setTraceDiscoveryMode,
    mobileSidebarOpen, setMobileSidebarOpen,
    mobileShowEditor, setMobileShowEditor,
    docCopied, setDocCopied,
    titleComposingRef,
    titleDraft, setTitleDraft,
    docCopyTimerRef,
    shortcutsPanelRef,
    eventDialog, setEventDialog,
    openCreateEventDialogRef,
    milestoneDialog, setMilestoneDialog,
    workspaceSearchOpen, setWorkspaceSearchOpen,
    createProjectDialogOpen, setCreateProjectDialogOpen,
    createMilestoneDialogOpen, setCreateMilestoneDialogOpen,
    resetBrowseScope,
  } = useNoteViewState();

  const { isMobile, isTablet } = useViewportLayout();
  const isCompactChrome = isMobile || isTablet;

  useModalA11y({ open: showShortcuts, onClose: () => setShowShortcuts(false), containerRef: shortcutsPanelRef });

  useEffect(() => {
    if (isTablet && !isMobile) setSidebarCollapsed(true);
  }, [isTablet, isMobile, setSidebarCollapsed]);

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

  const [expandedGraphNodes, setExpandedGraphNodes] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const blockEditorRef = useRef<BlockEditorHandle>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const virtualScrollApiRef = useRef<{
    scrollToBlockId: (blockId: string) => boolean;
    getBlockScrollTop?: (blockId: string) => number | null;
  } | null>(null);
  const tocScrollSpyPausedRef = useRef(false);
  const tocPanelRef = useRef<HTMLDivElement>(null);

  const isTrash = activeFolderId === 'trash';

  const {
    noteUpdate,
    createNote,
    duplicateNote,
    createFolder,
    deleteFolder,
    exportNote,
    exportAllNotes,
    openTraceDay,
    openTraceRange,
    openTraceArea,
    openTraceDiscovery,
    closeTraceLens,
    openCreateEventDialog,
    openEditEventDialog,
    openMilestoneDialog,
    handleEventDialogSave,
    handleRemoveEventStatus,
    handleMilestoneDialogSave,
    handleRemoveMilestone,
    createQuickCapture,
    createTask,
    createJournal,
    handleCreateReadingNote,
    handleCreateStudyNote,
    handleCreateProject,
    handleSubmitCreateProject,
    handleCreateProjectMilestone,
    handleSubmitCreateMilestone,
    handleOpenStudyCollection,
    handleOpenResearchCollection,
    handleActivateSubjectWorkspace,
    handleWorkspaceSearchNote,
    handleWorkspaceSearchFolder,
    handleWorkspaceSearchTag,
    handleWorkspaceSearchCollection,
    handleWorkspaceSearchLearningPath,
    handleOpenProjectNotes,
    handleNavigateToProjectEditor,
    handleEditProject,
    handleUpdateProjectDescription,
    handleUpdateProjectStatus,
    handleUpdateMilestoneStatus,
    handleUpdateMilestoneTargetDate,
    handleCreateLearningPathStepNote,
    handleUpdateNoteProperties,
    handleActivateDashboardWithTraceClear,
    handleCopyDocument,
    handleTitleChange,
    handleTitleCompositionEnd,
    handleActiveBodyChange,
    handlePromoteNoteKind,
    handleLinkReadingSource,
    handleUnlinkReadingSource,
    handleExpandGraphNode,
    handleCollapseGraphNode,
    addFolder,
    insertImageAtCursor,
    insertEmptyImageBlockAtCursor,
    handleEditorDrop,
    handleImport,
    navigateToWiki,
    handleToggleAreaNote,
    openCreatedNote,
  } = useNoteViewActions({
    notes,
    activeNote,
    activeNoteId,
    activeFolderId,
    isTrash,
    traceAreaId,
    viewMode,
    showSortMenu,
    newFolderName,
    eventDialog,
    milestoneDialog,
    titleInputRef,
    titleComposingRef,
    docCopyTimerRef,
    blockEditorRef,
    searchInputRef,
    openCreateEventDialogRef,
    setViewMode,
    setActiveFolderId,
    setSearchQuery,
    setShowFolderForm,
    setNewFolderName,
    setEventDialog,
    setMilestoneDialog,
    setCreateProjectDialogOpen,
    setCreateMilestoneDialogOpen,
    setTraceDate,
    setTraceRange,
    setTraceAreaId,
    setTraceAreaRange,
    setTraceDiscoveryMode,
    setWorkspaceActivation,
    setWorkspaceSearchOpen,
    setShowShortcuts,
    setShowSortMenu,
    setFocusMode,
    setDocCopied,
    setSearchScope,
    setActiveTag,
    setMobileSidebarOpen,
    setExpandedGraphNodes,
    setIsDragOver,
    setTitleDraft,
    setActiveNoteId,
    setShowRightPanel,
    setRightPanel,
    setEditingLearningPathId,
    updateNote,
    storeCreateNote,
    storeCreateFolder,
    storeDuplicateNote,
    storeDeleteFolder,
    importNote,
    flushPendingSync,
    syncNoteToDB,
    handleLeaveDashboardForNote,
    handleActivateSmartCollection,
    handleActivateDashboard,
    resetBrowseScope,
    isMobile,
  });

  createQuickCaptureRef.current = createQuickCapture;
  createTaskRef.current = createTask;
  createJournalRef.current = createJournal;

  const todayTraceKey = toDateKey(new Date());

  const currentTraceMonthKey = currentTraceMonth();
  const currentTraceQuarterKey = currentTraceQuarter();
  const currentTraceYearKey = currentTraceYear();

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
        ? areaRangeTraceMarkCount(traceAreaProjection as AreaRangeTraceProjection)
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

  const formulaQueryCatalog = useMemo(
    () => buildFormulaQueryCatalog(databaseViews),
    [databaseViews],
  );

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
    if (!shouldSkipUserSort) {
      list = [...list].sort((a, b) => {
        if (sortOrder === 'title')   return (a.title ?? '').localeCompare(b.title ?? '');
        if (sortOrder === 'created') return Number((a.id ?? '').split('-')[1] || 0) - Number((b.id ?? '').split('-')[1] || 0);
        return b.updatedAt - a.updatedAt;
      });
    }
    return list;
  }, [notes, activeFolderId, searchQuery, activeTag, sortOrder, knowledgeQueryInfo.active, applyWorkspaceToNotes, shouldSkipUserSort, formulaQueryCatalog]);

  // ── E. Layout-derived constants ───────────────────────────────────
  const hideSidebarByFocus = isFocusPresetActive && focusUiPreferences.hideSidebar;
  const hideSecondaryByFocus = isFocusPresetActive && focusUiPreferences.hideSecondaryPanels;
  const hideLeftChrome = focusMode || hideSidebarByFocus;
  const hideSecondaryChrome = hideSecondaryByFocus;
  const hideNoteList = isMobile && mobileShowEditor && !!activeNoteId;
  const hideEditorArea = isMobile && !mobileShowEditor;

  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [isMobile, activeFolderId, activeTag, workspaceActivation.kind, 'id' in workspaceActivation ? workspaceActivation.id : null]);

  useEffect(() => {
    if (isFocusPresetActive && focusUiPreferences.hideGraph && viewMode === 'graph') {
      setViewMode('edit');
    }
  }, [isFocusPresetActive, focusUiPreferences.hideGraph, viewMode]);

  const isWorkspacePanelMode = isDatabaseViewMode || isDashboardMode || isTraceLensMode;
  const activeWorkspaceKind = workspaceActivation.kind === 'none' ? null : workspaceActivation.kind;
  const activeWorkspaceId =
    workspaceActivation.kind === 'saved-view'
    || workspaceActivation.kind === 'smart-collection'
    || workspaceActivation.kind === 'rule-collection'
    || workspaceActivation.kind === 'database-view'
      ? workspaceActivation.id
      : null;

  const [databaseCreateSignal, setDatabaseCreateSignal] = useState(0);

  useEffect(() => {
    if (isDashboardMode || isWorkspaceKindActive(workspaceActivation, 'smart-collection')) {
      setWorkspaceExpanded(true);
    }
  }, [isDashboardMode, workspaceActivation, isWorkspaceKindActive]);

  useEffect(() => {
    if (databaseCreateSignal > 0) setWorkspaceExpanded(true);
  }, [databaseCreateSignal]);

  // ── B. Derived state (active note panels) ─────────────────────────
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

  useEffect(() => { setSearchMatchIdx(0); }, [searchQuery, activeNoteId, searchScope]);

  const editorSearchQuery = searchScope === 'all' ? '' : searchQuery;

  const toc = useMemo(
    () => (activeNote ? extractTOC(activeNote.body, { untitledLabel: t('outlineUntitled') }) : []),
    [activeNote?.body, t],
  );

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

  const relatedNotes = useMemo(
    () => (activeNote ? knowledgeIndexService.getRelatedNotes(activeNote.id) : []),
    [activeNote, notes],
  );

  const noteReferenceSummary = useMemo(
    () => (activeNote ? extractNoteReferenceSummary(activeNote, notes) : null),
    [activeNote, notes],
  );

  const knowledgeMaintenance = useMemo(
    () => buildKnowledgeMaintenanceData(notes),
    [notes],
  );

  const {
    historyEvents,
    discoveryFeed,
    unifiedWorkspaceDashboard,
    learningPathOverview,
    subjectWorkspaces,
    cosmosVaultPhase,
    knowledgeTimeline,
    activitySummary,
    cosmosEvolutionSummary,
    cosmosEvolutionStory,
    knowledgeJourney,
    evolutionInsights,
    bootstrapImportSummary,
    discoveryProgress,
    dashboardRecentActivity,
    dashboardLatestMilestone,
    handleDismissBootstrapSummary,
    handleExportHistory,
  } = useNoteViewDashboard({ notes, lang, timelineMode, activeNote });

  const projectEditorData = useMemo(
    () => (activeNote && isStudyProjectContainer(activeNote)
      ? buildProjectEditorData(notes, activeNote)
      : null),
    [activeNote, notes],
  );

  const milestoneProjectTitle = useMemo(() => {
    if (!activeNote || !isProjectMilestone(activeNote)) return '';
    const projectId = getMilestoneProjectId(activeNote);
    if (!projectId) return '';
    const project = notes.find(n => n.id === projectId);
    return project ? displayNoteTitle(project.title) : '';
  }, [activeNote, notes]);

  const conceptHub = useMemo(
    () => (activeNote
      ? buildConceptHub({
        note: activeNote,
        notes,
        service: knowledgeIndexService,
        referenceSummary: noteReferenceSummary,
      })
      : null),
    [activeNote, notes, noteReferenceSummary],
  );

  const learningPath = useMemo(() => {
    if (!activeNote) return null;
    const pathId = getLearningPathId(activeNote);
    return pathId ? buildLearningPath(notes, pathId) : null;
  }, [activeNote, notes]);

  const noteBibliography = useMemo(
    () => (activeNote ? collectCitationsFromMarkdown(activeNote.body ?? '') : []),
    [activeNote?.body, activeNote?.id],
  );

  const noteContextReviewEntry = useMemo(
    () => (activeNote
      ? knowledgeMaintenance.queue.find(entry => entry.noteId === activeNote.id) ?? null
      : null),
    [activeNote, knowledgeMaintenance.queue],
  );

  const noteLinkedProjectId = useMemo(() => {
    if (!activeNote) return null;
    if (isProjectMilestone(activeNote)) return getMilestoneProjectId(activeNote);
    return getLinkedStudyProjectId(activeNote);
  }, [activeNote]);

  const noteLinkedProjectTitle = useMemo(() => {
    if (!noteLinkedProjectId) return '';
    const project = notes.find(n => n.id === noteLinkedProjectId);
    return project ? displayNoteTitle(project.title) : '';
  }, [noteLinkedProjectId, notes]);

  const noteLearningPathLabel = useMemo(() => {
    if (!activeNote) return null;
    if (learningPath) return learningPath.label;
    const pathId = getLearningPathId(activeNote);
    return pathId ? formatLearningPathLabel(pathId) : null;
  }, [activeNote, learningPath]);

  const noteCosmosTier = useMemo(() => {
    if (!activeNote) return 'moon' as const;
    return classifyGraphNodeTier({
      backlinkCount: pageReferences?.incoming.length ?? 0,
      isAreaNote: isAreaNote(activeNote),
      isPinnedHub: Boolean(activeNote.starred),
    });
  }, [activeNote, pageReferences]);

  const noteConnectionCount = useMemo(
    () => (pageReferences?.incoming.length ?? 0) + (noteReferenceSummary?.outgoing.length ?? 0),
    [pageReferences, noteReferenceSummary],
  );

  const noteAreaProperty = useMemo(
    () => (activeNote && !isAreaNote(activeNote) ? getProperty(activeNote, 'area')?.trim() : ''),
    [activeNote],
  );

  const linksStructureCount = useMemo(() => {
    let count = 0;
    if (conceptHub) count += 1;
    count += 1; // concept relations always rendered
    if (learningPath) count += 1;
    return count;
  }, [conceptHub, learningPath]);

  const linksConnectionsCount = useMemo(() => {
    const incoming = pageReferences?.incoming.length ?? 0;
    const outgoing = noteReferenceSummary?.outgoing.length ?? 0;
    return incoming + outgoing + relatedNotes.length;
  }, [pageReferences, noteReferenceSummary, relatedNotes]);

  const linksSourcesCount = useMemo(
    () => noteBibliography.length + (activeNote && getLinkedSourceNoteId(activeNote) ? 1 : 0),
    [noteBibliography, activeNote],
  );

  const {
    openContextPanel,
    noteIntelligenceSnapshot,
    noteHistoryContext,
    noteTierInput,
    handleLearnLinking,
    handleStartWikiLink,
    handleCreateRelatedNote,
    handleOpenDiscover,
    handleOpenCosmosGraph,
    handleOpenTimeline,
    handleOpenEvolution,
    handleNavigateToArea,
    handleDiscoveryCreateRelation,
    handleCosmosConnect,
    handleCosmosAssignArea,
    handleCosmosCreateHub,
    handleCosmosCreateRelation,
    handleLinkRelatedNote,
    handleHudReviewWeakAreas,
  } = useNoteViewPanels({
    notes,
    activeNote,
    historyEvents,
    noteUpdate,
    createNote,
    setActiveNoteId,
    setViewMode,
    setShowRightPanel,
    setRightPanel,
    setTimelineInitialArea,
    blockEditorRef,
  });

  useEffect(() => {
    setHeaderTagsExpanded(false);
  }, [activeNote?.id, setHeaderTagsExpanded]);

  const activeNoteKind = activeNote ? getNoteKind(activeNote) : null;

  const sourceNoteCandidates = useMemo(
    () => filterNotesByKind(notes, 'source').filter(n => n.id !== activeNote?.id),
    [notes, activeNote?.id],
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

  useEffect(() => { setActiveTocIdx(null); }, [activeNoteId]);

  const getHeadingBlockScrollTop = useCallback(
    (blockId: string) => virtualScrollApiRef.current?.getBlockScrollTop?.(blockId) ?? null,
    [],
  );

  const getOutlineBlocks = useCallback(
    () => blockEditorRef.current?.getBlocks() ?? [],
    [activeNoteId],
  );

  useTocScrollSpy(
    editorScrollRef,
    getOutlineBlocks,
    toc,
    viewMode !== 'graph' && activeFolderId !== 'trash' && toc.length > 0,
    tocScrollSpyPausedRef,
    setActiveTocIdx,
    getHeadingBlockScrollTop,
  );

  const scrollToHeading = useCallback((headingIdx: number) => {
    setActiveTocIdx(headingIdx);
    tocScrollSpyPausedRef.current = true;
    const blocks = blockEditorRef.current?.getBlocks() ?? [];
    const scrollApi = virtualScrollApiRef.current;
    navigateToHeading({
      scrollRoot: editorScrollRef.current,
      blocks,
      headingIdx,
      scrollToBlockId: scrollApi?.scrollToBlockId,
      onFlash: flashHeadingElement,
    });
    window.setTimeout(() => { tocScrollSpyPausedRef.current = false; }, 800);
  }, [activeNoteId]);

  const highlightedTocIdx = tocKeyboardIdx ?? activeTocIdx;

  useEffect(() => {
    setTocKeyboardIdx(null);
  }, [activeNoteId, tocCollapsed]);

  const scrollTocRowIntoView = useCallback((headingIdx: number) => {
    const panel = tocPanelRef.current;
    if (!panel) return;
    const row = panel.querySelector(`[data-toc-idx="${headingIdx}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleTocKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (visibleToc.length === 0) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const current = tocKeyboardIdx ?? activeTocIdx;

    if (e.key === 'j') {
      e.preventDefault();
      const next = resolveNextTocKeyboardIndex(visibleToc, current, 'next');
      if (next !== null) {
        setTocKeyboardIdx(next);
        scrollTocRowIntoView(next);
      }
      return;
    }

    if (e.key === 'k') {
      e.preventDefault();
      const prev = resolveNextTocKeyboardIndex(visibleToc, current, 'prev');
      if (prev !== null) {
        setTocKeyboardIdx(prev);
        scrollTocRowIntoView(prev);
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const openIdx = resolveTocOpenIndex(visibleToc, tocKeyboardIdx, activeTocIdx);
      if (openIdx !== null) {
        setTocKeyboardIdx(null);
        scrollToHeading(openIdx);
      }
    }
  }, [visibleToc, tocKeyboardIdx, activeTocIdx, scrollToHeading, scrollTocRowIntoView]);

  // Reading mode click delegation — be-wikilink / be-tag data attributes
  const handleReadingModeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const fnRef = target.closest('.be-footnote-ref') as HTMLElement | null;
    if (fnRef?.dataset.footnoteId) {
      e.preventDefault();
      const anchor = footnoteAnchorId(fnRef.dataset.footnoteId);
      const root = editorScrollRef.current;
      root?.querySelector(`#${globalThis.CSS?.escape(anchor) ?? anchor}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
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

  const folderLabel = useMemo(() =>
    activeFolderId === null    ? t('nvAllNotes') :
    activeFolderId === 'trash' ? t('nvTrashLabel') :
    activeFolderId === 'starred' ? t('starred') :
    (folders.find(f => f.id === activeFolderId)?.name ?? ''),
    [activeFolderId, folders, t]
  );

  // 렌더마다 새 배열 생성 방지 — icon은 JSX이므로 useMemo로 안정화
  const VIEW_MODES = useMemo(() => [
    { key: 'reading' as const, icon: <Eye size={12}/>,     label: t('nvReading') },
    { key: 'graph'   as const, icon: <Orbit size={12}/>, label: t('nvGraph') },
  ], [t]);
  const RIGHT_PANELS = useMemo(() => [
    { key: 'toc'        as const, label: t('nvPanelToc'), icon: <AlignLeft size={12}/> },
    { key: 'links'      as const, label: t('nvPanelLinks'),   icon: <Link size={12}/> },
    { key: 'graph'      as const, label: t('nvGraph'),   icon: <Orbit size={12}/> },
    { key: 'insights'   as const, label: t('k36PanelInsights'), icon: <Lightbulb size={12}/> },
    { key: 'actions'    as const, label: t('k37PanelActions'), icon: <Zap size={12}/> },
    { key: 'discover'   as const, label: t('k38PanelDiscover'), icon: <Compass size={12}/> },
    { key: 'timeline'   as const, label: t('k42PanelTimeline'), hint: t('k43KnowledgeTimelineLabel'), icon: <History size={12}/> },
    { key: 'properties' as const, label: t('nvPanelProperties'),   icon: <SlidersHorizontal size={12}/> },
    { key: 'tags'       as const, label: t('nvPanelTags'),    icon: <Tag size={12}/> },
    { key: 'relations'  as const, label: t('nvPanelRelations'), icon: <ArrowRightLeft size={12}/> },
    { key: 'stats'      as const, label: t('nvPanelStats'),   icon: <span style={{ fontSize: 11, fontWeight: 700 }}>#</span> },
  ], [t]);

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
    .btoc.active{color:${c.accent};background:${c.cardHov};font-weight:600}
    .btpill{background:${c.tag};color:${c.tagTxt};border-radius:999px;font-size:10px;padding:2px 8px;cursor:pointer;border:1px solid transparent}
    .btpill:hover{border-color:${c.tagTxt}60}
    .btpill.active{border-color:${c.tagTxt};font-weight:600}
    .bbl{padding:6px 10px;font-size:12px;color:${c.accent};cursor:pointer;border-radius:5px}
    .bbl:hover{background:${c.cardHov}}
    .bshl{background:${dark ? '#3d3860' : '#e8e4ff'};color:${c.text};border-radius:2px;padding:0 2px}
    .bsc-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${c.sideBdr};font-size:13px}
    .bsc-key{background:${c.toolbar};border:1px solid ${c.toolBdr};border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace;color:${c.text}}
    .focus-overlay{position:fixed;inset:0;background:${dark ? '#000' : '#FAF8F3'};opacity:.94;z-index:98;pointer-events:none}
    .mobile-drawer-backdrop{position:fixed;inset:0;background:#00000055;z-index:140}
    .mobile-sidebar-drawer{position:fixed;top:0;left:0;bottom:0;width:min(280px,88vw);z-index:150;box-shadow:4px 0 24px #00000025}
    .mobile-panel-drawer{position:fixed;top:0;right:0;bottom:0;width:min(320px,92vw);z-index:150;box-shadow:-4px 0 24px #00000025}
    .mobile-sidebar-drawer .bfi{min-height:44px;padding:10px 11px}
    .btbtn-mobile{min-height:44px;min-width:44px}
    [data-compact-chrome] .bicon-btn{width:44px;height:44px}
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
    <div data-compact-chrome={isCompactChrome || undefined} style={{ display: 'flex', height: '100%', background: c.wrap, color: c.text, fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>
      <SkipLink href="#noteview-main" label={t('skipToMain')} />
      <SkipLink href="#noteview-navigation" label={t('skipToNavigation')} />
      <input ref={importInputRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={handleImport} multiple/>

      {/* ── 포커스 모드 오버레이 ── */}
      {hideLeftChrome && <div className="focus-overlay" onClick={() => {
        if (isFocusPresetActive) handleExitFocusPreset();
        else setFocusMode(false);
      }}/>}

      {isMobile && mobileSidebarOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />
      )}

      {isCompactChrome && showRightPanel && activeNote && viewMode !== 'graph' && !hideSecondaryByFocus && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setShowRightPanel(false)}
          aria-hidden
        />
      )}

      {/* ── 단축키 모달 ── */}
      {showShortcuts && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowShortcuts(false)}>
          <div ref={shortcutsPanelRef} role="dialog" aria-modal="true" aria-labelledby="nv-shortcuts-title"
            style={{ background: c.card, borderRadius: 12, padding: '20px 24px', width: 340, boxShadow: '0 8px 32px #00000030' }}
            onClick={e => e.stopPropagation()}>
            <div id="nv-shortcuts-title" style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: c.text }}>{t('nvShortcuts')}</div>
            {[
              ['Ctrl + N',         t('nvScNewNote')],
              ['Ctrl + D',         t('nvScDuplicate')],
              ['Ctrl + E',         t('nvScToggleRead')],
              ['Ctrl + G',         t('nvScGraph')],
              ['Ctrl + K',         t('nvScWorkspaceSearch')],
              ['Ctrl + F',         t('nvScNoteSearch')],
              ['Ctrl + Shift + F', t('nvScFocus')],
              ['Ctrl + /',         t('nvScShowShortcuts')],
              [null, null],
              ['Ctrl + S',         t('nvScSave')],
              ['Ctrl + Z',         t('nvScUndo')],
              ['Ctrl + Y / ⇧+Z',  t('nvScRedo')],
              [null, null],
              ['/',                t('nvScSlash')],
              ['[[...]]',          t('nvScWikiLink')],
              ['Ctrl + Click',     t('nvScWikiNav')],
              ['[[link]]',         t('nvScWikiClick')],
              ['#tag in search',   t('nvScTagFilter')],
              ['↑ ↓ Enter',        t('nvScMenuNav')],
              ['Esc',              t('nvScEsc')],
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
              {t('close')}
            </button>
          </div>
        </div>
      )}

      <NoteViewSidebar
        layout={{
          hideLeftChrome,
          hideSecondaryChrome,
          hideNoteList,
          isMobile,
          isTablet,
          isCompactChrome,
          isWorkspacePanelMode,
          sidebarCollapsed,
          mobileSidebarOpen,
        }}
        data={{
          c,
          dark,
          notes,
          folders,
          activeFolderId,
          activeTag,
          activeNoteCount,
          trashCount,
          starredCount,
          isTrash,
          searchQuery,
          knowledgeQueryInfo,
          workspaceActivation,
          isTraceLensMode,
          todayTraceKey,
          isTraceDayMode,
          traceDate,
          isTraceRangeMode,
          traceRange,
          currentTraceMonthKey,
          currentTraceQuarterKey,
          currentTraceYearKey,
          areaNotes,
          isTraceAreaMode,
          traceAreaId,
          isTraceDiscoveryMode,
          renamingFolderId,
          renameVal,
          showFolderForm,
          newFolderName,
          allTags,
          workspaceExpanded,
          isDashboardMode,
          smartCollectionCounts,
          pinnedWorkspaces,
          activeWorkspaceKind,
          activeWorkspaceId,
          recentWork,
          ruleCollections,
          ruleCollectionCounts,
          canCreateRuleCollection,
          databaseViews,
          databaseViewCounts,
          canCreateDatabaseView,
          databaseCreateSignal,
          savedViews,
          canSaveCurrentView,
          traceAreaProjection,
          traceAreaRange,
          activeDatabaseView,
          activeSmartCollection,
          activeRuleCollection,
          activeSavedView,
          folderLabel,
          traceLensMarkCount,
          isDatabaseViewMode,
          activeDatabaseViewNoteCount,
          recentNotes,
          visibleNotes,
          activeNotes,
          activeNoteId,
          safeNotesForDatabase,
          dashboard,
          sortOrder,
          showSortMenu,
          dragNoteId,
          editingLearningPathId,
          focusPresets,
          focusPresetTargets,
          focusSession,
          focusWorkspaceOptions,
          taskTemplates,
          journalTemplates,
          knowledgeMaintenance,
          unifiedWorkspaceDashboard,
          subjectWorkspaces,
          learningPathOverview,
          knowledgeTimeline,
          activitySummary,
          dashboardRecentActivity,
          dashboardLatestMilestone,
          evolutionInsights,
        }}
        handlers={{
          searchInputRef,
          importInputRef,
          setSidebarCollapsed,
          setActiveFolderId,
          setActiveTag,
          setSearchQuery,
          setShowShortcuts,
          setWorkspaceSearchOpen,
          openTraceDay,
          openTraceRange,
          openCreatedNote,
          openTraceArea,
          openTraceDiscovery,
          storeRenameFolder,
          setRenamingFolderId,
          setRenameVal,
          deleteFolder,
          setShowFolderForm,
          setNewFolderName,
          addFolder,
          setWorkspaceActivation,
          setTraceDate,
          setTraceRange,
          setTraceAreaId,
          setTraceAreaRange,
          setTraceDiscoveryMode,
          setWorkspaceExpanded,
          handleActivateDashboardWithTraceClear,
          handleActivateSmartCollection,
          handleClearSmartCollection,
          handleTogglePinWorkspace,
          isWorkspacePinned,
          handleActivateWorkspaceRef,
          handleUnpinWorkspace,
          handleMovePinnedWorkspace,
          handleClearRecentWork,
          handleActivateRuleCollection,
          handleClearRuleCollection,
          handleCreateRuleCollection,
          handleRenameRuleCollection,
          handleDeleteRuleCollection,
          handleActivateDatabaseView,
          handleClearDatabaseView,
          handleCreateDatabaseView,
          handleCreateDatabaseViewFromTemplate,
          handleRenameDatabaseView,
          handleDeleteDatabaseView,
          handleActivateSavedView,
          handleClearSavedView,
          handleCreateSavedView,
          handleRenameSavedView,
          handleDeleteSavedView,
          isWorkspaceKindActive,
          setMobileSidebarOpen,
          closeTraceLens,
          handleClearDashboard,
          setShowSortMenu,
          setSortOrder,
          exportAllNotes,
          openCreateEventDialog,
          createNote,
          setActiveNoteId,
          setMobileShowEditor,
          noteUpdate,
          setDragNoteId,
          duplicateNote,
          patchActiveDatabaseView,
          setDatabaseCreateSignal,
          setViewMode,
          handleLeaveDashboardForNote,
          handleResumeLastWorkspace,
          handleCreateFocusPreset,
          handleDeleteFocusPreset,
          handleActivateFocusPreset,
          handleExitFocusPreset,
          handleQuickCapture,
          handleCreateTask,
          handleCreateJournal,
          handleCreateReadingNote,
          handleCreateStudyNote,
          handleCreateTaskDatabase,
          handleCreateJournalDatabase,
          handleCreateProject,
          handleCreateProjectMilestone,
          handleOpenProjectNotes,
          handleEditProject,
          handleActivateSubjectWorkspace,
          handleOpenStudyCollection,
          handleOpenResearchCollection,
          handleOpenDiscover,
          handleOpenTimeline,
          handleOpenEvolution,
          handleNavigateToArea,
          handleCreateLearningPathStepNote,
          handleUpdateNoteProperties,
          handleNavigateToProjectEditor,
          setEditingLearningPathId,
          resumeWorkspace,
        }}
      />
      <NoteViewEditorArea
        layout={{
          hideEditorArea,
          isMobile,
          isCompactChrome,
          isFocusPresetActive,
          isTrash,
          showRightPanel,
          viewMode,
          showAppearance,
          isDragOver,
          headerTagsExpanded,
          docCopied,
          dark,
        }}
        data={{
          c,
          activeNote,
          activeNoteId,
          notes,
          folders,
          titleDraft,
          activeNoteKind,
          noteTags,
          syncError,
          isSyncing,
          savedAt,
          viewModes: VIEW_MODES,
          noteAreaProperty,
          noteLinkedProjectTitle,
          noteLinkedProjectId,
          noteLearningPathLabel,
          noteContextReviewEntry,
          noteConnectionCount,
          noteCosmosTier,
          activeTag,
          searchQuery,
          searchScope,
          searchMatchIdx,
          editorSearchQuery,
          blockColors,
          wikiTargets,
          appSettings,
          knowledgeTimeline,
          activeFocusPreset,
        }}
        handlers={{
          titleInputRef,
          titleComposingRef,
          blockEditorRef,
          editorScrollRef,
          virtualScrollApiRef,
          searchInputRef,
          importInputRef,
          setMobileShowEditor,
          setActiveNoteId,
          handleExitFocusPreset,
          handleTitleChange,
          handleTitleCompositionEnd,
          noteUpdate,
          retrySync,
          setViewMode,
          openEditEventDialog,
          openMilestoneDialog,
          handleToggleAreaNote,
          toggleStar,
          duplicateNote,
          setShowRightPanel,
          handleCopyDocument,
          exportNote,
          restoreNote,
          moveNoteToTrash,
          setActiveFolderId,
          setSearchQuery,
          setActiveTag,
          setHeaderTagsExpanded,
          openContextPanel,
          setRightPanel,
          handlePromoteNoteKind,
          handleLearnLinking,
          handleHudReviewWeakAreas,
          handleOpenDiscover,
          handleOpenTimeline,
          createNote,
          setSearchScope,
          setSearchMatchIdx,
          insertEmptyImageBlockAtCursor,
          setShowAppearance,
          updateSetting,
          setIsDragOver,
          insertImageAtCursor,
          handleEditorDrop,
          handleReadingModeClick,
          handleActiveBodyChange,
          navigateToWiki,
        }}
      />

      {/* ── Knowledge Context Panel ── */}
      {(activeNote || rightPanel === 'discover' || rightPanel === 'timeline') && viewMode !== 'graph' && showRightPanel && !hideSecondaryByFocus && (
        <KnowledgeContextPanel
          colors={c}
          compact={isCompactChrome}
          tablet={isTablet}
          activeTab={rightPanel}
          tabs={RIGHT_PANELS}
          onTabChange={setRightPanel}
        >
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <NoteContextPanelBody
              colors={c}
              rightPanel={rightPanel}
              activeNote={activeNote}
              panelData={{
                pageReferences,
                noteReferenceSummary,
                linksStructureCount,
                linksConnectionsCount,
                linksSourcesCount,
                conceptHub,
                learningPath,
                notes,
                wikiTargets,
                backlinkContexts,
                mentioningNotes,
                relatedNotes,
                sourceNoteCandidates,
                noteBibliography,
                localGraphData,
                noteIntelligenceSnapshot,
                noteTierInput,
                noteHistoryContext,
                discoveryFeed,
                cosmosVaultPhase,
                projectEditorData,
                milestoneProjectTitle,
                allTags,
                activeTag,
                resolvedOutgoingRelations,
                incomingRelationDisplays,
                noteTags,
              }}
              panelHandlers={{
                createNote,
                noteUpdate,
                setActiveNoteId,
                navigateToWiki,
                handleLinkRelatedNote,
                handleOpenCosmosGraph,
                handleStartWikiLink,
                handleCreateRelatedNote,
                handleLinkReadingSource,
                handleUnlinkReadingSource,
                handleExpandGraphNode,
                handleCollapseGraphNode,
                setViewMode,
                openContextPanel,
                handleOpenDiscover,
                handleCosmosConnect,
                handleCosmosAssignArea,
                handleCosmosCreateHub,
                handleCosmosCreateRelation,
                handleDiscoveryCreateRelation,
                handleUpdateProjectDescription,
                handleUpdateProjectStatus,
                handleCreateProjectMilestone,
                handleUpdateMilestoneStatus,
                handleUpdateMilestoneTargetDate,
                setActiveFolderId,
                setSearchQuery,
                setActiveTag,
              }}
              editorContext={{
                tocPanelRef,
                visibleToc,
                highlightedTocIdx,
                tocCollapsed,
                handleTocKeyDown,
                toggleTocCollapse,
                scrollToHeading,
              }}
              dashboardContext={{
                knowledgeTimeline,
                timelineMode,
                setTimelineMode,
                historyEvents,
                cosmosEvolutionSummary,
                cosmosEvolutionStory,
                discoveryProgress,
                knowledgeJourney,
                evolutionInsights,
                bootstrapImportSummary,
                timelineInitialArea,
                handleDismissBootstrapSummary,
                handleExportHistory,
              }}
            />
          </div>

          {isTrash && activeNote && (
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
        </KnowledgeContextPanel>
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
      <WorkspaceSearchPalette
        colors={c}
        notes={notes}
        folders={folders}
        open={workspaceSearchOpen}
        discoveryFeed={discoveryFeed}
        onClose={() => setWorkspaceSearchOpen(false)}
        onSelectNote={handleWorkspaceSearchNote}
        onSelectFolder={handleWorkspaceSearchFolder}
        onSelectTag={handleWorkspaceSearchTag}
        onSelectCollection={handleWorkspaceSearchCollection}
        onSelectLearningPath={handleWorkspaceSearchLearningPath}
      />
      {createProjectDialogOpen && (
        <CreateProjectDialog
          colors={c}
          onSubmit={handleSubmitCreateProject}
          onClose={() => setCreateProjectDialogOpen(false)}
        />
      )}
      {createMilestoneDialogOpen && (
        <CreateMilestoneDialog
          colors={c}
          notes={notes}
          defaultProjectId={
            activeNote && isStudyProjectContainer(activeNote)
              ? activeNote.id
              : filterStudyProjectContainers(notes, 'active')[0]?.id
          }
          onSubmit={handleSubmitCreateMilestone}
          onClose={() => setCreateMilestoneDialogOpen(false)}
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