import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { accountBoundRemoteFetcher, accountBoundRemoteUrl, type AccountBoundRemoteKey } from '../lib/accountBoundRemote';
import { fetcher, SessionReadUnauthorizedError } from '../lib/fetcher';
import { runtimeSessionReadOwner, SessionReadOwnerChangedError } from '../lib/remoteBoundary';
import { resolveSearchDatasetState } from '../lib/searchReadiness';
import type { Routine } from '../types';

const DISCARDED = Symbol();
type RoutineResponse = Routine[] | typeof DISCARDED;
type RoutineReadScope = { key: string; attempt?: object };
class RoutineReadFailure extends Error {
  constructor(readonly current: () => boolean, readonly reason: unknown) {
    super('Daily Routine read failed');
  }
}

/** Owns only the optional remote subscription; the existing account/date cache stays shared. */
export function useDailyRoutineReads(
  transportKey: AccountBoundRemoteKey | null,
  cacheKey: AccountBoundRemoteKey | null,
  accountId: string | undefined,
  enabled: boolean | undefined,
  options: { onError: (error: unknown) => void; revalidateOnFocus: boolean },
) {
  const swr = useSWRConfig();
  const { cache, mutate: globalMutate } = swr;
  const legacy = enabled === undefined;
  const session = legacy ? null : runtimeSessionReadOwner();
  const owner = session && session.accountId === accountId && !session.signal.aborted ? session : null;
  const key = legacy ? transportKey : enabled && owner ? transportKey : null;
  const mutationScope = useMemo(() => cacheKey && owner ? { cacheKey, owner } : null, [cacheKey, owner]);
  const currentMutationScope = useRef<typeof mutationScope>(null);
  useLayoutEffect(() => {
    currentMutationScope.current = mutationScope;
    return () => { currentMutationScope.current = null; };
  }, [mutationScope]);

  const readScope = useRef<RoutineReadScope | null>(null);
  // A response is still revocable between fetcher settlement and SWR admission
  // (including provider replay, when SWR's request registry can change).
  const publications = useMemo(() => new WeakMap<Routine[], () => boolean>(), []);
  const [, observeOnline] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    if (!enabled || !owner || key) return;
    // Leaving offline mode may restore the transport key without a tab change.
    window.addEventListener('online', observeOnline);
    return () => window.removeEventListener('online', observeOnline);
  }, [enabled, key, owner]);

  useLayoutEffect(() => {
    if (!key || !owner) return;
    const scope: RoutineReadScope = { key };
    readScope.current = scope;
    const retire = () => {
      if (readScope.current !== scope) return;
      readScope.current = null;
      // Drop the pending SWR request marker without launching a read from the
      // old revalidator (isPaused below). Keep already verified warm data.
      void globalMutate(key).catch(() => {});
    };
    owner.signal.addEventListener('abort', retire, { once: true });
    // Start after subscription, including a new session with the same key.
    // Unlike SWR's warm-mount animation frame this cannot start after departure.
    queueMicrotask(() => {
      if (readScope.current === scope && !scope.attempt && !owner.signal.aborted) void globalMutate(key);
    });
    return () => {
      owner.signal.removeEventListener('abort', retire);
      retire();
    };
  }, [globalMutate, key, owner]);

  const isCurrentFailure = (error: unknown): error is RoutineReadFailure =>
    error instanceof RoutineReadFailure && error.current();
  const read = async (requestedKey: AccountBoundRemoteKey): Promise<RoutineResponse> => {
    const scope = readScope.current;
    if (!owner || scope?.key !== requestedKey || owner.signal.aborted) return DISCARDED;
    const attempt = {};
    scope.attempt = attempt;
    const current = () => readScope.current === scope && scope.attempt === attempt && !owner.signal.aborted;
    try {
      const rows = await fetcher<Routine[]>(accountBoundRemoteUrl(requestedKey), owner, () => {
        if (!current()) throw new SessionReadOwnerChangedError();
      });
      if (!current()) return DISCARDED;
      if (!Array.isArray(rows)) throw new Error('Invalid daily Routine response');
      publications.set(rows, current);
      return rows;
    } catch (error) {
      if (!current()) return DISCARDED;
      throw new RoutineReadFailure(current, error ?? new Error('Daily Routine read failed'));
    }
  };
  const { data, error, isLoading, isValidating, mutate } = useSWR<RoutineResponse, AccountBoundRemoteKey | null>(
    key, legacy ? accountBoundRemoteFetcher : read, legacy ? options : {
      ...options,
      keepPreviousData: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      isPaused: () => !readScope.current || Boolean(owner?.signal.aborted) || swr.isPaused(),
      compare: (prior, next) => next === DISCARDED
        || (Array.isArray(next) && publications.get(next)?.() === false)
        || swr.compare(prior, next),
      onSuccess: (rows, key) => {
        if (!Array.isArray(rows)) return;
        const current = publications.get(rows);
        if (!current?.()) return;
        publications.delete(rows);
        queueMicrotask(() => { if (current()) swr.onSuccess(rows, key, swr); });
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

  const mutateRoutines = useCallback((update: (current: Routine[]) => Routine[], revalidate = true) => {
    const updater = (current: RoutineResponse | undefined) => update(Array.isArray(current) ? current : []);
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
    else if (mutationScope && currentMutationScope.current === mutationScope && !mutationScope.owner.signal.aborted) {
      const { cacheKey } = mutationScope;
      if (readScope.current?.key === cacheKey) void globalMutate(cacheKey);
      else if (cache.get(cacheKey)) {
        // A known invalidation must not look like verified warm data on reopen.
        void globalMutate(cacheKey, undefined, { revalidate: false });
      }
    }
  }, [cache, globalMutate, legacy, mutate, mutationScope]);

  const response = (legacy || key) && Array.isArray(data) ? data : undefined;
  const reason = legacy ? error : isCurrentFailure(error) ? error.reason : undefined;
  const state = useMemo(() => resolveSearchDatasetState({
    enabled: key !== null, data: response, error: reason, isLoading, isValidating,
  }), [key, response, reason, isLoading, isValidating]);

  return { response, state, isLoading, mutateRoutines, refresh };
}
