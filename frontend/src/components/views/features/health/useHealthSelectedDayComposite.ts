import { useCallback, useEffect, useRef, useState } from 'react';
import { HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT } from '../../../../lib/healthSupabaseBootstrap';
import { LocalDatabaseError } from '../../../../lib/localDatabase/errors';
import { WorkoutSelectedDayReader, readEstablishedWorkoutDeviceId,
  type SelectedDayCanonicalScope } from '../../../../lib/workoutSelectedDayReader';
import type { LocalHealthDailyProjection } from '../../../../lib/healthLocalRuntime';
import {
  CompositeWorkoutReadIsolationError, projectCompositeWorkoutRead,
  type ActiveCanonicalWorkoutReadInput, type CompositeWorkoutReadResult,
  type LegacyWorkoutReadInput, type SourceRead,
} from './compositeWorkoutReadProjection';
import { loadVerifiedSelectedDayLegacySnapshot } from './selectedDayLegacySnapshot';

/** A cache identity, not an invalidation counter. No unverified rows enter it. */
export function selectedDayCompositeKey(scope: SelectedDayCanonicalScope, date: string): readonly string[] {
  return ['health-selected-day-composite', scope.accountId, scope.namespaceKey, scope.generationId, date];
}

export type HealthSelectedDayReadModel = Readonly<{
  phase: 'loading' | 'settled';
  accountId: string;
  localDate: string;
  cacheKey: readonly string[] | null;
  result: CompositeWorkoutReadResult | null;
  legacyDaily: LocalHealthDailyProjection | null;
  isolationError: boolean;
  retry: () => void;
}>;

type StoredRead = Omit<HealthSelectedDayReadModel, 'retry'>;

function loading(accountId: string, localDate: string): StoredRead {
  return { phase: 'loading', accountId, localDate, cacheKey: null,
    result: null, legacyDaily: null, isolationError: false };
}

/** Activated only by the repository-local static gate. Never starts G5A or a writer. */
export function useHealthSelectedDayComposite(
  enabled: boolean, accountId: string, localDate: string,
): HealthSelectedDayReadModel {
  const [refresh, setRefresh] = useState(0);
  const [stored, setStored] = useState<StoredRead>(() => loading(accountId, localDate));
  const requestSequence = useRef(0);
  const mountEpoch = useRef(0);
  const readerRef = useRef<WorkoutSelectedDayReader | null>(null);
  const openingRef = useRef<Promise<WorkoutSelectedDayReader> | null>(null);
  const currentRef = useRef({ enabled, accountId, localDate });
  currentRef.current = { enabled, accountId, localDate };

  const retry = useCallback(() => {
    if (!currentRef.current.enabled) return;
    // Supersede synchronously, including before React can schedule the next effect.
    requestSequence.current += 1;
    setRefresh(value => value + 1);
  }, []);

  useEffect(() => {
    mountEpoch.current += 1;
    return () => {
      mountEpoch.current += 1;
      requestSequence.current += 1;
      readerRef.current?.close();
      readerRef.current = null;
      const opening = openingRef.current;
      openingRef.current = null;
      if (opening) void opening.then(reader => reader.close(), () => undefined);
    };
  }, [enabled, accountId]);

  useEffect(() => {
    if (!enabled) return;
    const onBootstrap = () => retry();
    let lastFocus = 0;
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastFocus < 250) return;
      lastFocus = now;
      retry();
    };
    window.addEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, onBootstrap);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT, onBootstrap);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [enabled, accountId, retry]);

  useEffect(() => {
    if (!enabled) return;
    const sequence = ++requestSequence.current;
    const epoch = mountEpoch.current;
    const captured = { accountId, localDate };
    const isCurrent = () => requestSequence.current === sequence
      && mountEpoch.current === epoch
      && currentRef.current.enabled
      && currentRef.current.accountId === captured.accountId
      && currentRef.current.localDate === captured.localDate;
    setStored(previous => previous.accountId === accountId && previous.localDate === localDate
      ? { ...loading(accountId, localDate), legacyDaily: previous.legacyDaily }
      : loading(accountId, localDate));

    async function openReader(): Promise<WorkoutSelectedDayReader> {
      const existing = readerRef.current;
      if (existing) {
        if (existing.accountId === accountId
          && existing.deviceId === readEstablishedWorkoutDeviceId(window.localStorage)) return existing;
        existing.close();
        readerRef.current = null;
      }
      if (!openingRef.current) {
        const opening = WorkoutSelectedDayReader.open(accountId, window.localStorage);
        openingRef.current = opening;
        void opening.then(reader => {
          if (openingRef.current === opening) {
            readerRef.current = reader;
            openingRef.current = null;
          } else reader.close();
        }, () => { if (openingRef.current === opening) openingRef.current = null; });
      }
      return openingRef.current;
    }

    async function readCanonical(): Promise<{
      scope: SelectedDayCanonicalScope | null;
      source: SourceRead<ActiveCanonicalWorkoutReadInput>;
      isolationError: boolean;
    }> {
      let reader: WorkoutSelectedDayReader | null = null;
      try {
        reader = await openReader();
        if (!isCurrent()) return { scope: null, source: { status: 'error' }, isolationError: false };
        try {
          return { scope: reader.scope, source: { status: 'success', records: await reader.read(localDate) }, isolationError: false };
        } catch (error) {
          if (!(error instanceof LocalDatabaseError) || error.code !== 'STALE_GENERATION') throw error;
          reader.close();
          if (readerRef.current === reader) readerRef.current = null;
          if (!isCurrent()) return { scope: null, source: { status: 'error' }, isolationError: false };
          reader = await openReader();
          return { scope: reader.scope, source: { status: 'success', records: await reader.read(localDate) }, isolationError: false };
        }
      } catch (error) {
        return { scope: reader && readerRef.current === reader ? reader.scope : null,
          source: { status: 'error' },
          isolationError: error instanceof CompositeWorkoutReadIsolationError };
      }
    }

    void (async () => {
      // One verified legacy read produces both editor and projection inputs.
      const [legacy, canonical] = await Promise.all([
        loadVerifiedSelectedDayLegacySnapshot(accountId, localDate)
          .then(value => ({ value, source: { status: 'success', records: value.persistedRows } as SourceRead<LegacyWorkoutReadInput>, isolationError: false }))
          .catch((error: unknown) => ({ value: null, source: { status: 'error' } as SourceRead<LegacyWorkoutReadInput>,
            isolationError: error instanceof CompositeWorkoutReadIsolationError })),
        readCanonical(),
      ]);
      if (!isCurrent()) return;
      if (legacy.isolationError || canonical.isolationError) {
        setStored({ phase: 'settled', accountId, localDate, cacheKey: null,
          result: null, legacyDaily: null, isolationError: true });
        return;
      }
      if (canonical.scope) {
        try {
          if (readerRef.current?.scope.namespaceKey !== canonical.scope.namespaceKey
            || readerRef.current?.scope.generationId !== canonical.scope.generationId) {
            retry();
            return;
          }
          await readerRef.current.verifyCurrentScope();
        } catch (error) {
          if (!isCurrent()) return;
          if (error instanceof LocalDatabaseError && error.code === 'STALE_GENERATION') {
            readerRef.current?.close();
            readerRef.current = null;
            retry();
            return;
          }
          // A metadata failure is an unavailable canonical source, never a
          // license to publish the previously captured generation.
          canonical.source = { status: 'error' };
        }
      }
      // A changed device cannot publish a result from its former namespace.
      if (canonical.scope) {
        try {
          if (readEstablishedWorkoutDeviceId(window.localStorage) !== canonical.scope.deviceId) {
            retry();
            return;
          }
        } catch {
          // Existing malformed identity is not repaired; surface canonical
          // unavailability through the next scoped load.
          retry();
          return;
        }
      }
      try {
        // The placeholder context is used only when canonical opening failed;
        // it cannot validate or fabricate a canonical record.
        const scope = canonical.scope ?? { accountId, deviceId: '',
          namespaceKey: 'canonical-unavailable', generationId: 'canonical-unavailable' };
        const legacySource: SourceRead<LegacyWorkoutReadInput> = legacy.source.status === 'success'
          && legacy.source.records.every(row => row?.localDate === localDate)
          ? legacy.source : { status: 'error' };
        const canonicalSource: SourceRead<ActiveCanonicalWorkoutReadInput> = canonical.source.status === 'success'
          && canonical.source.records.every(row => row?.session?.localDate === localDate)
          ? canonical.source : { status: 'error' };
        const result = projectCompositeWorkoutRead({
          context: { accountId, namespaceKey: scope.namespaceKey, generationId: scope.generationId },
          legacy: legacySource, canonical: canonicalSource,
        });
        if (!isCurrent()) return;
        setStored(previous => {
          if (!isCurrent()) return previous;
          const sameLegacy = previous.accountId === accountId && previous.localDate === localDate
            && previous.legacyDaily && legacy.value
            && JSON.stringify(previous.legacyDaily) === JSON.stringify(legacy.value.daily);
          return { phase: 'settled', accountId, localDate,
            cacheKey: canonical.scope ? selectedDayCompositeKey(canonical.scope, localDate) : null,
            result, legacyDaily: legacySource.status === 'success' && legacy.value
              ? sameLegacy ? previous.legacyDaily : legacy.value.daily : null,
            isolationError: false };
        });
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof CompositeWorkoutReadIsolationError) {
          setStored({ phase: 'settled', accountId, localDate, cacheKey: null,
            result: null, legacyDaily: null, isolationError: true });
        } else {
          setStored({ phase: 'settled', accountId, localDate, cacheKey: null,
            result: null, legacyDaily: null, isolationError: false });
        }
      }
    })();
    return () => { requestSequence.current += 1; };
  }, [enabled, accountId, localDate, refresh]);

  const visible = enabled && stored.accountId === accountId && stored.localDate === localDate
    ? stored : loading(accountId, localDate);
  return { ...visible, retry };
}
