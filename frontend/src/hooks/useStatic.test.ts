import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountBoundHealthStaticKey } from './useStatic';
import { RETURN_TO_USE_LOCAL_LOCK_ENV } from '../lib/syncMode';
import { setRuntimeAccountSyncAccount } from '../lib/remoteBoundary';

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
  vi.stubEnv('VITE_ABSINTHE_ACCOUNT_SYNC_DISABLED', 'false');
  vi.stubGlobal('navigator', { onLine: true });
  setRuntimeAccountSyncAccount('account-a');
});

describe('account-bound Health static cache keys', () => {
  it('never shares a remote Health static cache entry between accounts', () => {
    const url = 'https://absinthe.example/api/weekly_schedules';
    const accountA = accountBoundHealthStaticKey(url, 'account-a', 'planner_weekly_schedules');
    const accountB = accountBoundHealthStaticKey(url, 'account-b', 'planner_weekly_schedules');

    expect(accountA).toEqual(['health-static', 'account-a', url]);
    expect(accountB).toEqual(['health-static', 'account-b', url]);
    expect(accountA).not.toEqual(accountB);
  });

  it('does not let Notes local mode or its lock suppress a Planner remote boundary', () => {
    expect(accountBoundHealthStaticKey('/api/weekly_schedules', 'account-a', 'planner_weekly_schedules')).toEqual([
      'health-static',
      'account-a',
      '/api/weekly_schedules',
    ]);
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'true');
    expect(accountBoundHealthStaticKey('/api/weekly_schedules', 'account-a', 'planner_weekly_schedules')).toEqual([
      'health-static',
      'account-a',
      '/api/weekly_schedules',
    ]);
  });

  it('does not create direct remote keys for local-first or local-only Health data', () => {
    expect(accountBoundHealthStaticKey('/api/blocks', 'account-a', 'health_exercise_library')).toBeNull();
    expect(accountBoundHealthStaticKey('/api/health_routines', 'account-a', 'health_routine_presets')).toBeNull();
  });

  it('does not create a cache key when explicitly disabled', () => {
    vi.stubEnv(RETURN_TO_USE_LOCAL_LOCK_ENV, 'false');
    expect(accountBoundHealthStaticKey('/api/weekly_schedules', 'account-a', 'planner_weekly_schedules', false)).toBeNull();
  });
});
