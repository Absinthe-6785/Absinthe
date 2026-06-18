import type { Note } from './noteUtils';
import { buildDailyTraceProjection, buildRangeLensProjection } from './features/knowledge';
import { toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';
import { isoWeekBounds } from './features/planner/calendar/plannerCalendarDateUtils';

function uniqueTraceNoteCount(dateKey: string, notes: readonly Note[]): number {
  const projection = buildDailyTraceProjection(dateKey, notes);
  return new Set(projection.activities.map(a => a.noteId)).size;
}

export function countTraceDay(notes: readonly Note[], dateKey: string): number {
  return uniqueTraceNoteCount(dateKey, notes);
}

export function countTraceYesterday(notes: readonly Note[], todayKey: string): number {
  const d = new Date(`${todayKey}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return uniqueTraceNoteCount(toDateKey(d), notes);
}

export function countTraceWeek(notes: readonly Note[], anchorDateKey: string): number {
  const bounds = isoWeekBounds(anchorDateKey);
  if (!bounds) return 0;
  try {
    return buildRangeLensProjection(
      { kind: 'custom', startDate: bounds.startDate, endDate: bounds.endDate },
      notes,
    ).notesTouched;
  } catch {
    return 0;
  }
}

export function countTraceMonth(
  notes: readonly Note[],
  year: number,
  month: number,
): number {
  try {
    return buildRangeLensProjection({ kind: 'month', year, month }, notes).notesTouched;
  } catch {
    return 0;
  }
}
