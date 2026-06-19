/** K-111 — Note-domain search navigation handlers registered from NoteView. */
import type { SmartCollectionId } from '../knowledge/collections/smartCollectionModels';

export interface SearchNoteHandlers {
  onSelectNote: (noteId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectCollection: (collectionId: SmartCollectionId | string) => void;
  onSelectLearningPath: (pathId: string) => void;
}

let noteHandlers: SearchNoteHandlers | null = null;

export function registerSearchNoteHandlers(handlers: SearchNoteHandlers): () => void {
  noteHandlers = handlers;
  return () => {
    if (noteHandlers === handlers) noteHandlers = null;
  };
}

export function getSearchNoteHandlers(): SearchNoteHandlers | null {
  return noteHandlers;
}

export function peekSearchNoteHandlers(): SearchNoteHandlers | null {
  return noteHandlers;
}
