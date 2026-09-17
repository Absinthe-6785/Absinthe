import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountBoundHealthStaticKey } from './useStatic';
import { RETURN_TO_USE_LOCAL_LOCK_ENV } from '../lib/syncMode';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
});

beforeEach(() => {
  storage.clear();
  vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
  vi.stubEnv('VITE_ABSINTHE_SYNC_MODE', '');
});

describe('account-bound Health static cache keys', () => {
  it('never shares a remote Health static cache entry between accounts', () => {
    const url = 'https://absinthe.example/api/health_routines';
    const accountA = accountBoundHealthStaticKey(url, 'account-a');
    const accountB = accountBoundHealthStaticKey(url, 'account-b');

    expect(accountA).toEqual(['health-static', 'account-a', url]);
    expect(accountB).toEqual(['health-static', 'account-b', url]);
    expect(accountA).not.toEqual(accountB);
  });

  it('does not let Notes local mode or its lock suppress the Health remote boundary', () => {
    expect(accountBoundHealthStaticKey('/api/health_routines', 'account-a')).toEqual([
      'health-static',
      'account-a',
      '/api/health_routines',
    ]);
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    expect(accountBoundHealthStaticKey('/api/health_routines', 'account-a')).toEqual([
      'health-static',
      'account-a',
      '/api/health_routines',
    ]);
  });

  it('does not create a cache key when explicitly disabled', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
    expect(accountBoundHealthStaticKey('/api/health_routines', 'account-a', false)).toBeNull();
  });
});
