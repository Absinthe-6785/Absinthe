import { observePublishedNotesHydration, useNotesStore } from '../../store/useNotesStore';
import type { IdWikiLink, WikiNoteTarget } from './wikiLinks';

/** Read-only capture of the authority owner's opaque request. */
export function captureWikiPublication() {
  const observation = observePublishedNotesHydration();
  const request = observation.status === 'CURRENT' ? observation.request : null;
  const isCurrent = () => {
    const current = observePublishedNotesHydration();
    return request !== null && current.status === 'CURRENT' && current.request === request;
  };
  const resolve = (link: IdWikiLink) => isCurrent()
    ? useNotesStore.getState().notes.find(note => note.id === link.noteId && !note.deletedAt)
    : undefined;
  const targets: WikiNoteTarget[] = isCurrent()
    ? useNotesStore.getState().notes.filter(note => !note.deletedAt).map(note => ({
      id: note.id, title: note.title ?? '',
      isCurrent: () => isCurrent() && useNotesStore.getState().notes.some(current => current.id === note.id && !current.deletedAt),
    })) : [];
  return { isCurrent, resolve, targets };
}
