// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETURN_TO_USE_LOCAL_LOCK_ENV } from '../lib/syncMode';
import { setRuntimeAccountSyncAccount } from '../lib/remoteBoundary';
import type { HealthRoutine } from '../types';
import { useStaticData } from './useStatic';

const mocks = vi.hoisted(() => ({ localRead: vi.fn(), remoteRead: vi.fn(async () => []) }));
vi.mock('../lib/healthLocalRuntime', () => ({
  readLocalHealthStatic: (...args: unknown[]) => mocks.localRead(...args),
}));
vi.mock('../lib/fetcher', () => ({
  fetcher: (...args: unknown[]) => mocks.remoteRead(...args),
  isLocalOnlyRemotePausedError: () => false,
}));

let latest: ReturnType<typeof useStaticData>;
let root: Root | null = null;
let host: HTMLDivElement | null = null;

function Harness({ accountId }: { accountId: string }) {
  latest = useStaticData('2026-09-01', '2026-09-30', undefined,
    accountId, true, true, false, true);
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function mount(accountId = 'account-a') {
  host = document.createElement('div'); document.body.appendChild(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(createElement(SWRConfig, {
      value: { provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 },
      children: createElement(Harness, { accountId }),
    }));
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
  vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', '');
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  setRuntimeAccountSyncAccount('account-a');
  mocks.localRead.mockReset(); mocks.remoteRead.mockClear();
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove(); root = null; host = null;
});

describe('local Health routine source readiness', () => {
  it('distinguishes pending from verified empty without consulting remote Health routines', async () => {
    const local = deferred<{ healthBlocks: []; healthRoutines: HealthRoutine[] }>();
    mocks.localRead.mockReturnValue(local.promise);
    await mount();
    expect(latest.healthRoutines).toEqual([]);
    expect(latest.healthRoutinesState.status).toBe('LOADING');
    expect(mocks.localRead).toHaveBeenCalledWith('account-a');
    expect(mocks.remoteRead.mock.calls.some(call => String(call[0]).includes('health_routines'))).toBe(false);

    await act(async () => local.resolve({ healthBlocks: [], healthRoutines: [] }));
    expect(latest.healthRoutines).toEqual([]);
    expect(latest.healthRoutinesState.status).toBe('READY_EMPTY');
  });

  it('reports verified nonempty routines', async () => {
    mocks.localRead.mockResolvedValueOnce({ healthBlocks: [],
      healthRoutines: [{ id: 'routine-a', day_name: 'Day 1', blocks: ['push'] }] });
    await mount();
    expect(latest.healthRoutinesState.status).toBe('READY_WITH_RESULTS');
    expect(latest.healthRoutines[0]?.blocks).toEqual(['push']);
  });

  it('does not call an unavailable local routine source verified empty', async () => {
    mocks.localRead.mockRejectedValueOnce(new Error('local Health unavailable'));
    await mount();
    expect(latest.healthRoutines).toEqual([]);
    expect(latest.healthRoutinesState.status).toBe('ERROR');
  });
});
