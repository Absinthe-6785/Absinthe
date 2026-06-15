import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useNotesStore } from '../../../store/useNotesStore';
import { findNoteByTitle, normalizeNoteFolderId } from '../noteUtils';
import type { NoteBase as Note } from '../noteUtils';
import { displayNoteTitle } from '../noteDisplayTitle';
import type { EditorMode } from '../editorMode';
import { toggleEditReading } from '../editorMode';
import type { BlockEditorHandle } from '../BlockEditor';
import type { EditorSearchScope } from '../editorSearch';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import type { CreateProjectFormValues } from '../features/knowledge/components/CreateProjectDialog';
import type { CreateMilestoneFormValues } from '../features/knowledge/components/CreateMilestoneDialog';
import {
  serializeNoteMarkdown,
  parseNoteMarkdown,
  buildReadingNote,
  buildStudyNote,
  setStudyProjectContainer,
  setProjectMilestone,
  filterStudyProjectContainers,
  isStudyProjectContainer,
  isProjectMilestone,
  getStudyProjectDescription,
  getStudyProjectStatus,
  getMilestoneStatus,
  getMilestoneTargetDate,
  getMilestoneProjectId,
  getNoteKind,
  promoteNoteKind,
  linkReadingNoteToSource,
  unlinkReadingNoteFromSource,
  getLinkedSourceNoteId,
  createInboxNote,
  buildTaskNote,
  buildJournalNote,
  resolveTaskTemplateId,
  resolveJournalTemplateId,
  TASK_TEMPLATES,
  JOURNAL_TEMPLATES,
  INACTIVE_WORKSPACE,
  findSmartCollection,
  addTag,
  SUBJECT_DASHBOARDS,
  buildExpandedGraphData,
  expandNode,
  collapseNode,
  knowledgeIndexService,
  applyEventToNote,
  applyMilestoneToNote,
  clearEventFromNote,
  clearMilestoneFromNote,
  isMilestoneNote,
  eventFormValuesFromNote,
  milestoneFormValuesFromNote,
  applyAreaToNote,
  clearAreaFromNote,
  canMarkAsArea,
  isAreaNote,
  toDateKey,
  type QuickCaptureInput,
  type CreateTaskInput,
  type CreateJournalInput,
  type EventFormValues,
  type MilestoneFormValues,
  type TraceRangeLens,
  type SmartCollectionId,
} from '../features/knowledge';
import { registerTraceNavigation } from '../../../lib/traceNavigation';
import type { EventDialogState, MilestoneDialogState } from './useNoteViewState';

export interface UseNoteViewActionsParams {
  notes: Note[];
  activeNote: Note | null;
  activeNoteId: string | null;
  activeFolderId: string | null | 'trash' | 'starred';
  isTrash: boolean;
  traceAreaId: string | null;
  viewMode: EditorMode;
  showSortMenu: boolean;
  newFolderName: string;
  eventDialog: EventDialogState | null;
  milestoneDialog: MilestoneDialogState | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  titleComposingRef: MutableRefObject<boolean>;
  docCopyTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  blockEditorRef: RefObject<BlockEditorHandle | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  openCreateEventDialogRef: MutableRefObject<(defaults?: Partial<EventFormValues>) => void>;
  setViewMode: Dispatch<SetStateAction<EditorMode>>;
  setActiveFolderId: Dispatch<SetStateAction<string | null | 'trash' | 'starred'>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setShowFolderForm: Dispatch<SetStateAction<boolean>>;
  setNewFolderName: Dispatch<SetStateAction<string>>;
  setEventDialog: Dispatch<SetStateAction<EventDialogState | null>>;
  setMilestoneDialog: Dispatch<SetStateAction<MilestoneDialogState | null>>;
  setCreateProjectDialogOpen: Dispatch<SetStateAction<boolean>>;
  setCreateMilestoneDialogOpen: Dispatch<SetStateAction<boolean>>;
  setTraceDate: Dispatch<SetStateAction<string | null>>;
  setTraceRange: Dispatch<SetStateAction<TraceRangeLens | null>>;
  setTraceAreaId: Dispatch<SetStateAction<string | null>>;
  setTraceAreaRange: Dispatch<SetStateAction<TraceRangeLens | null>>;
  setTraceDiscoveryMode: Dispatch<SetStateAction<boolean>>;
  setWorkspaceActivation: (activation: import('../features/knowledge').WorkspaceActivation) => void;
  setWorkspaceSearchOpen: Dispatch<SetStateAction<boolean>>;
  setShowShortcuts: Dispatch<SetStateAction<boolean>>;
  setShowSortMenu: Dispatch<SetStateAction<boolean>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setDocCopied: Dispatch<SetStateAction<boolean>>;
  setSearchScope: Dispatch<SetStateAction<EditorSearchScope>>;
  setActiveTag: Dispatch<SetStateAction<string | null>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setExpandedGraphNodes: Dispatch<SetStateAction<string[]>>;
  setIsDragOver: Dispatch<SetStateAction<boolean>>;
  setTitleDraft: Dispatch<SetStateAction<string>>;
  setActiveNoteId: (id: string) => void;
  setShowRightPanel: Dispatch<SetStateAction<boolean>>;
  setRightPanel: Dispatch<SetStateAction<KnowledgeContextTab>>;
  setEditingLearningPathId: Dispatch<SetStateAction<string | null | undefined>>;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  storeCreateNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>> & { folderContext?: string | null }) => string;
  storeCreateFolder: (name: string) => string;
  storeDuplicateNote: (note: Note) => void;
  storeDeleteFolder: (id: string) => void;
  importNote: (note: Note) => void;
  flushPendingSync: () => void;
  syncNoteToDB: (note: Note) => Promise<boolean | void>;
  handleLeaveDashboardForNote: (id: string) => void;
  handleActivateSmartCollection: (collection: import('../features/knowledge').SmartCollection) => void;
  handleActivateDashboard: () => void;
  resetBrowseScope: () => void;
  isMobile: boolean;
}

export function useNoteViewActions(params: UseNoteViewActionsParams) {
  const {
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
  } = params;

  const noteUpdate = useCallback((id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => {
    updateNote(id, patch);
  }, [updateNote]);

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
  }, [activeFolderId, storeCreateNote, setViewMode, titleInputRef]);

  const duplicateNote = useCallback((note: Note) => {
    storeDuplicateNote(note);
  }, [storeDuplicateNote]);

  const createFolder = useCallback((name: string) => {
    const id = storeCreateFolder(name);
    setActiveFolderId(id);
  }, [storeCreateFolder, setActiveFolderId]);

  const deleteFolder = useCallback((id: string) => {
    storeDeleteFolder(id);
    setActiveFolderId(prev => (prev === id ? null : prev));
  }, [storeDeleteFolder, setActiveFolderId]);

  const exportNote = useCallback((note: Note) => {
    const blob = new Blob([serializeNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-') || 'untitled'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportAllNotes = useCallback(() => {
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    const nameCount: Record<string, number> = {};
    active.forEach((note, idx) => {
      const safeName = (note.title ?? 'untitled').replace(/[/\\?%*:|"<>]/g, '-') || 'untitled';
      const count = nameCount[safeName] ?? 0;
      nameCount[safeName] = count + 1;
      const fileName = count > 0 ? `${safeName}_${count}.md` : `${safeName}.md`;
      setTimeout(() => {
        const blob = new Blob([serializeNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
  }, [notes]);

  const openTraceDay = useCallback((dateKey: string) => {
    setTraceDate(dateKey);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setTraceDate, setTraceRange, setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode, setWorkspaceActivation, setActiveFolderId, setActiveTag, setSearchQuery]);

  const openTraceRange = useCallback((lens: TraceRangeLens) => {
    setTraceRange(lens);
    setTraceDate(null);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setTraceRange, setTraceDate, setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode, setWorkspaceActivation, setActiveFolderId, setActiveTag, setSearchQuery]);

  const openTraceArea = useCallback((areaNoteId: string) => {
    setTraceAreaId(areaNoteId);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
    setTraceDate(null);
    setTraceRange(null);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    setActiveFolderId(null);
    setActiveTag(null);
    setSearchQuery('');
  }, [setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode, setTraceDate, setTraceRange, setWorkspaceActivation, setActiveFolderId, setActiveTag, setSearchQuery]);

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
  }, [setTraceDiscoveryMode, setTraceAreaId, setTraceAreaRange, setTraceDate, setTraceRange, setWorkspaceActivation, setActiveFolderId, setActiveTag, setSearchQuery]);

  useEffect(() => {
    return registerTraceNavigation({
      openTraceDay,
      openTraceRange,
      openTraceDiscovery,
    });
  }, [openTraceDay, openTraceRange, openTraceDiscovery]);

  const closeTraceLens = useCallback(() => {
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
  }, [setTraceDate, setTraceRange, setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode]);

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
  }, [setEventDialog]);

  const openEditEventDialog = useCallback((note: Note) => {
    setEventDialog({
      mode: 'edit',
      noteId: note.id,
      initialValues: eventFormValuesFromNote(note, toDateKey(new Date())),
    });
  }, [setEventDialog]);

  const openMilestoneDialog = useCallback((note: Note) => {
    setMilestoneDialog({
      noteId: note.id,
      noteTitle: displayNoteTitle(note.title),
      initialValues: milestoneFormValuesFromNote(note, toDateKey(new Date())),
      hasExistingMilestone: isMilestoneNote(note),
    });
  }, [setMilestoneDialog]);

  openCreateEventDialogRef.current = openCreateEventDialog;

  const openCreatedNote = useCallback((id: string) => {
    handleLeaveDashboardForNote(id);
    setActiveNoteId(id);
    setViewMode('edit');
    return id;
  }, [handleLeaveDashboardForNote, setActiveNoteId, setViewMode]);

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
  }, [eventDialog, storeCreateNote, updateNote, openCreatedNote, setEventDialog]);

  const handleRemoveEventStatus = useCallback(() => {
    if (!eventDialog?.noteId) return;
    const note = useNotesStore.getState().notes.find(n => n.id === eventDialog.noteId);
    if (!note) return;
    const cleared = clearEventFromNote(note);
    updateNote(note.id, { properties: cleared.properties });
    setEventDialog(null);
  }, [eventDialog, updateNote, setEventDialog]);

  const handleMilestoneDialogSave = useCallback((values: MilestoneFormValues) => {
    if (!milestoneDialog) return;
    const note = useNotesStore.getState().notes.find(n => n.id === milestoneDialog.noteId);
    if (!note) return;
    const withMilestone = applyMilestoneToNote(note, values);
    updateNote(note.id, { properties: withMilestone.properties });
    setMilestoneDialog(null);
  }, [milestoneDialog, updateNote, setMilestoneDialog]);

  const handleRemoveMilestone = useCallback(() => {
    if (!milestoneDialog) return;
    const note = useNotesStore.getState().notes.find(n => n.id === milestoneDialog.noteId);
    if (!note) return;
    const cleared = clearMilestoneFromNote(note);
    updateNote(note.id, { properties: cleared.properties });
    setMilestoneDialog(null);
  }, [milestoneDialog, updateNote, setMilestoneDialog]);

  const createQuickCapture = useCallback((input: QuickCaptureInput) => {
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
  }, [notes, storeCreateNote, updateNote, openCreatedNote, openCreateEventDialogRef]);

  const createTask = useCallback((input: CreateTaskInput) => {
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
  }, [notes, storeCreateNote, updateNote, openCreatedNote]);

  const createJournal = useCallback((input: CreateJournalInput) => {
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
  }, [notes, storeCreateNote, updateNote, openCreatedNote]);

  const handleCreateReadingNote = useCallback((title?: string) => {
    const id = storeCreateNote({ title: title?.trim() || 'Reading Notes', body: '' });
    const created = notes.find(n => n.id === id);
    if (created) {
      let readingNote = buildReadingNote(created, { title });
      let sourceRelations: Note['relations'];
      if (activeNote && getNoteKind(activeNote) === 'source') {
        const linked = linkReadingNoteToSource(readingNote, activeNote);
        readingNote = linked.reading;
        sourceRelations = linked.source.relations;
      }
      updateNote(id, {
        title: readingNote.title,
        body: readingNote.body,
        properties: readingNote.properties,
        relations: readingNote.relations,
      });
      if (sourceRelations && activeNote) {
        noteUpdate(activeNote.id, { relations: sourceRelations });
      }
    }
    return openCreatedNote(id);
  }, [notes, activeNote, storeCreateNote, updateNote, noteUpdate, openCreatedNote]);

  const handleCreateStudyNote = useCallback((title?: string) => {
    const id = storeCreateNote({ title: title?.trim() || 'Study Notes', body: '' });
    const created = notes.find(n => n.id === id);
    if (created) {
      const studyNote = buildStudyNote(created, { title });
      updateNote(id, {
        title: studyNote.title,
        body: studyNote.body,
        properties: studyNote.properties,
      });
    }
    return openCreatedNote(id);
  }, [notes, storeCreateNote, updateNote, openCreatedNote]);

  const handleCreateProject = useCallback(() => {
    setCreateProjectDialogOpen(true);
  }, [setCreateProjectDialogOpen]);

  const handleSubmitCreateProject = useCallback((values: CreateProjectFormValues) => {
    const id = storeCreateNote({ title: values.name, body: '' });
    const created = useNotesStore.getState().notes.find(n => n.id === id);
    if (created) {
      let project = setStudyProjectContainer(created, values.status, values.description || undefined);
      if (values.subjectId) {
        const subject = SUBJECT_DASHBOARDS.find(s => s.id === values.subjectId);
        if (subject) project = addTag(project, subject.tag);
      }
      updateNote(id, { title: values.name, properties: project.properties });
    }
    setCreateProjectDialogOpen(false);
    openCreatedNote(id);
  }, [storeCreateNote, updateNote, openCreatedNote, setCreateProjectDialogOpen]);

  const handleCreateProjectMilestone = useCallback(() => {
    setCreateMilestoneDialogOpen(true);
  }, [setCreateMilestoneDialogOpen]);

  const handleSubmitCreateMilestone = useCallback((values: CreateMilestoneFormValues) => {
    const id = storeCreateNote({ title: values.name, body: '' });
    const created = useNotesStore.getState().notes.find(n => n.id === id);
    if (created) {
      const milestone = setProjectMilestone(
        created,
        values.projectId,
        values.status,
        values.targetDate || undefined,
      );
      updateNote(id, { title: values.name, properties: milestone.properties });
    }
    setCreateMilestoneDialogOpen(false);
    openCreatedNote(id);
  }, [storeCreateNote, updateNote, openCreatedNote, setCreateMilestoneDialogOpen]);

  const handleOpenStudyCollection = useCallback(() => {
    const collection = findSmartCollection('exam-study-notes');
    if (collection) handleActivateSmartCollection(collection);
  }, [handleActivateSmartCollection]);

  const handleOpenResearchCollection = useCallback(() => {
    const collection = findSmartCollection('research-sources');
    if (collection) handleActivateSmartCollection(collection);
  }, [handleActivateSmartCollection]);

  const handleActivateSubjectWorkspace = useCallback((collectionId: SmartCollectionId) => {
    const collection = findSmartCollection(collectionId);
    if (collection) handleActivateSmartCollection(collection);
  }, [handleActivateSmartCollection]);

  const handleWorkspaceSearchNote = useCallback((noteId: string) => {
    handleLeaveDashboardForNote(noteId);
    setActiveNoteId(noteId);
    if (isMobile) setMobileSidebarOpen(false);
  }, [handleLeaveDashboardForNote, isMobile, setActiveNoteId, setMobileSidebarOpen]);

  const handleWorkspaceSearchFolder = useCallback((folderId: string) => {
    resetBrowseScope();
    setActiveFolderId(folderId);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    if (isMobile) setMobileSidebarOpen(false);
  }, [resetBrowseScope, isMobile, setActiveFolderId, setWorkspaceActivation, setMobileSidebarOpen]);

  const handleWorkspaceSearchTag = useCallback((tag: string) => {
    resetBrowseScope();
    setActiveTag(tag);
    setWorkspaceActivation(INACTIVE_WORKSPACE);
    if (isMobile) setMobileSidebarOpen(false);
  }, [resetBrowseScope, isMobile, setActiveTag, setWorkspaceActivation, setMobileSidebarOpen]);

  const handleWorkspaceSearchCollection = useCallback((collectionId: string) => {
    const collection = findSmartCollection(collectionId as SmartCollectionId);
    if (collection) handleActivateSmartCollection(collection);
    if (isMobile) setMobileSidebarOpen(false);
  }, [handleActivateSmartCollection, isMobile, setMobileSidebarOpen]);

  const handleWorkspaceSearchLearningPath = useCallback((pathId: string) => {
    handleActivateDashboard();
    setEditingLearningPathId(pathId);
    if (isMobile) setMobileSidebarOpen(false);
  }, [handleActivateDashboard, isMobile, setEditingLearningPathId, setMobileSidebarOpen]);

  const handleOpenProjectNotes = useCallback(() => {
    const collection = findSmartCollection('academic-active-projects');
    if (collection) handleActivateSmartCollection(collection);
  }, [handleActivateSmartCollection]);

  const handleNavigateToProjectEditor = useCallback((projectId: string) => {
    handleLeaveDashboardForNote(projectId);
    setActiveNoteId(projectId);
    setShowRightPanel(true);
    setRightPanel('properties');
  }, [handleLeaveDashboardForNote, setActiveNoteId, setShowRightPanel, setRightPanel]);

  const handleEditProject = useCallback(() => {
    const project = filterStudyProjectContainers(notes, 'active')[0]
      ?? filterStudyProjectContainers(notes)[0];
    if (project) handleNavigateToProjectEditor(project.id);
  }, [notes, handleNavigateToProjectEditor]);

  const handleUpdateProjectDescription = useCallback((description: string) => {
    if (!activeNote || !isStudyProjectContainer(activeNote)) return;
    const status = getStudyProjectStatus(activeNote) ?? 'planned';
    const updated = setStudyProjectContainer(activeNote, status, description);
    noteUpdate(activeNote.id, { properties: updated.properties });
  }, [activeNote, noteUpdate]);

  const handleUpdateProjectStatus = useCallback((status: 'planned' | 'active' | 'completed') => {
    if (!activeNote || !isStudyProjectContainer(activeNote)) return;
    const updated = setStudyProjectContainer(activeNote, status, getStudyProjectDescription(activeNote));
    noteUpdate(activeNote.id, { properties: updated.properties });
  }, [activeNote, noteUpdate]);

  const handleUpdateMilestoneStatus = useCallback((status: 'planned' | 'active' | 'completed') => {
    if (!activeNote || !isProjectMilestone(activeNote)) return;
    const projectId = getMilestoneProjectId(activeNote);
    if (!projectId) return;
    const updated = setProjectMilestone(
      activeNote,
      projectId,
      status,
      getMilestoneTargetDate(activeNote) ?? undefined,
    );
    noteUpdate(activeNote.id, { properties: updated.properties });
  }, [activeNote, noteUpdate]);

  const handleUpdateMilestoneTargetDate = useCallback((targetDate: string | null) => {
    if (!activeNote || !isProjectMilestone(activeNote)) return;
    const projectId = getMilestoneProjectId(activeNote);
    if (!projectId) return;
    const status = getMilestoneStatus(activeNote) ?? 'planned';
    const updated = setProjectMilestone(
      activeNote,
      projectId,
      status,
      targetDate ?? undefined,
    );
    noteUpdate(activeNote.id, { properties: updated.properties });
  }, [activeNote, noteUpdate]);

  const handleCreateLearningPathStepNote = useCallback((title: string) => {
    const id = storeCreateNote({ title: title.trim() || 'New Step', body: '' });
    return id;
  }, [storeCreateNote]);

  const handleUpdateNoteProperties = useCallback((noteId: string, properties: Record<string, string>) => {
    noteUpdate(noteId, { properties });
  }, [noteUpdate]);

  const handleActivateDashboardWithTraceClear = useCallback(() => {
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
    handleActivateDashboard();
  }, [setTraceDate, setTraceRange, setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode, handleActivateDashboard]);

  const handleCopyDocument = useCallback(async () => {
    const ok = await blockEditorRef.current?.copyDocument();
    if (!ok) return;
    setDocCopied(true);
    if (docCopyTimerRef.current) clearTimeout(docCopyTimerRef.current);
    docCopyTimerRef.current = setTimeout(() => setDocCopied(false), 1500);
  }, [blockEditorRef, docCopyTimerRef, setDocCopied]);

  const handleTitleChange = useCallback((value: string) => {
    setTitleDraft(value);
    if (!titleComposingRef.current && activeNoteId) {
      noteUpdate(activeNoteId, { title: value });
    }
  }, [activeNoteId, noteUpdate, setTitleDraft, titleComposingRef]);

  const handleTitleCompositionEnd = useCallback((value: string) => {
    titleComposingRef.current = false;
    setTitleDraft(value);
    if (activeNoteId) noteUpdate(activeNoteId, { title: value });
  }, [activeNoteId, noteUpdate, setTitleDraft, titleComposingRef]);

  const handleActiveBodyChange = useCallback(
    (md: string) => { if (activeNoteId) noteUpdate(activeNoteId, { body: md }); },
    [activeNoteId, noteUpdate],
  );

  const handlePromoteNoteKind = useCallback(() => {
    if (!activeNote) return;
    const updated = promoteNoteKind(activeNote);
    noteUpdate(activeNote.id, { properties: updated.properties });
  }, [activeNote, noteUpdate]);

  const handleLinkReadingSource = useCallback((sourceNoteId: string) => {
    if (!activeNote) return;
    const source = notes.find(n => n.id === sourceNoteId);
    if (!source) return;
    const { reading, source: updatedSource } = linkReadingNoteToSource(activeNote, source);
    noteUpdate(activeNote.id, { relations: reading.relations });
    noteUpdate(source.id, { relations: updatedSource.relations });
  }, [activeNote, notes, noteUpdate]);

  const handleUnlinkReadingSource = useCallback(() => {
    if (!activeNote) return;
    const sourceId = getLinkedSourceNoteId(activeNote);
    if (!sourceId) return;
    const source = notes.find(n => n.id === sourceId);
    if (!source) return;
    const { reading, source: updatedSource } = unlinkReadingNoteFromSource(activeNote, source);
    noteUpdate(activeNote.id, { relations: reading.relations });
    noteUpdate(source.id, { relations: updatedSource.relations });
  }, [activeNote, notes, noteUpdate]);

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
  }, [activeNote, setExpandedGraphNodes]);

  const handleCollapseGraphNode = useCallback((noteId: string) => {
    setExpandedGraphNodes(prev => collapseNode(prev, noteId));
  }, [setExpandedGraphNodes]);

  const addFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName('');
    setShowFolderForm(false);
  }, [newFolderName, createFolder, setNewFolderName, setShowFolderForm]);

  const insertImageAtCursor = useCallback((name: string, src: string) => {
    if (viewMode !== 'edit' || !blockEditorRef.current) return;
    blockEditorRef.current.insertImage(src, name);
  }, [viewMode, blockEditorRef]);

  const insertEmptyImageBlockAtCursor = useCallback(() => {
    if (viewMode !== 'edit' || !blockEditorRef.current) return;
    blockEditorRef.current.insertEmptyImageBlock();
  }, [viewMode, blockEditorRef]);

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
  }, [activeNote, viewMode, insertImageAtCursor, setIsDragOver]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [activeFolderId, importNote]);

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

  const handleToggleAreaNote = useCallback(() => {
    if (!activeNote || isTrash) return;
    if (isAreaNote(activeNote)) {
      updateNote(activeNote.id, { properties: clearAreaFromNote(activeNote).properties });
      if (traceAreaId === activeNote.id) {
        setTraceAreaId(null);
        setTraceAreaRange(null);
        setTraceDiscoveryMode(false);
      }
      return;
    }
    if (!canMarkAsArea(activeNote)) return;
    updateNote(activeNote.id, { properties: applyAreaToNote(activeNote).properties });
  }, [activeNote, isTrash, traceAreaId, updateNote, setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode]);

  const shortcutRef = useRef({
    showSortMenu, viewMode, activeNote, createNote, duplicateNote,
    focusSearch: () => {},
  });
  const syncShortcutRef = useRef({
    flushPendingSync,
    syncNoteToDB,
    getActiveNote: () => null as Note | null,
  });

  useEffect(() => {
    shortcutRef.current = {
      showSortMenu, viewMode, activeNote, createNote, duplicateNote,
      focusSearch: () => {
        searchInputRef.current?.focus();
        if (activeNote) setSearchScope('document');
      },
    };
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

      const target = e.target;
      if (!mod && e.key === '?') {
        if (
          target instanceof HTMLElement
          && !target.closest('[contenteditable="true"], .be-editable, input, textarea')
          && !target.closest('.be-editor-root')
        ) {
          e.preventDefault();
          setShowShortcuts(v => !v);
        }
        return;
      }

      if (!mod) return;

      if (e.key === 's') {
        e.preventDefault();
        const { flushPendingSync: flush, syncNoteToDB: sync, getActiveNote } = syncShortcutRef.current;
        flush();
        const note = getActiveNote();
        if (note) void sync(note);
        return;
      }

      if (
        target instanceof HTMLElement
        && target.closest('[contenteditable="true"], .be-editable')
      ) {
        return;
      }

      switch (e.key) {
        case 'k':
          e.preventDefault();
          setWorkspaceSearchOpen(true);
          break;
        case 'n': e.preventDefault(); cn(); break;
        case 'd': e.preventDefault(); { if (an) dn(an); } break;
        case 'e': e.preventDefault(); setViewMode(v => toggleEditReading(v)); break;
        case 'g': e.preventDefault(); setViewMode(v => v === 'graph' ? 'edit' : 'graph'); break;
        case 'f':
          e.preventDefault();
          if (e.shiftKey) setFocusMode(v => !v);
          else shortcutRef.current.focusSearch();
          break;
        case '/':
          if (target instanceof HTMLElement && target.closest('.be-editor-root')) break;
          e.preventDefault();
          setShowShortcuts(v => !v);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
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
  };
}
