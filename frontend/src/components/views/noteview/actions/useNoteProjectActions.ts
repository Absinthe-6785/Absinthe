import { useCallback } from 'react';
import { useNotesStore } from '../../../../store/useNotesStore';
import type { NoteBase as Note } from '../../noteUtils';
import type { CreateProjectFormValues } from '../../features/knowledge/components/CreateProjectDialog';
import {
  setStudyProjectContainer,
  isStudyProjectContainer,
  getStudyProjectDescription,
  getStudyProjectStatus,
  addTag,
  SUBJECT_DASHBOARDS,
} from '../../features/knowledge';
import type { NoteUpdateFn, OpenCreatedNote } from './types';
import type { Dispatch, SetStateAction } from 'react';

export interface UseNoteProjectActionsParams {
  activeNote: Note | null;
  storeCreateNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>> & { folderContext?: string | null }) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  noteUpdate: NoteUpdateFn;
  openCreatedNote: OpenCreatedNote;
  setCreateProjectDialogOpen: Dispatch<SetStateAction<boolean>>;
}

export function useNoteProjectActions(params: UseNoteProjectActionsParams) {
  const {
    activeNote,
    storeCreateNote,
    updateNote,
    noteUpdate,
    openCreatedNote,
    setCreateProjectDialogOpen,
  } = params;

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

  return {
    handleCreateProject,
    handleSubmitCreateProject,
    handleUpdateProjectDescription,
    handleUpdateProjectStatus,
  };
}
