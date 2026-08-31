import { describe, expect, it, vi } from 'vitest';

const { fetcherMock } = vi.hoisted(() => ({
  fetcherMock: vi.fn(async (url: string) => ({ url })),
}));

vi.mock('./fetcher', () => ({ fetcher: fetcherMock }));
vi.mock('./remoteBoundary', () => ({
  remoteSWRKey: (url: string) => url,
}));

import {
  accountBoundRemoteFetcher,
  accountBoundRemoteKey,
  accountBoundRemoteUrl,
} from './accountBoundRemote';

describe('accountBoundRemote cache identity', () => {
  it('separates accounts without changing the request URL', () => {
    const url = 'https://example.invalid/api/schedules?date=2026-08-18';
    const accountA = accountBoundRemoteKey(url, 'account/a');
    const accountB = accountBoundRemoteKey(url, 'account-b');

    expect(accountA).not.toBe(accountB);
    expect(accountA).toContain('absinthe-account=account%2Fa');
    expect(accountBoundRemoteUrl(accountA!)).toBe(url);
    expect(accountBoundRemoteUrl(accountB!)).toBe(url);
  });

  it('does not activate a remote key without an authenticated account', () => {
    const url = 'https://example.invalid/api/schedules/ddays';

    expect(accountBoundRemoteKey(url)).toBeNull();
    expect(accountBoundRemoteKey(url, '')).toBeNull();
    expect(accountBoundRemoteKey(url, 'account-a', false)).toBeNull();
  });

  it('strips the cache-only marker before invoking the authenticated fetcher', async () => {
    const url = 'https://example.invalid/api/routines_with_logs?date=2026-08-18';
    const key = accountBoundRemoteKey(url, 'account-a');

    await accountBoundRemoteFetcher(key!);

    expect(fetcherMock).toHaveBeenCalledWith(url);
  });
});
