import { useState, useRef, useCallback } from 'react';
import type { EditorSearchScope } from '../editorSearch';
import type { EditorMode } from '../editorMode';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import type { TimelinePeriodMode } from '../features/knowledge/timeline';
import type {
  EventFormValues,
  MilestoneFormValues,
  TraceRangeLens,
} from '../features/knowledge';

export type EventDialogState = {
  mode: 'create' | 'edit';
  noteId?: string;
  initialValues: EventFormValues;
};

export type MilestoneDialogState = {
  noteId: string;
  noteTitle: string;
  initialValues: MilestoneFormValues;
  hasExistingMilestone: boolean;
};

export function useNoteViewState() {
  const [activeFolderId, setActiveFolderId] = useState<string | null | 'trash' | 'starred'>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<EditorMode>('edit');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<EditorSearchScope>('document');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [activeTocIdx, setActiveTocIdx] = useState<number | null>(null);
  const [tocKeyboardIdx, setTocKeyboardIdx] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<KnowledgeContextTab>('toc');
  const [timelineMode, setTimelineMode] = useState<TimelinePeriodMode>('month');
  const [timelineInitialArea, setTimelineInitialArea] = useState<string | null>(null);
  const [tocCollapsed, setTocCollapsed] = useState<Record<number, boolean>>({});
  const [focusMode, setFocusMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sortOrder, setSortOrder] = useState<'updated' | 'title' | 'created'>('updated');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [headerTagsExpanded, setHeaderTagsExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [editingLearningPathId, setEditingLearningPathId] = useState<string | null | undefined>(undefined);
  const [showAppearance, setShowAppearance] = useState(false);
  const [traceDate, setTraceDate] = useState<string | null>(null);
  const [traceRange, setTraceRange] = useState<TraceRangeLens | null>(null);
  const [traceAreaId, setTraceAreaId] = useState<string | null>(null);
  const [traceAreaRange, setTraceAreaRange] = useState<TraceRangeLens | null>(null);
  const [traceDiscoveryMode, setTraceDiscoveryMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const [docCopied, setDocCopied] = useState(false);
  const titleComposingRef = useRef(false);
  const [titleDraft, setTitleDraft] = useState('');
  const docCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortcutsPanelRef = useRef<HTMLDivElement>(null);

  const [eventDialog, setEventDialog] = useState<EventDialogState | null>(null);
  const openCreateEventDialogRef = useRef<(defaults?: Partial<EventFormValues>) => void>(() => {});

  const [milestoneDialog, setMilestoneDialog] = useState<MilestoneDialogState | null>(null);
  const [workspaceSearchOpen, setWorkspaceSearchOpen] = useState(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [createMilestoneDialogOpen, setCreateMilestoneDialogOpen] = useState(false);

  const resetBrowseScope = useCallback(() => {
    setActiveFolderId(null);
    setActiveTag(null);
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
  }, []);

  return {
    activeFolderId,
    setActiveFolderId,
    titleInputRef,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    searchMatchIdx,
    setSearchMatchIdx,
    showFolderForm,
    setShowFolderForm,
    newFolderName,
    setNewFolderName,
    renamingFolderId,
    setRenamingFolderId,
    renameVal,
    setRenameVal,
    activeTocIdx,
    setActiveTocIdx,
    tocKeyboardIdx,
    setTocKeyboardIdx,
    activeTag,
    setActiveTag,
    rightPanel,
    setRightPanel,
    timelineMode,
    setTimelineMode,
    timelineInitialArea,
    setTimelineInitialArea,
    tocCollapsed,
    setTocCollapsed,
    focusMode,
    setFocusMode,
    showShortcuts,
    setShowShortcuts,
    sortOrder,
    setSortOrder,
    showSortMenu,
    setShowSortMenu,
    dragNoteId,
    setDragNoteId,
    showRightPanel,
    setShowRightPanel,
    headerTagsExpanded,
    setHeaderTagsExpanded,
    sidebarCollapsed,
    setSidebarCollapsed,
    workspaceExpanded,
    setWorkspaceExpanded,
    editingLearningPathId,
    setEditingLearningPathId,
    showAppearance,
    setShowAppearance,
    traceDate,
    setTraceDate,
    traceRange,
    setTraceRange,
    traceAreaId,
    setTraceAreaId,
    traceAreaRange,
    setTraceAreaRange,
    traceDiscoveryMode,
    setTraceDiscoveryMode,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileShowEditor,
    setMobileShowEditor,
    docCopied,
    setDocCopied,
    titleComposingRef,
    titleDraft,
    setTitleDraft,
    docCopyTimerRef,
    shortcutsPanelRef,
    eventDialog,
    setEventDialog,
    openCreateEventDialogRef,
    milestoneDialog,
    setMilestoneDialog,
    workspaceSearchOpen,
    setWorkspaceSearchOpen,
    createProjectDialogOpen,
    setCreateProjectDialogOpen,
    createMilestoneDialogOpen,
    setCreateMilestoneDialogOpen,
    resetBrowseScope,
  };
}
