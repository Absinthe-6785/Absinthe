import { describe, expect, it, vi } from 'vitest';
import {
  buildScheduleRangePageUrl,
  collectCompleteScheduleRange,
  getScheduleMonthRange,
  SCHEDULE_RANGE_PAGE_SIZE,
  type DatedSchedule,
  type ScheduleDateRange,
} from './scheduleRangePagination';

const range: ScheduleDateRange = { startDate: '2026-09-01', endDate: '2026-09-30' };

function schedule(id: string, date = '2026-09-01', overrides: Record<string, unknown> = {}) {
  return {
    id,
    date,
    user_id: 'account-a',
    text: `Schedule ${id}`,
    start_time: '09:00',
    end_time: '10:00',
    end_next_day: false,
    is_dday: false,
    color: 'purple',
    category: 'Work',
    ...overrides,
  };
}

function page(
  items: unknown[],
  remaining_count: number,
  complete: boolean,
  next_cursor: string | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    protocol_version: 1,
    start_date: range.startDate,
    end_date: range.endDate,
    page_size: SCHEDULE_RANGE_PAGE_SIZE,
    order_by: 'id_ascending',
    items,
    remaining_count,
    complete,
    next_cursor,
    completion_evidence: complete
      ? 'exact_count_equals_returned_items'
      : 'exact_count_exceeds_returned_items',
    snapshot_consistency: 'per_request_not_cross_page_snapshot',
    ...overrides,
  };
}

function collect(fetchPage: (url: string) => Promise<unknown>, isCurrent = () => true) {
  return collectCompleteScheduleRange({
    apiUrl: 'https://example.invalid',
    range,
    accountId: 'account-a',
    fetchPage,
    isCurrent,
  });
}

describe('Schedule range pagination contract', () => {
  it('derives the displayed month with leap-year and month-boundary dates', () => {
    expect(getScheduleMonthRange('2024-02-29')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
    expect(getScheduleMonthRange('2026-09-30')).toEqual({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(getScheduleMonthRange('2026-02-30')).toBeNull();
  });

  it('builds account-independent first-page and cursor request URLs with exact bounds', () => {
    const url = new URL(buildScheduleRangePageUrl('https://example.invalid', range, 'cursor/+='));
    expect(url.pathname).toBe('/api/schedules/range');
    expect(url.searchParams.get('start_date')).toBe(range.startDate);
    expect(url.searchParams.get('end_date')).toBe(range.endDate);
    expect(url.searchParams.get('page_size')).toBe(String(SCHEDULE_RANGE_PAGE_SIZE));
    expect(url.searchParams.get('cursor')).toBe('cursor/+=');
  });

  it('collects all pages in a server-truncated response before returning data', async () => {
    const first = page([schedule('id-1', '2026-09-03')], 3, false, 'after-1');
    const second = page([schedule('id-2', '2026-09-18')], 2, false, 'after-2');
    const last = page([schedule('id-3', '2026-09-30')], 1, true, null);
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockResolvedValueOnce(last);

    const result = await collect(fetchPage);

    expect(result.map(item => item.id)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(result.map(item => item.date)).toEqual(['2026-09-03', '2026-09-18', '2026-09-30']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(new URL(fetchPage.mock.calls[1]![0]).searchParams.get('cursor')).toBe('after-1');
    expect(new URL(fetchPage.mock.calls[2]![0]).searchParams.get('cursor')).toBe('after-2');
  });

  it('distinguishes a verified empty month from a failed or incomplete first page', async () => {
    await expect(collect(async () => page([], 0, true, null))).resolves.toEqual([]);
    await expect(collect(async () => page([], 1, false, 'after-none'))).rejects.toThrow(/completion evidence/);
    await expect(collect(async () => { throw new Error('network failure'); })).rejects.toThrow('network failure');
  });

  it('does not return or publish earlier pages when a later page is malformed', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page([schedule('id-1')], 2, false, 'after-1'))
      .mockResolvedValueOnce(page([schedule('outside', '2026-10-01')], 1, true, null));

    await expect(collect(fetchPage)).rejects.toThrow(/record/);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['range mismatch', { start_date: '2026-08-01' }],
    ['missing exact-count evidence', { remaining_count: undefined }],
    ['incorrect terminal count', { remaining_count: 2 }],
    ['account mismatch', { items: [schedule('foreign', '2026-09-01', { user_id: 'account-b' })] }],
    ['duplicate identities', { items: [schedule('dup'), schedule('dup')], remaining_count: 2 }],
  ])('rejects %s instead of treating the page as authoritative', async (_name, override) => {
    await expect(collect(async () => page([schedule('id-1')], 1, true, null, override as Record<string, unknown>)))
      .rejects.toThrow();
  });

  it('rejects a repeated cursor and the bounded page limit', async () => {
    const repeated = page([schedule('id-1')], 2, false, 'same');
    const repeatedNext = page([schedule('id-2')], 2, false, 'same');
    let repeatedPageIndex = 0;
    await expect(collect(async () => repeatedPageIndex++ === 0 ? repeated : repeatedNext))
      .rejects.toThrow(/cursor did not advance/);

    let pageIndex = 0;
    const nonterminal = vi.fn(async () => {
      const currentPage = pageIndex++;
      return page([schedule(`id-${currentPage}`)], 2, false, `next-${currentPage}`);
    });
    await expect(collect(nonterminal)).rejects.toThrow(/bounded page limit/);
    expect(nonterminal).toHaveBeenCalledTimes(50);
  });

  it('stops before fetching or returning when account/month authority is stale', async () => {
    const fetchPage = vi.fn(async () => page([schedule('id-1')], 1, true, null));
    await expect(collect(fetchPage, () => false)).rejects.toThrow(/stale/);
    expect(fetchPage).not.toHaveBeenCalled();

    let current = true;
    const deferredFetch = vi.fn(async () => {
      current = false;
      return page([schedule('id-1')], 1, true, null);
    });
    await expect(collect(deferredFetch, () => current)).rejects.toThrow(/stale/);
  });

  it('preserves received row objects rather than mutating them', async () => {
    const source = schedule('unchanged', '2026-09-22');
    const before = structuredClone(source);
    const result = await collect(async () => page([source], 1, true, null));
    expect(result[0]).toBe(source as unknown as DatedSchedule);
    expect(source).toEqual(before);
  });
});
