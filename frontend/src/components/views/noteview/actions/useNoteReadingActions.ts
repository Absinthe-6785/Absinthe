import { useCallback } from 'react';
import type { NoteBase as Note } from '../../noteUtils';
import {
  buildReadingNote,
  buildStudyNote,
  getNoteKind,
  linkReadingNoteToSource,
  unlinkReadingNoteFromSource,
  getLinkedSourceNoteId,
} from '../../features/knowledge';
import type { NoteUpdateFn, OpenCreatedNote } from './types';

export interface UseNoteReadingActionsParams {
  notes: Note[];
  activeNote: Note | null;
  storeCreateNote: (initial?: Partial<Pick<Note, 'title' | 'body' | 'folderId'>> & { folderContext?: string | null }) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  noteUpdate: NoteUpdateFn;
  openCreatedNote: OpenCreatedNote;
}

export function useNoteReadingActions(params: UseNoteReadingActionsParams) {
  const { notes, activeNote, storeCreateNote, updateNote, noteUpdate, openCreatedNote } = params;

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

  return {
    handleCreateReadingNote,
    handleCreateStudyNote,
    handleLinkReadingSource,
    handleUnlinkReadingSource,
  };
}
