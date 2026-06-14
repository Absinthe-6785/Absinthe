import type { NoteBase } from '../../../noteUtils';
import type { TimelinePeriodBucket, TimelinePeriodMode } from './timelineTypes';
import { noteEffectiveCreatedAt } from './timelineMetrics';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfMonth(year: number, month: number): number {
  return Date.UTC(year, month, 1);
}

function endOfMonth(year: number, month: number): number {
  return Date.UTC(year, month + 1, 0, 23, 59, 59, 999);
}

function quarterLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`;
}

function quarterEndMs(year: number, quarter: number): number {
  const month = quarter * 3;
  return endOfMonth(year, month - 1);
}

export function earliestNoteTime(notes: readonly NoteBase[]): number | null {
  const active = notes.filter(n => !n.deletedAt);
  if (active.length === 0) return null;
  return Math.min(...active.map(noteEffectiveCreatedAt));
}

export function buildPeriodBuckets(
  notes: readonly NoteBase[],
  mode: TimelinePeriodMode,
  now: number,
): TimelinePeriodBucket[] {
  const earliest = earliestNoteTime(notes);
  if (earliest == null) return [];

  if (mode === 'all') {
    return [{
      id: 'all',
      label: 'All time',
      startMs: earliest,
      endMs: now,
    }];
  }

  const startDate = new Date(earliest);
  const endDate = new Date(now);
  const buckets: TimelinePeriodBucket[] = [];

  if (mode === 'month') {
    let year = startDate.getUTCFullYear();
    let month = startDate.getUTCMonth();
    const endYear = endDate.getUTCFullYear();
    const endMonth = endDate.getUTCMonth();

    while (year < endYear || (year === endYear && month <= endMonth)) {
      const startMs = startOfMonth(year, month);
      const endMs = endOfMonth(year, month);
      buckets.push({
        id: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: MONTH_NAMES[month],
        startMs,
        endMs: Math.min(endMs, now),
      });
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    return buckets;
  }

  let year = startDate.getUTCFullYear();
  let quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;
  const endYear = endDate.getUTCFullYear();
  const endQuarter = Math.floor(endDate.getUTCMonth() / 3) + 1;

  while (year < endYear || (year === endYear && quarter <= endQuarter)) {
    const startMs = Date.UTC(year, (quarter - 1) * 3, 1);
    const endMs = Math.min(quarterEndMs(year, quarter), now);
    buckets.push({
      id: `${year}-Q${quarter}`,
      label: quarterLabel(year, quarter),
      startMs,
      endMs,
    });
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
  }

  return buckets;
}

/** Downsample long month/quarter lists for UI readability. */
export function trimSnapshotsForDisplay<T>(items: readonly T[], max = 8): T[] {
  if (items.length <= max) return [...items];
  const step = Math.ceil(items.length / max);
  const result: T[] = [];
  for (let i = 0; i < items.length; i += step) {
    result.push(items[i]);
  }
  const last = items[items.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}
