import { useCallback, useEffect } from 'react';
import { useNotesStore } from '../../../../store/useNotesStore';
import type { NoteBase as Note } from '../../noteUtils';
import { displayNoteTitle } from '../../noteDisplayTitle';
import {
  INACTIVE_WORKSPACE,
  applyEventToNote,
  applyMilestoneToNote,
  clearEventFromNote,
  clearMilestoneFromNote,
  filterStudyProjectContainers,
  findSmartCollection,
  isMilestoneNote,
  eventFormValuesFromNote,
  milestoneFormValuesFromNote,
  toDateKey,
  type EventFormValues,
  type MilestoneFormValues,
  type TraceRangeLens,
  type SmartCollectionId,
} from '../../features/knowledge';
import { registerTraceNavigation } from '../../../../lib/traceNavigation';
import type { OpenCreatedNote, UseNoteViewActionsParams } from './types';

export function useNoteTraceActions(
  params: UseNoteViewActionsParams,
  openCreatedNote: OpenCreatedNote,
) {
  const {
    eventDialog,
    milestoneDialog,
    openCreateEventDialogRef,
    setEventDialog,
    setMilestoneDialog,
    setTraceDate,
    setTraceRange,
    setTraceAreaId,
    setTraceAreaRange,
    setTraceDiscoveryMode,
    setWorkspaceActivation,
    setActiveFolderId,
    setActiveTag,
    setSearchQuery,
    updateNote,
    storeCreateNote,
    handleActivateDashboard,
    handleLeaveDashboardForNote,
    handleActivateSmartCollection,
    resetBrowseScope,
    setActiveNoteId,
    setShowRightPanel,
    setRightPanel,
    setEditingLearningPathId,
    setMobileSidebarOpen,
    isMobile,
    notes,
  } = params;

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

  const handleActivateDashboardWithTraceClear = useCallback(() => {
    setTraceDate(null);
    setTraceRange(null);
    setTraceAreaId(null);
    setTraceAreaRange(null);
    setTraceDiscoveryMode(false);
    handleActivateDashboard();
  }, [setTraceDate, setTraceRange, setTraceAreaId, setTraceAreaRange, setTraceDiscoveryMode, handleActivateDashboard]);

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

  return {
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
    handleActivateDashboardWithTraceClear,
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
  };
}
