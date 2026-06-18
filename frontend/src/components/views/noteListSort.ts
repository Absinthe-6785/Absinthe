import type { Note } from './noteUtils';

export type NoteSortField = 'updated' | 'title' | 'created';
export type NoteSortDirection = 'asc' | 'desc';

export const DEFAULT_NOTE_SORT_FIELD: NoteSortField = 'updated';
export const DEFAULT_NOTE_SORT_DIRECTION: NoteSortDirection = 'desc';

function noteCreatedTimestamp(note: Note): number {
  return Number((note.id ?? '').split('-')[1] || 0);
}

/** Sort notes by field and direction. Returns a new array. */
export function sortNotes(
  list: readonly Note[],
  field: NoteSortField,
  direction: NoteSortDirection = DEFAULT_NOTE_SORT_DIRECTION,
): Note[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (field === 'title') {
      return sign * (a.title ?? '').localeCompare(b.title ?? '');
    }
    if (field === 'created') {
      return sign * (noteCreatedTimestamp(a) - noteCreatedTimestamp(b));
    }
    return sign * (a.updatedAt - b.updatedAt);
  });
}

export function toggleSortDirection(direction: NoteSortDirection): NoteSortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}
