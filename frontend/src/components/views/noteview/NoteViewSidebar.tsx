import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { useMemo, useRef, useState } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Star, AlignLeft,
  ChevronDown, ChevronRight, Upload, Keyboard,
  Clock, Calendar, CalendarDays, LayoutDashboard, Folder, MoreHorizontal,
} from 'lucide-react';
import { displayNoteTitle } from '../noteDisplayTitle';
import { estimateDeletedNoteBytes, formatRecoverableStorage } from '../../../lib/trashNoteStorage';
import { openWorkspaceSearch } from '../../../lib/noteNavigation';
import {
  formatTraceDayHeading,
  formatAreaRangeHeading,
  formatRangeLensHeading,
  listTags,
  toDateKey,
  SmartCollectionsSection,
  RuleCollectionsSection,
  DatabaseViewsSection,
  SavedViewsSection,
  PinnedWorkspacesSection,
  RecentWorkSection,
  WorkspaceDashboardView,
  SMART_COLLECTIONS,
  INACTIVE_WORKSPACE,
  knowledgeIndexService,
  DailyTraceDayView,
  RangeTraceLensView,
  AreaTraceView,
  AreaDiscoveryView,
  DatabaseViewPanel,
  type SavedView,
  type SmartCollection,
  type RuleCollection,
  type DatabaseView,
  type TraceRangeLens,
} from '../features/knowledge';
import type { SmartCollectionId } from '../features/knowledge/collections/smartCollectionModels';
import type { WorkspaceActivation } from '../features/knowledge/workspace/workspaceModels';
import type { NoteBase as Note, NoteFolderBase as NoteFolder } from '../noteUtils';
import type { NoteChromeColors } from '../noteEditorTheme';
import { NoteSidebarVirtualList } from './NoteSidebarVirtualList';
import { SIDEBAR_NOTE_SEARCH_ATTR } from '../searchFocusIsolation';
import { useTranslation } from '../../../lib/i18n';
import type { EditorMode } from '../editorMode';
import type { WorkspaceDashboardViewProps } from '../features/knowledge/components/WorkspaceDashboardView';
import type { FocusSessionState } from '../features/knowledge/workspace/focusModeModels';
import type { KnowledgeTimeline } from '../features/knowledge/timeline';
import { isoWeekBounds } from '../features/planner/calendar/plannerCalendarDateUtils';
import type { ListDensityMode } from '../listDensityPreference';
import { cycleListDensityMode, listDensityStyles, writeListDensityMode } from '../listDensityPreference';
import type { NoteSortDirection, NoteSortField } from '../noteListSort';
import { writeNoteListSectionPrefs, type NoteListSectionPrefs } from '../noteListSectionPrefs';
import { K103_NOTE_LIST_WIDTH_PX, K103_NOTE_LIST_MIN_WIDTH_PX } from '../k103LayoutConstants';
import { NoteListSortMenu } from './NoteListSortMenu';
import { switchToTab } from '../../../lib/noteNavigation';

export interface NoteViewSidebarLayout {
  hideLeftChrome: boolean;
  hideSecondaryChrome: boolean;
  hideNoteList: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isCompactChrome: boolean;
  isWorkspacePanelMode: boolean;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
}

export interface NoteViewSidebarData {
  c: NoteChromeColors;
  dark: boolean;
  notes: Note[];
  folders: NoteFolder[];
  activeFolderId: string | null | 'trash' | 'starred';
  activeTag: string | null;
  activeNoteCount: number;
  trashCount: number;
  starredCount: number;
  sidebarTodayCount: number;
  sidebarYesterdayCount: number;
  sidebarWeekCount: number;
  sidebarMonthCount: number;
  isTrash: boolean;
  noteListFilter: 'all' | 'recent' | 'favorites';
  searchQuery: string;
  sidebarSearchQuery: string;
  knowledgeQueryInfo: { active: boolean; label: string | null; error: string | null };
  workspaceActivation: WorkspaceActivation;
  isTraceLensMode: boolean;
  todayTraceKey: string;
  isTraceDayMode: boolean;
  traceDate: string | null;
  isTraceRangeMode: boolean;
  traceRange: TraceRangeLens | null;
  currentTraceMonthKey: { year: number; month: number };
  currentTraceQuarterKey: { year: number; quarter: number };
  currentTraceYearKey: number;
  areaNotes: Note[];
  isTraceAreaMode: boolean;
  traceAreaId: string | null;
  isTraceDiscoveryMode: boolean;
  renamingFolderId: string | null;
  renameVal: string;
  showFolderForm: boolean;
  newFolderName: string;
  allTags: { tag: string; count: number }[];
  workspaceExpanded: boolean;
  isDashboardMode: boolean;
  smartCollectionCounts: Record<string, number>;
  pinnedWorkspaces: WorkspaceDashboardViewProps['pinned'];
  activeWorkspaceKind: WorkspaceDashboardViewProps extends never ? never : Parameters<typeof PinnedWorkspacesSection>[0]['activeKind'];
  activeWorkspaceId: Parameters<typeof PinnedWorkspacesSection>[0]['activeId'];
  recentWork: WorkspaceDashboardViewProps['recent'];
  ruleCollections: readonly RuleCollection[];
  ruleCollectionCounts: Record<string, number>;
  canCreateRuleCollection: boolean;
  databaseViews: readonly DatabaseView[];
  databaseViewCounts: Record<string, number>;
  canCreateDatabaseView: boolean;
  databaseCreateSignal: number;
  savedViews: readonly SavedView[];
  canSaveCurrentView: boolean;
  traceAreaProjection: { areaTitle: string } | null;
  traceAreaRange: TraceRangeLens | null;
  activeDatabaseView: DatabaseView | undefined;
  activeSmartCollection: SmartCollection | undefined;
  activeRuleCollection: RuleCollection | undefined;
  activeSavedView: SavedView | undefined;
  folderLabel: string;
  traceLensMarkCount: number;
  isDatabaseViewMode: boolean;
  activeDatabaseViewNoteCount: number;
  recentNotes: readonly Note[];
  visibleNotes: readonly Note[];
  activeNotes: readonly Note[];
  activeNoteId: string | null;
  safeNotesForDatabase: readonly Note[];
  dashboard: WorkspaceDashboardViewProps['dashboard'];
  sortOrder: NoteSortField;
  sortDirection: NoteSortDirection;
  starredFirst: boolean;
  listSectionPrefs: NoteListSectionPrefs;
  listDensity: ListDensityMode;
  showSortMenu: boolean;
  dragNoteId: string | null;
  editingLearningPathId: string | null | undefined;
  focusPresets: NonNullable<WorkspaceDashboardViewProps['focus']>['presets'];
  focusPresetTargets: NonNullable<WorkspaceDashboardViewProps['focus']>['presetTargets'];
  focusSession: FocusSessionState;
  focusWorkspaceOptions: NonNullable<WorkspaceDashboardViewProps['focus']>['workspaceOptions'];
  taskTemplates: NonNullable<WorkspaceDashboardViewProps['quickCapture']>['taskTemplates'];
  journalTemplates: NonNullable<WorkspaceDashboardViewProps['productivity']>['journalTemplates'];
  knowledgeMaintenance: NonNullable<WorkspaceDashboardViewProps['maintenance']>['data'];
  unifiedWorkspaceDashboard: NonNullable<WorkspaceDashboardViewProps['unified']>['data'];
  subjectWorkspaces: NonNullable<WorkspaceDashboardViewProps['subjectWorkspaces']>['subjects'];
  learningPathOverview: NonNullable<WorkspaceDashboardViewProps['learningPath']>['data'];
  knowledgeTimeline: KnowledgeTimeline;
  activitySummary: NonNullable<WorkspaceDashboardViewProps['unified']>['activitySummary'];
  dashboardRecentActivity: NonNullable<WorkspaceDashboardViewProps['unified']>['activityRecent'];
  dashboardLatestMilestone: NonNullable<WorkspaceDashboardViewProps['unified']>['activityLatestMilestone'];
  evolutionInsights: NonNullable<WorkspaceDashboardViewProps['unified']>['evolutionInsights'];
}

export interface NoteViewSidebarHandlers {
  searchInputRef: RefObject<HTMLInputElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveFolderId: React.Dispatch<React.SetStateAction<string | null | 'trash' | 'starred'>>;
  setActiveTag: React.Dispatch<React.SetStateAction<string | null>>;
  setNoteListFilter: React.Dispatch<React.SetStateAction<'all' | 'recent' | 'favorites'>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSidebarSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  openTraceDay: (key: string) => void;
  openTraceRange: (lens: TraceRangeLens) => void;
  openCreatedNote: (id: string) => void;
  openTraceArea: (id: string) => void;
  openTraceDiscovery: () => void;
  storeRenameFolder: (id: string, name: string) => void;
  setRenamingFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  setRenameVal: React.Dispatch<React.SetStateAction<string>>;
  deleteFolder: (id: string) => void;
  setShowFolderForm: React.Dispatch<React.SetStateAction<boolean>>;
  setNewFolderName: React.Dispatch<React.SetStateAction<string>>;
  addFolder: () => void;
  setWorkspaceActivation: React.Dispatch<React.SetStateAction<WorkspaceActivation>>;
  setTraceDate: React.Dispatch<React.SetStateAction<string | null>>;
  setTraceRange: React.Dispatch<React.SetStateAction<TraceRangeLens | null>>;
  setTraceAreaId: React.Dispatch<React.SetStateAction<string | null>>;
  setTraceAreaRange: React.Dispatch<React.SetStateAction<TraceRangeLens | null>>;
  setTraceDiscoveryMode: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkspaceExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  handleActivateDashboardWithTraceClear: () => void;
  handleActivateSmartCollection: (collection: SmartCollection) => void;
  handleClearSmartCollection: () => void;
  handleTogglePinWorkspace: (workspace: import('../features/knowledge/workspace/workspaceModels').WorkspaceRef) => void;
  isWorkspacePinned: Parameters<typeof RecentWorkSection>[0]['isPinned'];
  handleActivateWorkspaceRef: Parameters<typeof PinnedWorkspacesSection>[0]['onActivate'];
  handleUnpinWorkspace: Parameters<typeof PinnedWorkspacesSection>[0]['onUnpin'];
  handleMovePinnedWorkspace: Parameters<typeof PinnedWorkspacesSection>[0]['onMovePinned'];
  handleClearRecentWork: Parameters<typeof RecentWorkSection>[0]['onClearRecent'];
  handleActivateRuleCollection: Parameters<typeof RuleCollectionsSection>[0]['onActivate'];
  handleClearRuleCollection: Parameters<typeof RuleCollectionsSection>[0]['onClearActive'];
  handleCreateRuleCollection: Parameters<typeof RuleCollectionsSection>[0]['onCreate'];
  handleRenameRuleCollection: Parameters<typeof RuleCollectionsSection>[0]['onRename'];
  handleDeleteRuleCollection: Parameters<typeof RuleCollectionsSection>[0]['onDelete'];
  handleActivateDatabaseView: Parameters<typeof DatabaseViewsSection>[0]['onActivate'];
  handleClearDatabaseView: Parameters<typeof DatabaseViewsSection>[0]['onClearActive'];
  handleCreateDatabaseView: Parameters<typeof DatabaseViewsSection>[0]['onCreate'];
  handleCreateDatabaseViewFromTemplate: Parameters<typeof DatabaseViewsSection>[0]['onCreateFromTemplate'];
  handleRenameDatabaseView: Parameters<typeof DatabaseViewsSection>[0]['onRename'];
  handleDeleteDatabaseView: Parameters<typeof DatabaseViewsSection>[0]['onDelete'];
  handleActivateSavedView: Parameters<typeof SavedViewsSection>[0]['onActivate'];
  handleClearSavedView: Parameters<typeof SavedViewsSection>[0]['onClearActive'];
  handleCreateSavedView: Parameters<typeof SavedViewsSection>[0]['onCreate'];
  handleRenameSavedView: Parameters<typeof SavedViewsSection>[0]['onRename'];
  handleDeleteSavedView: Parameters<typeof SavedViewsSection>[0]['onDelete'];
  isWorkspaceKindActive: (
    activation: WorkspaceActivation,
    kind: WorkspaceActivation['kind'],
    id?: string,
  ) => boolean;
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeTraceLens: () => void;
  handleClearDashboard: () => void;
  setShowSortMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setSortOrder: React.Dispatch<React.SetStateAction<NoteSortField>>;
  setSortDirection: React.Dispatch<React.SetStateAction<NoteSortDirection>>;
  setStarredFirst: React.Dispatch<React.SetStateAction<boolean>>;
  setListSectionPrefs: React.Dispatch<React.SetStateAction<NoteListSectionPrefs>>;
  setListDensity: React.Dispatch<React.SetStateAction<ListDensityMode>>;
  exportAllNotes: () => void;
  exportVaultBackup: () => void | Promise<void>;
  openVaultRestore: () => void;
  openCreateEventDialog: () => void;
  createNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>>) => string;
  setActiveNoteId: (id: string | null) => void;
  openNoteById: (id: string) => void;
  setMobileShowEditor: React.Dispatch<React.SetStateAction<boolean>>;
  noteUpdate: (id: string, patch: Partial<Note>) => void;
  setDragNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  duplicateNote: (note: Note) => void;
  patchActiveDatabaseView: Parameters<typeof DatabaseViewPanel>[0]['onViewChange'];
  setDatabaseCreateSignal: React.Dispatch<React.SetStateAction<number>>;
  setViewMode: React.Dispatch<React.SetStateAction<EditorMode>>;
  handleLeaveDashboardForNote: (noteId: string) => void;
  handleResumeLastWorkspace: WorkspaceDashboardViewProps['onResumeWorkspace'];
  handleCreateFocusPreset: NonNullable<WorkspaceDashboardViewProps['focus']>['onCreatePreset'];
  handleDeleteFocusPreset: NonNullable<WorkspaceDashboardViewProps['focus']>['onDeletePreset'];
  handleActivateFocusPreset: NonNullable<WorkspaceDashboardViewProps['focus']>['onActivatePreset'];
  handleExitFocusPreset: NonNullable<WorkspaceDashboardViewProps['focus']>['onExitPreset'];
  handleQuickCapture: NonNullable<WorkspaceDashboardViewProps['quickCapture']>['onCapture'];
  handleCreateTask: NonNullable<WorkspaceDashboardViewProps['productivity']>['onCreateTask'];
  handleCreateJournal: NonNullable<WorkspaceDashboardViewProps['productivity']>['onCreateJournal'];
  handleCreateReadingNote: NonNullable<WorkspaceDashboardViewProps['productivity']>['onCreateReadingNote'];
  handleCreateStudyNote: NonNullable<WorkspaceDashboardViewProps['productivity']>['onCreateStudyNote'];
  handleCreateTaskDatabase: NonNullable<WorkspaceDashboardViewProps['productivity']>['onCreateTaskDatabase'];
  handleCreateJournalDatabase: NonNullable<WorkspaceDashboardViewProps['productivity']>['onCreateJournalDatabase'];
  handleCreateProject: NonNullable<NonNullable<WorkspaceDashboardViewProps['unified']>['projectQuickActions']>['onCreateProject'];
  handleCreateProjectMilestone: NonNullable<NonNullable<WorkspaceDashboardViewProps['unified']>['projectQuickActions']>['onCreateMilestone'];
  handleOpenProjectNotes: NonNullable<NonNullable<WorkspaceDashboardViewProps['unified']>['projectQuickActions']>['onOpenProjectNotes'];
  handleEditProject: NonNullable<NonNullable<WorkspaceDashboardViewProps['unified']>['projectQuickActions']>['onEditProject'];
  handleActivateSubjectWorkspace: (collectionId: SmartCollectionId) => void;
  handleOpenStudyCollection: NonNullable<WorkspaceDashboardViewProps['unified']>['onOpenStudyCollection'];
  handleOpenResearchCollection: NonNullable<WorkspaceDashboardViewProps['unified']>['onOpenResearchCollection'];
  handleOpenDiscover: NonNullable<WorkspaceDashboardViewProps['unified']>['onOpenDiscover'];
  handleOpenTimeline: NonNullable<WorkspaceDashboardViewProps['unified']>['onOpenTimeline'];
  handleOpenEvolution: NonNullable<WorkspaceDashboardViewProps['unified']>['onOpenEvolution'];
  handleNavigateToArea: NonNullable<WorkspaceDashboardViewProps['unified']>['onNavigateToArea'];
  handleCreateLearningPathStepNote: NonNullable<NonNullable<WorkspaceDashboardViewProps['unified']>['learningPathEditor']>['onCreateNote'];
  handleUpdateNoteProperties: NonNullable<NonNullable<WorkspaceDashboardViewProps['unified']>['learningPathEditor']>['onUpdateNoteProperties'];
  handleNavigateToProjectEditor: NonNullable<WorkspaceDashboardViewProps['subjectWorkspaces']>['onEditProject'];
  setEditingLearningPathId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  resumeWorkspace: WorkspaceDashboardViewProps['resumeWorkspace'];
  handleEmptyTrash: () => void;
}

export interface NoteViewSidebarProps {
  layout: NoteViewSidebarLayout;
  data: NoteViewSidebarData;
  handlers: NoteViewSidebarHandlers;
}

export function NoteViewSidebar({ layout, data, handlers }: NoteViewSidebarProps) {
  const { t, lang } = useTranslation();
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const [mobileListMoreOpen, setMobileListMoreOpen] = useState(false);
  const toggleSectionPref = (key: keyof NoteListSectionPrefs) => {
    setListSectionPrefs(p => {
      const next = { ...p, [key]: !p[key] };
      writeNoteListSectionPrefs(next);
      return next;
    });
  };
  const {
    hideLeftChrome, hideSecondaryChrome, hideNoteList, isMobile, isTablet,
    isCompactChrome, isWorkspacePanelMode, sidebarCollapsed, mobileSidebarOpen,
  } = layout;
  const {
    c, dark, notes, folders, activeFolderId, activeTag, activeNoteCount, trashCount, starredCount,
    sidebarTodayCount, sidebarYesterdayCount, sidebarWeekCount, sidebarMonthCount,
    isTrash, noteListFilter, searchQuery, sidebarSearchQuery, knowledgeQueryInfo, workspaceActivation, isTraceLensMode, todayTraceKey,
    isTraceDayMode, traceDate, isTraceRangeMode, traceRange, currentTraceMonthKey,
    currentTraceQuarterKey, currentTraceYearKey, areaNotes, isTraceAreaMode, traceAreaId,
    isTraceDiscoveryMode, renamingFolderId, renameVal, showFolderForm, newFolderName, allTags,
    workspaceExpanded, isDashboardMode, smartCollectionCounts, pinnedWorkspaces, activeWorkspaceKind,
    activeWorkspaceId, recentWork, ruleCollections, ruleCollectionCounts, canCreateRuleCollection,
    databaseViews, databaseViewCounts, canCreateDatabaseView, databaseCreateSignal, savedViews,
    canSaveCurrentView, traceAreaProjection, traceAreaRange, activeDatabaseView, activeSmartCollection,
    activeRuleCollection, activeSavedView, folderLabel, traceLensMarkCount, isDatabaseViewMode,
    activeDatabaseViewNoteCount, recentNotes, visibleNotes, activeNotes, activeNoteId,
    safeNotesForDatabase, dashboard, sortOrder, sortDirection, starredFirst, listSectionPrefs, listDensity, showSortMenu, dragNoteId, editingLearningPathId,
    focusPresets, focusPresetTargets, focusSession, focusWorkspaceOptions, taskTemplates,
    journalTemplates, knowledgeMaintenance, unifiedWorkspaceDashboard, subjectWorkspaces,
    learningPathOverview, knowledgeTimeline, activitySummary, dashboardRecentActivity,
    dashboardLatestMilestone, evolutionInsights,
  } = data;

  const densityStyle = listDensityStyles(listDensity);
  const yesterdayTraceKey = useMemo(() => {
    const d = new Date(`${todayTraceKey}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return toDateKey(d);
  }, [todayTraceKey]);
  const weekTraceBounds = useMemo(() => isoWeekBounds(todayTraceKey), [todayTraceKey]);
  const isTraceWeekMode = isTraceRangeMode
    && traceRange?.kind === 'custom'
    && weekTraceBounds
    && traceRange.startDate === weekTraceBounds.startDate
    && traceRange.endDate === weekTraceBounds.endDate;
  const openTraceWeek = () => {
    if (!weekTraceBounds) return;
    openTraceRange({
      kind: 'custom',
      startDate: weekTraceBounds.startDate,
      endDate: weekTraceBounds.endDate,
      label: t('nvThisWeek'),
    });
  };
  const densityLabel = listDensity === 'ultra'
    ? t('nvListDensityUltra')
    : listDensity === 'compact'
      ? t('nvListDensityCompact')
      : t('nvListDensityComfortable');

  const {
    searchInputRef, importInputRef, setSidebarCollapsed, setActiveFolderId, setActiveTag,
    setNoteListFilter, setSearchQuery, setSidebarSearchQuery, setShowShortcuts, openTraceDay, openTraceRange,
    openCreatedNote, openTraceArea, openTraceDiscovery, storeRenameFolder, setRenamingFolderId,
    setRenameVal, deleteFolder, setShowFolderForm, setNewFolderName, addFolder,
    setWorkspaceActivation, setTraceDate, setTraceRange, setTraceAreaId, setTraceAreaRange,
    setTraceDiscoveryMode, setWorkspaceExpanded, handleActivateDashboardWithTraceClear,
    handleActivateSmartCollection, handleClearSmartCollection, handleTogglePinWorkspace,
    isWorkspacePinned, handleActivateWorkspaceRef, handleUnpinWorkspace, handleMovePinnedWorkspace,
    handleClearRecentWork, handleActivateRuleCollection, handleClearRuleCollection,
    handleCreateRuleCollection, handleRenameRuleCollection, handleDeleteRuleCollection,
    handleActivateDatabaseView, handleClearDatabaseView, handleCreateDatabaseView,
    handleCreateDatabaseViewFromTemplate, handleRenameDatabaseView, handleDeleteDatabaseView,
    handleActivateSavedView, handleClearSavedView, handleCreateSavedView, handleRenameSavedView,
    handleDeleteSavedView, isWorkspaceKindActive, setMobileSidebarOpen, closeTraceLens,
    handleClearDashboard, setShowSortMenu, setSortOrder, setSortDirection, setStarredFirst, setListSectionPrefs, setListDensity, exportAllNotes, exportVaultBackup, openVaultRestore, openCreateEventDialog,
    createNote, setActiveNoteId, openNoteById, setMobileShowEditor, noteUpdate, setDragNoteId, duplicateNote,
    patchActiveDatabaseView, setDatabaseCreateSignal, setViewMode, handleLeaveDashboardForNote,
    handleResumeLastWorkspace, handleCreateFocusPreset, handleDeleteFocusPreset,
    handleActivateFocusPreset, handleExitFocusPreset, handleQuickCapture, handleCreateTask,
    handleCreateJournal, handleCreateReadingNote, handleCreateStudyNote, handleCreateTaskDatabase,
    handleCreateJournalDatabase, handleCreateProject, handleCreateProjectMilestone,
    handleOpenProjectNotes, handleEditProject, handleActivateSubjectWorkspace,
    handleOpenStudyCollection, handleOpenResearchCollection, handleOpenDiscover, handleOpenTimeline,
    handleOpenEvolution, handleNavigateToArea, handleCreateLearningPathStepNote,
    handleUpdateNoteProperties, handleNavigateToProjectEditor, setEditingLearningPathId,
    resumeWorkspace, handleEmptyTrash,
  } = handlers;

  return (
    <>
      {/* ── Left Sidebar ── */}
      {(!hideLeftChrome || (isMobile && mobileSidebarOpen)) && (
        <nav
          id="noteview-navigation"
          aria-label={t('nvSidebarNav')}
          className={isMobile ? 'mobile-sidebar-drawer' : undefined}
          style={{
            width: isMobile ? undefined : (sidebarCollapsed ? 44 : 185),
            minWidth: isMobile ? undefined : (sidebarCollapsed ? 44 : 185),
            background: c.sidebar,
            borderRight: `1px solid ${c.sideBdr}`,
            display: isMobile && !mobileSidebarOpen ? 'none' : 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            transition: isMobile ? undefined : 'width .2s, min-width .2s',
            overflow: 'hidden',
            zIndex: isMobile ? 150 : 99,
          }}
        >
          {sidebarCollapsed ? (
            <div className="bicon-bar" style={{ flex: 1 }}>
              <button className="bicon-btn" onClick={() => setSidebarCollapsed(false)} style={{ marginBottom: 4 }}>
                <ChevronRight size={14}/>
                <span className="bicon-tooltip">{t('nvExpandSidebar')}</span>
              </button>
              <div style={{ width: 20, height: 1, background: c.sideBdr, margin: '2px 0 6px' }}/>
              <button className={`bicon-btn ${activeFolderId === null && !activeTag ? 'active' : ''}`}
                onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); }}>
                <AlignLeft size={14}/>
                <span className="bicon-tooltip">{t('nvAllNotes')} ({activeNoteCount})</span>
              </button>
              <button className={`bicon-btn ${activeFolderId === 'starred' ? 'active' : ''}`}
                onClick={() => { setActiveFolderId('starred' as any); setActiveTag(null); }}>
                <Star size={14} fill={activeFolderId === 'starred' ? c.accent : 'none'} color={activeFolderId === 'starred' ? c.accent : c.textMuted}/>
                <span className="bicon-tooltip">{t('starred')}</span>
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
                {trashCount > 0 && <span className="bicon-tooltip">{t('trash')} ({trashCount})</span>}
                {trashCount === 0 && <span className="bicon-tooltip">{t('trash')}</span>}
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 10px 8px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: c.accent, letterSpacing: -.3 }}>{t('note')}</span>
                <div style={{ flex: 1 }}/>
                <button onClick={() => setShowShortcuts(true)} className="btbtn" style={{ padding: '2px 3px' }}                 title={t('nvShortcuts')}><Keyboard size={11}/></button>
                <button onClick={() => setSidebarCollapsed(true)} className="btbtn" style={{ padding: '2px 3px' }} title={t('nvCollapseSidebar')}>
                  <ChevronRight size={11} style={{ transform: 'rotate(180deg)' }}/>
                </button>
              </div>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="btbtn"
                  title={t('nvWorkspaceSearchBtn')}
                  onClick={() => openWorkspaceSearch()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    minHeight: 28,
                    padding: '0 8px',
                    fontSize: 11,
                    color: c.textMuted,
                    border: `1px solid ${c.sideBdr}`,
                    borderRadius: 6,
                    background: c.input,
                    boxSizing: 'border-box',
                  }}
                  data-noteview-workspace-search-trigger
                >
                  <Search size={12}/>
                  {!sidebarCollapsed && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('k81WorkspaceSearchHint')}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => { createNote(); if (isMobile) setMobileShowEditor(true); }}
                  title={t('nvNewNoteBtn')}
                  data-noteview-new-note-btn
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    height: 28,
                    minHeight: 28,
                    minWidth: 28,
                    padding: sidebarCollapsed ? '0 8px' : '0 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    background: c.accent,
                    color: dark ? '#0F0F11' : '#fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <Plus size={12} strokeWidth={2.5}/>
                  {!sidebarCollapsed && <span>{t('nvNewNoteBtn')}</span>}
                </button>
              </div>
              {knowledgeQueryInfo.active && knowledgeQueryInfo.error && (
                <div style={{ padding: '4px 10px', fontSize: 10, color: c.danger, borderBottom: `1px solid ${c.sideBdr}` }}>
                  {knowledgeQueryInfo.error}
                </div>
              )}
              <div className="bscroll-pane" style={{ flex: 1 }}>
                <div className={`bfi ${activeFolderId === null && !activeTag && workspaceActivation.kind === 'none' && !isTraceLensMode ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); setWorkspaceActivation(INACTIVE_WORKSPACE); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}>
                  <span style={{ flex: 1 }}>{t('nvAllNotes')}</span>
                  <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>
                    {notes.filter(n => !n.deletedAt).length}
                  </span>
                </div>
                {!isTrash && (
                    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 2 }} data-k103-favorites-section data-k101-favorites-section data-k105-sidebar-favorites>
                      <div className="bseclbl k103-sidebar-sticky">
                        <span>{t('k81Favorites')}</span>
                      </div>
                      <div
                        className={`bfi k101-interactive ${activeFolderId === 'starred' ? 'active k101-selected' : ''}`}
                        onClick={() => { setActiveFolderId('starred' as any); setActiveTag(null); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}
                      >
                        <Star size={10} color={activeFolderId === 'starred' ? c.accent : c.textMuted} fill={activeFolderId === 'starred' ? c.accent : 'none'}/>
                        <span style={{ flex: 1 }}>{t('starred')}</span>
                        <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 600, flexShrink: 0 }}>({starredCount})</span>
                      </div>
                    </div>
                )}
                <div
                  className="bseclbl k101-interactive k103-sidebar-sticky"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => toggleSectionPref('traceQuickNavCollapsed')}
                  data-trace-quick-nav-toggle
                  data-k103-timeline-lens
                  data-k108-timeline-section
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSectionPref('traceQuickNavCollapsed');
                    }
                  }}
                >
                  <span>{t('k101TimeLens')}</span>
                  <ChevronDown
                    size={10}
                    style={{
                      transform: listSectionPrefs.traceQuickNavCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      transition: 'transform .15s',
                    }}
                  />
                </div>
                {!listSectionPrefs.traceQuickNavCollapsed ? (
                  <>
                <div
                  className={`bfi ${isTraceDayMode && traceDate === todayTraceKey ? 'active' : ''}`}
                  onClick={() => openTraceDay(todayTraceKey)}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k108-timeline-today
                >
                  <span style={{ flex: 1 }}>{t('nvToday')}</span>
                  {sidebarTodayCount > 0 && (
                    <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 600, flexShrink: 0 }}>({sidebarTodayCount})</span>
                  )}
                </div>
                <div
                  className={`bfi k101-interactive ${isTraceDayMode && traceDate === yesterdayTraceKey ? 'active k101-selected' : ''}`}
                  onClick={() => openTraceDay(yesterdayTraceKey)}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k108-timeline-yesterday
                >
                  <span style={{ flex: 1 }}>{t('nvYesterday')}</span>
                  {sidebarYesterdayCount > 0 && (
                    <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 600, flexShrink: 0 }}>({sidebarYesterdayCount})</span>
                  )}
                </div>
                <div
                  className={`bfi k101-interactive ${isTraceRangeMode && traceRange?.kind === 'month' && traceRange.year === currentTraceMonthKey.year && traceRange.month === currentTraceMonthKey.month ? 'active k101-selected' : ''}`}
                  onClick={() => openTraceRange({ kind: 'month', ...currentTraceMonthKey })}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k108-timeline-month
                >
                  <span style={{ flex: 1 }}>{t('nvThisMonth')}</span>
                  {sidebarMonthCount > 0 && (
                    <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 600, flexShrink: 0 }}>({sidebarMonthCount})</span>
                  )}
                </div>
                <div
                  className={`bfi k101-interactive ${isTraceWeekMode ? 'active k101-selected' : ''}`}
                  onClick={openTraceWeek}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k101-week-trace
                  data-k108-timeline-week
                >
                  <span style={{ flex: 1 }}>{t('nvThisWeek')}</span>
                  {sidebarWeekCount > 0 && (
                    <span style={{ fontSize: 10, color: c.textFaint, fontWeight: 600, flexShrink: 0 }}>({sidebarWeekCount})</span>
                  )}
                </div>
                <div
                  className={`bfi k101-interactive ${isTraceRangeMode && traceRange?.kind === 'quarter' && traceRange.year === currentTraceQuarterKey.year && traceRange.quarter === currentTraceQuarterKey.quarter ? 'active k101-selected' : ''}`}
                  onClick={() => openTraceRange({ kind: 'quarter', ...currentTraceQuarterKey } as TraceRangeLens)}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k108-timeline-quarter
                >
                  <span style={{ flex: 1 }}>{t('nvThisQuarter')}</span>
                </div>
                <div
                  className={`bfi k101-interactive ${isTraceRangeMode && traceRange?.kind === 'year' && traceRange.year === currentTraceYearKey ? 'active k101-selected' : ''}`}
                  onClick={() => openTraceRange({ kind: 'year', year: currentTraceYearKey })}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k108-timeline-year
                >
                  <span style={{ flex: 1 }}>{t('nvThisYear')}</span>
                </div>
                <div
                  className={`bfi k101-interactive ${isTraceRangeMode && traceRange?.kind === 'custom' ? 'active k101-selected' : ''}`}
                  onClick={() => openTraceRange({ kind: 'custom', startDate: '', endDate: '', label: '' })}
                  style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding }}
                  data-k108-timeline-custom
                >
                  <span style={{ flex: 1 }}>{t('nvCustomRange')}</span>
                </div>
                  </>
                ) : (
                  <div className="bfi" style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding, color: c.textMuted }}>
                    <span style={{ flex: 1 }}>
                      {t('nvToday')} ({sidebarTodayCount}) · {t('nvThisWeek')} ({sidebarWeekCount})
                    </span>
                  </div>
                )}
                <div data-k103-folders-section>
                <div className="bseclbl k103-sidebar-sticky">{t('nvFolders')}</div>
                {folders.map(f => (
                  <div key={f.id} className={`bfi ${activeFolderId === f.id ? 'active' : ''}`}
                    onClick={() => {
                      if (renamingFolderId === f.id) return;
                      setActiveFolderId(f.id); setActiveTag(null); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false);
                    }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bdrag-over'); }}
                    onDragLeave={e => e.currentTarget.classList.remove('bdrag-over')}
                    onDrop={e => { e.currentTarget.classList.remove('bdrag-over'); if (dragNoteId) { noteUpdate(dragNoteId, { folderId: f.id }); setDragNoteId(null); } }}
                    style={{ gap: 4 }}>
                    {renamingFolderId === f.id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && renameVal.trim()) {
                            storeRenameFolder(f.id, renameVal.trim());
                            setRenamingFolderId(null);
                          }
                          if (e.key === 'Escape') setRenamingFolderId(null);
                        }}
                        onBlur={() => {
                          if (renameVal.trim()) storeRenameFolder(f.id, renameVal.trim());
                          setRenamingFolderId(null);
                        }}
                        className="bwi"
                        style={{ flex: 1, fontSize: 11, margin: '0 4px' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          setRenamingFolderId(f.id);
                          setRenameVal(f.name);
                        }}>
                        {f.name}
                      </span>
                    )}
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
                    <input className="bwi" style={{ width: '100%', fontSize: 11 }} placeholder={t('nvFolderName')}
                      value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setShowFolderForm(false); }}
                      autoFocus/>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="bwbg" style={{ flex: 1, padding: '3px', fontSize: 11 }} onClick={addFolder}>추가</button>
                      <button onClick={() => setShowFolderForm(false)}
                        style={{ flex: 1, background: c.cardHov, border: 'none', borderRadius: 5, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '3px' }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="bfi" onClick={() => setShowFolderForm(true)} style={{ color: c.textMuted, fontSize: 10 }}>
                    <FolderPlus size={10} color={c.textMuted}/><span>{t('nvNewFolder')}</span>
                  </div>
                )}
                </div>
                <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }} data-k104-trash-section>
                  <div className={`bfi ${isTrash ? 'active' : ''}`} onClick={() => setActiveFolderId('trash')}>
                    <Trash2 size={10} color={isTrash ? c.danger : c.textMuted}/>
                    <span style={{ flex: 1, color: isTrash ? c.danger : undefined }}>{t('trash')}</span>
                    {trashCount > 0 && <span style={{ fontSize: 9, background: `${c.danger}20`, color: c.danger, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>{trashCount}</span>}
                  </div>
                </div>
                <div data-k104-areas-section>
                  <div
                    className="bseclbl k101-interactive k103-sidebar-sticky"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginTop: 4 }}
                    onClick={() => toggleSectionPref('areasCollapsed')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSectionPref('areasCollapsed');
                      }
                    }}
                    data-k104-areas-toggle
                  >
                    <span>{t('nvAreas')}</span>
                    <ChevronDown
                      size={10}
                      style={{
                        transform: listSectionPrefs.areasCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform .15s',
                      }}
                    />
                  </div>
                  {!listSectionPrefs.areasCollapsed ? (
                    <>
                {areaNotes.map(area => (
                  <div
                    key={area.id}
                    className={`bfi ${isTraceAreaMode && traceAreaId === area.id ? 'active' : ''}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.altKey) {
                        openTraceArea(area.id);
                      } else {
                        openCreatedNote(area.id);
                      }
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayNoteTitle(area.title)}
                    </span>
                  </div>
                ))}
                <div
                  className={`bfi ${isTraceDiscoveryMode ? 'active' : ''}`}
                  onClick={openTraceDiscovery}
                >
                  <span style={{ flex: 1 }}>{t('nvPatternDiscovery')}</span>
                </div>
                    </>
                  ) : null}
                </div>
                {allTags.length > 0 && (
                  <>
                    <div className="bseclbl" style={{ marginTop: 4 }}>{t('nvPanelTags')}</div>
                    <div style={{ padding: '3px 8px 8px', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {allTags.map(({ tag, count }) => (
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
                    onClick={() => {
                      setWorkspaceExpanded(v => {
                        const next = !v;
                        setListSectionPrefs(p => {
                          const updated = { ...p, workspaceCollapsed: !next };
                          writeNoteListSectionPrefs(updated);
                          return updated;
                        });
                        return next;
                      });
                    }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {workspaceExpanded
                      ? <ChevronDown size={10} style={{ flexShrink: 0, color: c.textFaint }} />
                      : <ChevronRight size={10} style={{ flexShrink: 0, color: c.textFaint }} />}
                    <span>{t('nvWorkspace')}</span>
                  </div>
                  {workspaceExpanded && (
                    <>
                      <div
                        className={`bfi ${isDashboardMode ? 'active' : ''}`}
                        onClick={handleActivateDashboardWithTraceClear}
                        style={{ gap: 4, fontSize: 11 }}
                      >
                        <LayoutDashboard size={10} color={isDashboardMode ? c.accent : c.textMuted} />
                        <span style={{ flex: 1 }}>{t('wsDashboard')}</span>
                      </div>
                      <SmartCollectionsSection
                        colors={c}
                        collections={SMART_COLLECTIONS}
                        activeCollectionId={isWorkspaceKindActive(workspaceActivation, 'smart-collection') && 'id' in workspaceActivation ? workspaceActivation.id : null}
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
                  collapsed={listSectionPrefs.pinnedCollapsed}
                  onToggleCollapse={() => setListSectionPrefs(p => {
                    const next = { ...p, pinnedCollapsed: !p.pinnedCollapsed };
                    writeNoteListSectionPrefs(next);
                    return next;
                  })}
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
                  collapsed={listSectionPrefs.recentCollapsed}
                  onToggleCollapse={() => setListSectionPrefs(p => {
                    const next = { ...p, recentCollapsed: !p.recentCollapsed };
                    writeNoteListSectionPrefs(next);
                    return next;
                  })}
                />
                <RuleCollectionsSection
                  colors={c}
                  collections={ruleCollections}
                  activeCollectionId={isWorkspaceKindActive(workspaceActivation, 'rule-collection') && 'id' in workspaceActivation ? workspaceActivation.id : null}
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
                  activeViewId={isWorkspaceKindActive(workspaceActivation, 'database-view') && 'id' in workspaceActivation ? workspaceActivation.id : null}
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
                  activeViewId={isWorkspaceKindActive(workspaceActivation, 'saved-view') && 'id' in workspaceActivation ? workspaceActivation.id : null}
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
              </div>
            </>
          )}
        </nav>
      )}
      {/* ── Note List / Database Table ── */}
      <div
        id="noteview-note-list"
        role="region"
        aria-label={t('nvNoteList')}
        data-list-density={listDensity}
        style={{
        width: hideLeftChrome ? 0 : (hideSecondaryChrome || hideNoteList ? 0 : (isWorkspacePanelMode ? (isMobile ? '100%' : (isTablet ? '36%' : '42%')) : (isMobile ? '100%' : (isTablet ? 168 : K103_NOTE_LIST_WIDTH_PX)))),
        minWidth: hideLeftChrome ? 0 : (hideSecondaryChrome || hideNoteList ? 0 : (isWorkspacePanelMode ? (isMobile ? 0 : (isTablet ? 220 : 260)) : (isMobile ? 0 : (isTablet ? 176 : K103_NOTE_LIST_MIN_WIDTH_PX)))),
        overflow: 'hidden',
        background: c.notelist,
        borderRight: `1px solid ${c.sideBdr}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: isWorkspacePanelMode ? 1 : 0,
        transition: 'width .2s, min-width .2s',
        zIndex: 99,
      }}>
        <div style={{ padding: '8px 10px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${c.sideBdr}`, gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            {(isMobile || isCompactChrome) && !isWorkspacePanelMode && (
              <>
                <button
                  type="button"
                  className="btbtn btbtn-mobile"
                  onClick={() => openWorkspaceSearch()}
                  title={t('nvWorkspaceSearchBtn')}
                  aria-label={t('nvScWorkspaceSearch')}
                  style={{ padding: '4px 6px', color: c.accent, flexShrink: 0 }}
                >
                  <Search size={16} />
                </button>
                {!isTrash && (
                  <button
                    type="button"
                    className="btbtn btbtn-mobile"
                    onClick={() => { createNote(); if (isMobile) setMobileShowEditor(true); }}
                    title={t('nvNewNoteBtn')}
                    aria-label={t('nvNewNoteBtn')}
                    data-noteview-new-note-btn
                    style={{
                      padding: '4px 8px',
                      background: c.accent,
                      border: 'none',
                      borderRadius: 8,
                      color: dark ? '#0F0F11' : '#fff',
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </>
            )}
            {isMobile && (
              <button
                type="button"
                className="btbtn btbtn-mobile"
                onClick={() => setMobileSidebarOpen(true)}
                title={t('nvOpenMenu')}
                aria-label={t('nvOpenMenu')}
                style={{ padding: '4px 6px', color: c.textMuted, flexShrink: 0 }}
              >
                <AlignLeft size={16} />
              </button>
            )}
          <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {isTraceDiscoveryMode
              ? t('nvPatternDiscovery')
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
              ? (knowledgeQueryInfo.error ? t('nvInvalidQuery') : knowledgeQueryInfo.label)
              : activeTag ? `#${activeTag}` : folderLabel}
            <span style={{ color: c.textFaint, marginLeft: 4 }}>
              ({isTraceLensMode ? traceLensMarkCount : isDatabaseViewMode ? activeDatabaseViewNoteCount : isDashboardMode ? recentNotes.length : visibleNotes.length})
            </span>
          </span>
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', position: 'relative', flexShrink: 0 }}>
            {searchQuery.trim() && (
              <button onClick={handleClearSavedView} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearQuery')}>✕</button>
            )}
            {isTraceLensMode && (
              <button onClick={closeTraceLens} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvLeaveTrace')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'dashboard') && (
              <button onClick={handleClearDashboard} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvLeaveDashboard')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'database-view') && (
              <button onClick={handleClearDatabaseView} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearDbView')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'smart-collection') && (
              <button onClick={handleClearSmartCollection} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearCollection')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'rule-collection') && !isWorkspaceKindActive(workspaceActivation, 'smart-collection') && (
              <button onClick={handleClearRuleCollection} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearCollection')}>✕</button>
            )}
            {activeTag && workspaceActivation.kind === 'none' && (
              <button onClick={() => setActiveTag(null)} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }}>✕</button>
            )}
            {!isWorkspacePanelMode && (
              <>
            <button
              ref={sortBtnRef}
              className="btbtn"
              style={{ padding: '2px 5px', fontSize: 9, color: c.textMuted }}
              onClick={() => setShowSortMenu(v => !v)}
              title={t('nvSort')}
              data-k104-sort-trigger
            >
              {sortOrder === 'updated' ? <Clock size={10} /> : sortOrder === 'title' ? 'Az' : <Calendar size={10} />}
              <span style={{ marginLeft: 2, fontSize: 8 }}>{sortDirection === 'desc' ? '↓' : '↑'}</span>
            </button>
            <NoteListSortMenu
              colors={c}
              anchorRef={sortBtnRef}
              isMobile={isMobile}
              open={showSortMenu}
              sortOrder={sortOrder}
              sortDirection={sortDirection}
              starredFirst={starredFirst}
              onSortOrder={setSortOrder}
              onSortDirection={setSortDirection}
              onStarredFirst={setStarredFirst}
              onClose={() => setShowSortMenu(false)}
            />
            {!isMobile ? (
              <>
            <button
              className="btbtn"
              style={{ padding: '2px 6px', fontSize: 8, color: c.textMuted, maxWidth: 72 }}
              title={t('nvListDensity')}
              onClick={() => {
                const next = cycleListDensityMode(listDensity);
                writeListDensityMode(next);
                setListDensity(next);
              }}
            >
              {densityLabel.slice(0, 1)}
            </button>
            {!isTrash && (
              <button onClick={() => importInputRef.current?.click()} className="btbtn" title={t('nvImportMd')}>
                <Upload size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={() => openCreateEventDialog()} className="btbtn" title={t('nvCreateEvent')}>
                <CalendarDays size={11}/>
              </button>
            )}
              </>
            ) : (
              <button
                type="button"
                className="btbtn btbtn-mobile"
                onClick={() => setMobileListMoreOpen(true)}
                title={t('nvMoreActions')}
                data-k104-mobile-list-more
              >
                <MoreHorizontal size={16} />
              </button>
            )}
              </>
            )}
          </div>
        </div>
        {mobileListMoreOpen && isMobile ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/40"
            onClick={() => setMobileListMoreOpen(false)}
            data-k104-mobile-list-more-sheet
          >
            <div
              className="rounded-t-2xl p-4 pb-8 shadow-2xl flex flex-col gap-1"
              style={{ background: c.card, borderTop: `1px solid ${c.sideBdr}` }}
              onClick={e => e.stopPropagation()}
            >
              <button type="button" className="btbtn btbtn-mobile" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => { const next = cycleListDensityMode(listDensity); writeListDensityMode(next); setListDensity(next); setMobileListMoreOpen(false); }}>
                {t('nvListDensity')}: {densityLabel}
              </button>
              <button type="button" className="btbtn btbtn-mobile" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => { setShowShortcuts(true); setMobileListMoreOpen(false); }}>
                {t('nvShortcuts')}
              </button>
              {!isTrash ? (
                <button type="button" className="btbtn btbtn-mobile" style={{ textAlign: 'left', padding: '10px 12px' }} onClick={() => { openCreateEventDialog(); setMobileListMoreOpen(false); }}>
                  {t('nvCreateEvent')}
                </button>
              ) : null}
            </div>
          </div>,
          document.body,
        ) : null}
        {isTrash && !isWorkspacePanelMode && (
          <div className="bsticky-header" style={{ padding: '8px 10px', borderBottom: `1px solid ${c.sideBdr}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: c.textMuted, fontWeight: 600 }}>
                {t('nvTrashNoteCount').replace('{count}', String(trashCount))}
              </div>
              <div style={{ fontSize: 10, color: c.textFaint, marginTop: 2 }}>
                {t('nvTrashRecoverableStorage').replace('{size}', formatRecoverableStorage(estimateDeletedNoteBytes(notes)))}
              </div>
            </div>
            {trashCount > 0 ? (
              <button
                type="button"
                className="btbtn"
                onClick={handleEmptyTrash}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: c.danger,
                  background: `${c.danger}12`,
                  border: `1px solid ${c.danger}40`,
                  borderRadius: 6,
                }}
              >
                {t('nvEmptyTrash')}
              </button>
            ) : null}
          </div>
        )}
        {!isTrash && !isWorkspacePanelMode && (
          <div style={{ padding: '4px 8px', borderBottom: `1px solid ${c.sideBdr}`, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4 }} role="tablist" aria-label={t('k81NoteListFilters')}>
              {(['all', 'recent', 'favorites'] as const).map(filter => {
                const active = noteListFilter === filter;
                const label = filter === 'all' ? t('nvAllNotes')
                  : filter === 'recent' ? t('k81RecentNotes')
                  : t('k81Favorites');
                return (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setNoteListFilter(filter)}
                    style={{
                      flex: 1,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '4px 6px',
                      borderRadius: 6,
                      border: `1px solid ${active ? c.accent : c.sideBdr}`,
                      background: active ? c.accentBg : 'transparent',
                      color: active ? c.accent : c.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type="search"
              value={sidebarSearchQuery}
              onChange={e => setSidebarSearchQuery(e.target.value)}
              placeholder={t('nvSidebarSearchPlaceholder')}
              title={t('nvSidebarSearchPlaceholder')}
              className="bwsi"
              style={{
                width: '100%',
                fontSize: 10,
                padding: '4px 8px',
                height: 26,
                boxSizing: 'border-box',
                background: c.input,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                color: c.text,
              }}
              {...{ [SIDEBAR_NOTE_SEARCH_ATTR]: '' }}
            />
            <span style={{ fontSize: 9, color: c.textFaint }}>{t('nvSearchShortcutHint')}</span>
          </div>
        )}
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
                openWorkspaceSearch();
              },
              onOpenCosmos: () => setViewMode('graph'),
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
              onCreateReadingNote: handleCreateReadingNote,
              onCreateStudyNote: handleCreateStudyNote,
              onCreateTaskDatabase: handleCreateTaskDatabase,
              onCreateJournalDatabase: handleCreateJournalDatabase,
            }}
            maintenance={{
              data: knowledgeMaintenance,
              onSelectNote: noteId => {
                handleLeaveDashboardForNote(noteId);
                setActiveNoteId(noteId);
              },
            }}
            unified={{
              data: unifiedWorkspaceDashboard,
              onSelectNote: noteId => {
                handleLeaveDashboardForNote(noteId);
                setActiveNoteId(noteId);
              },
              onActivateSubjectWorkspace: collectionId => {
                handleActivateSubjectWorkspace(collectionId);
                handleLeaveDashboardForNote('');
              },
              projectQuickActions: {
                onCreateProject: handleCreateProject,
                onCreateMilestone: handleCreateProjectMilestone,
                onOpenProjectNotes: handleOpenProjectNotes,
                onEditProject: handleEditProject,
              },
              onOpenStudyCollection: handleOpenStudyCollection,
              onOpenResearchCollection: handleOpenResearchCollection,
              onOpenDiscover: handleOpenDiscover,
              onOpenTimeline: handleOpenTimeline,
              timeline: knowledgeTimeline,
              activitySummary,
              activityRecent: dashboardRecentActivity,
              activityLatestMilestone: dashboardLatestMilestone,
              activityGrowthTrend: knowledgeTimeline.recentEvolution,
              evolutionInsights,
              onOpenEvolution: handleOpenEvolution,
              onNavigateToArea: handleNavigateToArea,
              activeNoteCount: activeNotes.length,
              onCreateNote: () => createNote(),
              onOpenCosmos: () => setViewMode('graph'),
              learningPathOverview: {
                data: learningPathOverview,
                onNavigateToNote: noteId => {
                  handleLeaveDashboardForNote(noteId);
                  setActiveNoteId(noteId);
                },
                onCreatePath: () => setEditingLearningPathId(null),
                onOpenPathEditor: pathId => setEditingLearningPathId(pathId),
              },
              learningPathEditor: editingLearningPathId !== undefined ? {
                pathId: editingLearningPathId,
                notes,
                activeNoteId,
                onPathIdChange: id => setEditingLearningPathId(id ?? undefined),
                onUpdateNoteProperties: handleUpdateNoteProperties,
                onCreateNote: handleCreateLearningPathStepNote,
              } : undefined,
            }}
            learningPath={{
              data: learningPathOverview,
              onSelectNote: noteId => {
                handleLeaveDashboardForNote(noteId);
                setActiveNoteId(noteId);
              },
              onCreatePath: () => setEditingLearningPathId(null),
              onOpenPathEditor: pathId => setEditingLearningPathId(pathId),
              editor: editingLearningPathId !== undefined ? {
                pathId: editingLearningPathId,
                notes,
                activeNoteId,
                onPathIdChange: id => setEditingLearningPathId(id ?? undefined),
                onUpdateNoteProperties: handleUpdateNoteProperties,
                onCreateNote: handleCreateLearningPathStepNote,
              } : undefined,
            }}
            subjectWorkspaces={{
              subjects: subjectWorkspaces,
              onSelectNote: noteId => {
                handleLeaveDashboardForNote(noteId);
                setActiveNoteId(noteId);
              },
              onActivateSubjectWorkspace: collectionId => {
                handleActivateSubjectWorkspace(collectionId);
                handleLeaveDashboardForNote('');
              },
              onEditProject: handleNavigateToProjectEditor,
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
        <NoteSidebarVirtualList
          colors={c}
          notes={visibleNotes}
          folders={folders}
          activeNoteId={activeNoteId}
          isTrash={isTrash}
          isMobile={isMobile}
          dragNoteId={dragNoteId}
          t={t}
          openNoteById={openNoteById}
          setMobileShowEditor={setMobileShowEditor}
          setDragNoteId={setDragNoteId}
          duplicateNote={duplicateNote}
          createNote={createNote}
          hasActiveSearch={!!sidebarSearchQuery.trim()}
          onClearSearch={() => setSidebarSearchQuery('')}
          listDensity={listDensity}
          todayKey={todayTraceKey}
          lang={lang}
        />
        )}
      </div>
    </>
  );
}
