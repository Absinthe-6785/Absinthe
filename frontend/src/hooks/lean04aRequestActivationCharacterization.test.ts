// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Key = string | readonly unknown[] | null;

const harness = vi.hoisted(() => ({
  localMode: false,
  currentAccount: 'account-a',
  keys: [] as Key[],
  fetchCalls: [] as Array<{ url: string; account: string }>,
  localDailyReads: [] as Array<{ account: string; date: string }>,
  localStaticReads: [] as string[],
  mutations: [] as string[],
  cache: new Map<string, unknown>(),
  last: null as { daily: any; stat: any } | null,
}));

function keyId(key: Exclude<Key, null>): string {
  return typeof key === 'string' ? key : JSON.stringify(key);
}

function responseFor(url: string, account: string): unknown {
  if (url.includes('/schedules/dates')) return [{ date: '2026-08-01', account }];
  if (url.includes('/schedules?')) return [{ id: `schedule-${account}`, account }];
  if (url.includes('/todos?')) return [{ id: `todo-${account}`, account }];
  if (url.includes('/routines_with_logs?')) return [{ id: `routine-${account}`, account }];
  if (url.includes('/workouts?')) return [{ id: `workout-${account}`, account }];
  if (url.includes('/inbody?')) return [{ weight: 72, smm: 30, pbf: 18, account }];
  if (url.endsWith('/blocks')) return [{ id: `block-${account}`, name: 'Block', account }];
  if (url.endsWith('/health_routines')) return [{ id: `health-routine-${account}`, day_name: 'Mon', blocks: [], account }];
  if (url.endsWith('/weekly_schedules')) return [{ id: `weekly-${account}`, account }];
  return [];
}

vi.mock('swr', () => ({
  default: (key: Key, fetcher?: (arg: unknown) => unknown) => {
    harness.keys.push(key);
    if (key === null) {
      return {
        data: undefined,
        mutate: () => { harness.mutations.push('null'); },
        isLoading: false,
      };
    }

    const id = keyId(key);
    if (!harness.cache.has(id)) {
      harness.cache.set(id, fetcher?.(key));
    }
    return {
      data: harness.cache.get(id),
      mutate: () => { harness.mutations.push(id); },
      isLoading: false,
    };
  },
  useSWRConfig: () => ({ mutate: () => undefined }),
}));

vi.mock('../lib/localAuth', () => ({
  isLocalOnlyRuntime: () => harness.localMode,
}));

vi.mock('../lib/remoteBoundary', () => ({
  remoteSWRKey: (key: string) => harness.localMode ? null : key,
}));

vi.mock('../lib/fetcher', () => ({
  fetcher: (input: unknown) => {
    const url = Array.isArray(input) ? String(input[2]) : String(input);
    harness.fetchCalls.push({ url, account: harness.currentAccount });
    return responseFor(url, harness.currentAccount);
  },
  isLocalOnlyRemotePausedError: () => false,
}));

vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));

vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: (account: string, date: string) => {
    harness.localDailyReads.push({ account, date });
    return {
      routines: [{ id: `local-routine-${account}`, text: 'Routine', done: false, is_active: true }],
      workouts: [{ id: `local-workout-${date}`, block_id: 'block', sets: [] }],
      inbody: { weight: 72, smm: 30, pbf: 18 },
    };
  },
  readLocalHealthStatic: (account: string) => {
    harness.localStaticReads.push(account);
    return {
      healthBlocks: [{ id: `local-block-${account}`, name: 'Block', type: 'strength', tags: [] }],
      healthRoutines: [],
    };
  },
}));

import { useDailyData } from './useDaily';
import { useStaticData } from './useStatic';

function Probe({
  account,
  date,
  monthStart,
  monthEnd,
  healthReady,
}: {
  account: string;
  date: string;
  monthStart: string;
  monthEnd: string;
  healthReady: boolean;
}) {
  harness.currentAccount = account;
  const daily = useDailyData(date, undefined, account, healthReady);
  const stat = useStaticData(monthStart, monthEnd, undefined, account, healthReady);
  harness.last = { daily, stat };
  return createElement('output', {
    'data-daily-owner': String(daily.schedules[0]?.account ?? daily.routines[0]?.id ?? ''),
    'data-static-owner': String(stat.healthBlocks[0]?.account ?? stat.healthBlocks[0]?.id ?? ''),
  });
}

function mount(props: Omit<React.ComponentProps<typeof Probe>, never>): { root: Root; host: HTMLDivElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(createElement(Probe, props)); });
  return { root, host };
}

function resetHarness(): void {
  harness.localMode = false;
  harness.currentAccount = 'account-a';
  harness.keys.length = 0;
  harness.fetchCalls.length = 0;
  harness.localDailyReads.length = 0;
  harness.localStaticReads.length = 0;
  harness.mutations.length = 0;
  harness.cache.clear();
  harness.last = null;
}

describe('LEAN_04A request activation characterization', () => {
  let mounted: { root: Root; host: HTMLDivElement } | null = null;

  beforeEach(resetHarness);

  afterEach(() => {
    if (mounted) act(() => mounted?.root.unmount());
    mounted?.host.remove();
    mounted = null;
  });

  it('records the current eager Home remote request matrix and exact request identities', () => {
    mounted = mount({
      account: 'account-a',
      date: '2026-08-18',
      monthStart: '2026-08-01',
      monthEnd: '2026-08-31',
      healthReady: true,
    });

    const dailyUrls = harness.fetchCalls
      .map(call => call.url)
      .filter(url => url.includes('/api/') && !url.includes('/schedules/dates') && !url.endsWith('/blocks') && !url.endsWith('/health_routines') && !url.endsWith('/weekly_schedules'));
    expect(dailyUrls).toEqual([
      'https://example.invalid/api/schedules?date=2026-08-18',
      'https://example.invalid/api/todos?date=2026-08-18',
      'https://example.invalid/api/routines_with_logs?date=2026-08-18',
      'https://example.invalid/api/workouts?date=2026-08-18',
      'https://example.invalid/api/inbody?date=2026-08-18',
    ]);

    const staticKeys = harness.keys.filter((key): key is readonly unknown[] => Array.isArray(key));
    expect(staticKeys).toEqual([
      ['health-static', 'account-a', 'https://example.invalid/api/schedules/dates?start_date=2026-08-01&end_date=2026-08-31'],
      ['health-static', 'account-a', 'https://example.invalid/api/blocks'],
      ['health-static', 'account-a', 'https://example.invalid/api/health_routines'],
      ['health-static', 'account-a', 'https://example.invalid/api/weekly_schedules'],
    ]);
    expect(harness.fetchCalls).toHaveLength(9);
    expect(harness.fetchCalls.every(call => call.account === 'account-a')).toBe(true);
  });

  it('records latest date/month key construction and exposes shell mutation handles for active keys', () => {
    mounted = mount({
      account: 'account-a',
      date: '2026-08-18',
      monthStart: '2026-08-01',
      monthEnd: '2026-08-31',
      healthReady: true,
    });
    const firstFetchCount = harness.fetchCalls.length;

    act(() => {
      mounted?.root.render(createElement(Probe, {
        account: 'account-a',
        date: '2026-08-19',
        monthStart: '2026-09-01',
        monthEnd: '2026-09-30',
        healthReady: true,
      }));
    });

    // Five daily date keys plus the month-bound markedDates key change; the
    // three account-scoped static keys are reused for the same account.
    expect(harness.fetchCalls.length).toBe(firstFetchCount + 6);
    expect(harness.fetchCalls.some(call => call.url.endsWith('/workouts?date=2026-08-19'))).toBe(true);
    expect(harness.fetchCalls.some(call => call.url.includes('start_date=2026-09-01&end_date=2026-09-30'))).toBe(true);

    harness.last?.daily.mutate();
    harness.last?.daily.mutateTodos(cur => cur, false);
    harness.last?.daily.mutateRoutines(cur => cur, false);
    harness.last?.stat.mutate();
    expect(harness.mutations.length).toBe(11);
    expect(harness.fetchCalls.length).toBe(firstFetchCount + 6);
  });

  it('records local-mode null keys, readiness pause, and latest account/date inputs', () => {
    harness.localMode = true;
    mounted = mount({
      account: 'account-a',
      date: '2026-08-18',
      monthStart: '2026-08-01',
      monthEnd: '2026-08-31',
      healthReady: false,
    });

    expect(harness.fetchCalls).toHaveLength(0);
    expect(harness.localDailyReads).toHaveLength(0);
    expect(harness.localStaticReads).toHaveLength(0);
    expect(harness.keys.filter(key => key === null)).toHaveLength(11);

    harness.last?.daily.mutate();
    harness.last?.stat.mutate();
    expect(harness.localDailyReads).toHaveLength(0);
    expect(harness.localStaticReads).toHaveLength(0);

    act(() => {
      mounted?.root.render(createElement(Probe, {
        account: 'account-a',
        date: '2026-08-18',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
        healthReady: true,
      }));
    });
    expect(harness.localDailyReads).toEqual([{ account: 'account-a', date: '2026-08-18' }]);
    expect(harness.localStaticReads).toEqual(['account-a']);
    expect(harness.keys).toContainEqual(['local-health-daily', 'account-a', '2026-08-18']);
    expect(harness.keys).toContainEqual(['local-health-static', 'account-a']);

    act(() => {
      mounted?.root.render(createElement(Probe, {
        account: 'account-b',
        date: '2026-08-19',
        monthStart: '2026-09-01',
        monthEnd: '2026-09-30',
        healthReady: true,
      }));
    });
    expect(harness.localDailyReads.at(-1)).toEqual({ account: 'account-b', date: '2026-08-19' });
    expect(harness.localStaticReads.at(-1)).toBe('account-b');
    expect(harness.keys).toContainEqual(['local-health-daily', 'account-b', '2026-08-19']);
    expect(harness.keys).toContainEqual(['local-health-static', 'account-b']);
  });
});
