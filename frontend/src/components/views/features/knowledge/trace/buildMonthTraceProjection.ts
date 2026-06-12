import { addMonths, formatCalendarMonthLabel } from '../databaseViews/parseDatabaseDate';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';
import type { MonthTraceProjection } from './monthTraceModels';

export interface TraceMonthKey {
  year: number;
  month: number;
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function currentTraceMonth(): TraceMonthKey {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export function shiftTraceMonth(
  year: number,
  month: number,
  deltaMonths: number,
): TraceMonthKey {
  const next = addMonths(year, month, deltaMonths);
  return { year: next.year, month: next.month };
}

export function formatTraceMonthHeading(year: number, month: number): string {
  return formatCalendarMonthLabel(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Reconstruct a calendar-month trace from daily projections.
 * Pure aggregation — no persistence, scoring, or interpretation.
 */
export function buildMonthTraceProjection(
  year: number,
  month: number,
  notes: readonly Parameters<typeof buildDailyTraceProjection>[1][number][],
): MonthTraceProjection {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }

  const monthKey = toMonthKey(year, month);
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const milestoneByKey = new Map<string, MonthTraceProjection['milestones'][number]>();
  const eventByNoteId = new Map<string, MonthTraceProjection['events'][number]>();
  const touchedNoteIds = new Set<string>();
  const createdNoteIds = new Set<string>();

  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const daily = buildDailyTraceProjection(dateKey, activeNotes);

    for (const milestone of daily.milestones) {
      milestoneByKey.set(`${milestone.noteId}:${milestone.date}`, milestone);
    }

    for (const event of daily.events) {
      eventByNoteId.set(event.noteId, { ...event, date: dateKey });
    }

    for (const activity of daily.activities) {
      touchedNoteIds.add(activity.noteId);
      if (activity.kind === 'created') {
        createdNoteIds.add(activity.noteId);
      }
    }
  }

  const milestones = [...milestoneByKey.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );

  const events = [...eventByNoteId.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  );

  return {
    month: monthKey,
    year,
    monthNumber: month,
    milestones,
    events,
    activityOverview: {
      notesTouched: touchedNoteIds.size,
      notesCreated: createdNoteIds.size,
    },
  };
}

export function hasMonthTraceMarks(projection: MonthTraceProjection): boolean {
  return projection.milestones.length > 0
    || projection.events.length > 0
    || projection.activityOverview.notesTouched > 0;
}

export function monthTraceMarkCount(projection: MonthTraceProjection): number {
  return projection.milestones.length + projection.events.length;
}
