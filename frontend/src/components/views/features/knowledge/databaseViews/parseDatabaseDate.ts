/**
 * Database date parsing policy (K-11).
 *
 * - ISO date-only (YYYY-MM-DD) → local calendar date, no timezone shift
 * - ISO datetime (YYYY-MM-DDTHH:mm:ssZ) → instant parsed → local calendar day
 * - Numeric strings → millisecond timestamps
 * - Other strings → Date.parse fallback
 * - Invalid / empty → null (caller buckets as "No Date")
 */

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T/;

export function parseDatabaseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = ISO_DATE_ONLY.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  if (ISO_DATE_TIME.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  if (/^\d+$/.test(trimmed)) {
    const timestamp = Number(trimmed);
    if (timestamp > 0 && timestamp < 1e15) {
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

/** Stable YYYY-MM-DD key in local timezone */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateKeyFromTimestamp(timestamp: number): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : toDateKey(date);
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_ONLY.exec(dateKey);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function formatCalendarDayLabel(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) return dateKey;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatCalendarMonthLabel(year: number, month: number, locale?: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

export interface CalendarMonthCell {
  dateKey: string;
  day: number;
  inMonth: boolean;
}

/** Build a 6-row month grid starting on Sunday */
export function buildCalendarMonthGrid(year: number, month: number): CalendarMonthCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month - 1, 1 - startOffset);
  const cells: CalendarMonthCell[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      dateKey: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    });
  }

  return cells;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function notesForMonth(
  buckets: ReadonlyMap<string, readonly { id: string }[]>,
  year: number,
  month: number,
): Map<string, readonly { id: string }[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const result = new Map<string, readonly { id: string }[]>();
  for (const [dateKey, notes] of buckets.entries()) {
    if (dateKey.startsWith(prefix)) {
      result.set(dateKey, notes);
    }
  }
  return result;
}
