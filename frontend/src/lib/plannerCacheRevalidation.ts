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
 * SWR's filter mutate revalidates every matching key, including inactive
 * entries retained by the provider. Keep the predicate account- and
 * endpoint-scoped so other accounts and unrelated domains remain untouched.
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
  void globalMutate(key => isCurrentAccountPlannerCacheKey(key, accountId));
}
