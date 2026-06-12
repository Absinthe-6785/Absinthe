import type { NoteBase } from '../../../noteUtils';
import {
  addMonths,
  formatCalendarMonthLabel,
  parseDateKey,
  toDateKey,
} from '../databaseViews/parseDatabaseDate';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';
import {
  MAX_RANGE_DAYS,
  type RangeTraceProjection,
  type TraceRangeLens,
} from './rangeTraceModels';

export interface TraceMonthKey {
  year: number;
  month: number;
}

export interface TraceQuarterKey {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

function normalizeRangeDate(date: string): string {
  const trimmed = date.trim();
  if (!parseDateKey(trimmed)) {
    throw new Error(`Invalid trace date key: ${date}`);
  }
  const parsed = parseDateKey(trimmed)!;
  const normalized = new Date(parsed.year, parsed.month - 1, parsed.day);
  if (toDateKey(normalized) !== trimmed) {
    throw new Error(`Invalid trace date key: ${date}`);
  }
  return trimmed;
}

export function enumerateDateKeys(startDate: string, endDate: string): string[] {
  const start = normalizeRangeDate(startDate);
  const end = normalizeRangeDate(endDate);
  const startParts = parseDateKey(start)!;
  const endParts = parseDateKey(end)!;
  const startTime = new Date(startParts.year, startParts.month - 1, startParts.day).getTime();
  const endTime = new Date(endParts.year, endParts.month - 1, endParts.day).getTime();

  if (startTime > endTime) {
    throw new Error('Start date cannot be after end date');
  }

  const keys: string[] = [];
  const cursor = new Date(startParts.year, startParts.month - 1, startParts.day);
  const last = new Date(endParts.year, endParts.month - 1, endParts.day);

  while (cursor.getTime() <= last.getTime()) {
    keys.push(toDateKey(cursor));
    if (keys.length > MAX_RANGE_DAYS) {
      throw new Error(`Range exceeds maximum of ${MAX_RANGE_DAYS} days`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

/**
 * Reconstruct a date-range trace from daily projections.
 * Pure aggregation — no persistence, scoring, or interpretation.
 */
export function buildRangeTraceProjection(
  startDate: string,
  endDate: string,
  notes: readonly NoteBase[],
): RangeTraceProjection {
  const start = normalizeRangeDate(startDate);
  const end = normalizeRangeDate(endDate);
  const activeNotes = notes.filter(note => note.deletedAt == null);
  const milestoneByKey = new Map<string, RangeTraceProjection['milestones'][number]>();
  const eventByNoteId = new Map<string, RangeTraceProjection['events'][number]>();
  const touchedNoteIds = new Set<string>();
  const createdNoteIds = new Set<string>();

  for (const dateKey of enumerateDateKeys(start, end)) {
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
    startDate: start,
    endDate: end,
    milestones,
    events,
    notesTouched: touchedNoteIds.size,
    notesCreated: createdNoteIds.size,
  };
}

export function hasRangeTraceMarks(projection: RangeTraceProjection): boolean {
  return projection.milestones.length > 0
    || projection.events.length > 0
    || projection.notesTouched > 0;
}

export function rangeTraceMarkCount(projection: RangeTraceProjection): number {
  return projection.milestones.length + projection.events.length;
}

export function resolveRangeLensBounds(lens: TraceRangeLens): { startDate: string; endDate: string } {
  switch (lens.kind) {
    case 'month': {
      if (lens.month < 1 || lens.month > 12) {
        throw new Error(`Invalid month: ${lens.month}`);
      }
      const monthKey = toMonthKey(lens.year, lens.month);
      const days = daysInMonth(lens.year, lens.month);
      return {
        startDate: `${monthKey}-01`,
        endDate: `${monthKey}-${String(days).padStart(2, '0')}`,
      };
    }
    case 'quarter':
      return getQuarterBounds(lens.year, lens.quarter);
    case 'year':
      return getYearBounds(lens.year);
    case 'custom':
      return { startDate: lens.startDate, endDate: lens.endDate };
    default:
      throw new Error('Unsupported trace range lens');
  }
}

export function buildRangeLensProjection(
  lens: TraceRangeLens,
  notes: readonly NoteBase[],
): RangeTraceProjection {
  const bounds = resolveRangeLensBounds(lens);
  return buildRangeTraceProjection(bounds.startDate, bounds.endDate, notes);
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
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

export function buildMonthTraceProjection(
  year: number,
  month: number,
  notes: readonly NoteBase[],
): RangeTraceProjection {
  return buildRangeLensProjection({ kind: 'month', year, month }, notes);
}

export function getQuarterBounds(year: number, quarter: 1 | 2 | 3 | 4): {
  startDate: string;
  endDate: string;
} {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDay = daysInMonth(year, endMonth);
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

export function currentTraceQuarter(): TraceQuarterKey {
  const today = new Date();
  const quarter = (Math.floor(today.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return { year: today.getFullYear(), quarter };
}

export function shiftTraceQuarter(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  deltaQuarters: number,
): TraceQuarterKey {
  let index = year * 4 + (quarter - 1) + deltaQuarters;
  const nextYear = Math.floor(index / 4);
  const nextQuarter = ((index % 4) + 4) % 4 + 1;
  return { year: nextYear, quarter: nextQuarter as 1 | 2 | 3 | 4 };
}

export function formatTraceQuarterHeading(year: number, quarter: 1 | 2 | 3 | 4): string {
  return `Q${quarter} ${year}`;
}

export function buildQuarterTraceProjection(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  notes: readonly NoteBase[],
): RangeTraceProjection {
  return buildRangeLensProjection({ kind: 'quarter', year, quarter }, notes);
}

export function getYearBounds(year: number): { startDate: string; endDate: string } {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

export function currentTraceYear(): number {
  return new Date().getFullYear();
}

export function shiftTraceYear(year: number, deltaYears: number): number {
  return year + deltaYears;
}

export function formatTraceYearHeading(year: number): string {
  return String(year);
}

export function buildYearTraceProjection(
  year: number,
  notes: readonly NoteBase[],
): RangeTraceProjection {
  return buildRangeLensProjection({ kind: 'year', year }, notes);
}

export function formatRangeLensHeading(lens: TraceRangeLens): string {
  switch (lens.kind) {
    case 'month':
      return formatTraceMonthHeading(lens.year, lens.month);
    case 'quarter':
      return formatTraceQuarterHeading(lens.year, lens.quarter);
    case 'year':
      return formatTraceYearHeading(lens.year);
    case 'custom':
      if (lens.label?.trim()) return lens.label.trim();
      if (lens.startDate.trim() && lens.endDate.trim()) {
        return `${lens.startDate} – ${lens.endDate}`;
      }
      return 'Custom Range';
    default:
      return 'Range';
  }
}

export function formatCustomRangeEmptyMessage(): string {
  return 'No traces recorded for this period.';
}

export const hasMonthTraceMarks = hasRangeTraceMarks;
export const monthTraceMarkCount = rangeTraceMarkCount;
