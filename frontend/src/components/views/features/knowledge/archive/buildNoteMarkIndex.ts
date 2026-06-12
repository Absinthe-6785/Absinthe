import type { NoteBase } from '../../../noteUtils';
import { parseDateKey, toDateKey } from '../databaseViews/parseDatabaseDate';
import { collectNoteActivityDateKeys } from '../trace/buildDailyTraceProjection';
import { isEventNote, readEventFromNote } from '../trace/eventNotes';
import { isMilestoneNote, readMilestoneFromNote } from '../trace/milestoneNotes';
import {
  addMarkType,
  type ArchiveMarkIndex,
  isDateInRange,
} from './archiveMarkUtils';

function enumerateClippedDateKeys(
  startDate: string,
  endDate: string,
  clipStart: string,
  clipEnd: string,
): string[] {
  const effectiveStart = startDate > clipStart ? startDate : clipStart;
  const effectiveEnd = endDate < clipEnd ? endDate : clipEnd;
  if (effectiveStart > effectiveEnd) return [];

  const startParts = parseDateKey(effectiveStart);
  const endParts = parseDateKey(effectiveEnd);
  if (!startParts || !endParts) return [];

  const keys: string[] = [];
  const cursor = new Date(startParts.year, startParts.month - 1, startParts.day);
  const last = new Date(endParts.year, endParts.month - 1, endParts.day);

  while (cursor.getTime() <= last.getTime()) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function addNoteMarkDatesInRange(
  index: ArchiveMarkIndex,
  dateKeys: readonly string[],
  type: 'note-activity' | 'milestone' | 'event',
  startDate: string,
  endDate: string,
): void {
  for (const dateKey of dateKeys) {
    if (isDateInRange(dateKey, startDate, endDate)) {
      addMarkType(index, dateKey, type);
    }
  }
}

/**
 * Single-pass note scan for archive mark types within [startDate, endDate].
 * Preferred over per-day buildDailyTraceProjection for multi-year spans.
 */
export function buildNoteMarkIndex(
  notes: readonly NoteBase[],
  startDate: string,
  endDate: string,
): ArchiveMarkIndex {
  const index: ArchiveMarkIndex = new Map();
  const activeNotes = notes.filter(note => note.deletedAt == null);

  for (const note of activeNotes) {
    if (isMilestoneNote(note)) {
      const milestone = readMilestoneFromNote(note);
      if (milestone?.milestoneDate) {
        addNoteMarkDatesInRange(index, [milestone.milestoneDate], 'milestone', startDate, endDate);
      }
    }

    if (isEventNote(note)) {
      const event = readEventFromNote(note);
      if (event?.eventDate) {
        const eventEnd = event.eventEndDate ?? event.eventDate;
        const eventDates = enumerateClippedDateKeys(
          event.eventDate,
          eventEnd,
          startDate,
          endDate,
        );
        addNoteMarkDatesInRange(index, eventDates, 'event', startDate, endDate);
      }
    }

    addNoteMarkDatesInRange(
      index,
      collectNoteActivityDateKeys(note),
      'note-activity',
      startDate,
      endDate,
    );
  }

  return index;
}

/** Collect unique mark dates for a note within a window — used by area pills. */
export function collectNoteMarkDatesInWindow(
  note: NoteBase,
  startDate: string,
  endDate: string,
): Set<string> {
  const dates = new Set<string>();

  if (isMilestoneNote(note)) {
    const milestone = readMilestoneFromNote(note);
    if (milestone?.milestoneDate && isDateInRange(milestone.milestoneDate, startDate, endDate)) {
      dates.add(milestone.milestoneDate);
    }
  }

  if (isEventNote(note)) {
    const event = readEventFromNote(note);
    if (event?.eventDate) {
      const eventEnd = event.eventEndDate ?? event.eventDate;
      for (const dateKey of enumerateClippedDateKeys(event.eventDate, eventEnd, startDate, endDate)) {
        dates.add(dateKey);
      }
    }
  }

  for (const dateKey of collectNoteActivityDateKeys(note)) {
    if (isDateInRange(dateKey, startDate, endDate)) {
      dates.add(dateKey);
    }
  }

  return dates;
}
