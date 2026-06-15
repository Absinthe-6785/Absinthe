import { useCallback } from 'react';
import { useNotesStore } from '../../../../store/useNotesStore';
import type { NoteBase as Note } from '../../noteUtils';
import type { CreateMilestoneFormValues } from '../../features/knowledge/components/CreateMilestoneDialog';
import {
  setProjectMilestone,
  isProjectMilestone,
  getMilestoneStatus,
  getMilestoneTargetDate,
  getMilestoneProjectId,
} from '../../features/knowledge';
import type { NoteUpdateFn, OpenCreatedNote } from './types';
import type { Dispatch, SetStateAction } from 'react';

export interface UseNoteMilestoneActionsParams {
  activeNote: Note | null;
  storeCreateNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>> & { folderContext?: string | null }) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  noteUpdate: NoteUpdateFn;
  openCreatedNote: OpenCreatedNote;
  setCreateMilestoneDialogOpen: Dispatch<SetStateAction<boolean>>;
}

export function useNoteMilestoneActions(params: UseNoteMilestoneActionsParams) {
  const {
    activeNote,
    storeCreateNote,
    updateNote,
    noteUpdate,
    openCreatedNote,
    setCreateMilestoneDialogOpen,
  } = params;

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

  return {
    handleCreateProjectMilestone,
    handleSubmitCreateMilestone,
    handleUpdateMilestoneStatus,
    handleUpdateMilestoneTargetDate,
  };
}
