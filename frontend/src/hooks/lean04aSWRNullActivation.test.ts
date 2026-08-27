// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import useSWR, { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDailyData } from './useDaily';
import { useStaticData } from './useStatic';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ControlledRequest = {
  url: string;
  account: string;
  resolve: (value: unknown) => void;
};

const productionHarness = vi.hoisted(() => ({
  remoteActive: true,
  currentAccount: 'account-a',
  requests: [] as ControlledRequest[],
  latest: null as { daily: any; stat: any } | null,
}));

vi.mock('../lib/localAuth', () => ({ isLocalOnlyRuntime: () => false }));
vi.mock('../lib/remoteBoundary', () => ({
  remoteSWRKey: (key: string) => productionHarness.remoteActive ? key : null,
}));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../lib/fetcher', () => ({
  fetcher: (input: unknown) => {
    const url = Array.isArray(input) ? String(input[2]) : String(input);
    return new Promise<unknown>(resolve => {
      productionHarness.requests.push({
        url,
        account: productionHarness.currentAccount,
        resolve,
      });
    });
  },
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: async () => ({ routines: [], workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 } }),
  readLocalHealthStatic: async () => ({ healthBlocks: [], healthRoutines: [] }),
}));

function responseFor(url: string, account: string): unknown {
  const parsed = new URL(url);
  const date = parsed.searchParams.get('date') ?? '';
  const startDate = parsed.searchParams.get('start_date') ?? '';
  if (parsed.pathname.endsWith('/schedules/dates')) return [{ date: startDate }];
  if (parsed.pathname.endsWith('/schedules')) return [{ id: `schedule-${account}-${date}`, account }];
  if (parsed.pathname.endsWith('/todos')) return [{ id: `todo-${account}-${date}`, account }];
  if (parsed.pathname.endsWith('/routines_with_logs')) return [{ id: `routine-${account}-${date}`, account }];
  if (parsed.pathname.endsWith('/workouts')) return [{ id: `workout-${account}-${date}`, account }];
  if (parsed.pathname.endsWith('/inbody')) return [{ weight: 72, smm: 30, pbf: 18, account }];
  if (parsed.pathname.endsWith('/blocks')) return [{ id: `block-${account}`, account }];
  if (parsed.pathname.endsWith('/health_routines')) return [{ id: `health-routine-${account}`, account }];
  if (parsed.pathname.endsWith('/weekly_schedules')) return [{ id: `weekly-${account}`, account }];
  return [];
}

function resetProductionHarness(): void {
  productionHarness.remoteActive = true;
  productionHarness.currentAccount = 'account-a';
  productionHarness.requests.length = 0;
  productionHarness.latest = null;
}

type ProductionProbeProps = {
  active: boolean;
  account: string;
  date: string;
  monthStart: string;
  monthEnd: string;
};

function ProductionProbe({ active, account, date, monthStart, monthEnd }: ProductionProbeProps) {
  productionHarness.currentAccount = account;
  productionHarness.remoteActive = active;
  const daily = useDailyData(date, undefined, account, true);
  const stat = useStaticData(monthStart, monthEnd, undefined, account, true);
  productionHarness.latest = { daily, stat };
  return createElement('output', {
    'data-daily-owner': String(daily.schedules[0]?.account ?? ''),
    'data-daily-id': String(daily.schedules[0]?.id ?? ''),
    'data-marked-date': String(stat.markedDates[0] ?? ''),
  });
}

function renderProductionProbe(
  root: Root,
  config: { provider: () => Map<unknown, unknown>; dedupingInterval: number; revalidateOnFocus: boolean },
  props: ProductionProbeProps,
): void {
  root.render(createElement(SWRConfig, { value: config }, createElement(ProductionProbe, props)));
}

function resolveRequests(requests: ControlledRequest[]): void {
  requests.forEach(request => request.resolve(responseFor(request.url, request.account)));
}

type ProbeProps = {
  active: boolean;
  account: string;
  date: string;
  fetcher: (key: readonly [string, string, string]) => Promise<string[]>;
};

function Probe({ active, account, date, fetcher }: ProbeProps) {
  const { data = [] } = useSWR(
    active ? ['lean04a-activation', account, date] as const : null,
    fetcher,
    { dedupingInterval: 0, revalidateOnFocus: false },
  );
  return createElement('output', { 'data-testid': 'lean04a-swr-value' }, data.join('|'));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('LEAN_04A null-key activation semantics', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    resetProductionHarness();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('reproduces a stale account A value under account B with a real shared SWR cache while B revalidation is pending', async () => {
    const cache = new Map<unknown, unknown>();
    const config = { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false };
    root = createRoot(host!);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: true,
        account: 'account-a',
        date: '2026-08-18',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
      });
    });
    await flush();
    expect(productionHarness.requests).toHaveLength(9);
    const initialRequests = productionHarness.requests.splice(0);
    resolveRequests(initialRequests);
    await flush();
    expect(host?.querySelector('output')?.getAttribute('data-daily-owner')).toBe('account-a');

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: true,
        account: 'account-b',
        date: '2026-08-18',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
      });
    });
    await flush();
    expect(host?.querySelector('output')?.getAttribute('data-daily-owner')).toBe('account-a');
    const accountBActivationRequests = productionHarness.requests.splice(0);
    expect(accountBActivationRequests).toHaveLength(5);
    const accountBStaticRequests = accountBActivationRequests.filter(request => !request.url.includes('/inbody?'));
    expect(accountBStaticRequests).toHaveLength(4);
    expect(accountBStaticRequests.some(request => new URL(request.url).searchParams.has('date'))).toBe(false);
    expect(accountBActivationRequests.some(request => request.url.includes('/inbody?'))).toBe(true);
    resolveRequests(accountBActivationRequests);
    await flush();

    productionHarness.latest?.daily.mutate();
    await flush();
    const accountBRequests = productionHarness.requests.filter(request => request.account === 'account-b');
    expect(accountBRequests).toHaveLength(5);
    expect(accountBRequests.every(request => new URL(request.url).searchParams.get('date') === '2026-08-18')).toBe(true);
    expect(host?.querySelector('output')?.getAttribute('data-daily-owner')).toBe('account-a');

    const scheduleRequest = accountBRequests.find(request => new URL(request.url).pathname.endsWith('/schedules'));
    expect(scheduleRequest).toBeDefined();
    scheduleRequest?.resolve(responseFor(scheduleRequest.url, scheduleRequest.account));
    await flush();
    expect(host?.querySelector('output')?.getAttribute('data-daily-owner')).toBe('account-b');
  });

  it('uses the latest date after remaining inactive while the selected date changes', async () => {
    const cache = new Map<unknown, unknown>();
    const config = { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false };
    root = createRoot(host!);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: false,
        account: 'account-a',
        date: '2026-08-18',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
      });
    });
    await flush();
    expect(productionHarness.requests).toHaveLength(0);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: false,
        account: 'account-a',
        date: '2026-08-19',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
      });
    });
    await flush();
    expect(productionHarness.requests).toHaveLength(0);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: true,
        account: 'account-a',
        date: '2026-08-19',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
      });
    });
    await flush();
    const activatedRequests = productionHarness.requests.splice(0);
    const dailyRequests = activatedRequests.filter(request => new URL(request.url).searchParams.has('date'));
    expect(dailyRequests).toHaveLength(5);
    expect(dailyRequests.every(request => new URL(request.url).searchParams.get('date') === '2026-08-19')).toBe(true);
    expect(dailyRequests.some(request => new URL(request.url).searchParams.get('date') === '2026-08-18')).toBe(false);
    resolveRequests(activatedRequests);
    await flush();
    expect(host?.querySelector('output')?.getAttribute('data-daily-id')).toBe('schedule-account-a-2026-08-19');
  });

  it('uses the latest month after remaining inactive while the selected range changes', async () => {
    const cache = new Map<unknown, unknown>();
    const config = { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false };
    root = createRoot(host!);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: false,
        account: 'account-a',
        date: '2026-08-18',
        monthStart: '2026-08-01',
        monthEnd: '2026-08-31',
      });
    });
    await flush();
    expect(productionHarness.requests).toHaveLength(0);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: false,
        account: 'account-a',
        date: '2026-08-18',
        monthStart: '2026-09-01',
        monthEnd: '2026-09-30',
      });
    });
    await flush();
    expect(productionHarness.requests).toHaveLength(0);

    await act(async () => {
      renderProductionProbe(root!, config, {
        active: true,
        account: 'account-a',
        date: '2026-08-18',
        monthStart: '2026-09-01',
        monthEnd: '2026-09-30',
      });
    });
    await flush();
    const activatedRequests = productionHarness.requests.splice(0);
    const monthRequests = activatedRequests.filter(request => new URL(request.url).pathname.endsWith('/schedules/dates'));
    expect(monthRequests).toHaveLength(1);
    const monthQuery = new URL(monthRequests[0]!.url).searchParams;
    expect(monthQuery.get('start_date')).toBe('2026-09-01');
    expect(monthQuery.get('end_date')).toBe('2026-09-30');
    expect(monthRequests.some(request => request.url.includes('2026-08-01') || request.url.includes('2026-08-31'))).toBe(false);
    resolveRequests(activatedRequests);
    await flush();
    expect(host?.querySelector('output')?.getAttribute('data-marked-date')).toBe('2026-09-01');
  });

  it('suppresses inactive fetches, activates with the current account/date, and revalidates after a later activation', async () => {
    let version = 'A';
    const calls: Array<readonly [string, string, string]> = [];
    const fetcher = async (key: readonly [string, string, string]) => {
      calls.push(key);
      return [`${key[1]}:${key[2]}:${version}`];
    };
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };

    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: false, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    await flush();
    expect(calls).toHaveLength(0);

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: true, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    await flush();
    expect(calls).toEqual([['lean04a-activation', 'account-a', '2026-08-18']]);
    expect(host?.querySelector('[data-testid="lean04a-swr-value"]')?.textContent).toBe('account-a:2026-08-18:A');

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: false, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    version = 'B';
    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: true, account: 'account-a', date: '2026-08-18', fetcher,
      })));
    });
    await flush();
    expect(calls).toHaveLength(2);
    expect(host?.querySelector('[data-testid="lean04a-swr-value"]')?.textContent).toBe('account-a:2026-08-18:B');

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        active: true, account: 'account-b', date: '2026-08-19', fetcher,
      })));
    });
    await flush();
    expect(calls.at(-1)).toEqual(['lean04a-activation', 'account-b', '2026-08-19']);
    expect(host?.querySelector('[data-testid="lean04a-swr-value"]')?.textContent).toBe('account-b:2026-08-19:B');
  });
});
