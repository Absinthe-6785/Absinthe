import { useCallback } from 'react';
import type { NoteBase as Note } from '../../noteUtils';
import {
  promoteNoteKind,
  createInboxNote,
  buildTaskNote,
  buildJournalNote,
  resolveTaskTemplateId,
  resolveJournalTemplateId,
  TASK_TEMPLATES,
  JOURNAL_TEMPLATES,
  buildExpandedGraphData,
  expandNode,
  collapseNode,
  knowledgeIndexService,
  applyAreaToNote,
  clearAreaFromNote,
  canMarkAsArea,
  isAreaNote,
  toDateKey,
  type QuickCaptureInput,
  type CreateTaskInput,
  type CreateJournalInput,
} from '../../features/knowledge';
import type { UseNoteViewActionsParams } from './types';
import { useNoteProjectActions } from './useNoteProjectActions';
import { useNoteMilestoneActions } from './useNoteMilestoneActions';
import { useNoteReadingActions } from './useNoteReadingActions';

export function useNoteCrudActions(params: UseNoteViewActionsParams) {
  const {
    notes,
    activeNote,
    activeNoteId,
    activeFolderId,
    isTrash,
    traceAreaId,
    newFolderName,
    titleInputRef,
    titleComposingRef,
    openCreateEventDialogRef,
    setViewMode,
    setActiveFolderId,
    setActiveTag,
    setShowFolderForm,
    setNewFolderName,
    setCreateProjectDialogOpen,
    setCreateMilestoneDialogOpen,
    setExpandedGraphNodes,
    setTitleDraft,
    setActiveNoteId,
    updateNote,
    storeCreateNote,
    storeCreateFolder,
    storeDuplicateNote,
    storeDeleteFolder,
    handleLeaveDashboardForNote,
    setTraceAreaId,
    setTraceAreaRange,
    setTraceDiscoveryMode,
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

  const openCreatedNote = useCallback((id: string) => {
    handleLeaveDashboardForNote(id);
    setActiveNoteId(id);
    setViewMode('edit');
    return id;
  }, [handleLeaveDashboardForNote, setActiveNoteId, setViewMode]);

  const projectActions = useNoteProjectActions({
    activeNote,
    storeCreateNote,
    updateNote,
    noteUpdate,
    openCreatedNote,
    setCreateProjectDialogOpen,
  });

  const milestoneActions = useNoteMilestoneActions({
    activeNote,
    storeCreateNote,
    updateNote,
    noteUpdate,
    openCreatedNote,
    setCreateMilestoneDialogOpen,
  });

  const readingActions = useNoteReadingActions({
    notes,
    activeNote,
    storeCreateNote,
    updateNote,
    noteUpdate,
    openCreatedNote,
  });

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

  const handleCreateLearningPathStepNote = useCallback((title: string) => {
    const id = storeCreateNote({ title: title.trim() || 'New Step', body: '' });
    return id;
  }, [storeCreateNote]);

  const handleUpdateNoteProperties = useCallback((noteId: string, properties: Record<string, string>) => {
    noteUpdate(noteId, { properties });
  }, [noteUpdate]);

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

  return {
    noteUpdate,
    createNote,
    duplicateNote,
    createFolder,
    deleteFolder,
    openCreatedNote,
    createQuickCapture,
    createTask,
    createJournal,
    ...projectActions,
    ...milestoneActions,
    ...readingActions,
    handleCreateLearningPathStepNote,
    handleUpdateNoteProperties,
    handleTitleChange,
    handleTitleCompositionEnd,
    handleActiveBodyChange,
    handlePromoteNoteKind,
    handleExpandGraphNode,
    handleCollapseGraphNode,
    addFolder,
    handleToggleAreaNote,
  };
}
