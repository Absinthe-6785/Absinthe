import { toDateKey } from '../databaseViews/parseDatabaseDate';
import { isoWeekBounds } from '../../planner/calendar/plannerCalendarDateUtils';
import type { ArchiveHistoryBucket, ArchiveTimelineBucket } from './archiveProjectionModels';

const MS_PER_DAY = 86_400_000;

function startOfDayMs(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getTime();
}

function calendarDayDiff(fromKey: string, toKey: string): number {
  return Math.round((startOfDayMs(toKey) - startOfDayMs(fromKey)) / MS_PER_DAY);
}

export function todayDateKey(now: Date): string {
  return toDateKey(now);
}

export function classifyHistoryBucket(timestamp: number, todayKey: string): ArchiveHistoryBucket {
  const valueKey = toDateKey(new Date(timestamp));
  const diff = calendarDayDiff(valueKey, todayKey);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return 'earlier';
}

export function classifyTimelineBucket(
  dateKey: string,
  todayKey: string,
): ArchiveTimelineBucket {
  if (dateKey === todayKey) return 'today';
  const week = isoWeekBounds(todayKey);
  if (week && dateKey >= week.startDate && dateKey <= week.endDate) return 'thisWeek';
  const todayParts = todayKey.split('-').map(Number);
  const [y, m] = todayParts;
  const monthPrefix = `${y}-${String(m).padStart(2, '0')}-`;
  if (dateKey.startsWith(monthPrefix)) return 'thisMonth';
  return 'earlier';
}

export const ARCHIVE_HISTORY_BUCKETS: readonly ArchiveHistoryBucket[] = [
  'today',
  'yesterday',
  'earlier',
];

export const ARCHIVE_TIMELINE_BUCKETS: readonly ArchiveTimelineBucket[] = [
  'today',
  'thisWeek',
  'thisMonth',
  'earlier',
];
