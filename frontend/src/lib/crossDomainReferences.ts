/**
 * K-113 — Cross-domain note references (title match, no schema changes).
 */
import type { TabId } from '../components/common/Sidebar';
import { useNotesStore } from '../store/useNotesStore';
import { openNote, type OpenNoteOptions } from './noteNavigation';
import type { NoteBreadcrumbSegment } from './noteBreadcrumb';

export function findNoteByTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const notes = useNotesStore.getState().notes;
  const exact = notes.find(n => !n.deletedAt && n.title.trim() === trimmed);
  return exact?.id ?? null;
}

export function recipeCookingNoteTitle(recipeTitle: string): string {
  return recipeTitle.trim();
}

export interface OpenRelatedNoteOptions {
  noteId?: string;
  title?: string;
  returnTab: TabId;
  breadcrumb?: readonly NoteBreadcrumbSegment[];
}

/** Open a note by id or title match; returns false when no note resolves. */
export function openRelatedNote(options: OpenRelatedNoteOptions): boolean {
  const noteId = options.noteId ?? (options.title ? findNoteByTitle(options.title) : null);
  if (!noteId) return false;
  const openOpts: OpenNoteOptions = { returnTab: options.returnTab };
  if (options.breadcrumb?.length) openOpts.breadcrumb = options.breadcrumb;
  openNote(noteId, openOpts);
  return true;
}

export function openRecipeCookingNote(
  recipeTitle: string,
  createNote: () => string,
  updateNote: (id: string, patch: { title: string }) => void,
  breadcrumb?: readonly NoteBreadcrumbSegment[],
): boolean {
  const title = recipeCookingNoteTitle(recipeTitle);
  if (!title) return false;
  const existingId = findNoteByTitle(title);
  const noteId = existingId ?? (() => {
    const id = createNote();
    updateNote(id, { title });
    return id;
  })();
  openNote(noteId, {
    returnTab: 'recipe',
    breadcrumb: breadcrumb ?? [
      { type: 'key', key: 'recipe' },
      { type: 'key', key: 'k113OpenCookingNote' },
    ],
  });
  return true;
}
