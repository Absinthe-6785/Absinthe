// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  dailyReads: [] as Array<{ account: string; date: string }>,
  staticReads: [] as string[],
  latest: null as { daily: any; stat: any } | null,
}));

vi.mock('../lib/localAuth', () => ({ isLocalOnlyRuntime: () => true }));
vi.mock('../lib/remoteBoundary', () => ({ remoteSWRKey: () => null }));
vi.mock('../lib/fetcher', () => ({
  fetcher: vi.fn(),
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: async (account: string, date: string) => {
    state.dailyReads.push({ account, date });
    return {
      routines: [],
      workouts: [],
      inbody: { weight: 72, smm: 30, pbf: 18 },
    };
  },
  readLocalHealthStatic: async (account: string) => {
    state.staticReads.push(account);
    return { healthBlocks: [], healthRoutines: [] };
  },
}));

import { useDailyData } from './useDaily';
import { useStaticData } from './useStatic';

function Probe({ account, date, ready }: { account: string; date: string; ready: boolean }) {
  const daily = useDailyData(date, undefined, account, ready);
  const stat = useStaticData('2026-08-01', '2026-08-31', undefined, account, ready);
  state.latest = { daily, stat };
  return createElement('output', { 'data-ready': String(ready) });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('LEAN_04A local read/mutation characterization', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    state.dailyReads.length = 0;
    state.staticReads.length = 0;
    state.latest = null;
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('observes one account-bound read per local daily/static key, mutation rereads, and latest-account/date activation', async () => {
    const cache = new Map();
    const config = { provider: () => cache, dedupingInterval: 0 };
    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        account: 'account-a', date: '2026-08-18', ready: true,
      })));
    });
    await flush();

    expect(state.dailyReads).toEqual([{ account: 'account-a', date: '2026-08-18' }]);
    expect(state.staticReads).toEqual(['account-a']);

    state.latest?.daily.mutate();
    state.latest?.stat.mutate();
    await flush();
    expect(state.dailyReads).toHaveLength(2);
    expect(state.staticReads).toHaveLength(2);

    act(() => {
      root?.render(createElement(SWRConfig, { value: config }, createElement(Probe, {
        account: 'account-b', date: '2026-08-19', ready: true,
      })));
    });
    await flush();
    expect(state.dailyReads.at(-1)).toEqual({ account: 'account-b', date: '2026-08-19' });
    expect(state.staticReads.at(-1)).toBe('account-b');
  });
});
