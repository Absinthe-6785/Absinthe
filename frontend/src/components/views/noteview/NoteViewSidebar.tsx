import type { RefObject } from 'react';
import {
  Search, Plus, Trash2, FolderPlus, Star, AlignLeft, Save,
  ChevronDown, ChevronRight, Upload, Keyboard, Archive, RotateCcw,
  Clock, Calendar, CalendarDays, LayoutDashboard, Folder,
} from 'lucide-react';
import { highlightText } from '../noteUtils';
import { displayNoteTitle } from '../noteDisplayTitle';
import {
  formatTraceDayHeading,
  formatAreaRangeHeading,
  formatRangeLensHeading,
  listTags,
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
import { TagChip } from '../features/knowledge/components/TagChip';
import { useTranslation } from '../../../lib/i18n';
import type { EditorMode } from '../editorMode';
import type { WorkspaceDashboardViewProps } from '../features/knowledge/components/WorkspaceDashboardView';
import type { FocusSessionState } from '../features/knowledge/workspace/focusModeModels';
import type { KnowledgeTimeline } from '../features/knowledge/timeline';

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
  isTrash: boolean;
  searchQuery: string;
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
  sortOrder: 'updated' | 'title' | 'created';
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
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  setWorkspaceSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  setSortOrder: React.Dispatch<React.SetStateAction<'updated' | 'title' | 'created'>>;
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
}

export interface NoteViewSidebarProps {
  layout: NoteViewSidebarLayout;
  data: NoteViewSidebarData;
  handlers: NoteViewSidebarHandlers;
}

export function NoteViewSidebar({ layout, data, handlers }: NoteViewSidebarProps) {
  const { t } = useTranslation();
  const {
    hideLeftChrome, hideSecondaryChrome, hideNoteList, isMobile, isTablet,
    isCompactChrome, isWorkspacePanelMode, sidebarCollapsed, mobileSidebarOpen,
  } = layout;
  const {
    c, dark, notes, folders, activeFolderId, activeTag, activeNoteCount, trashCount, starredCount,
    isTrash, searchQuery, knowledgeQueryInfo, workspaceActivation, isTraceLensMode, todayTraceKey,
    isTraceDayMode, traceDate, isTraceRangeMode, traceRange, currentTraceMonthKey,
    currentTraceQuarterKey, currentTraceYearKey, areaNotes, isTraceAreaMode, traceAreaId,
    isTraceDiscoveryMode, renamingFolderId, renameVal, showFolderForm, newFolderName, allTags,
    workspaceExpanded, isDashboardMode, smartCollectionCounts, pinnedWorkspaces, activeWorkspaceKind,
    activeWorkspaceId, recentWork, ruleCollections, ruleCollectionCounts, canCreateRuleCollection,
    databaseViews, databaseViewCounts, canCreateDatabaseView, databaseCreateSignal, savedViews,
    canSaveCurrentView, traceAreaProjection, traceAreaRange, activeDatabaseView, activeSmartCollection,
    activeRuleCollection, activeSavedView, folderLabel, traceLensMarkCount, isDatabaseViewMode,
    activeDatabaseViewNoteCount, recentNotes, visibleNotes, activeNotes, activeNoteId,
    safeNotesForDatabase, dashboard, sortOrder, showSortMenu, dragNoteId, editingLearningPathId,
    focusPresets, focusPresetTargets, focusSession, focusWorkspaceOptions, taskTemplates,
    journalTemplates, knowledgeMaintenance, unifiedWorkspaceDashboard, subjectWorkspaces,
    learningPathOverview, knowledgeTimeline, activitySummary, dashboardRecentActivity,
    dashboardLatestMilestone, evolutionInsights,
  } = data;
  const {
    searchInputRef, importInputRef, setSidebarCollapsed, setActiveFolderId, setActiveTag,
    setSearchQuery, setShowShortcuts, setWorkspaceSearchOpen, openTraceDay, openTraceRange,
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
    handleClearDashboard, setShowSortMenu, setSortOrder, exportAllNotes, exportVaultBackup, openVaultRestore, openCreateEventDialog,
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
    resumeWorkspace,
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
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${c.sideBdr}`, position: 'relative', display: 'flex', gap: 4 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                <Search size={10} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: c.textMuted }}/>
                <input
                  ref={searchInputRef}
                  className="bwsi"
                  style={{ fontSize: 11, paddingRight: searchQuery.trim() ? 24 : undefined, width: '100%' }}
                  placeholder={t('nvNoteSearchPlaceholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                </div>
                <button
                  type="button"
                  className="btbtn"
                  title={t('nvWorkspaceSearchBtn')}
                  onClick={() => setWorkspaceSearchOpen(true)}
                  style={{ padding: '4px 6px', flexShrink: 0, color: c.accent }}
                >
                  <Search size={12}/>
                </button>
              </div>
              {knowledgeQueryInfo.active && knowledgeQueryInfo.error && (
                <div style={{ padding: '4px 10px', fontSize: 10, color: c.danger, borderBottom: `1px solid ${c.sideBdr}` }}>
                  {knowledgeQueryInfo.error}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className={`bfi ${activeFolderId === null && !activeTag && workspaceActivation.kind === 'none' && !isTraceLensMode ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId(null); setActiveTag(null); setSearchQuery(''); setWorkspaceActivation(INACTIVE_WORKSPACE); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}>
                  <span style={{ flex: 1 }}>{t('nvAllNotes')}</span>
                  <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>
                    {notes.filter(n => !n.deletedAt).length}
                  </span>
                </div>
                <div
                  className={`bfi ${isTraceDayMode && traceDate === todayTraceKey ? 'active' : ''}`}
                  onClick={() => openTraceDay(todayTraceKey)}
                >
                  <span style={{ flex: 1 }}>{t('nvToday')}</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'month' && traceRange.year === currentTraceMonthKey.year && traceRange.month === currentTraceMonthKey.month ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'month', ...currentTraceMonthKey })}
                >
                  <span style={{ flex: 1 }}>{t('nvThisMonth')}</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'quarter' && traceRange.year === currentTraceQuarterKey.year && traceRange.quarter === currentTraceQuarterKey.quarter ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'quarter', ...currentTraceQuarterKey } as TraceRangeLens)}
                >
                  <span style={{ flex: 1 }}>{t('nvThisQuarter')}</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'year' && traceRange.year === currentTraceYearKey ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'year', year: currentTraceYearKey })}
                >
                  <span style={{ flex: 1 }}>{t('nvThisYear')}</span>
                </div>
                <div
                  className={`bfi ${isTraceRangeMode && traceRange?.kind === 'custom' ? 'active' : ''}`}
                  onClick={() => openTraceRange({ kind: 'custom', startDate: '', endDate: '', label: '' })}
                >
                  <span style={{ flex: 1 }}>{t('nvCustomRange')}</span>
                </div>
                <div className="bseclbl">{t('nvAreas')}</div>
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
                <div className={`bfi ${activeFolderId === 'starred' ? 'active' : ''}`}
                  onClick={() => { setActiveFolderId('starred' as any); setActiveTag(null); setTraceDate(null); setTraceRange(null); setTraceAreaId(null); setTraceAreaRange(null); setTraceDiscoveryMode(false); }}>
                  <Star size={10} color={activeFolderId === 'starred' ? c.accent : c.textMuted} fill={activeFolderId === 'starred' ? c.accent : 'none'}/>
                  <span style={{ flex: 1 }}>{t('starred')}</span>
                  {starredCount > 0 && <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>{starredCount}</span>}
                </div>
                <div className="bseclbl">{t('nvFolders')}</div>
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
                    onClick={() => setWorkspaceExpanded(v => !v)}
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
                <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
                  <div className={`bfi ${isTrash ? 'active' : ''}`} onClick={() => setActiveFolderId('trash')}>
                    <Trash2 size={10} color={isTrash ? c.danger : c.textMuted}/>
                    <span style={{ flex: 1, color: isTrash ? c.danger : undefined }}>{t('trash')}</span>
                    {trashCount > 0 && <span style={{ fontSize: 9, background: `${c.danger}20`, color: c.danger, borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>{trashCount}</span>}
                  </div>
                </div>
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
        style={{
        width: hideLeftChrome ? 0 : (hideSecondaryChrome || hideNoteList ? 0 : (isWorkspacePanelMode ? (isMobile ? '100%' : (isTablet ? '38%' : '45%')) : (isMobile ? '100%' : (isTablet ? 168 : 200)))),
        minWidth: hideLeftChrome ? 0 : (hideSecondaryChrome || hideNoteList ? 0 : (isWorkspacePanelMode ? (isMobile ? 0 : (isTablet ? 220 : 280)) : (isMobile ? 0 : (isTablet ? 168 : 200)))),
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
            {isCompactChrome && (
              <button
                type="button"
                className="btbtn btbtn-mobile"
                onClick={() => setWorkspaceSearchOpen(true)}
                title={t('nvWorkspaceSearchBtn')}
                aria-label={t('nvScWorkspaceSearch')}
                style={{ padding: '4px 6px', color: c.accent, flexShrink: 0 }}
              >
                <Search size={16} />
              </button>
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
            {isWorkspaceKindActive(workspaceActivation, 'dashboard') && !searchQuery.trim() && (
              <button onClick={handleClearDashboard} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvLeaveDashboard')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'database-view') && !searchQuery.trim() && (
              <button onClick={handleClearDatabaseView} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearDbView')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'smart-collection') && !searchQuery.trim() && (
              <button onClick={handleClearSmartCollection} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearCollection')}>✕</button>
            )}
            {isWorkspaceKindActive(workspaceActivation, 'rule-collection') && !searchQuery.trim() && !isWorkspaceKindActive(workspaceActivation, 'smart-collection') && (
              <button onClick={handleClearRuleCollection} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }} title={t('nvClearCollection')}>✕</button>
            )}
            {activeTag && workspaceActivation.kind === 'none' && !searchQuery.trim() && (
              <button onClick={() => setActiveTag(null)} className="btbtn" style={{ padding: '2px 4px', fontSize: 9 }}>✕</button>
            )}
            {!isWorkspacePanelMode && (
              <>
            {/* 정렬 */}
            <button className="btbtn" style={{ padding: '2px 5px', fontSize: 9, color: c.textMuted }} onClick={() => setShowSortMenu(v => !v)}
              title={t('nvSort')}>
              {sortOrder === 'updated' ? <Clock size={10} /> : sortOrder === 'title' ? 'Az' : <Calendar size={10} />}
            </button>
            {showSortMenu && (
              <div className="bsort-menu" onClick={e => e.stopPropagation()}>
                {(['updated', 'title', 'created'] as const).map(s => (
                  <div key={s} className={`bsort-item ${sortOrder === s ? 'active' : ''}`}
                    onClick={() => { setSortOrder(s); setShowSortMenu(false); }}>
                    {s === 'updated' ? <><Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{t('nvSortUpdated')}</> : s === 'title' ? t('nvSortTitle') : <><Calendar size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{t('nvSortCreated')}</>}
                  </div>
                ))}
              </div>
            )}
            {!isTrash && (
              <button onClick={() => importInputRef.current?.click()} className="btbtn" title={t('nvImportMd')}>
                <Upload size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={exportAllNotes} className="btbtn" title={t('nvExportAllNotes').replace('{count}', String(activeNoteCount))}>
                <Save size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={() => void exportVaultBackup()} className="btbtn min-h-[44px] min-w-[44px]" title={t('nvExportVaultBackup')}>
                <Archive size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={openVaultRestore} className="btbtn min-h-[44px] min-w-[44px]" title={t('nvImportVaultBackup')}>
                <RotateCcw size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={() => openCreateEventDialog()} className="btbtn" title={t('nvCreateEvent')}>
                <CalendarDays size={11}/>
              </button>
            )}
            {!isTrash && (
              <button onClick={() => { createNote(); if (isMobile) setMobileShowEditor(true); }}
                className="btbtn min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ background: c.accent, border: 'none', borderRadius: 8, color: dark ? '#0F0F11' : '#fff', fontWeight: 700 }}
                title={t('nvNewNoteBtn')}>
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
        ) : isDashboardMode && !searchQuery.trim() ? (
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleNotes.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: c.textFaint, fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span>{isTrash ? t('nvTrashEmpty') : searchQuery.trim() ? t('nvSearchNoResults') : t('nvNoNotes')}</span>
              {!isTrash && !searchQuery.trim() && (
                <button type="button" className="bwbg" onClick={() => { createNote(); if (isMobile) setMobileShowEditor(true); }}
                  style={{ minHeight: 44, padding: '8px 16px' }}>
                  {t('nvCreateFirstNote')}
                </button>
              )}
              {!isTrash && searchQuery.trim() && (
                <button type="button" className="bwbg" onClick={() => setSearchQuery('')}
                  style={{ minHeight: 44, padding: '8px 16px' }}>
                  {t('nvClearQuery')}
                </button>
              )}
            </div>
          ) : visibleNotes.map(n => {
            const folder  = folders.find(f => f.id === n.folderId);
            const tags    = listTags(n).slice(0, 2);
            const rawPreview = n.body.replace(/(^|\s)#[\w\uAC00-\uD7A3]+/g, '').replace(/[#*`[\]=~>$-]/g, '').split('\n').find(l => l.trim()) || '';
            const displayTitle = displayNoteTitle(n.title);
            const hlTitle   = searchQuery.trim() ? highlightText(displayTitle, searchQuery) : displayTitle;
            const hlPreview = searchQuery.trim() ? highlightText(rawPreview, searchQuery) : rawPreview;
            return (
              <div key={n.id}
                className={`bni ${n.id === activeNoteId ? 'active' : ''} ${dragNoteId === n.id ? 'bnote-drag' : ''}`}
                onClick={() => { openNoteById(n.id); if (isMobile) setMobileShowEditor(true); }}
                draggable={!isTrash}
                onDragStart={() => setDragNoteId(n.id)}
                onDragEnd={() => setDragNoteId(null)}
                title={t('nvDragHint')}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateNote(n); } }}
                tabIndex={0}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  {n.starred && <Star size={9} color={c.accent} fill={c.accent} style={{ flexShrink: 0 }}/>}
                  <span style={{ fontSize: 12, fontWeight: 600, color: n.id === activeNoteId ? c.accent : c.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    dangerouslySetInnerHTML={{ __html: hlTitle }}/>
                </div>
                <div style={{ fontSize: 10, color: c.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}
                  dangerouslySetInnerHTML={{ __html: hlPreview }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', minWidth: 0 }}>
                  {folder && <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>{folder.name}</span>}
                  {tags.map(tag => (
                    <TagChip key={tag} colors={c} tag={tag} size="sm" />
                  ))}
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
    </>
  );
}
