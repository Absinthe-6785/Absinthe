import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { getProperty } from '../properties/noteProperties';
import { dateKeyFromTimestamp, parseDateKey, parseDatabaseDate, toDateKey } from '../databaseViews/parseDatabaseDate';
import {
  TRACE_PROPERTY_KEYS,
  type DailyTraceProjection,
  type TraceActivity,
  type TraceActivityKind,
  type TraceEventRef,
  type TraceMilestoneRef,
} from './dailyTraceModels';
import { isEventNote } from './eventNotes';

type NoteWithCreatedAt = NoteBase & { createdAt?: number };

function normalizeTraceDateKey(date: string): string {
  const trimmed = date.trim();
  if (!parseDateKey(trimmed)) {
    throw new Error(`Invalid trace date key: ${date}`);
  }
  const parsed = parseDatabaseDate(trimmed);
  if (!parsed || toDateKey(parsed) !== trimmed) {
    throw new Error(`Invalid trace date key: ${date}`);
  }
  return trimmed;
}

function isActiveNote(note: NoteBase): boolean {
  return note.deletedAt == null;
}

function propertyDateKey(note: NoteBase, key: string): string | null {
  const raw = getProperty(note, key);
  if (!raw) return null;
  const parsed = parseDatabaseDate(raw);
  return parsed ? toDateKey(parsed) : null;
}

function formatLocalTime(timestamp: number): string | undefined {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getCreatedAt(note: NoteBase): number | undefined {
  const createdAt = (note as NoteWithCreatedAt).createdAt;
  return typeof createdAt === 'number' && createdAt > 0 ? createdAt : undefined;
}

/**
 * Calendar days on which this note contributes note-activity marks.
 * Mirrors resolveActivityKind rules without scanning day-by-day.
 */
export function collectNoteActivityDateKeys(note: NoteBase): readonly string[] {
  const traceDate = propertyDateKey(note, TRACE_PROPERTY_KEYS.TRACE_DATE);
  if (traceDate) return [traceDate];

  const keys: string[] = [];
  const createdAt = getCreatedAt(note);
  const createdDay = createdAt ? dateKeyFromTimestamp(createdAt) : null;
  const updatedDay = dateKeyFromTimestamp(note.updatedAt);

  if (createdDay) keys.push(createdDay);
  if (updatedDay && updatedDay !== createdDay) keys.push(updatedDay);

  return keys;
}

function resolveActivityKind(note: NoteBase, dateKey: string): TraceActivityKind | null {
  const traceDate = propertyDateKey(note, TRACE_PROPERTY_KEYS.TRACE_DATE);
  if (traceDate) {
    return traceDate === dateKey ? 'edited' : null;
  }

  const createdAt = getCreatedAt(note);
  const createdDay = createdAt ? dateKeyFromTimestamp(createdAt) : null;
  const updatedDay = dateKeyFromTimestamp(note.updatedAt);

  if (createdDay === dateKey) {
    return 'created';
  }
  if (updatedDay === dateKey) {
    return 'edited';
  }
  return null;
}

function resolveActivityTimestamp(note: NoteBase, kind: TraceActivityKind): number | undefined {
  if (kind === 'created') {
    return getCreatedAt(note) ?? note.updatedAt;
  }
  return note.updatedAt;
}

function buildActivity(note: NoteBase, dateKey: string): TraceActivity | null {
  const kind = resolveActivityKind(note, dateKey);
  if (!kind) return null;

  const timestamp = resolveActivityTimestamp(note, kind);
  const at = timestamp ? formatLocalTime(timestamp) : undefined;

  return {
    noteId: note.id,
    title: displayNoteTitle(note.title),
    kind,
    ...(at ? { at } : {}),
  };
}

function buildEventRef(note: NoteBase): TraceEventRef | null {
  const eventDate = propertyDateKey(note, TRACE_PROPERTY_KEYS.EVENT_DATE);
  if (!eventDate) return null;

  const eventTime = getProperty(note, TRACE_PROPERTY_KEYS.EVENT_TIME)?.trim();
  const endDate = propertyDateKey(note, TRACE_PROPERTY_KEYS.EVENT_END_DATE) ?? undefined;

  return {
    noteId: note.id,
    title: displayNoteTitle(note.title),
    ...(eventTime ? { time: eventTime } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

function buildMilestoneRef(note: NoteBase, dateKey: string): TraceMilestoneRef | null {
  const milestoneDate = propertyDateKey(note, TRACE_PROPERTY_KEYS.MILESTONE_DATE);
  if (!milestoneDate || milestoneDate !== dateKey) return null;

  const kind = getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_KIND)?.trim() ?? '';
  const labelOverride = getProperty(note, TRACE_PROPERTY_KEYS.MILESTONE_LABEL)?.trim();
  const label = labelOverride || displayNoteTitle(note.title);

  return {
    noteId: note.id,
    label,
    kind,
    date: milestoneDate,
  };
}

function compareByTitle<T extends { title?: string; label?: string }>(a: T, b: T): number {
  const aText = ('title' in a && a.title) ? a.title : ('label' in a && a.label) ? a.label : '';
  const bText = ('title' in b && b.title) ? b.title : ('label' in b && b.label) ? b.label : '';
  return aText.localeCompare(bText, undefined, { sensitivity: 'base' });
}

function compareEvents(a: TraceEventRef, b: TraceEventRef): number {
  if (a.time && b.time && a.time !== b.time) {
    return a.time.localeCompare(b.time);
  }
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return compareByTitle(a, b);
}

function compareActivities(a: TraceActivity, b: TraceActivity): number {
  if (a.at && b.at && a.at !== b.at) {
    return b.at.localeCompare(a.at);
  }
  if (a.at && !b.at) return -1;
  if (!a.at && b.at) return 1;
  return compareByTitle(a, b);
}

/**
 * Reconstruct a calendar-day trace from notes and K-28 property conventions.
 * Pure projection — no persistence, CRUD, or scoring.
 */
export function buildDailyTraceProjection(
  date: string,
  notes: readonly NoteBase[],
): DailyTraceProjection {
  const dateKey = normalizeTraceDateKey(date);
  const activeNotes = notes.filter(isActiveNote);

  const events: TraceEventRef[] = [];
  const milestones: TraceMilestoneRef[] = [];
  const activities: TraceActivity[] = [];

  for (const note of activeNotes) {
    if (isEventNote(note)) {
      const eventDate = propertyDateKey(note, TRACE_PROPERTY_KEYS.EVENT_DATE);
      if (eventDate === dateKey) {
        const eventRef = buildEventRef(note);
        if (eventRef) events.push(eventRef);
      }
    }

    const milestoneRef = buildMilestoneRef(note, dateKey);
    if (milestoneRef) milestones.push(milestoneRef);

    const activity = buildActivity(note, dateKey);
    if (activity) activities.push(activity);
  }

  milestones.sort((a, b) => compareByTitle(
    { label: a.label },
    { label: b.label },
  ));
  events.sort(compareEvents);
  activities.sort(compareActivities);

  return {
    date: dateKey,
    milestones,
    events,
    activities,
  };
}
