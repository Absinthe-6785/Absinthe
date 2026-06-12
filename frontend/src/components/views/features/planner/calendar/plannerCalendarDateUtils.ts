import { parseDateKey, toDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';

export const PLANNER_AGENDA_HORIZON_DAYS = 14;
export const PLANNER_MONTH_GRID_ROWS = 6;
export const PLANNER_MONTH_GRID_COLS = 7;

export function isDateInRange(dateKey: string, startDate: string, endDate: string): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

export function addDays(dateKey: string, delta: number): string | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

export function isoWeekdayFromDateKey(dateKey: string): number | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return (date.getDay() + 6) % 7;
}

export function enumerateDateKeys(startDate: string, endDate: string, maxDays = 366): string[] {
  const startParts = parseDateKey(startDate);
  const endParts = parseDateKey(endDate);
  if (!startParts || !endParts) return [];
  if (startDate > endDate) return [];

  const keys: string[] = [];
  const cursor = new Date(startParts.year, startParts.month - 1, startParts.day);
  const last = new Date(endParts.year, endParts.month - 1, endParts.day);

  while (cursor.getTime() <= last.getTime()) {
    keys.push(toDateKey(cursor));
    if (keys.length > maxDays) return keys.slice(0, maxDays);
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function enumerateClippedDateKeys(
  startDate: string,
  endDate: string,
  clipStart: string,
  clipEnd: string,
): string[] {
  const effectiveStart = startDate > clipStart ? startDate : clipStart;
  const effectiveEnd = endDate < clipEnd ? endDate : clipEnd;
  if (effectiveStart > effectiveEnd) return [];
  return enumerateDateKeys(effectiveStart, effectiveEnd);
}

export function isoWeekBounds(anchorDate: string): { startDate: string; endDate: string } | null {
  const weekday = isoWeekdayFromDateKey(anchorDate);
  if (weekday == null) return null;
  const startDate = addDays(anchorDate, -weekday);
  const endDate = startDate ? addDays(startDate, 6) : null;
  if (!startDate || !endDate) return null;
  return { startDate, endDate };
}

export interface MonthGridBounds {
  startDate: string;
  endDate: string;
  year: number;
  month: number;
}

export function monthGridBounds(anchorDate: string): MonthGridBounds | null {
  const parts = parseDateKey(anchorDate);
  if (!parts) return null;

  const { year, month, day: _day } = parts;
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const leading = isoWeekdayFromDateKey(firstOfMonth);
  if (leading == null) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  const gridStart = addDays(firstOfMonth, -leading);
  if (!gridStart) return null;

  const totalCells = PLANNER_MONTH_GRID_ROWS * PLANNER_MONTH_GRID_COLS;
  const gridEnd = addDays(gridStart, totalCells - 1);
  if (!gridEnd) return null;

  return { startDate: gridStart, endDate: gridEnd, year, month };
}

export interface PlannerCalendarRange {
  startDate: string;
  endDate: string;
  month?: { year: number; month: number };
}

export function resolvePlannerCalendarRange(
  viewMode: 'month' | 'week' | 'day' | 'agenda',
  anchorDate: string,
): PlannerCalendarRange | null {
  if (!parseDateKey(anchorDate)) return null;

  switch (viewMode) {
    case 'month': {
      const bounds = monthGridBounds(anchorDate);
      if (!bounds) return null;
      return {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        month: { year: bounds.year, month: bounds.month },
      };
    }
    case 'week': {
      const week = isoWeekBounds(anchorDate);
      return week ?? null;
    }
    case 'day':
      return { startDate: anchorDate, endDate: anchorDate };
    case 'agenda': {
      const endDate = addDays(anchorDate, PLANNER_AGENDA_HORIZON_DAYS - 1);
      if (!endDate) return null;
      return { startDate: anchorDate, endDate };
    }
    default:
      return null;
  }
}

export function resolvePlannerIndexRange(anchorDate: string): PlannerCalendarRange | null {
  const candidates = [
    resolvePlannerCalendarRange('month', anchorDate),
    resolvePlannerCalendarRange('week', anchorDate),
    resolvePlannerCalendarRange('day', anchorDate),
    resolvePlannerCalendarRange('agenda', anchorDate),
  ].filter((range): range is PlannerCalendarRange => range != null);

  if (candidates.length === 0) return null;

  let startDate = candidates[0].startDate;
  let endDate = candidates[0].endDate;
  for (const candidate of candidates.slice(1)) {
    if (candidate.startDate < startDate) startDate = candidate.startDate;
    if (candidate.endDate > endDate) endDate = candidate.endDate;
  }

  return { startDate, endDate };
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function daysBetween(fromDateKey: string, toDateKeyValue: string): number | null {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKeyValue);
  if (!from || !to) return null;
  const fromMs = new Date(from.year, from.month - 1, from.day).getTime();
  const toMs = new Date(to.year, to.month - 1, to.day).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}
