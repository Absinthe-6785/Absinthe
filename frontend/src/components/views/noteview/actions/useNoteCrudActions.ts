import { useCallback } from 'react';
import { useNotesStore } from '../../../../store/useNotesStore';
import type { NoteBase as Note } from '../../noteUtils';
import type { CreateMilestoneFormValues } from '../../features/knowledge/components/CreateMilestoneDialog';
import type { CreateProjectFormValues } from '../../features/knowledge/components/CreateProjectDialog';
import {
  buildReadingNote,
  buildStudyNote,
  setStudyProjectContainer,
  setProjectMilestone,
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
  addTag,
  SUBJECT_DASHBOARDS,
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
    handleCreateReadingNote,
    handleCreateStudyNote,
    handleCreateProject,
    handleSubmitCreateProject,
    handleCreateProjectMilestone,
    handleSubmitCreateMilestone,
    handleUpdateProjectDescription,
    handleUpdateProjectStatus,
    handleUpdateMilestoneStatus,
    handleUpdateMilestoneTargetDate,
    handleCreateLearningPathStepNote,
    handleUpdateNoteProperties,
    handleTitleChange,
    handleTitleCompositionEnd,
    handleActiveBodyChange,
    handlePromoteNoteKind,
    handleLinkReadingSource,
    handleUnlinkReadingSource,
    handleExpandGraphNode,
    handleCollapseGraphNode,
    addFolder,
    handleToggleAreaNote,
  };
}
