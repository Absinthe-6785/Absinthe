import type { Schedule } from '../types';

export const SCHEDULE_RANGE_PAGE_SIZE = 100;
export const SCHEDULE_RANGE_MAX_PAGES = 50;

export type DatedSchedule = Schedule & Readonly<{ date: string }>;

export interface ScheduleDateRange {
  startDate: string;
  endDate: string;
}

interface ScheduleRangePage {
  protocol_version: 1;
  start_date: string;
  end_date: string;
  page_size: number;
  order_by: 'id_ascending';
  items: unknown[];
  remaining_count: number;
  complete: boolean;
  next_cursor: string | null;
  completion_evidence: 'exact_count_equals_returned_items' | 'exact_count_exceeds_returned_items';
  snapshot_consistency: 'per_request_not_cross_page_snapshot';
}

function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
    ? { year, month, day }
    : null;
}

export function getScheduleMonthRange(anchorDate: string): ScheduleDateRange | null {
  const parsed = parseDateKey(anchorDate);
  if (!parsed) return null;
  const lastDay = [31, parsed.year % 4 === 0 && (parsed.year % 100 !== 0 || parsed.year % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][parsed.month - 1]!;
  const prefix = `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}`;
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${String(lastDay).padStart(2, '0')}` };
}

export function buildScheduleRangePageUrl(
  apiUrl: string,
  range: ScheduleDateRange,
  cursor?: string | null,
): string {
  const url = new URL('/api/schedules/range', apiUrl);
  url.searchParams.set('start_date', range.startDate);
  url.searchParams.set('end_date', range.endDate);
  url.searchParams.set('page_size', String(SCHEDULE_RANGE_PAGE_SIZE));
  if (cursor) url.searchParams.set('cursor', cursor);
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePage(value: unknown, range: ScheduleDateRange): ScheduleRangePage {
  if (!isRecord(value)
      || value.protocol_version !== 1
      || value.start_date !== range.startDate
      || value.end_date !== range.endDate
      || value.page_size !== SCHEDULE_RANGE_PAGE_SIZE
      || value.order_by !== 'id_ascending'
      || !Array.isArray(value.items)
      || typeof value.remaining_count !== 'number'
      || !Number.isSafeInteger(value.remaining_count)
      || (value.remaining_count as number) < 0
      || typeof value.complete !== 'boolean'
      || (value.next_cursor !== null && typeof value.next_cursor !== 'string')
      || (value.completion_evidence !== 'exact_count_equals_returned_items'
        && value.completion_evidence !== 'exact_count_exceeds_returned_items')
      || value.snapshot_consistency !== 'per_request_not_cross_page_snapshot') {
    throw new Error('Unverified Schedule range page.');
  }

  const remainingCount = value.remaining_count as number;
  const complete = value.complete;
  const items = value.items;
  const evidence = complete
    ? 'exact_count_equals_returned_items'
    : 'exact_count_exceeds_returned_items';
  if (items.length > SCHEDULE_RANGE_PAGE_SIZE
      || remainingCount < items.length
      || complete !== (remainingCount === items.length)
      || evidence !== value.completion_evidence
      || (complete && value.next_cursor !== null)
      || (!complete && (items.length === 0 || typeof value.next_cursor !== 'string'
        || value.next_cursor.length === 0 || value.next_cursor.length > 2048))) {
    throw new Error('Schedule range completion evidence is inconsistent.');
  }

  return value as unknown as ScheduleRangePage;
}

function parseSchedule(value: unknown, range: ScheduleDateRange, accountId: string): DatedSchedule {
  if (!isRecord(value)
      || typeof value.id !== 'string' || !value.id || value.id.length > 128
      || typeof value.date !== 'string' || !parseDateKey(value.date)
      || value.date < range.startDate || value.date > range.endDate
      || typeof value.text !== 'string'
      || typeof value.start_time !== 'string'
      || typeof value.end_time !== 'string'
      || typeof value.is_dday !== 'boolean'
      || typeof value.color !== 'string'
      || typeof value.category !== 'string'
      || (value.end_next_day !== undefined && typeof value.end_next_day !== 'boolean')
      || (value.user_id !== undefined && value.user_id !== accountId)) {
    throw new Error('Unverified Schedule range record.');
  }
  return value as unknown as DatedSchedule;
}

export async function collectCompleteScheduleRange(options: {
  apiUrl: string;
  range: ScheduleDateRange;
  accountId: string;
  fetchPage: (url: string) => Promise<unknown>;
  isCurrent: () => boolean;
}): Promise<DatedSchedule[]> {
  const start = parseDateKey(options.range.startDate);
  const end = parseDateKey(options.range.endDate);
  if (!start || !end || options.range.startDate > options.range.endDate
      || !options.accountId.trim()) {
    throw new Error('Invalid Schedule range request context.');
  }

  const collected: DatedSchedule[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < SCHEDULE_RANGE_MAX_PAGES; pageIndex += 1) {
    if (!options.isCurrent()) throw new Error('Schedule range request became stale.');
    const response = await options.fetchPage(buildScheduleRangePageUrl(options.apiUrl, options.range, cursor));
    if (!options.isCurrent()) throw new Error('Schedule range request became stale.');
    const page = parsePage(response, options.range);
    for (const rawSchedule of page.items) {
      const schedule = parseSchedule(rawSchedule, options.range, options.accountId);
      if (seenIds.has(schedule.id)) throw new Error('Duplicate Schedule identity in range response.');
      seenIds.add(schedule.id);
      collected.push(schedule);
    }
    if (page.complete) {
      if (!options.isCurrent()) throw new Error('Schedule range request became stale.');
      return collected;
    }

    const nextCursor = page.next_cursor!;
    if (seenCursors.has(nextCursor) || nextCursor === cursor) {
      throw new Error('Schedule range cursor did not advance.');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new Error('Schedule range exceeded the bounded page limit.');
}
