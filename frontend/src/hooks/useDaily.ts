import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { isLocalOnlyRemotePausedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { remoteSWRKey } from '../lib/remoteBoundary';
import {
  accountBoundRemoteFetcher,
  accountBoundRemoteKey,
  type AccountBoundRemoteKey,
} from '../lib/accountBoundRemote';
import { isLocalOnlyRuntime } from '../lib/localAuth';
import { readLocalHealthDaily } from '../lib/healthLocalRuntime';
import { resolveSearchDatasetState, type SearchDatasetState } from '../lib/searchReadiness';
import { Schedule, Todo, Routine, Workout, Inbody } from '../types';

export interface UseDailyDataResult {
  schedules: Schedule[];
  todos: Todo[];
  /** Readiness for the Search-deferred todo source. */
  todosState: SearchDatasetState;
  routines: Routine[];
  workouts: Workout[];
  inbody: Inbody;
  /** 전체 재검증 */
  mutate: () => void;
  /** todos만 optimistic 업데이트용 */
  mutateTodos: (updater: (cur: Todo[]) => Todo[], revalidate?: boolean) => void;
  /** routines만 optimistic 업데이트용 */
  mutateRoutines: (updater: (cur: Routine[]) => Routine[], revalidate?: boolean) => void;
  isLoading: boolean;
}

export type AccountBoundTodoKey = AccountBoundRemoteKey;

export type AccountBoundInbodyKey = AccountBoundRemoteKey;

/**
 * Keep the request URL unchanged while giving each account its own SWR cache
 * namespace. This prevents a deferred Search activation from reusing another
 * account's todo response after an account transition.
 */
export function accountBoundTodoKey(
  url: string,
  accountId?: string,
  enabled = true,
): AccountBoundTodoKey | null {
  return accountBoundRemoteKey(url, accountId, enabled);
}

const fetchAccountBoundTodo = accountBoundRemoteFetcher;

/**
 * Keep the InBody request URL unchanged while separating each account's SWR
 * cache entry. The account marker is part of the cache identity only; it is
 * never sent to the backend.
 */
export function accountBoundInbodyKey(
  url: string,
  accountId?: string,
  enabled = true,
): AccountBoundInbodyKey | null {
  const remoteKey = remoteSWRKey(url);
  return enabled && accountId && remoteKey
    ? `${remoteKey}\u0000absinthe-account=${encodeURIComponent(accountId)}\u0000inbody`
    : null;
}

const fetchAccountBoundInbody = accountBoundRemoteFetcher;

export function getDailyDataLoading(
  localMode: boolean,
  localHealthLoading: boolean,
  remoteLoading: readonly boolean[],
): boolean {
  return localMode ? localHealthLoading : remoteLoading.some(Boolean);
}

export const useDailyData = (
  dateStr: string,
  onError?: (msg: string) => void,
  accountId?: string,
  healthReady = true,
  todosEnabled?: boolean,
  inbodyEnabled = true,
): UseDailyDataResult => {
  const base = `${API_URL}/api`;
  const localMode = isLocalOnlyRuntime();
  const todoUrlKey = remoteSWRKey(`${base}/todos?date=${dateStr}`);
  const todoCacheKey = todosEnabled === undefined
    ? todoUrlKey
    : accountBoundTodoKey(`${base}/todos?date=${dateStr}`, accountId);
  // Calls that predate the Search seam retain their original URL key. The
  // shell passes an explicit activation flag and receives the account-bound
  // key used by the production Search path.
  const todoKey = todosEnabled === undefined
    ? todoUrlKey
    : todosEnabled ? todoCacheKey : null;
  const inbodyUrl = `${base}/inbody?date=${dateStr}`;
  const inbodyCacheKey = accountBoundInbodyKey(inbodyUrl, accountId);
  const inbodyKey = inbodyEnabled ? inbodyCacheKey : null;
  const schedulesKey = accountBoundRemoteKey(`${base}/schedules?date=${dateStr}`, accountId);
  const routinesKey = accountBoundRemoteKey(`${base}/routines_with_logs?date=${dateStr}`, accountId);
  const workoutsKey = accountBoundRemoteKey(`${base}/workouts?date=${dateStr}`, accountId);

  const { mutate: globalMutate } = useSWRConfig();

  // onError 콜백만 useMemo로 메모이제이션 (showToast는 useCallback으로 안정됨)
  // DAILY_SWR_BASE = {} 는 SWR 기본값과 동일해 실질 효과가 없으므로 제거.
  const swrOpts = useMemo(
    () => ({
      onError: (e: unknown) => {
        if (isLocalOnlyRemotePausedError(e)) return;
        const message = e instanceof Error ? e.message : String(e);
        onError?.(`Fetch failed: ${message}`);
      },
      revalidateOnFocus: false,
    }),
    [onError],
  );

  const { data: schedules = [], mutate: mutateSchedules, isLoading: l1 } =
    useSWR<Schedule[], AccountBoundRemoteKey | null>(schedulesKey, accountBoundRemoteFetcher, swrOpts);

  const {
    data: todosData,
    mutate: mutateTodosRaw,
    isLoading: l2,
    isValidating: todosIsValidating,
    error: todosError,
  } = useSWR<Todo[], AccountBoundTodoKey | null>(todoKey, fetchAccountBoundTodo, swrOpts);
  const todos = todosData ?? [];

  const { data: routines = [], mutate: mutateRoutinesRaw, isLoading: l3 } =
    useSWR<Routine[], AccountBoundRemoteKey | null>(routinesKey, accountBoundRemoteFetcher, swrOpts);

  const { data: workouts = [], mutate: mutateWorkouts, isLoading: l4 } =
    useSWR<Workout[], AccountBoundRemoteKey | null>(workoutsKey, accountBoundRemoteFetcher, swrOpts);

  const { data: inbodyRaw, mutate: mutateInbody, isLoading: l5 } =
    useSWR<Inbody[], AccountBoundInbodyKey | null>(inbodyKey, fetchAccountBoundInbody, swrOpts);

  const localHealthCacheKey = localMode && accountId
    ? ['local-health-daily', accountId, dateStr] as const
    : null;
  // Existing local readiness remains account-bound:
  // localMode && accountId && healthReady ? ['local-health-daily', accountId, dateStr]
  const localHealthKey = localHealthCacheKey && healthReady ? localHealthCacheKey : null;
  const { data: localHealth, mutate: mutateLocalHealth, isLoading: l6 } =
    useSWR(
      localHealthKey,
      ([, ownerId, selectedDate]) => readLocalHealthDaily(ownerId, selectedDate),
      swrOpts,
    );

  /** todos optimistic mutate — updater 함수로 현재 캐시를 즉시 수정 */
  const mutateTodos = useCallback(
    (updater: (cur: Todo[]) => Todo[], revalidate = true) => {
      if (todoKey !== null) {
        mutateTodosRaw(
          (cur) => updater(cur ?? []),
          { revalidate },
        );
      } else if (todoCacheKey !== null) {
        void globalMutate(
          todoCacheKey,
          (cur: Todo[] | undefined) => updater(cur ?? []),
          { revalidate },
        );
      }
    },
    [globalMutate, mutateTodosRaw, todoCacheKey, todoKey],
  );

  /** routines optimistic mutate */
  const mutateRoutines = useCallback(
    (updater: (cur: Routine[]) => Routine[], revalidate = true) => {
      mutateRoutinesRaw(
        (cur) => updater(cur ?? []),
        { revalidate },
      );
    },
    [mutateRoutinesRaw],
  );

  const mutate = useCallback(() => {
    mutateSchedules();
    if (todoKey !== null) mutateTodosRaw();
    else if (todoCacheKey !== null) {
      // The inactive hook has no bound revalidator. Clear its stable cache
      // entry so reset/bootstrap cannot surface stale data on reactivation.
      void globalMutate(todoCacheKey, undefined, { revalidate: false });
    }
    mutateRoutinesRaw();
    mutateWorkouts();
    if (inbodyKey !== null) mutateInbody();
    else if (inbodyCacheKey !== null) {
      // Keep reset/bootstrap invalidation available while InBody is inactive.
      void globalMutate(inbodyCacheKey, undefined, { revalidate: false });
    }
    if (localMode) {
      if (localHealthKey !== null) mutateLocalHealth();
      else if (localHealthCacheKey !== null) {
        void globalMutate(localHealthCacheKey, undefined, { revalidate: false });
      }
    }
  }, [globalMutate, inbodyCacheKey, inbodyKey, localHealthCacheKey, localHealthKey, localMode, mutateInbody, mutateLocalHealth, mutateRoutinesRaw, mutateSchedules, mutateTodosRaw, mutateWorkouts, todoCacheKey, todoKey]);

  const todosState = resolveSearchDatasetState({
    enabled: todoKey !== null,
    data: todosData,
    isLoading: l2,
    isValidating: todosIsValidating,
    error: todosError,
  });

  return {
    schedules,
    todos,
    todosState,
    routines: localMode ? localHealth?.routines ?? [] : routines,
    workouts: localMode ? localHealth?.workouts ?? [] : workouts,
    inbody: localMode ? localHealth?.inbody ?? { weight: 0, smm: 0, pbf: 0 } : inbodyRaw?.[0] ?? { weight: 0, smm: 0, pbf: 0 },
    mutate,
    mutateTodos,
    mutateRoutines,
    // Search-deferred todo loading is intentionally excluded from the global
    // daily spinner; Search owns that group's pending state.
    isLoading: getDailyDataLoading(localMode, l6, [l1, false, l3, l4, l5]),
  };
};
