import type { NoteBase } from '../../../noteUtils';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import { EVENT_TYPE_VALUE, TRACE_PROPERTY_KEYS } from './dailyTraceModels';

export const AREA_TYPE_VALUE = 'area';

export function isAreaNote(note: NoteBase): boolean {
  return getProperty(note, TRACE_PROPERTY_KEYS.TYPE)?.trim().toLowerCase() === AREA_TYPE_VALUE;
}

export function applyAreaToNote(note: NoteBase): NoteBase {
  return setProperty(note, TRACE_PROPERTY_KEYS.TYPE, AREA_TYPE_VALUE);
}

export function clearAreaFromNote(note: NoteBase): NoteBase {
  const currentType = getProperty(note, TRACE_PROPERTY_KEYS.TYPE)?.trim().toLowerCase();
  if (currentType !== AREA_TYPE_VALUE) return note;
  return removeProperty(note, TRACE_PROPERTY_KEYS.TYPE);
}

export function listAreaNotes(notes: readonly NoteBase[]): NoteBase[] {
  return notes
    .filter(note => note.deletedAt == null && isAreaNote(note))
    .sort((a, b) =>
      (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }),
    );
}

/** Area notes cannot simultaneously be event notes */
export function canMarkAsArea(note: NoteBase): boolean {
  if (note.deletedAt != null) return false;
  if (isAreaNote(note)) return true;
  const type = getProperty(note, TRACE_PROPERTY_KEYS.TYPE)?.trim().toLowerCase();
  return !type || type === AREA_TYPE_VALUE;
}
