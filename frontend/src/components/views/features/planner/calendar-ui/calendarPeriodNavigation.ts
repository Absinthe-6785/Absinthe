import type { PlannerCalendarViewMode } from '../calendar';
import { addDays, isoWeekBounds } from '../calendar/plannerCalendarDateUtils';
import { parseDateKey, toDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';

export type CalendarPeriodDirection = -1 | 1;

/**
 * Shift the planner anchor date by one period for the active calendar mode.
 * Month → ±1 calendar month (day 1); week → ±7 days; day → ±1 day.
 */
export function shiftPlannerAnchorDate(
  viewMode: PlannerCalendarViewMode,
  anchorDate: string,
  direction: CalendarPeriodDirection,
): string | null {
  if (!parseDateKey(anchorDate)) return null;

  switch (viewMode) {
    case 'day':
      return addDays(anchorDate, direction);
    case 'week':
      return addDays(anchorDate, direction * 7);
    case 'month': {
      const parts = parseDateKey(anchorDate);
      if (!parts) return null;
      const cursor = new Date(parts.year, parts.month - 1 + direction, 1);
      return toDateKey(cursor);
    }
    default:
      return null;
  }
}

/** First date of the ISO week containing anchorDate — used when jumping to "today" in week mode. */
export function weekStartForAnchor(anchorDate: string): string | null {
  return isoWeekBounds(anchorDate)?.startDate ?? null;
}
