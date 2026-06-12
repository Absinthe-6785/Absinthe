import type { NoteBase } from '../../../noteUtils';
import { parseDateKey, toDateKey } from '../databaseViews/parseDatabaseDate';
import type { DailyTraceProjection } from './dailyTraceModels';

/** Shift a YYYY-MM-DD key by calendar days (local timezone). */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(parts.year, parts.month - 1, parts.day + deltaDays);
  return toDateKey(date);
}

/** K-19 optional daily anchor — note titled exactly YYYY-MM-DD. */
export function findDailyAnchorNote(
  notes: readonly NoteBase[],
  dateKey: string,
): NoteBase | undefined {
  return notes.find(n => n.deletedAt == null && n.title.trim() === dateKey);
}

export function formatTraceDayHeading(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function hasDailyTraceMarks(
  projection: DailyTraceProjection,
  dailyAnchor?: NoteBase,
): boolean {
  return projection.milestones.length > 0
    || projection.events.length > 0
    || projection.activities.length > 0
    || Boolean(dailyAnchor);
}
