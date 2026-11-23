import { describe, expect, it, vi } from 'vitest';
import type { Arguments } from 'swr';

vi.mock('./remoteBoundary', () => ({ remoteSWRKey: (url: string) => url }));

import { accountBoundRemoteKey } from './accountBoundRemote';
import {
  isCurrentAccountPlannerCacheKey,
  plannerCacheDomainForKey,
  revalidatePlannerAccountCache,
} from './plannerCacheRevalidation';

const API = 'https://example.invalid/api';
const accountA = 'account-a';
const accountB = 'account-b';

function key(path: string, account = accountA): string {
  const domain = path.startsWith('/workouts')
    ? 'health_workouts'
    : path.startsWith('/schedules/ddays')
      ? 'planner_ddays'
      : path.startsWith('/routines')
        ? 'planner_routines'
        : path.startsWith('/todos')
          ? 'planner_todos'
          : 'planner_events';
  return accountBoundRemoteKey(`${API}${path}`, account, domain)!;
}

describe('Planner account cache revalidation', () => {
  it('matches every dated Planner family and D-Days for the requested account', () => {
    const affected: Array<[string, string]> = [
      ['/schedules?date=2026-08-18', 'schedule'],
      ['/schedules?date=2026-08-17', 'schedule'],
      ['/schedules/ddays', 'dday'],
      ['/routines_with_logs?date=2026-08-18', 'routine'],
      ['/routines_with_logs?date=2026-08-17', 'routine'],
      ['/workouts?date=2026-08-18', 'workout'],
      ['/workouts?date=2026-08-17', 'workout'],
    ];

    for (const [path, domain] of affected) {
      const accountAKey = key(path, accountA);
      expect(plannerCacheDomainForKey(accountAKey, accountA)).toBe(domain);
      expect(isCurrentAccountPlannerCacheKey(accountAKey, accountA)).toBe(true);
      expect(isCurrentAccountPlannerCacheKey(accountAKey, accountB)).toBe(false);
      expect(isCurrentAccountPlannerCacheKey(key(path, accountB), accountA)).toBe(false);
    }
  });

  it('does not match Todo, weekly, malformed, or unrelated remote keys', () => {
    const todo = key('/todos?date=2026-08-18');
    const weekly = ['health-static', accountA, `${API}/weekly_schedules`] as const;
    const rawUrl = `${API}/schedules?date=2026-08-18`;
    const malformed = `${API}/schedules?date=2026-08-18\u0000absinthe-account=${encodeURIComponent(accountA)}\u0000extra`;

    for (const candidate of [todo, weekly, rawUrl, malformed] as Arguments[]) {
      expect(isCurrentAccountPlannerCacheKey(candidate, accountA)).toBe(false);
    }
  });

  it('revalidates the same Planner key families and clears only restored-account Routine rows', () => {
    const mutate = vi.fn<(filter: (key?: Arguments) => boolean, ...args: unknown[]) => Promise<unknown>>(
      async () => [],
    );

    revalidatePlannerAccountCache(mutate, accountA);

    expect(mutate).toHaveBeenCalledTimes(2);
    const [filter, ...otherArgs] = mutate.mock.calls[0]!;
    const [routineFilter, ...routineArgs] = mutate.mock.calls[1]!;
    expect(otherArgs).toEqual([]); // Other active sources revalidate without clearing data.
    expect(routineArgs).toEqual([undefined]); // An inactive Routine key has no revalidator.
    expect(filter(key('/schedules?date=2026-08-17', accountA))).toBe(true);
    expect(filter(key('/schedules/ddays', accountA))).toBe(true);
    expect(filter(key('/routines_with_logs?date=2026-08-17', accountA))).toBe(false);
    expect(routineFilter(key('/routines_with_logs?date=2026-08-17', accountA))).toBe(true);
    expect(routineFilter(key('/routines_with_logs?date=2026-08-18', accountA))).toBe(true);
    expect(routineFilter(key('/routines_with_logs?date=2026-08-17', accountB))).toBe(false);
    expect(routineFilter(key('/schedules?date=2026-08-17', accountA))).toBe(false);
    expect(routineFilter(key('/schedules/ddays', accountA))).toBe(false);
    expect(routineFilter(key('/workouts?date=2026-08-17', accountA))).toBe(false);
    expect(routineFilter(key('/todos?date=2026-08-17', accountA))).toBe(false);
    expect(routineFilter(weeklyKey(accountA))).toBe(false);
    expect(filter(key('/workouts?date=2026-08-17', accountA))).toBe(true);
    expect(filter(key('/schedules?date=2026-08-17', accountB))).toBe(false);
    expect(filter(key('/schedules/ddays', accountB))).toBe(false);
    expect(filter(key('/todos?date=2026-08-17', accountA))).toBe(false);
    expect(filter(weeklyKey(accountA))).toBe(false);
  });
});

function weeklyKey(account: string): readonly [string, string, string] {
  return ['health-static', account, `${API}/weekly_schedules`];
}
