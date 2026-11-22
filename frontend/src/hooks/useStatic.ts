import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import useSWR, { unstable_serialize, useSWRConfig } from 'swr';
import { fetcher, isLocalOnlyRemotePausedError, SessionReadUnauthorizedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { remoteSWRKey, runtimeSessionReadOwner, SessionReadOwnerChangedError, type RuntimeSessionReadOwner } from '../lib/remoteBoundary';
import { domainUsesLocalWorkingCopy } from '../lib/syncAuthority';
import type { SyncDomain } from '../lib/syncAuthority';
import { readLocalHealthStatic } from '../lib/healthLocalRuntime';
import { ExerciseBlock, HealthRoutine, WeeklySchedule } from '../types';
import { resolveSearchDatasetState, type SearchDatasetState } from '../lib/searchReadiness';

const STATIC_SWR_BASE = { revalidateOnFocus: false } as const;
const EMPTY_WEEKLY_SCHEDULES: WeeklySchedule[] = [];

interface UseStaticDataResult {
  markedDates: string[];
  healthBlocks: ExerciseBlock[];
  /** Readiness for the Search-deferred Health block source. */
  healthBlocksState: SearchDatasetState;
  healthRoutines: HealthRoutine[];
  /** Verified routine-source readiness, distinct from an empty fallback array. */
  healthRoutinesState: SearchDatasetState;
  weeklySchedules: WeeklySchedule[];
  weeklySchedulesState: SearchDatasetState;
  mutate: () => void;
}

export type AccountBoundHealthStaticKey = readonly ['health-static', string, string];

export function accountBoundHealthStaticKey(
  url: string,
  accountId: string | undefined,
  domain: SyncDomain,
  enabled = true,
): AccountBoundHealthStaticKey | null {
  const remoteKey = remoteSWRKey(url, domain);
  return enabled && accountId && remoteKey ? ['health-static', accountId, remoteKey] : null;
}

const fetchAccountBoundHealthStatic = <T>(key: AccountBoundHealthStaticKey): Promise<T> => fetcher<T>(key[2]);

type WeeklyScheduleReadAttempt = { signal: AbortSignal; failure?: { reason: unknown } };

class WeeklyScheduleReadFailure extends Error {
  constructor(readonly attempt: WeeklyScheduleReadAttempt, readonly reason: unknown) {
    super('Weekly Schedule read failed');
  }

  get current() {
    return !this.attempt.signal.aborted && !(this.reason instanceof SessionReadOwnerChangedError);
  }
}

export const useStaticData = (
  monthStartStr: string,
  monthEndStr: string,
  onError?: (msg: string) => void,
  accountId?: string,
  healthReady = true,
  healthBlocksEnabled = true,
  markedDatesEnabled = true,
  healthRoutinesEnabled = true,
  weeklyEnabled = true,
): UseStaticDataResult => {
  const base = `${API_URL}/api`;
  const localMode = domainUsesLocalWorkingCopy('health_exercise_library');
  const swrConfig = useSWRConfig();
  const { cache, mutate: globalMutate, isPaused, onErrorRetry } = swrConfig;

  const swrOpts = useMemo(
    () => ({
      ...STATIC_SWR_BASE,
      onError: (e: unknown) => {
        if (isLocalOnlyRemotePausedError(e)) return;
        const message = e instanceof Error ? e.message : String(e);
        onError?.(`Static fetch failed: ${message}`);
      },
    }),
    [onError],
  );

  const markedDatesCacheKey = accountBoundHealthStaticKey(
    `${base}/schedules/dates?start_date=${monthStartStr}&end_date=${monthEndStr}`,
    accountId,
    'planner_events',
  );
  const markedDatesKey = markedDatesEnabled ? markedDatesCacheKey : null;
  const { data: rawDates = [], mutate: mutateDates } = useSWR<(string | { date: string })[]>(
    markedDatesKey,
    fetchAccountBoundHealthStatic,
    swrOpts,
  );
  const healthBlocksCacheKey = accountBoundHealthStaticKey(`${base}/blocks`, accountId, 'health_exercise_library', !localMode);
  const healthBlocksKey = healthBlocksEnabled ? healthBlocksCacheKey : null;
  const {
    data: healthBlocksData,
    mutate: mutateBlocks,
    isLoading: healthBlocksIsLoading,
    isValidating: healthBlocksIsValidating,
    error: healthBlocksError,
  } = useSWR<ExerciseBlock[]>(
    healthBlocksKey,
    fetchAccountBoundHealthStatic,
    swrOpts,
  );
  const healthRoutinesCacheKey = accountBoundHealthStaticKey(`${base}/health_routines`, accountId, 'health_routine_presets', !localMode);
  const healthRoutinesKey = healthRoutinesEnabled ? healthRoutinesCacheKey : null;
  const {
    data: remoteHealthRoutines,
    mutate: mutateRoutines,
    isLoading: remoteRoutinesIsLoading,
    isValidating: remoteRoutinesIsValidating,
    error: remoteRoutinesError,
  } = useSWR<HealthRoutine[]>(
    healthRoutinesKey,
    fetchAccountBoundHealthStatic,
    swrOpts,
  );
  const weeklyUrl = `${base}/weekly_schedules`;
  const runtimeOwner = runtimeSessionReadOwner();
  const weeklyOwner = runtimeOwner?.accountId === accountId ? runtimeOwner : null;
  const weeklyKey = accountBoundHealthStaticKey(weeklyUrl, accountId, 'planner_weekly_schedules',
    weeklyEnabled && weeklyOwner !== null && !weeklyOwner.signal.aborted);
  const weeklySubscribed = weeklyKey !== null;
  const [, notifyWeeklyReadChange] = useReducer(revision => revision + 1, 0);
  const weeklyLifetime = useRef<{
    owner: RuntimeSessionReadOwner;
    key: string;
    enabled: boolean;
    subscribed: boolean;
    interrupted: boolean;
  } | null>(null);
  // SWR can update error/loading metadata even for a discarded rejection.
  // Track the latest started read ourselves until it publishes successfully.
  const lastWeeklyAttempt = useRef<WeeklyScheduleReadAttempt | null>(null);
  const previousWeekly = weeklyLifetime.current;
  const quietResume = previousWeekly !== null && previousWeekly.owner === weeklyOwner
    && !previousWeekly.enabled && !previousWeekly.interrupted
    && lastWeeklyAttempt.current?.signal !== weeklyOwner?.signal;
  const weeklyReadNeeded = useRef(false);
  // Commit demand before SWR can start a read for the now-current key.
  useLayoutEffect(() => {
    weeklyReadNeeded.current = weeklySubscribed;
    return () => { weeklyReadNeeded.current = false; };
  }, [weeklySubscribed]);

  const invalidatingWeekly = useRef(false);
  const invalidateWeeklyWithoutRead = useCallback((key: string, signal: AbortSignal, discardData = false) => {
    // Stamp the mutation and discard SWR's in-flight marker synchronously.
    // An acknowledged change while inactive also makes warm rows unusable.
    if (lastWeeklyAttempt.current?.signal === signal) lastWeeklyAttempt.current = null;
    invalidatingWeekly.current = true;
    try {
      void globalMutate(key, undefined, { populateCache: discardData, revalidate: true });
    } finally {
      invalidatingWeekly.current = false;
    }
  }, [globalMutate]);
  const isCurrentWeeklyFailure = (error: unknown): error is WeeklyScheduleReadFailure =>
    weeklyReadNeeded.current && error instanceof WeeklyScheduleReadFailure
    && error.current && lastWeeklyAttempt.current === error.attempt;
  const { data: weeklyData, mutate: mutateWeekly } = useSWR<WeeklySchedule[]>(
    weeklyKey,
    weeklySubscribed && weeklyOwner ? async ([, keyAccount, url]: AccountBoundHealthStaticKey) => {
      const attempt: WeeklyScheduleReadAttempt = { signal: weeklyOwner.signal };
      try {
        // A queued SWR revalidation can keep its old key while using the
        // latest fetcher. Never let a different account's GET use that key.
        if (keyAccount !== weeklyOwner.accountId || attempt.signal.aborted) {
          throw new SessionReadOwnerChangedError();
        }
        lastWeeklyAttempt.current = attempt;
        // Consume deferred refresh only once a fetcher for this owner runs.
        // A warm mount can close again before its SWR frame gets here.
        if (weeklyReadNeeded.current) {
          const lifetime = weeklyLifetime.current;
          if (lifetime?.owner === weeklyOwner) lifetime.interrupted = false;
          notifyWeeklyReadChange();
        }
        const rows = await fetcher<WeeklySchedule[]>(url, weeklyOwner, () => {
          if (lastWeeklyAttempt.current !== attempt || !weeklyReadNeeded.current) {
            throw new SessionReadOwnerChangedError();
          }
        });
        if (!Array.isArray(rows)) throw new Error('Invalid weekly Schedule response');
        return rows;
      } catch (error) {
        const reason = error ?? new Error('Weekly Schedule read failed');
        attempt.failure = { reason };
        // SWR can invoke the latest callback for the same serialized key.
        // Retain the failing request's lifetime, not the current config's.
        throw new WeeklyScheduleReadFailure(attempt, reason);
      }
    } : null,
    {
      ...swrOpts,
      // Normal navigation reuses verified cache data. Known invalidations,
      // account changes and an offline reconnect still require revalidation.
      revalidateIfStale: !quietResume,
      isPaused: () => invalidatingWeekly.current || isPaused(),
      onSuccess: (data, key) => {
        const attempt = lastWeeklyAttempt.current;
        if (attempt && attempt.signal === weeklyOwner?.signal) {
          lastWeeklyAttempt.current = null;
          if (weeklyReadNeeded.current) notifyWeeklyReadChange();
        }
        swrConfig.onSuccess(data, key, swrConfig);
      },
      onError: error => {
        if (isCurrentWeeklyFailure(error)) {
          notifyWeeklyReadChange();
          swrOpts.onError(error.reason);
        }
      },
      onErrorRetry: (error, key, _config, revalidate, options) => {
        if (!isCurrentWeeklyFailure(error) || error.reason instanceof SessionReadUnauthorizedError) return;
        onErrorRetry(error.reason, key, swrConfig, retry => {
          if (isCurrentWeeklyFailure(error)) revalidate(retry);
        }, options);
      },
    },
  );
  // SWR owns cached data, but its raw error/validating slots can be written
  // by a rejected older request. Use only this owner's current attempt.
  const lastAttempt = lastWeeklyAttempt.current;
  const weeklyAttempt = lastAttempt && lastAttempt.signal === weeklyOwner?.signal ? lastAttempt : null;
  const weeklyFailure = weeklyAttempt?.failure;
  const weeklyReadError = weeklyFailure && !(weeklyFailure.reason instanceof SessionReadOwnerChangedError)
    ? weeklyFailure.reason : undefined;
  const weeklyIsValidating = Boolean((weeklyAttempt && !weeklyFailure)
    || (previousWeekly?.owner === weeklyOwner && previousWeekly?.interrupted));
  const weeklySchedulesState = useMemo(() => resolveSearchDatasetState({
    enabled: weeklySubscribed, data: weeklyData, error: weeklyReadError,
    isValidating: weeklyIsValidating,
  }), [weeklySubscribed, weeklyData, weeklyReadError, weeklyIsValidating]);
  useLayoutEffect(() => {
    if (!weeklyOwner || weeklyOwner.signal.aborted) {
      weeklyLifetime.current = null;
      return;
    }
    const key: AccountBoundHealthStaticKey = ['health-static', weeklyOwner.accountId, weeklyUrl];
    const cacheKey = unstable_serialize(key);
    const previous = weeklyLifetime.current;
    // The cold-key SWR effect can start this owner's read before the new
    // lifetime is installed. Do not carry an already-consumed refresh.
    const readAlreadyStarted = lastWeeklyAttempt.current?.signal === weeklyOwner.signal;
    const lifetime = {
      owner: weeklyOwner, key: cacheKey, enabled: weeklyEnabled, subscribed: weeklySubscribed,
      interrupted: !readAlreadyStarted && (previous?.key === cacheKey ? previous.interrupted : !weeklyEnabled),
    };
    weeklyLifetime.current = lifetime;
    const revoke = () => {
      const cached = cache.get(lifetime.key);
      lifetime.interrupted ||= lastWeeklyAttempt.current?.signal === weeklyOwner.signal || cached?.data === undefined;
      invalidateWeeklyWithoutRead(lifetime.key, weeklyOwner.signal);
    };
    const handleReconnect = () => {
      if (weeklyOwner.signal.aborted) return;
      lifetime.interrupted = true;
      invalidateWeeklyWithoutRead(lifetime.key, weeklyOwner.signal);
      if (weeklyEnabled) {
        // No SWR key is subscribed while offline. Let the online event
        // restore the key without waiting for an unrelated app render.
        notifyWeeklyReadChange();
      }
    };
    // Watch the owner even if connectivity temporarily turns the SWR key off:
    // an older in-flight read can still have a cache entry to invalidate.
    weeklyOwner.signal.addEventListener('abort', revoke, { once: true });
    if (!weeklySubscribed) window.addEventListener('online', handleReconnect);
    // Ordinary key changes already revalidate in SWR; only a replaced owner
    // with the same key and an interrupted or deferred read needs a restart.
    if (weeklySubscribed && previous?.subscribed && previous.key === lifetime.key
      && previous.owner !== weeklyOwner && lifetime.interrupted) {
      void globalMutate(key);
    }
    return () => {
      weeklyOwner.signal.removeEventListener('abort', revoke);
      if (!weeklySubscribed) window.removeEventListener('online', handleReconnect);
    };
  }, [cache, globalMutate, invalidateWeeklyWithoutRead, weeklyEnabled, weeklyOwner, weeklySubscribed, weeklyUrl]);
  const localHealthCacheKey = localMode && accountId
    ? ['local-health-static', accountId] as const
    : null;
  const localHealthKey = localHealthCacheKey && healthReady && (healthBlocksEnabled || healthRoutinesEnabled)
    ? localHealthCacheKey
    : null;
  // Existing local readiness remains account-bound:
  // localMode && accountId && healthReady && (healthBlocksEnabled || healthRoutinesEnabled)
  //   ? ['local-health-static', accountId]
  const {
    data: localHealth,
    mutate: mutateLocalHealth,
    isLoading: localHealthIsLoading,
    isValidating: localHealthIsValidating,
    error: localHealthError,
  } = useSWR<{ healthBlocks?: ExerciseBlock[]; healthRoutines?: HealthRoutine[] }>(
    localHealthKey,
    ([, ownerId]: readonly ['local-health-static', string]) => readLocalHealthStatic(ownerId),
    swrOpts,
  );

  const markedDates = useMemo(
    () =>
      rawDates
        .map((d) => (typeof d === 'string' ? d : d.date))
        .filter(Boolean) as string[],
    [rawDates],
  );

  const mutate = useCallback(() => {
    if (markedDatesKey !== null) mutateDates();
    else if (markedDatesCacheKey !== null) {
      // Keep reset/bootstrap invalidation available while markedDates is inactive.
      void globalMutate(markedDatesCacheKey, undefined, { revalidate: false });
    }
    if (healthBlocksKey !== null) mutateBlocks();
    else if (healthBlocksCacheKey !== null) {
      // The inactive hook has no bound revalidator. Clear its stable cache
      // entry so reset/bootstrap cannot surface stale blocks on reactivation.
      void globalMutate(healthBlocksCacheKey, undefined, { revalidate: false });
    }
    if (healthRoutinesKey !== null) mutateRoutines();
    else if (healthRoutinesCacheKey !== null) {
      // Keep reset/bootstrap invalidation available while Health routines are inactive.
      void globalMutate(healthRoutinesCacheKey, undefined, { revalidate: false });
    }
    const weekly = weeklyLifetime.current;
    if (weekly && weekly.owner.accountId === accountId && runtimeSessionReadOwner()?.accountId === accountId) {
      if (!weekly.subscribed) {
        // Invalidate the exact account key, not a previously bound SWR key.
        invalidateWeeklyWithoutRead(weekly.key, weekly.owner.signal, !weekly.enabled);
      } else if (weekly.owner.signal.aborted) {
        // A save or restore can request revalidation after the auth event
        // but before React commits the replacement fetcher for the same key.
        weekly.interrupted = true;
      } else {
        void mutateWeekly();
      }
    }
    if (localMode) {
      if (localHealthKey !== null) mutateLocalHealth();
      else if (localHealthCacheKey !== null) {
        void globalMutate(localHealthCacheKey, undefined, { revalidate: false });
      }
    }
  }, [accountId, globalMutate, healthBlocksCacheKey, healthBlocksKey, healthRoutinesCacheKey, healthRoutinesKey, invalidateWeeklyWithoutRead, localHealthCacheKey, localHealthKey, localMode, markedDatesCacheKey, markedDatesKey, mutateBlocks, mutateDates, mutateLocalHealth, mutateRoutines, mutateWeekly]);

  const healthBlocks = localMode
    ? healthBlocksEnabled ? localHealth?.healthBlocks : []
    : healthBlocksData;
  const healthBlocksState = resolveSearchDatasetState({
    enabled: localMode ? localHealthKey !== null : healthBlocksKey !== null,
    data: healthBlocks,
    isLoading: localMode ? localHealthIsLoading : healthBlocksIsLoading,
    isValidating: localMode ? localHealthIsValidating : healthBlocksIsValidating,
    error: localMode ? localHealthError : healthBlocksError,
  });
  const healthRoutinesState = resolveSearchDatasetState({
    enabled: localMode ? localHealthKey !== null && healthRoutinesEnabled : healthRoutinesKey !== null,
    data: localMode ? localHealth?.healthRoutines : remoteHealthRoutines,
    isLoading: localMode ? localHealthIsLoading : remoteRoutinesIsLoading,
    isValidating: localMode ? localHealthIsValidating : remoteRoutinesIsValidating,
    error: localMode ? localHealthError : remoteRoutinesError,
  });

  return {
    markedDates,
    healthBlocks: healthBlocks ?? [],
    healthBlocksState,
    healthRoutines: localMode
      ? healthRoutinesEnabled ? localHealth?.healthRoutines ?? [] : []
      : remoteHealthRoutines ?? [],
    healthRoutinesState,
    weeklySchedules: (weeklySubscribed ? weeklyData : undefined) ?? EMPTY_WEEKLY_SCHEDULES,
    weeklySchedulesState,
    mutate,
  };
};
