// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type CandidateFlags = {
  todosEnabled: boolean;
  inbodyEnabled: boolean;
  markedDatesEnabled: boolean;
  healthBlocksEnabled: boolean;
  healthRoutinesEnabled: boolean;
};

type ProbeProps = CandidateFlags & {
  account: string;
  date: string;
  monthStart: string;
  monthEnd: string;
};

type Request = {
  url: string;
  account: string;
  resolve: (value: unknown) => void;
};

const harness = vi.hoisted(() => ({
  currentAccount: 'account-a',
  requests: [] as Request[],
  latest: null as { daily: any; stat: any } | null,
  localMode: false,
  localStaticReads: [] as string[],
}));

vi.mock('../lib/localAuth', () => ({
  isLocalOnlyRuntime: () => harness.localMode,
}));
vi.mock('../lib/remoteBoundary', () => ({
  remoteSWRKey: (key: string) => harness.localMode ? null : key,
}));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../lib/fetcher', () => ({
  fetcher: (input: unknown) => {
    const url = Array.isArray(input) ? String(input[2]) : String(input);
    const request = {
      url,
      account: harness.currentAccount,
      resolve: () => undefined,
    } as Request;
    const promise = new Promise(resolve => {
      request.resolve = resolve;
      harness.requests.push(request);
    });

    // Shared shell datasets resolve immediately. Conditional groups remain
    // pending until a test explicitly resolves them, making loading and
    // reactivation behavior observable without stubbing SWR itself.
    if (
      !url.includes('/todos?')
      && !url.includes('/inbody?')
      && !url.includes('/schedules/dates?')
      && !url.endsWith('/blocks')
      && !url.endsWith('/health_routines')
    ) {
      queueMicrotask(() => request.resolve([]));
    }
    return promise;
  },
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: async () => ({
    routines: [],
    workouts: [],
    inbody: { weight: 0, smm: 0, pbf: 0 },
  }),
  readLocalHealthStatic: async (account: string) => {
    harness.localStaticReads.push(account);
    return { healthBlocks: [], healthRoutines: [] };
  },
}));

import { accountBoundInbodyKey, useDailyData } from './useDaily';
import { useStaticData } from './useStatic';

function Probe({
  account,
  date,
  monthStart,
  monthEnd,
  todosEnabled,
  inbodyEnabled,
  markedDatesEnabled,
  healthBlocksEnabled,
  healthRoutinesEnabled,
}: ProbeProps) {
  harness.currentAccount = account;
  const daily = useDailyData(date, undefined, account, true, todosEnabled, inbodyEnabled);
  const stat = useStaticData(
    monthStart,
    monthEnd,
    undefined,
    account,
    true,
    healthBlocksEnabled,
    markedDatesEnabled,
    healthRoutinesEnabled,
  );
  harness.latest = { daily, stat };
  return createElement('output', {
    'data-inbody-weight': String(daily.inbody.weight),
    'data-daily-loading': String(daily.isLoading),
    'data-blocks-state': stat.healthBlocksState.status,
  });
}

const inactiveCandidates: CandidateFlags = {
  todosEnabled: false,
  inbodyEnabled: false,
  markedDatesEnabled: false,
  healthBlocksEnabled: false,
  healthRoutinesEnabled: false,
};

const baseProps: Omit<ProbeProps, keyof CandidateFlags> = {
  account: 'account-a',
  date: '2026-08-26',
  monthStart: '2026-08-01',
  monthEnd: '2026-08-31',
};

function resetHarness(): void {
  harness.currentAccount = 'account-a';
  harness.requests.length = 0;
  harness.latest = null;
  harness.localMode = false;
  harness.localStaticReads.length = 0;
}

function isCandidate(url: string): boolean {
  return url.includes('/todos?')
    || url.includes('/inbody?')
    || url.includes('/schedules/dates?')
    || url.endsWith('/blocks')
    || url.endsWith('/health_routines');
}

function candidateRequests(): Request[] {
  return harness.requests.filter(request => isCandidate(request.url));
}

function resolveCandidates(valueFor: (request: Request) => unknown): void {
  candidateRequests().forEach(request => request.resolve(valueFor(request)));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

async function mountProbe(
  props: ProbeProps,
  cache: Map<unknown, unknown> = new Map(),
): Promise<{ root: Root; host: HTMLDivElement; cache: Map<unknown, unknown> }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(
      SWRConfig,
      { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
      createElement(Probe, props),
    ));
  });
  await flush();
  return { root, host, cache };
}

async function unmountProbe(mounted: { root: Root; host: HTMLDivElement }): Promise<void> {
  await act(async () => mounted.root.unmount());
  mounted.host.remove();
}

describe('LEAN_04 MODEL_A request activation', () => {
  let mounted: { root: Root; host: HTMLDivElement; cache: Map<unknown, unknown> } | null = null;

  beforeEach(resetHarness);

  afterEach(async () => {
    if (mounted) await unmountProbe(mounted);
    mounted = null;
  });

  it('keeps candidate sources inactive on Home, Notes, Settings, Recipe, and empty Search', async () => {
    const surfaces: Array<[string, CandidateFlags]> = [
      ['Home', inactiveCandidates],
      ['Notes', inactiveCandidates],
      ['Settings', inactiveCandidates],
      ['Recipe', inactiveCandidates],
      ['empty Search', inactiveCandidates],
    ];

    for (const [surface, flags] of surfaces) {
      resetHarness();
      mounted = await mountProbe({ ...baseProps, ...flags });
      expect(candidateRequests(), `${surface} candidate requests`).toHaveLength(0);
      expect(harness.requests.filter(request => !isCandidate(request.url))).toHaveLength(4);
      await unmountProbe(mounted);
      mounted = null;
    }
  });

  it('activates only the accepted deferred groups for Planner, Health, and non-empty Search', async () => {
    mounted = await mountProbe({
      ...baseProps,
      todosEnabled: true,
      inbodyEnabled: false,
      markedDatesEnabled: false,
      healthBlocksEnabled: false,
      healthRoutinesEnabled: false,
    });
    expect(candidateRequests().map(request => request.url)).toEqual([
      'https://example.invalid/api/todos?date=2026-08-26',
    ]);
    expect(harness.requests).toHaveLength(5);
    await unmountProbe(mounted);
    mounted = null;

    resetHarness();
    mounted = await mountProbe({
      ...baseProps,
      todosEnabled: false,
      inbodyEnabled: true,
      markedDatesEnabled: false,
      healthBlocksEnabled: true,
      healthRoutinesEnabled: true,
    });
    expect(candidateRequests().map(request => request.url).sort()).toEqual([
      'https://example.invalid/api/blocks',
      'https://example.invalid/api/health_routines',
      'https://example.invalid/api/inbody?date=2026-08-26',
    ].sort());
    expect(harness.requests).toHaveLength(7);
    await unmountProbe(mounted);
    mounted = null;

    resetHarness();
    mounted = await mountProbe({
      ...baseProps,
      todosEnabled: true,
      inbodyEnabled: false,
      markedDatesEnabled: false,
      healthBlocksEnabled: true,
      healthRoutinesEnabled: false,
    });
    expect(candidateRequests().map(request => request.url).sort()).toEqual([
      'https://example.invalid/api/blocks',
      'https://example.invalid/api/todos?date=2026-08-26',
    ].sort());
    expect(harness.requests).toHaveLength(6);
  });

  it('keeps InBody and static candidate identities account-safe during A to B activation', async () => {
    const inbodyUrl = 'https://example.invalid/api/inbody?date=2026-08-26';
    expect(accountBoundInbodyKey(inbodyUrl, 'account-a'))
      .not.toBe(accountBoundInbodyKey(inbodyUrl, 'account-b'));
    expect(accountBoundInbodyKey(inbodyUrl, 'account-a')).toContain('account-a');

    const cache = new Map<unknown, unknown>();
    mounted = await mountProbe({
      ...baseProps,
      todosEnabled: false,
      inbodyEnabled: true,
      markedDatesEnabled: true,
      healthBlocksEnabled: true,
      healthRoutinesEnabled: true,
    }, cache);
    resolveCandidates(request => {
      if (request.url.includes('/inbody?')) return [{ weight: 72, smm: 30, pbf: 18 }];
      if (request.url.includes('/schedules/dates?')) return [{ date: '2026-08-26' }];
      if (request.url.endsWith('/blocks')) return [{ id: 'block-a', name: 'A', type: 'strength', tags: [] }];
      return [{ id: 'routine-a', day_name: 'Mon', blocks: [] }];
    });
    await flush();
    expect(harness.latest?.daily.inbody.weight).toBe(72);
    expect(harness.latest?.stat.markedDates).toEqual(['2026-08-26']);
    expect(harness.latest?.stat.healthBlocks[0]?.id).toBe('block-a');
    expect(harness.latest?.stat.healthRoutines[0]?.id).toBe('routine-a');

    await act(async () => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
        createElement(Probe, {
          ...baseProps,
          account: 'account-b',
          todosEnabled: false,
          inbodyEnabled: true,
          markedDatesEnabled: true,
          healthBlocksEnabled: true,
          healthRoutinesEnabled: true,
        }),
      ));
    });
    await flush();
    expect(harness.latest?.daily.inbody.weight).toBe(0);
    expect(harness.latest?.stat.markedDates).toEqual([]);
    expect(harness.latest?.stat.healthBlocks).toEqual([]);
    expect(harness.latest?.stat.healthRoutines).toEqual([]);
    expect(candidateRequests().filter(request => request.account === 'account-b')).toHaveLength(4);
    expect(candidateRequests().every(request => !request.url.includes('\u0000'))).toBe(true);
  });

  it('clears warm InBody, markedDates, and Health-routines caches when reset/bootstrap runs while inactive', async () => {
    const cache = new Map<unknown, unknown>();
    mounted = await mountProbe({
      ...baseProps,
      todosEnabled: false,
      inbodyEnabled: true,
      markedDatesEnabled: true,
      healthBlocksEnabled: false,
      healthRoutinesEnabled: true,
    }, cache);
    resolveCandidates(request => {
      if (request.url.includes('/inbody?')) return [{ weight: 81, smm: 33, pbf: 15 }];
      if (request.url.includes('/schedules/dates?')) return [{ date: '2026-08-26' }];
      return [{ id: 'routine-before-reset', day_name: 'Tue', blocks: [] }];
    });
    await flush();
    expect(harness.latest?.daily.inbody.weight).toBe(81);
    expect(harness.latest?.stat.markedDates).toEqual(['2026-08-26']);
    expect(harness.latest?.stat.healthRoutines[0]?.id).toBe('routine-before-reset');

    await act(async () => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
        createElement(Probe, { ...baseProps, ...inactiveCandidates }),
      ));
    });
    await flush();

    // Settings reset and Health bootstrap-complete both call these same
    // AppContent-owned mutation handles. Exercise both invalidation events.
    harness.latest?.daily.mutate();
    await flush();
    harness.latest?.stat.mutate();
    await flush();

    await act(async () => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
        createElement(Probe, {
          ...baseProps,
          todosEnabled: false,
          inbodyEnabled: true,
          markedDatesEnabled: true,
          healthBlocksEnabled: false,
          healthRoutinesEnabled: true,
        }),
      ));
    });
    await flush();
    expect(harness.latest?.daily.inbody.weight).toBe(0);
    expect(harness.latest?.stat.markedDates).toEqual([]);
    expect(harness.latest?.stat.healthRoutines).toEqual([]);
    expect(candidateRequests().filter(request => request.account === 'account-a')).toHaveLength(6);
  });

  it('uses the latest date and month after remaining inactive, and excludes inactive candidates from daily loading', async () => {
    const cache = new Map<unknown, unknown>();
    mounted = await mountProbe({
      ...baseProps,
      date: '2026-08-25',
      monthStart: '2026-08-01',
      monthEnd: '2026-08-31',
      ...inactiveCandidates,
    }, cache);
    expect(harness.latest?.daily.isLoading).toBe(false);
    expect(candidateRequests()).toHaveLength(0);

    await act(async () => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
        createElement(Probe, {
          ...baseProps,
          date: '2026-08-26',
          monthStart: '2026-09-01',
          monthEnd: '2026-09-30',
          ...inactiveCandidates,
        }),
      ));
    });
    await flush();
    expect(candidateRequests()).toHaveLength(0);

    await act(async () => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
        createElement(Probe, {
          ...baseProps,
          date: '2026-08-26',
          monthStart: '2026-09-01',
          monthEnd: '2026-09-30',
          inbodyEnabled: true,
          markedDatesEnabled: true,
          healthBlocksEnabled: false,
          healthRoutinesEnabled: true,
          todosEnabled: false,
        }),
      ));
    });
    await flush();
    const activated = candidateRequests();
    expect(activated.some(request => request.url.includes('/inbody?date=2026-08-26'))).toBe(true);
    expect(activated.some(request => request.url.includes('start_date=2026-09-01&end_date=2026-09-30'))).toBe(true);
    expect(activated.some(request => request.url.includes('2026-08-25') || request.url.includes('2026-08-01'))).toBe(false);
    expect(activated.some(request => request.url.includes('/todos?'))).toBe(false);
  });

  it('does not perform inactive candidate reads in local mode while Health activates the shared local static read', async () => {
    harness.localMode = true;
    const cache = new Map<unknown, unknown>();
    mounted = await mountProbe({ ...baseProps, ...inactiveCandidates }, cache);
    expect(harness.localStaticReads).toEqual([]);

    await act(async () => {
      mounted?.root.render(createElement(
        SWRConfig,
        { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
        createElement(Probe, {
          ...baseProps,
          inbodyEnabled: true,
          markedDatesEnabled: false,
          healthBlocksEnabled: true,
          healthRoutinesEnabled: true,
          todosEnabled: false,
        }),
      ));
    });
    await flush();
    expect(harness.localStaticReads).toEqual(['account-a']);
    expect(harness.requests).toHaveLength(0);
  });
});
