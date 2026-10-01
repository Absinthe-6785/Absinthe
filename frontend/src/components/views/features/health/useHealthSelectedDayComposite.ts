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

export type HealthSelectedDayCompositeOptions = Readonly<{
  /** AppContent owns the shared bootstrap/focus/visibility lifecycle. */
  managedLifecycle?: boolean;
}>;

type StoredRead = Omit<HealthSelectedDayReadModel, 'retry'>;
type Publication = { scopeVersion: number; sequence: number; epoch: number };

function loading(accountId: string, localDate: string): StoredRead {
  return { phase: 'loading', accountId, localDate, cacheKey: null,
    result: null, legacyDaily: null, isolationError: false };
}

/** Activated only by the repository-local static gate. Never starts G5A or a writer. */
export function useHealthSelectedDayComposite(
  enabled: boolean, accountId: string, localDate: string,
  options?: HealthSelectedDayCompositeOptions,
): HealthSelectedDayReadModel {
  const [refresh, setRefresh] = useState(0);
  const [stored, setStored] = useState<StoredRead & Publication>(() => ({
    ...loading(accountId, localDate), scopeVersion: -1, sequence: -1, epoch: -1,
  }));
  const requestSequence = useRef(0);
  const mountEpoch = useRef(0);
  const readerRef = useRef<WorkoutSelectedDayReader | null>(null);
  const openingRef = useRef<Promise<WorkoutSelectedDayReader> | null>(null);
  const currentRef = useRef({ enabled, accountId, localDate, scopeVersion: 0 });
  const previousScope = currentRef.current;
  if (previousScope.enabled !== enabled || previousScope.accountId !== accountId || previousScope.localDate !== localDate) {
    // Render-time fencing also covers the interval before effect cleanup/setup.
    currentRef.current = { enabled, accountId, localDate, scopeVersion: previousScope.scopeVersion + 1 };
  }

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
    if (!enabled || options?.managedLifecycle) return;
    const onBootstrap = () => retry();
    let lastFocus = -Infinity;
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
  }, [enabled, accountId, options?.managedLifecycle, retry]);

  useEffect(() => {
    if (!enabled) return;
    const sequence = ++requestSequence.current;
    const epoch = mountEpoch.current;
    const scopeVersion = currentRef.current.scopeVersion;
    const captured = { accountId, localDate };
    const isCurrent = () => requestSequence.current === sequence
      && mountEpoch.current === epoch
      && currentRef.current.scopeVersion === scopeVersion
      && currentRef.current.enabled
      && currentRef.current.accountId === captured.accountId
      && currentRef.current.localDate === captured.localDate;
    const publish = (value: StoredRead) => setStored(previous => isCurrent()
      ? { ...value, scopeVersion, sequence, epoch } : previous);
    // Retain only the previous verified daily object's identity internally.
    // It is never exposed while loading and is reused only after a fresh pair agrees.
    setStored(previous => isCurrent() ? {
      ...loading(accountId, localDate), scopeVersion, sequence, epoch,
      legacyDaily: previous.scopeVersion === scopeVersion ? previous.legacyDaily : null,
    } : previous);
    // Separate from readCanonical's single internal stale-generation reopen.
    // Each manual/lifecycle request starts a new, finite whole-pair episode.
    let automaticRecoveryRemaining = 1;
    const recoverCurrentness = () => {
      if (!isCurrent()) return;
      readerRef.current?.close();
      readerRef.current = null;
      if (automaticRecoveryRemaining-- > 0) void loadPair();
      else publish({ ...loading(accountId, localDate), phase: 'settled' });
    };

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
          if (!isCurrent()) return { scope: null, source: { status: 'error' }, isolationError: false };
          reader.close();
          if (readerRef.current === reader) readerRef.current = null;
          if (!isCurrent()) return { scope: null, source: { status: 'error' }, isolationError: false };
          reader = await openReader();
          if (!isCurrent()) return { scope: null, source: { status: 'error' }, isolationError: false };
          return { scope: reader.scope, source: { status: 'success', records: await reader.read(localDate) }, isolationError: false };
        }
      } catch (error) {
        return { scope: reader && readerRef.current === reader ? reader.scope : null,
          source: { status: 'error' },
          isolationError: error instanceof CompositeWorkoutReadIsolationError };
      }
    }

    async function loadPair() {
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
        publish({ phase: 'settled', accountId, localDate, cacheKey: null,
          result: null, legacyDaily: null, isolationError: true });
        return;
      }
      if (canonical.scope) {
        try {
          if (readerRef.current?.scope.namespaceKey !== canonical.scope.namespaceKey
            || readerRef.current?.scope.generationId !== canonical.scope.generationId) {
            recoverCurrentness();
            return;
          }
          await readerRef.current.verifyCurrentScope();
          if (!isCurrent()) return;
        } catch (error) {
          if (!isCurrent()) return;
          if (error instanceof LocalDatabaseError && error.code === 'STALE_GENERATION') {
            recoverCurrentness();
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
            recoverCurrentness();
            return;
          }
        } catch {
          // Never repair identity; one bounded new pair may observe its new scope.
          recoverCurrentness();
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
            isolationError: false, scopeVersion, sequence, epoch };
        });
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof CompositeWorkoutReadIsolationError) {
          publish({ phase: 'settled', accountId, localDate, cacheKey: null,
            result: null, legacyDaily: null, isolationError: true });
        } else {
          publish({ phase: 'settled', accountId, localDate, cacheKey: null,
            result: null, legacyDaily: null, isolationError: false });
        }
      }
    }
    void loadPair();
    return () => { requestSequence.current += 1; };
  }, [enabled, accountId, localDate, refresh]);

  const visible = enabled && stored.accountId === accountId && stored.localDate === localDate
    && stored.scopeVersion === currentRef.current.scopeVersion
    && stored.sequence === requestSequence.current && stored.epoch === mountEpoch.current
    ? stored.phase === 'loading' ? loading(accountId, localDate) : stored
    : loading(accountId, localDate);
  return { ...visible, retry };
}
