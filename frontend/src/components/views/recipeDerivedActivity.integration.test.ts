// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NoteViewSidebar } from './noteview/NoteViewSidebar';
import {
  clearRecipeActivityForTest,
  recordRecipeView,
} from './features/recipe/recipeActivityStorage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../common/WorkspaceSectionNav', () => ({ WorkspaceSectionNav: () => null }));
vi.mock('../common/WorkspacePageHeader', () => ({ WorkspacePageHeader: () => null }));
vi.mock('./features/knowledge', () => ({
  formatTraceDayHeading: (value: string) => value,
  formatAreaRangeHeading: (value: string) => value,
  formatRangeLensHeading: () => 'range',
  listTags: () => [],
  toDateKey: (value: Date) => value.toISOString().slice(0, 10),
  SmartCollectionsSection: () => null,
  RuleCollectionsSection: () => null,
  DatabaseViewsSection: () => null,
  SavedViewsSection: () => null,
  PinnedWorkspacesSection: () => null,
  RecentWorkSection: () => null,
  WorkspaceDashboardView: ({ crossDomainActivity }: { crossDomainActivity: { groups: Array<{ items: Array<{ title: string; recipeId?: string }> }> } }) => createElement(
    'output',
    {
      'data-notes-recipe-activity': crossDomainActivity.groups
        .flatMap(group => group.items)
        .filter(item => item.recipeId)
        .map(item => `${item.recipeId}:${item.title}`)
        .join('|'),
    },
  ),
  SMART_COLLECTIONS: [],
  INACTIVE_WORKSPACE: { kind: 'none' },
  knowledgeIndexService: {},
  DailyTraceDayView: () => null,
  RangeTraceLensView: () => null,
  AreaTraceView: () => null,
  AreaDiscoveryView: () => null,
  DatabaseViewPanel: () => null,
}));
vi.mock('./features/knowledge/collections/sidebarSmartCollections', () => ({ getSidebarSmartCollections: () => [] }));
vi.mock('./NoteSidebarVirtualList', () => ({ NoteSidebarVirtualList: () => null }));
vi.mock('./EmbeddedAttachmentMigrationReviewPanel', () => ({ EmbeddedAttachmentMigrationReviewPanel: () => null }));
vi.mock('../notes/NotesOverviewSignalPanelContainer', () => ({ NotesOverviewSignalPanelContainer: () => null }));
vi.mock('../searchFocusIsolation', () => ({ SIDEBAR_NOTE_SEARCH_ATTR: 'data-sidebar-search' }));
vi.mock('../../lib/i18n', () => ({
  resolveIntlLocale: () => 'en-US',
  useTranslation: () => ({
    lang: 'en',
    t: (key: string) => ({
      note: 'Notes',
      k125NotesSubtitle: 'Notes subtitle',
      nvNoteList: 'Note list',
      nvAllNotes: 'All notes',
      nvToday: 'Today',
      nvYesterday: 'Yesterday',
      nvThisMonth: 'This month',
      nvThisWeek: 'This week',
      nvThisQuarter: 'This quarter',
      nvThisYear: 'This year',
      nvCustomRange: 'Custom range',
      nvFolders: 'Folders',
      nvTrash: 'Trash',
      nvSort: 'Sort',
      nvListDensity: 'Density',
      nvImportMd: 'Import',
      nvCreateEvent: 'Create event',
      nvMoreActions: 'More',
      nvWorkspaceSearchBtn: 'Search',
      k81WorkspaceSearchHint: 'Search workspace',
      nvNewNoteBtn: 'New note',
      k81Favorites: 'Favorites',
      k81TimeLens: 'Time lens',
      nvPatternDiscovery: 'Pattern discovery',
      nvInvalidQuery: 'Invalid query',
      k81RecentNotes: 'Recent notes',
      k81NoteListFilters: 'Filters',
      nvSidebarSearchPlaceholder: 'Search notes',
      nvLeaveDashboard: 'Leave dashboard',
      nvClearQuery: 'Clear query',
      nvCollapseSidebar: 'Collapse sidebar',
      nvExpandSidebar: 'Expand sidebar',
      nvTrashNoteCount: '{count} notes',
      nvTrashRecoverableStorage: '{size}',
      nvEmptyTrash: 'Empty trash',
      nvLeaveTrace: 'Leave trace',
      nvClearDbView: 'Clear view',
      nvClearCollection: 'Clear collection',
      nvOpenMenu: 'Open menu',
      nvScWorkspaceSearch: 'Workspace search',
      nvListDensityComfortable: 'Comfortable',
      nvListDensityCompact: 'Compact',
      nvListDensityUltra: 'Ultra',
    }[key] ?? key),
  }),
}));
vi.mock('../listDensityPreference', () => ({
  cycleListDensityMode: (value: string) => value,
  listDensityStyles: () => ({ traceRowMinHeight: 28, traceRowPadding: '4px 8px' }),
  writeListDensityMode: vi.fn(),
}));
vi.mock('../noteListSectionPrefs', () => ({ writeNoteListSectionPrefs: vi.fn() }));
vi.mock('../k103LayoutConstants', () => ({ K103_NOTE_LIST_WIDTH_PX: 280, K103_NOTE_LIST_MIN_WIDTH_PX: 240 }));
vi.mock('./NoteListSortMenu', () => ({ NoteListSortMenu: () => null }));
vi.mock('../../lib/trashNoteStorage', () => ({
  estimateDeletedNoteBytes: () => 0,
  formatRecoverableStorage: () => '0 B',
}));
vi.mock('../../lib/noteNavigation', () => ({
  openWorkspaceSearch: vi.fn(),
  switchToTab: vi.fn(),
}));
vi.mock('./features/planner/plannerActivityStorage', () => ({ readPlannerActivityRecents: () => [] }));
vi.mock('./features/knowledge/archive/archiveRestoreRecents', () => ({ readArchiveRestoreRecents: () => [] }));
vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector({ notes: [], vaultStructureVersion: 0 }),
    { getState: () => ({ notes: [] }) },
  ),
}));

const colors = {
  sidebar: '#111', sideBdr: '#222', accent: '#5af', card: '#111', input: '#222',
  text: '#fff', textMuted: '#aaa', textFaint: '#888', badge: '#333', badgeTxt: '#fff',
  notelist: '#111', danger: '#f55',
};

function sidebarData(accountId: string): Record<string, unknown> {
  const listSectionPrefs = {
    traceQuickNavCollapsed: true,
    pinnedCollapsed: true,
    recentCollapsed: true,
    favoritesCollapsed: true,
  };
  return {
    accountId,
    c: colors,
    dark: true,
    notes: [],
    folders: [],
    activeFolderId: null,
    activeTag: null,
    activeNoteCount: 0,
    trashCount: 0,
    starredCount: 0,
    sidebarTodayCount: 0,
    sidebarYesterdayCount: 0,
    sidebarWeekCount: 0,
    sidebarMonthCount: 0,
    isTrash: false,
    noteListFilter: 'all',
    searchQuery: '',
    sidebarSearchQuery: '',
    knowledgeQueryInfo: { active: false, label: null, error: null },
    workspaceActivation: { kind: 'none' },
    isTraceLensMode: false,
    todayTraceKey: '2026-08-31',
    isTraceDayMode: false,
    traceDate: null,
    isTraceRangeMode: false,
    traceRange: null,
    currentTraceMonthKey: { year: 2026, month: 8 },
    currentTraceQuarterKey: { year: 2026, quarter: 3 },
    currentTraceYearKey: 2026,
    areaNotes: [],
    isTraceAreaMode: false,
    traceAreaId: null,
    isTraceDiscoveryMode: false,
    renamingFolderId: null,
    renameVal: '',
    showFolderForm: false,
    newFolderName: '',
    allTags: [],
    workspaceExpanded: false,
    isDashboardMode: true,
    smartCollectionCounts: {},
    pinnedWorkspaces: [],
    activeWorkspaceKind: 'none',
    activeWorkspaceId: null,
    recentWork: [],
    ruleCollections: [],
    ruleCollectionCounts: {},
    canCreateRuleCollection: false,
    databaseViews: [],
    databaseViewCounts: {},
    canCreateDatabaseView: false,
    databaseCreateSignal: 0,
    savedViews: [],
    canSaveCurrentView: false,
    traceAreaProjection: null,
    traceAreaRange: null,
    activeDatabaseView: undefined,
    activeSmartCollection: undefined,
    activeRuleCollection: undefined,
    activeSavedView: undefined,
    folderLabel: 'All notes',
    traceLensMarkCount: 0,
    isDatabaseViewMode: false,
    activeDatabaseViewNoteCount: 0,
    recentNotes: [],
    visibleNotes: [],
    activeNotes: [],
    activeNoteId: null,
    safeNotesForDatabase: [],
    dashboard: { name: 'Notes dashboard' },
    sortOrder: 'updated',
    sortDirection: 'desc',
    starredFirst: false,
    listSectionPrefs,
    listDensity: 'comfortable',
    showSortMenu: false,
    dragNoteId: null,
    editingLearningPathId: null,
    focusPresets: [],
    focusPresetTargets: [],
    focusSession: { activePresetId: null },
    focusWorkspaceOptions: [],
    taskTemplates: [],
    journalTemplates: [],
    knowledgeMaintenance: {},
    unifiedWorkspaceDashboard: {},
    subjectWorkspaces: [],
    learningPathOverview: {},
    knowledgeTimeline: { recentEvolution: [] },
    activitySummary: {},
    dashboardRecentActivity: [],
    dashboardLatestMilestone: null,
    evolutionInsights: {},
  };
}

function sidebarLayout(): Record<string, unknown> {
  return {
    hideLeftChrome: true,
    hideSecondaryChrome: false,
    hideNoteList: false,
    isMobile: false,
    isTablet: false,
    isCompactChrome: false,
    isWorkspacePanelMode: false,
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
  };
}

function sidebarHandlers(): Record<string, unknown> {
  const noop = vi.fn();
  return new Proxy({}, { get: () => noop });
}

describe('Notes Recipe-derived activity account boundary', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    clearRecipeActivityForTest();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    clearRecipeActivityForTest();
  });

  it('reads only the current account Recipe activity in the mounted Notes sidebar', () => {
    recordRecipeView('recipe-a', 'Account A recipe', 'account-a');
    recordRecipeView('recipe-b', 'Account B recipe', 'account-b');

    act(() => root.render(createElement(NoteViewSidebar, {
      layout: sidebarLayout(),
      data: sidebarData('account-a'),
      handlers: sidebarHandlers(),
    })));
    expect(host.querySelector('output')?.getAttribute('data-notes-recipe-activity')).toContain('recipe-a:Account A recipe');
    expect(host.querySelector('output')?.getAttribute('data-notes-recipe-activity')).not.toContain('recipe-b');

    act(() => root.render(createElement(NoteViewSidebar, {
      layout: sidebarLayout(),
      data: sidebarData('account-b'),
      handlers: sidebarHandlers(),
    })));
    const output = host.querySelector('output')?.getAttribute('data-notes-recipe-activity');
    expect(output).toContain('recipe-b:Account B recipe');
    expect(output).not.toContain('recipe-a');
    expect(output).not.toContain('Account A');
  });
});
