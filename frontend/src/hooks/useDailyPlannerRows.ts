import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { accountBoundRemoteFetcher, accountBoundRemoteUrl, type AccountBoundRemoteKey } from '../lib/accountBoundRemote';
import { fetcher, SessionReadUnauthorizedError } from '../lib/fetcher';
import { runtimeSessionReadOwner, SessionReadOwnerChangedError, type RuntimeSessionReadOwner } from '../lib/remoteBoundary';
import { resolveSearchDatasetState } from '../lib/searchReadiness';
import { invalidateChangedScheduleDates, observeScheduleInvalidation } from '../lib/plannerCacheRevalidation';

const DISCARDED = Symbol();
type DailyResponse<Row> = Row[] | typeof DISCARDED;
type ReadScope = { key: string; attempt?: object; manual?: object; manualFailure?: unknown };
type WarmSchedule = { key: string; owner: RuntimeSessionReadOwner };
class DailyReadFailure extends Error {
  constructor(readonly current: () => boolean, readonly reason: unknown, source: string) {
    super(`Daily ${source} read failed`);
  }
}

/** Owns only the optional remote subscription; the existing account/date cache stays shared. */
export function useDailyPlannerRows<Row>(
  source: 'Routine' | 'Schedule',
  transportKey: AccountBoundRemoteKey | null,
  cacheKey: AccountBoundRemoteKey | null,
  accountId: string | undefined,
  enabled: boolean | undefined,
  options: { onError: (error: unknown) => void; revalidateOnFocus: boolean },
  searchDemand?: () => boolean,
) {
  const swr = useSWRConfig();
  const { cache, mutate: globalMutate } = swr;
  const legacy = enabled === undefined;
  const isSchedule = source === 'Schedule';
  const session = legacy ? null : runtimeSessionReadOwner(isSchedule ? 'schedule' : undefined);
  const owner = session && session.accountId === accountId && !session.signal.aborted ? session : null;
  const key = legacy ? transportKey : enabled && owner && searchDemand?.() !== false ? transportKey : null;
  const mutationScope = useMemo(() => cacheKey && owner ? { cacheKey, owner } : null, [cacheKey, owner]);
  const currentMutationScope = useRef<typeof mutationScope>(null);
  useLayoutEffect(() => {
    currentMutationScope.current = mutationScope;
    return () => { currentMutationScope.current = null; };
  }, [mutationScope]);

  const readScope = useRef<ReadScope | null>(null);
  // The previously verified SWR value need not be fetched again just because
  // the same Schedule consumer closed and reopened. Never remember an
  // interrupted or failed read; explicit invalidation still clears the key.
  const warmSchedule = useRef<WarmSchedule | null>(null);
  const verifiedSchedules = useMemo(() => new WeakMap<Row[], WarmSchedule>(), []);
  // A response is still revocable between fetcher settlement and SWR admission
  // (including provider replay, when SWR's request registry can change).
  const publications = useMemo(() => new WeakMap<Row[], () => boolean>(), []);
  const [, observeReadState] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    if (!owner || (key !== null) || (!enabled && !isSchedule)) return;
    const reconnect = () => {
      if (isSchedule) warmSchedule.current = null;
      // Leaving offline mode may restore a demanded transport key.
      if (enabled) observeReadState();
    };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [enabled, isSchedule, key, owner]);

  useLayoutEffect(() => {
    if (!key || !owner) return;
    const scope: ReadScope = { key };
    readScope.current = scope;
    const retire = () => {
      if (readScope.current !== scope) return;
      readScope.current = null;
      // Drop the pending SWR request marker without launching a read from the
      // old revalidator (isPaused below). Keep already verified warm data.
      void globalMutate(key).catch(() => {});
    };
    const stopInvalidation = isSchedule ? observeScheduleInvalidation(globalMutate, matches => {
      if (readScope.current !== scope || !matches(key)) return;
      scope.attempt = undefined;
      scope.manual = undefined;
      scope.manualFailure = undefined;
      warmSchedule.current = null;
      const cached = cache.get(key)?.data;
      if (Array.isArray(cached)) verifiedSchedules.delete(cached);
    }) : undefined;
    owner.signal.addEventListener('abort', retire, { once: true });
    // Start after subscription, including a new session with the same key.
    // Unlike SWR's warm-mount animation frame this cannot start after departure.
    queueMicrotask(() => {
      if (readScope.current !== scope || scope.attempt || owner.signal.aborted || searchDemand?.() === false) return;
      const cached = cache.get(key)?.data;
      if (warmSchedule.current?.key === key && warmSchedule.current.owner === owner
        && Array.isArray(cached) && verifiedSchedules.get(cached)?.owner === owner
        && verifiedSchedules.get(cached)?.key === key) return;
      void globalMutate(key);
    });
    return () => {
      owner.signal.removeEventListener('abort', retire);
      stopInvalidation?.();
      retire();
    };
  }, [cache, globalMutate, isSchedule, key, owner, searchDemand, verifiedSchedules]);

  const isCurrentFailure = (error: unknown): error is DailyReadFailure =>
    error instanceof DailyReadFailure && error.current();
  const read = async (requestedKey: AccountBoundRemoteKey): Promise<DailyResponse<Row>> => {
    const scope = readScope.current;
    if (!owner || scope?.key !== requestedKey || owner.signal.aborted || searchDemand?.() === false) return DISCARDED;
    const attempt = {};
    scope.attempt = attempt;
    if (isSchedule) {
      warmSchedule.current = null;
      scope.manualFailure = undefined;
    }
    const current = () => readScope.current === scope && scope.attempt === attempt
      && !owner.signal.aborted && searchDemand?.() !== false;
    try {
      const rows = await fetcher<Row[]>(accountBoundRemoteUrl(requestedKey), owner, () => {
        if (!current()) throw new SessionReadOwnerChangedError();
      });
      if (!current()) return DISCARDED;
      if (!Array.isArray(rows)) throw new Error(`Invalid daily ${source} response`);
      // Keep verification local to this exact Schedule response/key.
      const snapshot = isSchedule ? [...rows] : rows;
      publications.set(snapshot, current);
      return snapshot;
    } catch (error) {
      if (!current()) return DISCARDED;
      throw new DailyReadFailure(current, error ?? new Error(`Daily ${source} read failed`), source);
    }
  };
  const { data, error, isLoading, isValidating, mutate } = useSWR<DailyResponse<Row>, AccountBoundRemoteKey | null>(
    key, legacy ? accountBoundRemoteFetcher : read, legacy ? options : {
      ...options,
      keepPreviousData: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      isPaused: () => !readScope.current || Boolean(owner?.signal.aborted) || searchDemand?.() === false || swr.isPaused(),
      compare: (prior, next) => next === DISCARDED
        || (Array.isArray(next) && publications.get(next)?.() === false)
        || (!(isSchedule && Array.isArray(next) && publications.has(next) && Array.isArray(prior)
          && (verifiedSchedules.get(prior)?.owner !== owner || verifiedSchedules.get(prior)?.key !== key))
          && swr.compare(prior, next)),
      onSuccess: (rows, key) => {
        if (!Array.isArray(rows)) return;
        const current = publications.get(rows);
        if (!current?.()) return;
        publications.delete(rows);
        if (isSchedule && owner) verifiedSchedules.set(rows, { key, owner });
        queueMicrotask(() => {
          if (!current()) return;
          if (isSchedule && owner) warmSchedule.current = { key, owner };
          swr.onSuccess(rows, key, swr);
        });
      },
      onError: error => { if (isCurrentFailure(error)) options.onError(error.reason); },
      shouldRetryOnError: error => isCurrentFailure(error)
        && !(error.reason instanceof SessionReadUnauthorizedError)
        && (typeof swr.shouldRetryOnError === 'function' ? swr.shouldRetryOnError(error.reason) : swr.shouldRetryOnError),
      onErrorRetry: (error, key, _config, revalidate, retryOptions) => {
        if (!isCurrentFailure(error)) return;
        swr.onErrorRetry(error.reason, key, swr, retry => {
          if (isCurrentFailure(error)) revalidate(retry);
        }, retryOptions);
      },
    },
  );

  const mutateRows = useCallback((update: (current: Row[]) => Row[], revalidate = true) => {
    const updater = (current: DailyResponse<Row> | undefined) => update(Array.isArray(current) ? current : []);
    if (legacy) void mutate(updater, { revalidate });
    else if (mutationScope && currentMutationScope.current === mutationScope && !mutationScope.owner.signal.aborted) {
      const { cacheKey } = mutationScope;
      const reading = readScope.current;
      // A pre-mutation GET cannot replace the optimistic value even if SWR's
      // request and mutation registries were recreated by a provider replay.
      if (reading?.key === cacheKey) reading.attempt = undefined;
      // Without a live read or warm base, an optimistic operation cannot
      // construct a complete snapshot (or register it for restore filters).
      else if (!Array.isArray(cache.get(cacheKey)?.data)) return;
      void globalMutate(cacheKey, updater, { revalidate });
    }
  }, [cache, globalMutate, legacy, mutate, mutationScope]);

  const refresh = useCallback(() => {
    if (legacy) void mutate();
    else {
      const current = currentMutationScope.current;
      if (!current || !mutationScope || current.owner !== mutationScope.owner || current.owner.signal.aborted) return;
      if (!isSchedule && current !== mutationScope) return;
      if (readScope.current?.key === current.cacheKey) void globalMutate(current.cacheKey);
      else if (!isSchedule && cache.get(current.cacheKey)) {
        // Do not present pre-change warm rows after a closed source reopens.
        void globalMutate(current.cacheKey, undefined, { revalidate: false });
      }
    }
  }, [cache, globalMutate, isSchedule, legacy, mutate, mutationScope]);

  const invalidateChangedDates = useCallback((dates: readonly string[] | null): boolean => {
    const current = currentMutationScope.current;
    if (!mutationScope || !current || current.owner !== mutationScope.owner || current.owner.signal.aborted) return false;
    invalidateChangedScheduleDates(globalMutate, current.owner.accountId, dates);
    return true;
  }, [globalMutate, mutationScope]);

  const readFresh = useCallback(async (isStillCurrent: () => boolean) => {
    const scope = readScope.current;
    const publication = {};
    const admitted = () => isStillCurrent() && (legacy || (
      !!owner && !owner.signal.aborted && currentMutationScope.current === mutationScope
        && !!scope && readScope.current === scope && scope.key === key
        && searchDemand?.() !== false
    ));
    if (!key || !admitted()) throw new Error(`Selected-day ${source} refresh is no longer available.`);
    if (scope) {
      scope.manual = publication;
      scope.manualFailure = undefined;
    }
    const current = () => admitted() && (legacy || scope?.manual === publication);
    const fresh = async () => {
      const rows = legacy ? await accountBoundRemoteFetcher<Row[]>(key)
        : await fetcher<Row[]>(accountBoundRemoteUrl(key), owner!, () => {
        if (!current()) throw new SessionReadOwnerChangedError();
      });
      if (!Array.isArray(rows)) throw new Error(`Invalid selected-day ${source} response.`);
      if (!current()) throw new Error(`Selected-day ${source} refresh became stale.`);
      return rows;
    };
    if (legacy) {
      const rows = await fresh();
      if (!current()) throw new Error(`Selected-day ${source} refresh became stale.`);
      await globalMutate(key, rows, { revalidate: false });
      return;
    }
    try {
      const rows = await fresh();
      if (!current()) throw new Error(`Selected-day ${source} refresh became stale.`);
      // Only successful manual reads supersede SWR GETs. An independent
      // in-flight automatic success is still useful when this read fails.
      scope!.attempt = undefined;
      verifiedSchedules.set(rows, { key, owner: owner! });
      warmSchedule.current = { key, owner: owner! };
      await globalMutate(key, rows, { revalidate: false });
    } catch (error) {
      if (scope && current()) {
        scope.manualFailure = error;
        observeReadState();
      }
      throw error;
    } finally {
      if (scope?.manual === publication) scope.manual = undefined;
    }
  }, [globalMutate, key, legacy, mutationScope, owner, searchDemand, source, verifiedSchedules]);

  const verification = !legacy && isSchedule && Array.isArray(data) ? verifiedSchedules.get(data) : undefined;
  const response = (legacy || key) && Array.isArray(data)
    && (legacy || !isSchedule || (verification?.owner === owner && verification?.key === key)) ? data : undefined;
  const validating = isValidating && (legacy || !isSchedule || Boolean(readScope.current?.attempt));
  const manualFailure = isSchedule && key && readScope.current?.key === key && !response && !validating
    ? readScope.current.manualFailure : undefined;
  const reason = legacy ? error : isCurrentFailure(error) ? error.reason : manualFailure;
  const state = useMemo(() => resolveSearchDatasetState({
    enabled: key !== null, data: response, error: reason, isLoading: isLoading && validating, isValidating: validating,
  }), [key, response, reason, isLoading, validating]);

  return { response, state, isLoading, mutateRows, refresh, readFresh, invalidateChangedDates };
}
