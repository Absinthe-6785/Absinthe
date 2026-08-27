// @vitest-environment happy-dom
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDailyData } from './useDaily';
import { useStaticData } from './useStatic';

const mocks = vi.hoisted(() => ({
  dailyReader: vi.fn(),
  staticReader: vi.fn(),
  localKeys: [] as unknown[][],
  fetchedKeys: new Set<string>(),
}));

vi.mock('swr', () => ({
  default: (key: unknown, fetcher?: (arg: unknown) => unknown) => {
    const isLocalKey = Array.isArray(key) && (
      key[0] === 'local-health-daily' || key[0] === 'local-health-static'
    );
    if (isLocalKey) {
      mocks.localKeys.push(key);
      const keyId = JSON.stringify(key);
      if (!mocks.fetchedKeys.has(keyId)) {
        mocks.fetchedKeys.add(keyId);
        void fetcher?.(key);
      }
    }

    if (Array.isArray(key) && key[0] === 'local-health-daily') {
      return {
        data: { routines: [], workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 } },
        mutate: vi.fn(),
        isLoading: false,
      };
    }
    if (Array.isArray(key) && key[0] === 'local-health-static') {
      return {
        data: { healthBlocks: [], healthRoutines: [] },
        mutate: vi.fn(),
        isLoading: false,
      };
    }
    return { data: undefined, mutate: vi.fn(), isLoading: false };
  },
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));

vi.mock('../lib/localAuth', () => ({ isLocalOnlyRuntime: () => true }));
vi.mock('../lib/remoteBoundary', () => ({ remoteSWRKey: () => null }));
vi.mock('../lib/fetcher', () => ({
  fetcher: vi.fn(),
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthDaily: (accountId: string, date: string) => mocks.dailyReader(accountId, date),
  readLocalHealthStatic: (accountId: string) => mocks.staticReader(accountId),
}));

function Probe({ healthReady }: { healthReady: boolean }) {
  const daily = useDailyData('2026-08-18', undefined, 'account-a', healthReady);
  const stat = useStaticData('2026-08-01', '2026-08-31', undefined, 'account-a', healthReady);
  return createElement(
    'output',
    { 'data-daily-loading': String(daily.isLoading), 'data-daily-empty': String(daily.routines.length === 0 && daily.workouts.length === 0), 'data-static-empty': String(stat.healthBlocks.length === 0 && stat.healthRoutines.length === 0) },
  );
}

describe('Health readiness hook integration', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    mocks.dailyReader.mockReset().mockResolvedValue({ routines: [], workouts: [], inbody: { weight: 0, smm: 0, pbf: 0 } });
    mocks.staticReader.mockReset().mockResolvedValue({ healthBlocks: [], healthRoutines: [] });
    mocks.localKeys.length = 0;
    mocks.fetchedKeys.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('does not read Health before ready or report startup readiness as daily loading', async () => {
    await act(async () => {
      root = createRoot(host!);
      root.render(createElement(Probe, { healthReady: false }));
    });

    expect(mocks.dailyReader).not.toHaveBeenCalled();
    expect(mocks.staticReader).not.toHaveBeenCalled();
    expect(mocks.localKeys).toHaveLength(0);
    expect(host!.firstElementChild?.getAttribute('data-daily-loading')).toBe('false');
    expect(host!.firstElementChild?.getAttribute('data-daily-empty')).toBe('true');
    expect(host!.firstElementChild?.getAttribute('data-static-empty')).toBe('true');

    await act(async () => {
      root!.render(createElement(Probe, { healthReady: true }));
      await Promise.resolve();
    });

    expect(mocks.dailyReader).toHaveBeenCalledOnce();
    expect(mocks.staticReader).toHaveBeenCalledOnce();
    expect(mocks.localKeys).toHaveLength(2);
    expect(host!.firstElementChild?.getAttribute('data-daily-loading')).toBe('false');
    expect(host!.firstElementChild?.getAttribute('data-daily-empty')).toBe('true');
    expect(host!.firstElementChild?.getAttribute('data-static-empty')).toBe('true');
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });
});
