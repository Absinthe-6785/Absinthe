import { describe, expect, it } from 'vitest';
import { accountBoundHealthStaticKey } from './useStatic';

describe('account-bound Health static cache keys', () => {
  it('never shares a remote Health static cache entry between accounts', () => {
    const url = 'https://absinthe.example/api/health_routines';
    const accountA = accountBoundHealthStaticKey(url, 'account-a');
    const accountB = accountBoundHealthStaticKey(url, 'account-b');

    expect(accountA).toEqual(['health-static', 'account-a', url]);
    expect(accountB).toEqual(['health-static', 'account-b', url]);
    expect(accountA).not.toEqual(accountB);
  });

  it('does not create a remote cache key when the local runtime owns Health data', () => {
    expect(accountBoundHealthStaticKey('/api/health_routines', 'account-a', false)).toBeNull();
  });
});
