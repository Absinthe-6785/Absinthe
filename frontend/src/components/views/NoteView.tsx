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
import { sortNotes } from './noteListSort';
import { writeNoteSortPrefs } from './noteListSortPreference';
import { countTraceDay, countTraceMonth, countTraceWeek, countTraceYesterday } from './traceSidebarCounts';
import { openOrCreateDailyNote } from './k101DailyNote';
import {
  navigateToNoteWithHistory,
  seedNoteNavigationStack,
  type NoteNavigationSource,
} from '../../lib/noteNavigationStack';
import { setNoteBreadcrumb, type NoteBreadcrumbSegment, registerNotesTrashOpener, switchToTab, openWorkspaceSearch } from '../../lib/noteNavigation';
import { registerSearchNoteHandlers } from './features/search/searchNavigation';
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
  normalizeNoteFolderId,
} from './noteUtils';
import { displayNoteTitle } from './noteDisplayTitle';
import { collectCitationsFromMarkdown } from './citationUtils';
import {
  buildExpandedGraphData,
  collapseNode,
  expandNode,
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
  groupRelatedNotes,
  type GroupedRelatedNotes,
} from './features/knowledge';
import type { NoteBase as Note, NoteFolderBase as NoteFolder, TocItem } from './noteUtils';
import { CreateProjectDialog, type CreateProjectFormValues } from './features/knowledge/components/CreateProjectDialog';
import { CreateMilestoneDialog, type CreateMilestoneFormValues } from './features/knowledge/components/CreateMilestoneDialog';
import { KnowledgeContextPanel, type KnowledgeContextTab } from './features/knowledge/components/KnowledgeContextPanel';
import { classifyGraphNodeTier } from './features/knowledge/graph/knowledgeUniverse/graphNodeTier';
import type { AppSettings } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { NoteGraphView } from './NoteGraphView';
import { type BlockEditorHandle } from './BlockEditor';
import { scheduleEditorFocus } from './noteview/editorFocus';
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
import { resetTocScrollStore, setTocScrollActiveIdx, getTocScrollActiveIdx } from './noteview/tocScrollStore';
import { useRenderDiagnostic } from './noteview/renderDiagnostics';
import type { VirtualScrollApiRef } from './features/block-editor/performance';
import { footnoteAnchorId } from './footnoteUtils';
import { useNoteViewState, useNoteViewDashboard, useNoteViewPanels, useNoteViewActions, NoteContextPanelBody, NoteViewSidebar, NoteViewEditorArea, useNoteViewStyles, useNoteViewChildProps, useNoteViewChildPropInput, useNoteViewPanelConfig, NoteViewShortcutsModal } from './noteview/index';
import { filterNotesForSidebarList } from './noteview/sidebarNoteListFilter';
import {
  resolveDashboardLoadScope,
  isLinksContextTabActive,
  isGraphContextTabActive,
  isInsightsContextTabActive,
  isPropertiesContextTabActive,
  isRelationsContextTabActive,
  isTagsContextTabActive,
} from './noteview/contextPanelTabGate';
import { logMemAudit } from '../../lib/memAudit';

const EMPTY_GROUPED_RELATED: GroupedRelatedNotes = { mostRelated: [], worthRevisiting: [] };
const EMPTY_BACKLINK_CONTEXTS: ReturnType<typeof extractLinkContexts> = [];
const EMPTY_MENTIONING_NOTES: ReturnType<typeof knowledgeIndexService.getMentioningNotes> = [];


import { useVaultRestoreFlow } from '../../hooks/useVaultRestoreFlow';
import { VaultRestoreModal } from './features/knowledge/VaultRestoreModal';

interface NoteViewProps {
  showToast?: (msg: string, type?: 'success' | 'error') => void;
  accountId?: string;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export const NoteView = ({ showToast = () => {}, accountId }: NoteViewProps) => {
  useRenderDiagnostic('NoteView');
  const { t, lang } = useTranslation();
  const vaultRestore = useVaultRestoreFlow(showToast, t, false, accountId);

  const { appSettings, updateSetting } = useAppStore();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  // ── A. Store selectors ────────────────────────────────────────────
  const notes = useNotesStore(s => s.notes);
  const vaultStructureVersion = useNotesStore(s => s.vaultStructureVersion);
  const indexContentVersion = useNotesStore(s => s.indexContentVersion);
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
  const prepareNotePermanentDelete = useNotesStore(s => s.prepareNotePermanentDelete);
  const deleteNotePermanently = useNotesStore(s => s.deleteNotePermanently);
  const emptyTrash = useNotesStore(s => s.emptyTrash);
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
    sidebarSearchQuery, setSidebarSearchQuery,
    noteListFilter, setNoteListFilter,
    searchScope, setSearchScope,
    searchMatchIdx, setSearchMatchIdx,
    showFolderForm, setShowFolderForm,
    newFolderName, setNewFolderName,
    renamingFolderId, setRenamingFolderId,
    renameVal, setRenameVal,
    tocKeyboardIdx, setTocKeyboardIdx,
    activeTag, setActiveTag,
    rightPanel, setRightPanel,
    timelineMode, setTimelineMode,
    timelineInitialArea, setTimelineInitialArea,
    tocCollapsed, setTocCollapsed,
    focusMode, setFocusMode,
    showShortcuts, setShowShortcuts,
    sortOrder, setSortOrder,
    sortDirection, setSortDirection,
    starredFirst, setStarredFirst,
    listSectionPrefs, setListSectionPrefs,
    documentSearchOpen, setDocumentSearchOpen,
    listDensity, setListDensity,
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

  useEffect(() => {
    return registerNotesTrashOpener(() => setActiveFolderId('trash'));
  }, [setActiveFolderId]);

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
    exportVaultBackup,
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
    attachImageFilesToActiveNote,
    handleEditorDrop,
    handleImport,
    navigateToWiki,
    canBackNote,
    canForwardNote,
    goBackNote,
    goForwardNote,
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
    setShowShortcuts,
    setShowSortMenu,
    setFocusMode,
    setDocCopied,
    setSearchScope,
    setDocumentSearchOpen,
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

  useEffect(() => {
    return registerSearchNoteHandlers({
      onSelectNote: handleWorkspaceSearchNote,
      onSelectFolder: handleWorkspaceSearchFolder,
      onSelectTag: handleWorkspaceSearchTag,
      onSelectCollection: handleWorkspaceSearchCollection,
      onSelectLearningPath: handleWorkspaceSearchLearningPath,
    });
  }, [
    handleWorkspaceSearchNote,
    handleWorkspaceSearchFolder,
    handleWorkspaceSearchTag,
    handleWorkspaceSearchCollection,
    handleWorkspaceSearchLearningPath,
  ]);

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
    const safeNotes = useNotesStore.getState().notes;
    const applySidebarSearch = (list: Note[]) =>
      sidebarSearchQuery.trim()
        ? filterNotesForSidebarList(list, sidebarSearchQuery, knowledgeIndexService, {
            formulaColumns: formulaQueryCatalog,
          })
        : list;
    const applyListSort = (list: Note[]) => {
      if (shouldSkipUserSort) return list;
      return sortNotes(list, sortOrder, sortDirection, { folders, starredFirst });
    };

    if (noteListFilter === 'favorites') {
      let list = safeNotes.filter(n => n.starred && !n.deletedAt);
      list = applyWorkspaceToNotes(list);
      list = applySidebarSearch(list);
      return applyListSort(list);
    }

    if (noteListFilter === 'recent') {
      let list = safeNotes.filter(n => !n.deletedAt && n.lastOpenedAt);
      list = applyWorkspaceToNotes(list);
      list = applySidebarSearch(list);
      if (sidebarSearchQuery.trim()) return list;
      return [...list].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
    }

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
    list = applySidebarSearch(list);
    return applyListSort(list);
  }, [vaultStructureVersion, indexContentVersion, activeFolderId, activeTag, sortOrder, sortDirection, starredFirst, folders, applyWorkspaceToNotes, shouldSkipUserSort, noteListFilter, sidebarSearchQuery, formulaQueryCatalog]);

  useEffect(() => {
    writeNoteSortPrefs({ field: sortOrder, direction: sortDirection, starredFirst });
  }, [sortOrder, sortDirection, starredFirst]);

  const contextPanelOpen = showRightPanel && viewMode !== 'graph';
  const dashboardLoadScope = useMemo(
    () => resolveDashboardLoadScope({ isDashboardMode, showRightPanel, rightPanel, viewMode }),
    [isDashboardMode, showRightPanel, rightPanel, viewMode],
  );
  const linksTabActive = isLinksContextTabActive(contextPanelOpen, rightPanel);
  const graphTabActive = isGraphContextTabActive(contextPanelOpen, rightPanel);
  const insightsTabActive = isInsightsContextTabActive(contextPanelOpen, rightPanel);
  const propertiesTabActive = isPropertiesContextTabActive(contextPanelOpen, rightPanel);
  const relationsTabActive = isRelationsContextTabActive(contextPanelOpen, rightPanel);
  const tagsTabActive = isTagsContextTabActive(contextPanelOpen, rightPanel);

  // Mobile needs the empty-vault editor state before deciding whether to hide
  // the editor pane; the normal active-note mobile flow remains unchanged.
  // ── E. Layout-derived constants ───────────────────────────────────
  const hideSidebarByFocus = isFocusPresetActive && focusUiPreferences.hideSidebar;
  const hideSecondaryByFocus = isFocusPresetActive && focusUiPreferences.hideSecondaryPanels;
  const hideLeftChrome = focusMode || hideSidebarByFocus;
  const hideSecondaryChrome = hideSecondaryByFocus;
  const isMobileEmptyVault = activeFolderId !== 'trash' && notes.every(n => n.deletedAt);
  const hideNoteList = (isMobile && mobileShowEditor && !!activeNoteId) || (isMobile && isMobileEmptyVault);
  const hideEditorArea = isMobile && !mobileShowEditor && !isMobileEmptyVault;

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

  useEffect(() => {
    seedNoteNavigationStack(activeNoteId);
  }, [activeNoteId]);

  const openNoteById = useCallback((
    noteId: string,
    source: NoteNavigationSource = 'panel',
    breadcrumb?: readonly NoteBreadcrumbSegment[],
  ) => {
    if (breadcrumb?.length) setNoteBreadcrumb(breadcrumb);
    navigateToNoteWithHistory(noteId, source);
  }, []);

  const onWorkspaceSearchNote = useCallback((noteId: string) => {
    handleWorkspaceSearchNote(noteId);
    if (isMobile) setMobileShowEditor(true);
  }, [handleWorkspaceSearchNote, isMobile, setMobileShowEditor]);

  useEffect(() => () => {
    if (docCopyTimerRef.current) clearTimeout(docCopyTimerRef.current);
  }, []);

  useEffect(() => { setSearchMatchIdx(0); }, [searchQuery, activeNoteId, searchScope]);

  useEffect(() => {
    setDocumentSearchOpen(false);
    setSearchQuery('');
    setSearchMatchIdx(0);
  }, [activeNoteId, setDocumentSearchOpen, setSearchQuery, setSearchMatchIdx]);

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
    () => useNotesStore.getState().notes.filter(n => !n.deletedAt && (n.title ?? '').trim()).map(n => n.title),
    [vaultStructureVersion],
  );
  const pageReferences = useMemo(
    () => (activeNote ? knowledgeIndexService.getPageReferences(activeNote, useNotesStore.getState().notes) : null),
    [activeNote?.id, indexContentVersion, vaultStructureVersion],
  );

  // Linked reference excerpts — contextual paragraphs from referring pages
  const backlinkContexts = useMemo(
    () => (linksTabActive && activeNote
      ? extractLinkContexts(activeNote.title ?? '', useNotesStore.getState().notes, {
        contentVersion: indexContentVersion,
      })
      : EMPTY_BACKLINK_CONTEXTS),
    [linksTabActive, activeNote?.id, activeNote?.title, indexContentVersion],
  );

  const mentioningNotes = useMemo(
    () => (linksTabActive && activeNote
      ? knowledgeIndexService.getMentioningNotes(activeNote.id, { excludeNoteId: activeNote.id })
      : EMPTY_MENTIONING_NOTES),
    [linksTabActive, activeNote?.id, indexContentVersion],
  );

  const groupedRelatedNotes = useMemo(
    () => (linksTabActive && activeNote
      ? groupRelatedNotes(activeNote.id, useNotesStore.getState().notes, knowledgeIndexService)
      : EMPTY_GROUPED_RELATED),
    [linksTabActive, activeNote?.id, vaultStructureVersion, indexContentVersion],
  );

  const relatedNotesCount = useMemo(
    () => groupedRelatedNotes.mostRelated.length
      + groupedRelatedNotes.worthRevisiting.length,
    [groupedRelatedNotes],
  );

  const noteReferenceSummary = useMemo(
    () => (activeNote ? extractNoteReferenceSummary(activeNote, useNotesStore.getState().notes) : null),
    [activeNote?.id, indexContentVersion, vaultStructureVersion],
  );

  const knowledgeMaintenance = useMemo(
    () => buildKnowledgeMaintenanceData(useNotesStore.getState().notes),
    [vaultStructureVersion],
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
  } = useNoteViewDashboard({ notes, lang, timelineMode, activeNote, loadScope: dashboardLoadScope });

  const projectEditorData = useMemo(
    () => (propertiesTabActive && activeNote && isStudyProjectContainer(activeNote)
      ? buildProjectEditorData(useNotesStore.getState().notes, activeNote)
      : null),
    [propertiesTabActive, activeNote?.id, vaultStructureVersion],
  );

  const milestoneProjectTitle = useMemo(() => {
    if (!propertiesTabActive || !activeNote || !isProjectMilestone(activeNote)) return '';
    const projectId = getMilestoneProjectId(activeNote);
    if (!projectId) return '';
    const project = useNotesStore.getState().notes.find(n => n.id === projectId);
    return project ? displayNoteTitle(project.title) : '';
  }, [propertiesTabActive, activeNote?.id, vaultStructureVersion]);

  const conceptHub = useMemo(
    () => (linksTabActive && activeNote
      ? buildConceptHub({
        note: activeNote,
        notes: useNotesStore.getState().notes,
        service: knowledgeIndexService,
        referenceSummary: noteReferenceSummary,
      })
      : null),
    [linksTabActive, activeNote?.id, noteReferenceSummary, vaultStructureVersion, indexContentVersion],
  );

  const learningPath = useMemo(() => {
    if (!linksTabActive || !activeNote) return null;
    const pathId = getLearningPathId(activeNote);
    return pathId ? buildLearningPath(useNotesStore.getState().notes, pathId) : null;
  }, [linksTabActive, activeNote?.id, vaultStructureVersion]);

  const noteBibliography = useMemo(
    () => (linksTabActive && activeNote ? collectCitationsFromMarkdown(activeNote.body ?? '') : []),
    [linksTabActive, activeNote?.body, activeNote?.id],
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
    const project = useNotesStore.getState().notes.find(n => n.id === noteLinkedProjectId);
    return project ? displayNoteTitle(project.title) : '';
  }, [noteLinkedProjectId, vaultStructureVersion]);

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
    return incoming + outgoing + relatedNotesCount;
  }, [pageReferences, noteReferenceSummary, relatedNotesCount]);

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
    insightsEnabled: insightsTabActive,
  });

  useEffect(() => {
    setHeaderTagsExpanded(false);
  }, [activeNote?.id, setHeaderTagsExpanded]);

  const activeNoteKind = activeNote ? getNoteKind(activeNote) : null;

  const sourceNoteCandidates = useMemo(
    () => propertiesTabActive
      ? filterNotesByKind(useNotesStore.getState().notes, 'source').filter(n => n.id !== activeNote?.id)
      : [],
    [propertiesTabActive, activeNote?.id, vaultStructureVersion],
  );

  useEffect(() => {
    setExpandedGraphNodes([]);
  }, [activeNote?.id]);

  const localGraphData = useMemo(
    () => (graphTabActive && activeNote
      ? buildExpandedGraphData({
        centerId: activeNote.id,
        centerTitle: activeNote.title ?? '',
        expandedNodeIds: expandedGraphNodes,
        service: knowledgeIndexService,
      })
      : null),
    [graphTabActive, activeNote?.id, activeNote?.title, expandedGraphNodes, vaultStructureVersion, indexContentVersion],
  );

  useEffect(() => {
    if (!contextPanelOpen) return;
    const activeCount = useNotesStore.getState().notes.filter(n => !n.deletedAt).length;
    const outgoing = activeNote ? knowledgeIndexService.getOutgoing(activeNote.id).length : 0;
    const incoming = activeNote
      ? knowledgeIndexService.getIncoming(activeNote.title ?? '').length
      : 0;
    logMemAudit({
      source: 'NoteView.context',
      notes: activeCount,
      links: outgoing + incoming,
      graphNodes: localGraphData?.nodes.length,
      graphEdges: localGraphData?.edges.length,
      relatedCandidates: relatedNotesCount,
      discoveryItems: discoveryFeed.items.length,
    });
  }, [contextPanelOpen, activeNote?.id, localGraphData, relatedNotesCount, discoveryFeed]);

  const allTags = useMemo(
    () => tagsTabActive ? knowledgeIndexService.getAllTags() : [],
    [tagsTabActive, vaultStructureVersion, indexContentVersion],
  );
  const noteTags = useMemo(
    () => (activeNote ? listTags(activeNote) : []),
    [activeNote?.id, activeNote?.properties],
  );

  const resolvedOutgoingRelations = useMemo(
    () => (relationsTabActive && activeNote
      ? knowledgeIndexService.resolveRelationTargets(activeNote.id)
      : []),
    [relationsTabActive, activeNote?.id, vaultStructureVersion],
  );

  const incomingRelationDisplays = useMemo(
    () => {
      if (!relationsTabActive || !activeNote) return [];
      return knowledgeIndexService.getIncomingRelations(activeNote.id).map(edge => {
        const sourceTitle = knowledgeIndexService.getNoteTitle(edge.sourceId);
        return {
          edge,
          sourceTitle,
          missing: !sourceTitle,
        };
      });
    },
    [relationsTabActive, activeNote?.id, vaultStructureVersion],
  );

  useEffect(() => { resetTocScrollStore(); }, [activeNoteId]);

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
    setTocScrollActiveIdx,
    getHeadingBlockScrollTop,
  );

  const scrollToHeading = useCallback((headingIdx: number) => {
    setTocScrollActiveIdx(headingIdx);
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

    const current = tocKeyboardIdx ?? getTocScrollActiveIdx();

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
      const openIdx = resolveTocOpenIndex(visibleToc, tocKeyboardIdx, getTocScrollActiveIdx());
      if (openIdx !== null) {
        setTocKeyboardIdx(null);
        scrollToHeading(openIdx);
      }
    }
  }, [visibleToc, tocKeyboardIdx, scrollToHeading, scrollTocRowIntoView]);

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
    if (e.detail === 2) {
      setViewMode('edit');
      scheduleEditorFocus(blockEditorRef);
    }
  }, [navigateToWiki, blockEditorRef]);

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
  const isEmptyVault = activeNoteCount === 0 && activeFolderId !== 'trash';

  const handlePermanentDeleteActive = useCallback(() => {
    if (!activeNote?.deletedAt) return;
    const authorization = prepareNotePermanentDelete(activeNote.id);
    if (!authorization) {
      showToast(useNotesStore.getState().syncError ?? 'Permanent delete is unavailable.', 'error');
      return;
    }
    showConfirm(
      t('nvDeletePermanentConfirm'),
      async () => {
        const deleted = await deleteNotePermanently(authorization);
        showToast(
          deleted
            ? 'Note permanently deleted.'
            : (useNotesStore.getState().syncError ?? 'Permanent delete failed. The Note was kept.'),
          deleted ? 'success' : 'error',
        );
      },
      { confirmLabel: t('nvDeletePermanently'), variant: 'destructive' },
    );
  }, [activeNote, deleteNotePermanently, prepareNotePermanentDelete, showConfirm, showToast, t]);

  const handleEmptyTrash = useCallback(() => {
    const count = notes.filter(n => n.deletedAt).length;
    if (count === 0) return;
    showConfirm(
      t('nvEmptyTrashConfirm').replace('{count}', String(count)),
      () => emptyTrash(),
      { confirmLabel: t('nvEmptyTrash'), variant: 'destructive' },
    );
  }, [emptyTrash, notes, showConfirm, t]);

  const sidebarTodayCount = useMemo(
    () => countTraceDay(activeNotes, todayTraceKey),
    [todayTraceKey, activeNotes],
  );

  const sidebarYesterdayCount = useMemo(
    () => countTraceYesterday(activeNotes, todayTraceKey),
    [todayTraceKey, activeNotes],
  );

  const sidebarWeekCount = useMemo(
    () => countTraceWeek(activeNotes, todayTraceKey),
    [todayTraceKey, activeNotes],
  );

  const sidebarMonthCount = useMemo(
    () => countTraceMonth(activeNotes, currentTraceMonthKey.year, currentTraceMonthKey.month),
    [currentTraceMonthKey, activeNotes],
  );

  const folderLabel = useMemo(() =>
    activeFolderId === null    ? t('nvAllNotes') :
    activeFolderId === 'trash' ? t('nvTrashLabel') :
    activeFolderId === 'starred' ? t('starred') :
    (folders.find(f => f.id === activeFolderId)?.name ?? ''),
    [activeFolderId, folders, t]
  );

  const { viewModes: VIEW_MODES, rightPanels: RIGHT_PANELS } = useNoteViewPanelConfig();

  // ── CSS (c가 바뀔 때만 재생성) ──────────────────────────────────
  const CSS = useNoteViewStyles(c, dark);

  const childPropInput = useNoteViewChildPropInput(useMemo(() => ({
    sidebarLayout: { hideLeftChrome, hideSecondaryChrome, hideNoteList, isMobile, isTablet, isCompactChrome, isWorkspacePanelMode, sidebarCollapsed, mobileSidebarOpen },
    sidebarData: {
      c, dark, notes, folders, activeFolderId, activeTag, activeNoteCount, trashCount, starredCount,
      sidebarTodayCount, sidebarYesterdayCount, sidebarWeekCount, sidebarMonthCount, isTrash, noteListFilter,
      searchQuery, sidebarSearchQuery, knowledgeQueryInfo, workspaceActivation, isTraceLensMode, todayTraceKey, isTraceDayMode, traceDate,
      isTraceRangeMode, traceRange, currentTraceMonthKey, currentTraceQuarterKey, currentTraceYearKey, areaNotes,
      isTraceAreaMode, traceAreaId, isTraceDiscoveryMode, renamingFolderId, renameVal, showFolderForm, newFolderName,
      allTags, workspaceExpanded, isDashboardMode, smartCollectionCounts, pinnedWorkspaces, activeWorkspaceKind,
      activeWorkspaceId, recentWork, ruleCollections, ruleCollectionCounts, canCreateRuleCollection, databaseViews,
      databaseViewCounts, canCreateDatabaseView, databaseCreateSignal, savedViews, canSaveCurrentView,
      traceAreaProjection, traceAreaRange, activeDatabaseView, activeSmartCollection, activeRuleCollection,
      activeSavedView, folderLabel, traceLensMarkCount, isDatabaseViewMode, activeDatabaseViewNoteCount, recentNotes,
      visibleNotes, activeNotes, activeNoteId, safeNotesForDatabase, dashboard, sortOrder, sortDirection, starredFirst, listDensity, listSectionPrefs, showSortMenu, dragNoteId,
      editingLearningPathId, focusPresets, focusPresetTargets, focusSession, focusWorkspaceOptions, taskTemplates,
      journalTemplates, knowledgeMaintenance, unifiedWorkspaceDashboard, subjectWorkspaces, learningPathOverview,
      knowledgeTimeline, activitySummary, dashboardRecentActivity, dashboardLatestMilestone, evolutionInsights,
    },
    sidebarHandlers: {
      searchInputRef, importInputRef, setSidebarCollapsed, setActiveFolderId, setActiveTag, setNoteListFilter, setSearchQuery, setSidebarSearchQuery,
      setShowShortcuts, openTraceDay, openTraceRange, openCreatedNote, openTraceArea,
      openTraceDiscovery, storeRenameFolder, setRenamingFolderId, setRenameVal, deleteFolder, setShowFolderForm,
      setNewFolderName, addFolder, setWorkspaceActivation, setTraceDate, setTraceRange, setTraceAreaId,
      setTraceAreaRange, setTraceDiscoveryMode, setWorkspaceExpanded, handleActivateDashboardWithTraceClear,
      handleActivateSmartCollection, handleClearSmartCollection, handleTogglePinWorkspace, isWorkspacePinned,
      handleActivateWorkspaceRef, handleUnpinWorkspace, handleMovePinnedWorkspace, handleClearRecentWork,
      handleActivateRuleCollection, handleClearRuleCollection, handleCreateRuleCollection, handleRenameRuleCollection,
      handleDeleteRuleCollection, handleActivateDatabaseView, handleClearDatabaseView, handleCreateDatabaseView,
      handleCreateDatabaseViewFromTemplate, handleRenameDatabaseView, handleDeleteDatabaseView, handleActivateSavedView,
      handleClearSavedView, handleCreateSavedView, handleRenameSavedView, handleDeleteSavedView, isWorkspaceKindActive,
      setMobileSidebarOpen, closeTraceLens, handleClearDashboard, setShowSortMenu, setSortOrder, setSortDirection, setStarredFirst, setListSectionPrefs, setListDensity, exportAllNotes, exportVaultBackup, openVaultRestore: vaultRestore.openFilePicker,
      openCreateEventDialog, createNote, setActiveNoteId, openNoteById, setMobileShowEditor, noteUpdate, setDragNoteId,
      duplicateNote, patchActiveDatabaseView, setDatabaseCreateSignal, setViewMode, handleLeaveDashboardForNote,
      handleResumeLastWorkspace, handleCreateFocusPreset, handleDeleteFocusPreset, handleActivateFocusPreset,
      handleExitFocusPreset, handleQuickCapture, handleCreateTask, handleCreateJournal, handleCreateReadingNote,
      handleCreateStudyNote, handleCreateTaskDatabase, handleCreateJournalDatabase, handleCreateProject,
      handleCreateProjectMilestone, handleOpenProjectNotes, handleEditProject, handleActivateSubjectWorkspace,
      handleOpenStudyCollection, handleOpenResearchCollection, handleOpenDiscover, handleOpenTimeline,
      handleOpenEvolution, handleNavigateToArea, handleCreateLearningPathStepNote, handleUpdateNoteProperties,
      handleNavigateToProjectEditor, setEditingLearningPathId, resumeWorkspace, handleEmptyTrash,
    },
    editorLayout: {
      hideEditorArea, isMobile, isCompactChrome, isFocusPresetActive, isTrash, showRightPanel, viewMode,
      showAppearance, isDragOver, headerTagsExpanded, docCopied, dark, isEmptyVault,
    },
    editorData: {
      c, activeNote, activeNoteId, notes, folders, titleDraft, activeNoteKind, noteTags, syncError, isSyncing,
      savedAt, viewModes: VIEW_MODES, noteAreaProperty, noteLinkedProjectTitle, noteLinkedProjectId,
      noteLearningPathLabel, noteContextReviewEntry, noteConnectionCount, noteCosmosTier, activeTag, searchQuery,
      searchScope, searchMatchIdx, editorSearchQuery, blockColors, wikiTargets, appSettings, knowledgeTimeline,
      activeFocusPreset, discoveryFeed, documentSearchOpen,
    },
    editorHandlers: {
      titleInputRef, titleComposingRef, blockEditorRef, editorScrollRef, virtualScrollApiRef, searchInputRef,
      importInputRef, setMobileShowEditor, setActiveNoteId, handleExitFocusPreset, handleTitleChange,
      handleTitleCompositionEnd, noteUpdate, retrySync, setViewMode, openEditEventDialog, openMilestoneDialog,
      handleToggleAreaNote, toggleStar, duplicateNote, setShowRightPanel, handleCopyDocument, exportNote,
      restoreNote, moveNoteToTrash, onPermanentDelete: handlePermanentDeleteActive, setActiveFolderId, setSearchQuery, setActiveTag, setHeaderTagsExpanded,
      openContextPanel, setRightPanel, handlePromoteNoteKind, handleLearnLinking, handleHudReviewWeakAreas,
      handleOpenDiscover, handleOpenTimeline, createNote, setSearchScope, setSearchMatchIdx,
      insertEmptyImageBlockAtCursor, attachImageFilesToActiveNote, setShowAppearance, setShowShortcuts, updateSetting, setIsDragOver, insertImageAtCursor,
      handleEditorDrop, handleReadingModeClick, handleActiveBodyChange, navigateToWiki,
      canBackNote, canForwardNote, goBackNote, goForwardNote, openNoteById, setDocumentSearchOpen,
      onOpenSettings: () => switchToTab('settings'),
      onOpenTodaysNote: () => {
        openOrCreateDailyNote({
          notes,
          dateKey: todayTraceKey,
          createNote: opts => createNote({ title: opts.title, body: opts.body }),
          setActiveNoteId,
        });
        if (isMobile) setMobileShowEditor(true);
      },
      onImportVault: vaultRestore.openFilePicker,
    },
    contextColors: c,
    contextRightPanel: rightPanel,
    contextActiveNote: activeNote,
    contextPanelData: {
      pageReferences, noteReferenceSummary, linksStructureCount, linksConnectionsCount, linksSourcesCount,
      conceptHub, learningPath, notes, wikiTargets, backlinkContexts, mentioningNotes, relatedNotes: groupedRelatedNotes,
      sourceNoteCandidates, noteBibliography, localGraphData, noteIntelligenceSnapshot, noteTierInput,
      noteHistoryContext, discoveryFeed, cosmosVaultPhase, projectEditorData, milestoneProjectTitle, allTags,
      activeTag, resolvedOutgoingRelations, incomingRelationDisplays, noteTags,
    },
    contextPanelHandlers: {
      createNote, noteUpdate, setActiveNoteId, openNoteById, navigateToWiki, handleLinkRelatedNote, handleOpenCosmosGraph,
      handleStartWikiLink, handleCreateRelatedNote, handleLinkReadingSource, handleUnlinkReadingSource,
      handleExpandGraphNode, handleCollapseGraphNode, setViewMode, openContextPanel, handleOpenDiscover,
      handleCosmosConnect, handleCosmosAssignArea, handleCosmosCreateHub, handleCosmosCreateRelation,
      handleDiscoveryCreateRelation, handleUpdateProjectDescription, handleUpdateProjectStatus,
      handleCreateProjectMilestone, handleUpdateMilestoneStatus, handleUpdateMilestoneTargetDate,
      setActiveFolderId, setSearchQuery, setActiveTag,
    },
    contextEditorContext: {
      tocPanelRef, visibleToc, tocKeyboardIdx, tocCollapsed, handleTocKeyDown, toggleTocCollapse, scrollToHeading,
    },
    contextDashboardContext: {
      knowledgeTimeline, timelineMode, setTimelineMode, historyEvents, cosmosEvolutionSummary, cosmosEvolutionStory,
      discoveryProgress, knowledgeJourney, evolutionInsights, bootstrapImportSummary, timelineInitialArea,
      handleDismissBootstrapSummary, handleExportHistory,
    },
  }), [
    hideLeftChrome, hideSecondaryChrome, hideNoteList, isMobile, isTablet, isCompactChrome, isWorkspacePanelMode,
    sidebarCollapsed, mobileSidebarOpen, c, dark, notes, folders, activeFolderId, activeTag, activeNoteCount, isEmptyVault,
      trashCount, starredCount, sidebarTodayCount, sidebarMonthCount, isTrash, noteListFilter, searchQuery, sidebarSearchQuery, knowledgeQueryInfo, workspaceActivation, isTraceLensMode,
    todayTraceKey, isTraceDayMode, traceDate, isTraceRangeMode, traceRange, currentTraceMonthKey,
    currentTraceQuarterKey, currentTraceYearKey, areaNotes, isTraceAreaMode, traceAreaId, isTraceDiscoveryMode,
    renamingFolderId, renameVal, showFolderForm, newFolderName, allTags, workspaceExpanded, isDashboardMode,
    smartCollectionCounts, pinnedWorkspaces, activeWorkspaceKind, activeWorkspaceId, recentWork, ruleCollections,
    ruleCollectionCounts, canCreateRuleCollection, databaseViews, databaseViewCounts, canCreateDatabaseView,
    databaseCreateSignal, savedViews, canSaveCurrentView, traceAreaProjection, traceAreaRange, activeDatabaseView,
    activeSmartCollection, activeRuleCollection, activeSavedView, folderLabel, traceLensMarkCount, isDatabaseViewMode,
    activeDatabaseViewNoteCount, recentNotes, visibleNotes, activeNotes, activeNoteId, safeNotesForDatabase, dashboard,
    sortOrder, sortDirection, listDensity, showSortMenu, dragNoteId, editingLearningPathId, focusPresets, focusPresetTargets, focusSession,
    focusWorkspaceOptions, taskTemplates, journalTemplates, knowledgeMaintenance, unifiedWorkspaceDashboard,
    subjectWorkspaces, learningPathOverview, knowledgeTimeline, activitySummary, dashboardRecentActivity,
    dashboardLatestMilestone, evolutionInsights, searchInputRef, importInputRef, setSidebarCollapsed, setActiveFolderId,
    setActiveTag, setSearchQuery, setSidebarSearchQuery, setShowShortcuts, openTraceDay, openTraceRange,
    openCreatedNote, openTraceArea, openTraceDiscovery, storeRenameFolder, setRenamingFolderId, setRenameVal,
    deleteFolder, setShowFolderForm, setNewFolderName, addFolder, setWorkspaceActivation, setTraceDate, setTraceRange,
    setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode, setWorkspaceExpanded, handleActivateDashboardWithTraceClear,
    handleActivateSmartCollection, handleClearSmartCollection, handleTogglePinWorkspace, isWorkspacePinned,
    handleActivateWorkspaceRef, handleUnpinWorkspace, handleMovePinnedWorkspace, handleClearRecentWork,
    handleActivateRuleCollection, handleClearRuleCollection, handleCreateRuleCollection, handleRenameRuleCollection,
    handleDeleteRuleCollection, handleActivateDatabaseView, handleClearDatabaseView, handleCreateDatabaseView,
    handleCreateDatabaseViewFromTemplate, handleRenameDatabaseView, handleDeleteDatabaseView, handleActivateSavedView,
    handleClearSavedView, handleCreateSavedView, handleRenameSavedView, handleDeleteSavedView, isWorkspaceKindActive,
    setMobileSidebarOpen, closeTraceLens, handleClearDashboard, setShowSortMenu, setSortOrder, setSortDirection, setListDensity, exportAllNotes, exportVaultBackup, vaultRestore.openFilePicker,
    openCreateEventDialog, createNote, setActiveNoteId, setMobileShowEditor, noteUpdate, setDragNoteId, duplicateNote,
    patchActiveDatabaseView, setDatabaseCreateSignal, setViewMode, handleLeaveDashboardForNote, handleResumeLastWorkspace,
    handleCreateFocusPreset, handleDeleteFocusPreset, handleActivateFocusPreset, handleExitFocusPreset, handleQuickCapture,
    handleCreateTask, handleCreateJournal, handleCreateReadingNote, handleCreateStudyNote, handleCreateTaskDatabase,
    handleCreateJournalDatabase, handleCreateProject, handleCreateProjectMilestone, handleOpenProjectNotes, handleEditProject,
    handleActivateSubjectWorkspace, handleOpenStudyCollection, handleOpenResearchCollection, handleOpenDiscover,
    handleOpenTimeline, handleOpenEvolution, handleNavigateToArea, handleCreateLearningPathStepNote,
    handleUpdateNoteProperties, handleNavigateToProjectEditor, setEditingLearningPathId, resumeWorkspace, handleEmptyTrash, hideEditorArea,
    isFocusPresetActive, showRightPanel, viewMode, showAppearance, isDragOver, headerTagsExpanded, docCopied,
    activeNote, titleDraft, activeNoteKind, noteTags, syncError, isSyncing, savedAt, VIEW_MODES, noteAreaProperty,
    noteLinkedProjectTitle, noteLinkedProjectId, noteLearningPathLabel, noteContextReviewEntry, noteConnectionCount,
    noteCosmosTier, searchScope, searchMatchIdx, editorSearchQuery, blockColors, wikiTargets, appSettings,
    activeFocusPreset, titleInputRef, titleComposingRef, blockEditorRef, editorScrollRef, virtualScrollApiRef,
    setMobileShowEditor, handleExitFocusPreset, handleTitleChange, handleTitleCompositionEnd, retrySync,
    openEditEventDialog, openMilestoneDialog, handleToggleAreaNote, toggleStar, setShowRightPanel, handleCopyDocument,
    exportNote, restoreNote, moveNoteToTrash, handlePermanentDeleteActive, handleEmptyTrash, setHeaderTagsExpanded, openContextPanel, setRightPanel, handlePromoteNoteKind,
    handleLearnLinking, handleHudReviewWeakAreas, setSearchScope, setSearchMatchIdx, insertEmptyImageBlockAtCursor,
    attachImageFilesToActiveNote, setShowAppearance, updateSetting, setIsDragOver, insertImageAtCursor, handleEditorDrop, handleReadingModeClick,
    handleActiveBodyChange, navigateToWiki, rightPanel, pageReferences, noteReferenceSummary, linksStructureCount,
    linksConnectionsCount, linksSourcesCount, conceptHub, learningPath, backlinkContexts, mentioningNotes, groupedRelatedNotes,
    sourceNoteCandidates, noteBibliography, localGraphData, noteIntelligenceSnapshot, noteTierInput, noteHistoryContext,
    discoveryFeed, cosmosVaultPhase, projectEditorData, milestoneProjectTitle, resolvedOutgoingRelations,
    incomingRelationDisplays, handleLinkRelatedNote, handleOpenCosmosGraph, handleStartWikiLink, handleCreateRelatedNote,
    handleLinkReadingSource, handleUnlinkReadingSource, handleExpandGraphNode, handleCollapseGraphNode,
    handleCosmosConnect, handleCosmosAssignArea, handleCosmosCreateHub, handleCosmosCreateRelation,
    handleDiscoveryCreateRelation, handleUpdateProjectDescription, handleUpdateProjectStatus,
    handleUpdateMilestoneStatus, handleUpdateMilestoneTargetDate, tocPanelRef, visibleToc, tocKeyboardIdx,
    tocCollapsed, handleTocKeyDown, toggleTocCollapse, scrollToHeading, timelineMode, setTimelineMode, historyEvents,
    cosmosEvolutionSummary, cosmosEvolutionStory, discoveryProgress, knowledgeJourney, bootstrapImportSummary,
    timelineInitialArea, handleDismissBootstrapSummary, handleExportHistory,
  ]));
  const { sidebarProps, editorAreaProps, contextPanelProps } = useNoteViewChildProps(childPropInput);
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
        <NoteViewShortcutsModal colors={c} panelRef={shortcutsPanelRef} onClose={() => setShowShortcuts(false)} />
      )}

      <NoteViewSidebar {...sidebarProps} />
      <NoteViewEditorArea {...editorAreaProps} />

      {/* ── Knowledge Context Panel ── */}
      {(activeNote || rightPanel === 'discover' || rightPanel === 'timeline') && viewMode !== 'graph' && showRightPanel && !hideSecondaryByFocus && !isEmptyVault && (
        <KnowledgeContextPanel
          colors={c}
          compact={isCompactChrome}
          tablet={isTablet}
          activeTab={rightPanel}
          tabs={RIGHT_PANELS}
          onTabChange={setRightPanel}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <NoteContextPanelBody {...contextPanelProps} />
          </div>
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
      <input
        ref={vaultRestore.fileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        className="hidden"
        onChange={vaultRestore.handleFileChange}
      />
      {vaultRestore.preview && vaultRestore.selection && (
        <VaultRestoreModal
          preview={vaultRestore.preview}
          fullPreview={vaultRestore.fullPreview}
          pipelineOptions={vaultRestore.pipelineOptions}
          restoreSource={vaultRestore.restoreSource}
          strategy={vaultRestore.strategy}
          selection={vaultRestore.selection}
          onStrategyChange={vaultRestore.setStrategy}
          onPipelineOptionsChange={vaultRestore.updatePipelineOptions}
          onToggleNote={vaultRestore.toggleNote}
          onToggleFolder={vaultRestore.toggleFolder}
          onSelectAll={vaultRestore.selectAll}
          onSelectNone={vaultRestore.selectNone}
          onConfirm={vaultRestore.confirmRestore}
          onCancel={vaultRestore.cancelRestore}
          importing={vaultRestore.importing}
        />
      )}
    </div>
  );
};
