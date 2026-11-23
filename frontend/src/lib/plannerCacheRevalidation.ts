import type { Arguments, ScopedMutator } from 'swr';
import {
  ACCOUNT_BOUND_REMOTE_SEPARATOR,
  accountBoundRemoteUrl,
} from './accountBoundRemote';

const ACCOUNT_MARKER_PREFIX = 'absinthe-account=';
const PLANNER_DATE_ENDPOINTS = new Set([
  '/api/schedules',
  '/api/routines_with_logs',
  '/api/workouts',
]);

/**
 * Return the Planner domain represented by an account-bound remote cache key.
 * The account marker is cache-only and is never included in the request URL.
 */
export type PlannerCacheDomain = 'schedule' | 'dday' | 'routine' | 'workout';

export function plannerCacheDomainForKey(
  key: Arguments,
  accountId?: string,
): PlannerCacheDomain | null {
  if (!accountId || typeof key !== 'string') return null;

  const separator = key.indexOf(ACCOUNT_BOUND_REMOTE_SEPARATOR);
  if (separator < 0) return null;

  const marker = key.slice(separator + ACCOUNT_BOUND_REMOTE_SEPARATOR.length);
  if (marker !== `${ACCOUNT_MARKER_PREFIX}${encodeURIComponent(accountId)}`) return null;

  let url: URL;
  try {
    url = new URL(accountBoundRemoteUrl(key), 'http://absinthe.local');
  } catch {
    return null;
  }

  if (url.pathname === '/api/schedules/ddays' && [...url.searchParams].length === 0) {
    return 'dday';
  }
  if (!PLANNER_DATE_ENDPOINTS.has(url.pathname) || !url.searchParams.has('date')) {
    return null;
  }
  if (url.pathname === '/api/schedules') return 'schedule';
  if (url.pathname === '/api/routines_with_logs') return 'routine';
  return 'workout';
}

/**
 * SWR's filter mutate targets current-account Planner keys, including entries
 * retained by the provider without a live reader.
 */
export function isCurrentAccountPlannerCacheKey(
  key: Arguments,
  accountId?: string,
): boolean {
  return plannerCacheDomainForKey(key, accountId) !== null;
}

export function revalidatePlannerAccountCache(
  globalMutate: ScopedMutator,
  accountId?: string,
): void {
  if (!accountId) return;
  void globalMutate(key => {
    const domain = plannerCacheDomainForKey(key, accountId);
    return domain !== null && domain !== 'routine';
  });
  // Restore invalidates the old Routine snapshot for every cached date.
  // An active reader revalidates; an inactive key stays cold without a GET.
  void globalMutate(key => plannerCacheDomainForKey(key, accountId) === 'routine', undefined);
}
