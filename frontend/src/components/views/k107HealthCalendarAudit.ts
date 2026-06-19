/**
 * K-107 — Calendar memoization audit.
 */
import { buildMonthCellDecorations } from './features/health/WorkoutMonthCalendar';
import { buildCalendarDays } from '@/lib/calendarUtils';

export function auditCalendarMonthKeyMemo(): { monthKey: string; cellCount: number } {
  const year = 2026;
  const month = 5;
  const calendarDays = buildCalendarDays(year, month);
  const mobileDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const dates = new Set(['2026-06-01', '2026-06-15']);
  const { monthKey, desktop, mobile } = buildMonthCellDecorations(year, month, calendarDays, mobileDays, dates);
  return { monthKey, cellCount: desktop.size + mobile.size };
}

export function auditCalendarHooks(): readonly string[] {
  return ['data-k107-calendar-month-key', 'buildMonthCellDecorations'];
}
