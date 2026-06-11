import type { NoteBase } from '../../../noteUtils';
import { getProperty, removeProperty, setProperty } from '../properties/noteProperties';
import { parseDatabaseDate, toDateKey } from '../databaseViews/parseDatabaseDate';
import { EVENT_TYPE_VALUE, TRACE_PROPERTY_KEYS } from './dailyTraceModels';

export interface EventFormValues {
  title: string;
  eventDate: string;
  eventTime?: string;
  eventEndDate?: string;
  eventEndTime?: string;
}

const EVENT_PROPERTY_KEYS = [
  TRACE_PROPERTY_KEYS.TYPE,
  TRACE_PROPERTY_KEYS.EVENT_DATE,
  TRACE_PROPERTY_KEYS.EVENT_TIME,
  TRACE_PROPERTY_KEYS.EVENT_END_DATE,
  TRACE_PROPERTY_KEYS.EVENT_END_TIME,
] as const;

export function isEventNote(note: NoteBase): boolean {
  return getProperty(note, TRACE_PROPERTY_KEYS.TYPE)?.trim().toLowerCase() === EVENT_TYPE_VALUE;
}

function normalizeOptionalTime(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = parseDatabaseDate(trimmed);
  return parsed ? toDateKey(parsed) : undefined;
}

export function validateEventForm(values: EventFormValues): string | null {
  const title = values.title.trim();
  if (!title) return 'Title is required';

  const eventDate = normalizeOptionalDate(values.eventDate);
  if (!eventDate) return 'Date is required';

  const eventTime = normalizeOptionalTime(values.eventTime);
  if (eventTime && !/^\d{2}:\d{2}$/.test(eventTime)) {
    return 'Time must use HH:mm format';
  }

  const eventEndDate = normalizeOptionalDate(values.eventEndDate);
  const eventEndTime = normalizeOptionalTime(values.eventEndTime);

  if (eventEndTime && !eventEndDate) {
    return 'End date is required when end time is set';
  }

  if (eventEndDate) {
    const start = parseDatabaseDate(eventDate);
    const end = parseDatabaseDate(eventEndDate);
    if (!end) return 'End date is invalid';
    if (start && end.getTime() < start.getTime()) {
      return 'End date cannot be before start date';
    }
  }

  if (eventEndTime && !/^\d{2}:\d{2}$/.test(eventEndTime)) {
    return 'End time must use HH:mm format';
  }

  return null;
}

export function readEventFromNote(note: NoteBase): EventFormValues | null {
  if (!isEventNote(note)) return null;

  const rawDate = getProperty(note, TRACE_PROPERTY_KEYS.EVENT_DATE)?.trim();
  const eventDate = rawDate ? normalizeOptionalDate(rawDate) : undefined;
  if (!eventDate) return null;

  return {
    title: note.title.trim() || 'Untitled',
    eventDate,
    eventTime: normalizeOptionalTime(getProperty(note, TRACE_PROPERTY_KEYS.EVENT_TIME)),
    eventEndDate: normalizeOptionalDate(getProperty(note, TRACE_PROPERTY_KEYS.EVENT_END_DATE)),
    eventEndTime: normalizeOptionalTime(getProperty(note, TRACE_PROPERTY_KEYS.EVENT_END_TIME)),
  };
}

function setOptionalProperty(
  note: NoteBase,
  key: string,
  value: string | undefined,
): NoteBase {
  if (value) return setProperty(note, key, value);
  return removeProperty(note, key);
}

export function applyEventToNote(note: NoteBase, values: EventFormValues): NoteBase {
  const error = validateEventForm(values);
  if (error) throw new Error(error);

  const eventDate = normalizeOptionalDate(values.eventDate)!;
  const eventTime = normalizeOptionalTime(values.eventTime);
  const eventEndDate = normalizeOptionalDate(values.eventEndDate);
  const eventEndTime = normalizeOptionalTime(values.eventEndTime);

  let result: NoteBase = {
    ...note,
    title: values.title.trim() || 'Untitled',
  };

  result = setProperty(result, TRACE_PROPERTY_KEYS.TYPE, EVENT_TYPE_VALUE);
  result = setProperty(result, TRACE_PROPERTY_KEYS.EVENT_DATE, eventDate);
  result = setOptionalProperty(result, TRACE_PROPERTY_KEYS.EVENT_TIME, eventTime);
  result = setOptionalProperty(result, TRACE_PROPERTY_KEYS.EVENT_END_DATE, eventEndDate);
  result = setOptionalProperty(result, TRACE_PROPERTY_KEYS.EVENT_END_TIME, eventEndTime);

  return result;
}

export function clearEventFromNote(note: NoteBase): NoteBase {
  let result = note;
  for (const key of EVENT_PROPERTY_KEYS) {
    result = removeProperty(result, key);
  }
  return result;
}

export function eventFormValuesFromNote(note: NoteBase, defaultDate: string): EventFormValues {
  return readEventFromNote(note) ?? {
    title: note.title.trim() || 'Untitled',
    eventDate: defaultDate,
  };
}
