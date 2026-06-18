import type { Note, NoteFolderBase } from './noteUtils';

export type NoteSortField = 'updated' | 'title' | 'created' | 'folder';
export type NoteSortDirection = 'asc' | 'desc';

export const DEFAULT_NOTE_SORT_FIELD: NoteSortField = 'updated';
export const DEFAULT_NOTE_SORT_DIRECTION: NoteSortDirection = 'desc';

const SORT_FIELDS: readonly NoteSortField[] = ['updated', 'title', 'created', 'folder'];
const SORT_DIRECTIONS: readonly NoteSortDirection[] = ['asc', 'desc'];

export function isNoteSortField(value: unknown): value is NoteSortField {
  return typeof value === 'string' && (SORT_FIELDS as readonly string[]).includes(value);
}

export function isNoteSortDirection(value: unknown): value is NoteSortDirection {
  return typeof value === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(value);
}

function noteCreatedTimestamp(note: Note): number {
  return Number((note.id ?? '').split('-')[1] || 0);
}

function folderNameForNote(note: Note, folders: readonly NoteFolderBase[]): string {
  if (!note.folderId) return '';
  return folders.find(f => f.id === note.folderId)?.name ?? '';
}

export interface SortNotesOptions {
  folders?: readonly NoteFolderBase[];
  starredFirst?: boolean;
}

/** Sort notes by field and direction. Returns a new array. */
export function sortNotes(
  list: readonly Note[],
  field: NoteSortField,
  direction: NoteSortDirection = DEFAULT_NOTE_SORT_DIRECTION,
  options: SortNotesOptions = {},
): Note[] {
  const sign = direction === 'asc' ? 1 : -1;
  const folders = options.folders ?? [];
  const starredFirst = options.starredFirst ?? false;

  return [...list].sort((a, b) => {
    if (starredFirst && Boolean(a.starred) !== Boolean(b.starred)) {
      return a.starred ? -1 : 1;
    }
    if (field === 'title') {
      return sign * (a.title ?? '').localeCompare(b.title ?? '');
    }
    if (field === 'created') {
      return sign * (noteCreatedTimestamp(a) - noteCreatedTimestamp(b));
    }
    if (field === 'folder') {
      return sign * folderNameForNote(a, folders).localeCompare(folderNameForNote(b, folders));
    }
    return sign * (a.updatedAt - b.updatedAt);
  });
}

export function toggleSortDirection(direction: NoteSortDirection): NoteSortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}
