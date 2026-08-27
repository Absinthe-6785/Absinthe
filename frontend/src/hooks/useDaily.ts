import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher, isLocalOnlyRemotePausedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { remoteSWRKey } from '../lib/remoteBoundary';
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

export type AccountBoundTodoKey = string;

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
  const remoteKey = remoteSWRKey(url);
  return enabled && accountId && remoteKey
    ? `${remoteKey}\u0000absinthe-account=${encodeURIComponent(accountId)}`
    : null;
}

const fetchAccountBoundTodo = <T>(key: AccountBoundTodoKey): Promise<T> => {
  const separator = key.indexOf('\u0000');
  return fetcher<T>(separator >= 0 ? key.slice(0, separator) : key);
};

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
): UseDailyDataResult => {
  const base = `${API_URL}/api`;
  const localMode = isLocalOnlyRuntime();
  const todoUrlKey = remoteSWRKey(`${base}/todos?date=${dateStr}`);
  // Calls that predate the Search seam retain their original URL key. The
  // shell passes an explicit activation flag and receives the account-bound
  // key used by the production Search path.
  const todoKey = todosEnabled === undefined
    ? todoUrlKey
    : accountBoundTodoKey(`${base}/todos?date=${dateStr}`, accountId, todosEnabled);

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
    useSWR<Schedule[]>(remoteSWRKey(`${base}/schedules?date=${dateStr}`), fetcher, swrOpts);

  const {
    data: todosData,
    mutate: mutateTodosRaw,
    isLoading: l2,
    isValidating: todosIsValidating,
    error: todosError,
  } = useSWR<Todo[], AccountBoundTodoKey | null>(todoKey, fetchAccountBoundTodo, swrOpts);
  const todos = todosData ?? [];

  const { data: routines = [], mutate: mutateRoutinesRaw, isLoading: l3 } =
    useSWR<Routine[]>(remoteSWRKey(`${base}/routines_with_logs?date=${dateStr}`), fetcher, swrOpts);

  const { data: workouts = [], mutate: mutateWorkouts, isLoading: l4 } =
    useSWR<Workout[]>(remoteSWRKey(`${base}/workouts?date=${dateStr}`), fetcher, swrOpts);

  const { data: inbodyRaw, mutate: mutateInbody, isLoading: l5 } =
    useSWR<Inbody[]>(remoteSWRKey(`${base}/inbody?date=${dateStr}`), fetcher, swrOpts);

  const { data: localHealth, mutate: mutateLocalHealth, isLoading: l6 } =
    useSWR(
      localMode && accountId && healthReady ? ['local-health-daily', accountId, dateStr] as const : null,
      ([, ownerId, selectedDate]) => readLocalHealthDaily(ownerId, selectedDate),
      swrOpts,
    );

  /** todos optimistic mutate — updater 함수로 현재 캐시를 즉시 수정 */
  const mutateTodos = useCallback(
    (updater: (cur: Todo[]) => Todo[], revalidate = true) => {
      mutateTodosRaw(
        (cur) => updater(cur ?? []),
        { revalidate },
      );
    },
    [mutateTodosRaw],
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
    mutateTodosRaw();
    mutateRoutinesRaw();
    mutateWorkouts();
    mutateInbody();
    if (localMode) mutateLocalHealth();
  }, [localMode, mutateSchedules, mutateTodosRaw, mutateRoutinesRaw, mutateWorkouts, mutateInbody, mutateLocalHealth]);

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
