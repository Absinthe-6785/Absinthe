import type { NoteSortDirection, NoteSortField } from './noteListSort';
import {
  DEFAULT_NOTE_SORT_DIRECTION,
  DEFAULT_NOTE_SORT_FIELD,
  isNoteSortDirection,
  isNoteSortField,
} from './noteListSort';

export const NOTE_SORT_STORAGE_KEY = 'absinthe-note-sort';

export interface NoteSortPrefs {
  field: NoteSortField;
  direction: NoteSortDirection;
  starredFirst: boolean;
}

export const DEFAULT_NOTE_SORT_PREFS: NoteSortPrefs = {
  field: DEFAULT_NOTE_SORT_FIELD,
  direction: DEFAULT_NOTE_SORT_DIRECTION,
  starredFirst: false,
};

export function readNoteSortPrefs(): NoteSortPrefs {
  try {
    const raw = localStorage.getItem(NOTE_SORT_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTE_SORT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NoteSortPrefs>;
    return {
      field: isNoteSortField(parsed.field) ? parsed.field : DEFAULT_NOTE_SORT_FIELD,
      direction: isNoteSortDirection(parsed.direction) ? parsed.direction : DEFAULT_NOTE_SORT_DIRECTION,
      starredFirst: Boolean(parsed.starredFirst),
    };
  } catch {
    return DEFAULT_NOTE_SORT_PREFS;
  }
}

export function writeNoteSortPrefs(prefs: NoteSortPrefs): void {
  try {
    localStorage.setItem(NOTE_SORT_STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
