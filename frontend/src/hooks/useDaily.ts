import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import useSWR, { unstable_serialize, useSWRConfig } from 'swr';
import { isLocalOnlyRemotePausedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { remoteSWRKey, runtimeAccountSyncAccountId, runtimeSessionReadOwner } from '../lib/remoteBoundary';
import {
  accountBoundRemoteFetcher,
  accountBoundCacheKey,
  accountBoundRemoteKey,
  type AccountBoundRemoteKey,
} from '../lib/accountBoundRemote';
import { domainUsesLocalWorkingCopy } from '../lib/syncAuthority';
import { readLocalHealthDaily, type LocalHealthDailyProjection } from '../lib/healthLocalRuntime';
import { resolveSearchDatasetState, type SearchDatasetState } from '../lib/searchReadiness';
import { Schedule, Todo, Routine, Workout, Inbody } from '../types';
import { useDailyRoutineReads } from './useDailyRoutineReads';

export interface UseDailyDataResult {
  schedules: Schedule[];
  todos: Todo[];
  /** Readiness for the Search-deferred todo source. */
  todosState: SearchDatasetState;
  routines: Routine[];
  /** Readiness of the Routine list from its existing local or remote authority. */
  routinesState: SearchDatasetState;
  workouts: Workout[];
  inbody: Inbody;
  /** 전체 재검증 */
  mutate: () => void;
  /** Schedule-specific readiness for date-targeted navigation. */
  isScheduleLoading: boolean;
  /** Explicit, account/date-fenced refresh of the selected-day Schedule snapshot. */
  revalidateSelectedDaySchedules: SelectedDayScheduleRevalidator;
  /** todos만 optimistic 업데이트용 */
  mutateTodos: (updater: (cur: Todo[]) => Todo[], revalidate?: boolean) => void;
  /** routines만 optimistic 업데이트용 */
  mutateRoutines: (updater: (cur: Routine[]) => Routine[], revalidate?: boolean) => void;
  isLoading: boolean;
}

export type SelectedDayScheduleRevalidator = (
  accountId: string,
  dateKey: string,
  isStillCurrent: () => boolean,
) => Promise<void>;

export type AccountBoundTodoKey = AccountBoundRemoteKey;

export type AccountBoundInbodyKey = AccountBoundRemoteKey;

type LocalHealthDailyKey = readonly ['local-health-daily', string, string];
const EMPTY_ROUTINES: Routine[] = [];
const DISCARDED_LOCAL_DAILY_READ = Symbol('discarded local daily read');
type LocalDailyReadLifetime = {
  key: LocalHealthDailyKey;
  session: AbortSignal | undefined;
  retired: boolean;
  detached: boolean;
  interrupted: boolean;
  attempt?: LocalDailyReadAttempt;
};

type LocalDailyReadAttempt = { lifetime: LocalDailyReadLifetime; pending: boolean };

function reserveLocalDailyRead(lifetime: LocalDailyReadLifetime): LocalDailyReadAttempt {
  const attempt = { lifetime, pending: true };
  lifetime.attempt = attempt;
  return attempt;
}

class LocalDailyReadFailure extends Error {
  constructor(readonly attempt: LocalDailyReadAttempt, readonly reason: unknown) {
    super('Local daily Health read failed');
  }
}

function matchesLocalDailyKey(lifetime: LocalDailyReadLifetime | null, key: LocalHealthDailyKey) {
  return lifetime?.key[1] === key[1] && lifetime.key[2] === key[2];
}

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
  return accountBoundRemoteKey(url, accountId, 'planner_todos', enabled);
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
  const remoteKey = remoteSWRKey(url, 'health_inbody');
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
  routinesEnabled?: boolean,
): UseDailyDataResult => {
  const base = `${API_URL}/api`;
  const localMode = domainUsesLocalWorkingCopy('health_workouts');
  const todoUrlKey = remoteSWRKey(`${base}/todos?date=${dateStr}`, 'planner_todos');
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
  const inbodyCacheKey = accountBoundInbodyKey(inbodyUrl, accountId, !localMode);
  const inbodyKey = inbodyEnabled ? inbodyCacheKey : null;
  const schedulesKey = accountBoundRemoteKey(`${base}/schedules?date=${dateStr}`, accountId, 'planner_events');
  const routinesKey = accountBoundRemoteKey(`${base}/routines_with_logs?date=${dateStr}`, accountId, 'planner_routines');
  const workoutsKey = accountBoundRemoteKey(`${base}/workouts?date=${dateStr}`, accountId, 'health_workouts', !localMode);

  const scheduleContextRef = useRef({ accountId, dateStr, key: schedulesKey, generation: 0 });
  const previousScheduleContext = scheduleContextRef.current;
  if (previousScheduleContext.accountId !== accountId
    || previousScheduleContext.dateStr !== dateStr
    || previousScheduleContext.key !== schedulesKey) {
    scheduleContextRef.current = {
      accountId,
      dateStr,
      key: schedulesKey,
      generation: previousScheduleContext.generation + 1,
    };
  }

  const swrConfig = useSWRConfig();
  const { cache, mutate: globalMutate } = swrConfig;

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

  const revalidateSelectedDaySchedules = useCallback<SelectedDayScheduleRevalidator>(async (
    expectedAccountId,
    expectedDateKey,
    isStillCurrent,
  ) => {
    const requestContext = scheduleContextRef.current;
    if (requestContext.accountId !== expectedAccountId
      || requestContext.dateStr !== expectedDateKey
      || runtimeAccountSyncAccountId() !== expectedAccountId
      || requestContext.key === null
      || !isStillCurrent()) {
      throw new Error('Selected-day Schedule refresh is no longer available.');
    }

    const freshSchedules = await accountBoundRemoteFetcher<Schedule[]>(requestContext.key);
    if (!Array.isArray(freshSchedules)) throw new Error('Invalid selected-day Schedule response.');
    if (scheduleContextRef.current !== requestContext
      || runtimeAccountSyncAccountId() !== expectedAccountId
      || !isStillCurrent()) {
      throw new Error('Selected-day Schedule refresh became stale.');
    }

    // Publish only to this hook's account/date-bound SWR key after an
    // authoritative GET succeeds; a failed or stale response leaves cache intact.
    await mutateSchedules(freshSchedules, { revalidate: false });
  }, [mutateSchedules]);

  const {
    data: todosData,
    mutate: mutateTodosRaw,
    isLoading: l2,
    isValidating: todosIsValidating,
    error: todosError,
  } = useSWR<Todo[], AccountBoundTodoKey | null>(todoKey, fetchAccountBoundTodo, swrOpts);
  const todos = todosData ?? [];

  const remoteRoutines = useDailyRoutineReads(routinesKey,
    accountBoundCacheKey(`${base}/routines_with_logs?date=${dateStr}`, accountId),
    accountId, routinesEnabled === undefined ? undefined : routinesEnabled && !localMode, swrOpts);

  const { data: workouts = [], mutate: mutateWorkouts, isLoading: l4 } =
    useSWR<Workout[], AccountBoundRemoteKey | null>(workoutsKey, accountBoundRemoteFetcher, swrOpts);

  const { data: inbodyRaw, mutate: mutateInbody, isLoading: l5 } =
    useSWR<Inbody[], AccountBoundInbodyKey | null>(inbodyKey, fetchAccountBoundInbody, swrOpts);

  const localHealthCacheKey = useMemo<LocalHealthDailyKey | null>(() => localMode && accountId
    ? ['local-health-daily', accountId, dateStr] as const
    : null, [localMode, accountId, dateStr]);
  // Existing local readiness remains account-bound:
  // localMode && accountId && healthReady ? ['local-health-daily', accountId, dateStr]
  const session = localHealthCacheKey ? runtimeSessionReadOwner() : null;
  const sessionSignal = session?.signal;
  const localHealthKey = healthReady && (!session || session.accountId === accountId) ? localHealthCacheKey : null;
  const localLifetime = useRef<LocalDailyReadLifetime | null>(null);
  const localPublications = useMemo(() => new WeakMap<LocalHealthDailyProjection, LocalDailyReadAttempt>(), []);
  const invalidatingLocalHealth = useRef(false);
  const isCurrentLifetime = (lifetime: LocalDailyReadLifetime) =>
    localLifetime.current === lifetime && !lifetime.retired && !lifetime.session?.aborted;
  const isCurrentAttempt = (attempt: LocalDailyReadAttempt) =>
    isCurrentLifetime(attempt.lifetime) && attempt.lifetime.attempt === attempt;
  const isCurrentLocalFailure = (error: unknown): error is LocalDailyReadFailure =>
    error instanceof LocalDailyReadFailure && isCurrentAttempt(error.attempt);
  const invalidateLocalHealthRead = useCallback((key: LocalHealthDailyKey, clearData = false) => {
    // Retire SWR's pending/deduped request for this exact key without
    // triggering a new read or dropping an already accepted snapshot.
    invalidatingLocalHealth.current = true;
    try {
      // A custom SWR provider may already be disposed during parent unmount.
      void Promise.resolve(globalMutate(key, undefined, { populateCache: clearData, revalidate: true })).catch(() => {});
    } finally {
      invalidatingLocalHealth.current = false;
    }
  }, [globalMutate]);

  // Install the current date/session lifetime before SWR subscribes to it.
  useLayoutEffect(() => {
    const previous = localLifetime.current;
    if (!localHealthKey) {
      localLifetime.current = null;
      return;
    }
    const lifetime: LocalDailyReadLifetime = {
      key: localHealthKey, session: sessionSignal, retired: false, detached: false, interrupted: false,
    };
    localLifetime.current = lifetime;
    const serialized = unstable_serialize(localHealthKey);
    const retire = () => {
      lifetime.retired = true;
      if (lifetime.attempt?.pending || cache?.get(serialized)?.isValidating) {
        lifetime.interrupted = true;
        invalidateLocalHealthRead(lifetime.key);
      }
    };
    if (sessionSignal?.aborted) retire();
    else sessionSignal?.addEventListener('abort', retire, { once: true });

    // The same SWR key can survive token rotation or StrictMode cleanup.
    // Start a replacement through the committed subscription, not the old
    // request: a custom provider can have replaced its request registry.
    if (previous && matchesLocalDailyKey(previous, localHealthKey)
      && (previous.session !== sessionSignal || previous.interrupted)) {
      const cached = cache?.get(serialized);
      lifetime.interrupted = Boolean(previous?.interrupted || cached?.data === undefined);
      if (lifetime.interrupted) {
        queueMicrotask(() => {
          if (!lifetime.retired && !sessionSignal?.aborted && !lifetime.attempt) void globalMutate(localHealthKey);
        });
      }
    }
    return () => {
      lifetime.detached = true;
      sessionSignal?.removeEventListener('abort', retire);
      retire();
    };
  }, [cache, globalMutate, invalidateLocalHealthRead, localHealthKey, sessionSignal]);

  const localHealthRead =
    useSWR<LocalHealthDailyProjection | typeof DISCARDED_LOCAL_DAILY_READ | undefined, LocalHealthDailyKey | null>(
      localHealthKey,
      async (key: LocalHealthDailyKey) => {
        const startedIn = localLifetime.current;
        // Reserve ownership before yielding so a superseded rejection can't
        // hide this request from retirement by clearing SWR's loading flags.
        const reservation = startedIn && matchesLocalDailyKey(startedIn, key)
          ? reserveLocalDailyRead(startedIn) : null;
        // SWR installs its request marker after calling the fetcher. Give
        // StrictMode replay a chance to retire that marker before any I/O.
        await Promise.resolve();
        const lifetime = localLifetime.current;
        if (reservation && startedIn !== lifetime) return DISCARDED_LOCAL_DAILY_READ;
        if (!lifetime || !matchesLocalDailyKey(lifetime, key)) {
          // A delayed warm revalidation may still hold the previous key.
          if (!startedIn?.detached && !matchesLocalDailyKey(startedIn, key)) invalidateLocalHealthRead(key);
          return DISCARDED_LOCAL_DAILY_READ;
        }
        if (!isCurrentLifetime(lifetime)) {
          // A scheduled revalidation can start between auth revocation and
          // the React commit. Retire its marker as well, with no local I/O.
          if (!lifetime.detached) invalidateLocalHealthRead(key);
          return DISCARDED_LOCAL_DAILY_READ;
        }
        const attempt = reservation?.lifetime === lifetime ? reservation : reserveLocalDailyRead(lifetime);
        if (!isCurrentAttempt(attempt)) return DISCARDED_LOCAL_DAILY_READ;
        lifetime.interrupted = false;
        try {
          const snapshot = await readLocalHealthDaily(key[1], key[2]);
          if (!isCurrentAttempt(attempt)) return DISCARDED_LOCAL_DAILY_READ;
          if (snapshot) localPublications.set(snapshot, attempt);
          return snapshot;
        } catch (error) {
          if (isCurrentAttempt(attempt)) throw new LocalDailyReadFailure(attempt, error);
          return DISCARDED_LOCAL_DAILY_READ;
        }
      },
      {
        ...swrOpts,
        compare: (previous, next) => {
          // A provider can lose or replace its mutation registry before an
          // old SWR continuation settles. Never publish a retired snapshot
          // or let a discarded read replace verified cache data with empty.
          if (next === DISCARDED_LOCAL_DAILY_READ) return true;
          const attempt = next && localPublications.get(next);
          return Boolean(attempt && !isCurrentAttempt(attempt)) || swrConfig.compare(previous, next);
        },
        isPaused: () => invalidatingLocalHealth.current || Boolean(swrConfig.isPaused?.()),
        onSuccess: (data, key) => {
          if (!data || data === DISCARDED_LOCAL_DAILY_READ) return;
          const attempt = localPublications.get(data);
          if (!attempt || !isCurrentAttempt(attempt) || unstable_serialize(attempt.lifetime.key) !== key) return;
          // The reader promise can resolve before SWR admits the result.
          attempt.pending = false;
          localPublications.delete(data);
          queueMicrotask(() => { if (isCurrentAttempt(attempt)) swrConfig.onSuccess(data, key, swrConfig); });
        },
        onError: (error: unknown) => {
          if (isCurrentLocalFailure(error)) {
            error.attempt.pending = false;
            swrOpts.onError(error.reason);
          }
        },
        shouldRetryOnError: (error: unknown) => isCurrentLocalFailure(error)
          && (typeof swrConfig.shouldRetryOnError === 'function'
            ? swrConfig.shouldRetryOnError(error.reason) : swrConfig.shouldRetryOnError),
        onErrorRetry: (error, key, _config, revalidate, options) => {
          if (!isCurrentLocalFailure(error)) return;
          swrConfig.onErrorRetry(error.reason, key, swrConfig, retry => {
            if (isCurrentLocalFailure(error)) revalidate(retry);
          }, options);
        },
      },
    );
  const { data: localHealthResult, mutate: mutateLocalHealth, isLoading: localHealthLoading, error: localHealthError } = localHealthRead;
  const localHealth = localHealthResult === DISCARDED_LOCAL_DAILY_READ ? undefined : localHealthResult;
  // Settlement from an obsolete attempt must not turn off the current cold-read spinner.
  const displayedLifetime = localLifetime.current;
  const l6 = localHealthLoading || Boolean(localHealthKey && !localHealth && displayedLifetime?.attempt?.pending
    && !isCurrentLocalFailure(localHealthError) && isCurrentAttempt(displayedLifetime.attempt)
    && matchesLocalDailyKey(displayedLifetime, localHealthKey));

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

  const refreshRoutines = remoteRoutines.refresh;
  const mutate = useCallback(() => {
    mutateSchedules();
    if (todoKey !== null) mutateTodosRaw();
    else if (todoCacheKey !== null) {
      // The inactive hook has no bound revalidator. Clear its stable cache
      // entry so reset/bootstrap cannot surface stale data on reactivation.
      void globalMutate(todoCacheKey, undefined, { revalidate: false });
    }
    refreshRoutines();
    mutateWorkouts();
    if (inbodyKey !== null) mutateInbody();
    else if (inbodyCacheKey !== null) {
      // Keep reset/bootstrap invalidation available while InBody is inactive.
      void globalMutate(inbodyCacheKey, undefined, { revalidate: false });
    }
    if (localMode) {
      if (localHealthKey !== null) mutateLocalHealth();
      else if (localHealthCacheKey !== null) {
        invalidateLocalHealthRead(localHealthCacheKey, true);
      }
    }
  }, [globalMutate, inbodyCacheKey, inbodyKey, invalidateLocalHealthRead, localHealthCacheKey, localHealthKey, localMode, mutateInbody, mutateLocalHealth, refreshRoutines, mutateSchedules, mutateTodosRaw, mutateWorkouts, todoCacheKey, todoKey]);

  const todosState = resolveSearchDatasetState({
    enabled: todoKey !== null,
    data: todosData,
    isLoading: l2,
    isValidating: todosIsValidating,
    error: todosError,
  });

  const localRoutinesEnabled = localHealthKey !== null && routinesEnabled !== false;
  const localRoutines = routinesEnabled === false ? undefined : localHealth?.routines;
  const localRoutinesError = isCurrentLocalFailure(localHealthError) ? localHealthError.reason : undefined;
  const localRoutinesValidating = localRoutinesEnabled && localHealthRead.isValidating;
  const localRoutinesState = useMemo(() => resolveSearchDatasetState({
    enabled: localRoutinesEnabled, data: localRoutines, isLoading: l6, error: localRoutinesError,
    isValidating: localRoutinesValidating,
  }), [localRoutinesEnabled, localRoutines, l6, localRoutinesError, localRoutinesValidating]);

  return {
    schedules,
    todos,
    todosState,
    routines: (localMode ? localRoutines : remoteRoutines.response) ?? EMPTY_ROUTINES,
    routinesState: localMode ? localRoutinesState : remoteRoutines.state,
    workouts: localMode ? localHealth?.workouts ?? [] : workouts,
    inbody: localMode ? localHealth?.inbody ?? { weight: 0, smm: 0, pbf: 0 } : inbodyRaw?.[0] ?? { weight: 0, smm: 0, pbf: 0 },
    mutate,
    isScheduleLoading: l1,
    revalidateSelectedDaySchedules,
    mutateTodos,
    mutateRoutines: remoteRoutines.mutateRoutines,
    // Search-deferred Todo and Routine loading belongs to Search, not the
    // global spinner. Omitted activation retains legacy loading semantics.
    isLoading: getDailyDataLoading(localMode, l6, [l1, false, routinesEnabled === undefined && remoteRoutines.isLoading, l4, l5]),
  };
};
