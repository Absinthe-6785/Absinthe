import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CompositeWorkoutReadIsolationError,
} from './compositeWorkoutReadProjection';
import {
  WorkoutReadSnapshotCoordinator,
  type WorkoutRangeView,
} from './verifiedWorkoutRangeSnapshot';

export type WorkoutRangeBounds = Readonly<{ startDate: string; endDate: string }>;

export type HealthWorkoutRangeReadModel = Readonly<{
  phase: 'disabled' | 'loading' | 'settled';
  accountId: string;
  previousBounds: WorkoutRangeBounds;
  monthBounds: WorkoutRangeBounds;
  previousView: WorkoutRangeView | null;
  monthView: WorkoutRangeView | null;
  isolationError: boolean;
  retry: () => void;
  /** Synchronously fences old publications before scheduling a fresh pair. */
  invalidateAndReload: () => void;
}>;

type StoredRangeRead = Omit<HealthWorkoutRangeReadModel, 'retry' | 'invalidateAndReload'>;

type RangeCoordinator = Pick<WorkoutReadSnapshotCoordinator,
  'load' | 'deriveRange' | 'invalidate' | 'close' | 'currentSnapshot'>;

export type HealthWorkoutRangeDependencies = Readonly<{
  createCoordinator?: (accountId: string, storage: Storage) => RangeCoordinator;
  deviceStorage?: Storage;
}>;

function initialState(
  enabled: boolean,
  accountId: string,
  previousBounds: WorkoutRangeBounds,
  monthBounds: WorkoutRangeBounds,
): StoredRangeRead {
  return {
    phase: enabled ? 'loading' : 'disabled',
    accountId,
    previousBounds,
    monthBounds,
    previousView: null,
    monthView: null,
    isolationError: false,
  };
}

/**
 * One account-scoped owner for the paired Workout range source snapshot.
 * It owns no browser listeners and exposes no repository or mutation API.
 */
export function useHealthWorkoutRangeSnapshot(
  enabled: boolean,
  accountId: string,
  previousBounds: WorkoutRangeBounds,
  monthBounds: WorkoutRangeBounds,
  dependencies?: HealthWorkoutRangeDependencies,
): HealthWorkoutRangeReadModel {
  const [refresh, setRefresh] = useState(0);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [stored, setStored] = useState<StoredRangeRead>(() => (
    initialState(enabled, accountId, previousBounds, monthBounds)
  ));
  const coordinatorRef = useRef<RangeCoordinator | null>(null);
  const ownerEpoch = useRef(0);
  const publicationSequence = useRef(0);
  const automaticCurrentnessRetryUsed = useRef(false);
  const currentRef = useRef({ enabled, accountId, previousBounds, monthBounds });
  currentRef.current = { enabled, accountId, previousBounds, monthBounds };

  const invalidateAndReload = useCallback(() => {
    const current = currentRef.current;
    if (!current.enabled) return;
    automaticCurrentnessRetryUsed.current = false;
    publicationSequence.current += 1;
    coordinatorRef.current?.invalidate();
    setStored(initialState(true, current.accountId, current.previousBounds, current.monthBounds));
    setRefresh(value => value + 1);
  }, []);

  const recoverCurrentnessOrSettle = useCallback(() => {
    const current = currentRef.current;
    if (!current.enabled) return;
    publicationSequence.current += 1;
    coordinatorRef.current?.invalidate();
    if (automaticCurrentnessRetryUsed.current) {
      setStored({
        phase: 'settled',
        accountId: current.accountId,
        previousBounds: current.previousBounds,
        monthBounds: current.monthBounds,
        previousView: null,
        monthView: null,
        isolationError: false,
      });
      return;
    }
    automaticCurrentnessRetryUsed.current = true;
    setStored(initialState(true, current.accountId, current.previousBounds, current.monthBounds));
    setRefresh(value => value + 1);
  }, []);

  const retry = invalidateAndReload;

  useEffect(() => {
    ownerEpoch.current += 1;
    publicationSequence.current += 1;
    automaticCurrentnessRetryUsed.current = false;
    coordinatorRef.current?.close();
    coordinatorRef.current = null;
    if (!enabled) {
      setStored(initialState(false, accountId, previousBounds, monthBounds));
      return undefined;
    }
    const createCoordinator = dependencies?.createCoordinator
      ?? ((owner: string, storage: Storage) => new WorkoutReadSnapshotCoordinator(owner, storage));
    const storage = dependencies?.deviceStorage ?? window.localStorage;
    coordinatorRef.current = createCoordinator(accountId, storage);
    setStored(initialState(true, accountId, previousBounds, monthBounds));
    return () => {
      ownerEpoch.current += 1;
      publicationSequence.current += 1;
      coordinatorRef.current?.close();
      coordinatorRef.current = null;
    };
  // Bounds deliberately do not create a new source lifecycle.
  }, [enabled, accountId, dependencies?.createCoordinator, dependencies?.deviceStorage]);

  useEffect(() => {
    if (!enabled || !coordinatorRef.current) return;
    const coordinator = coordinatorRef.current;
    const epoch = ownerEpoch.current;
    const sequence = ++publicationSequence.current;
    const capturedAccount = accountId;
    const isCurrent = () => currentRef.current.enabled
      && currentRef.current.accountId === capturedAccount
      && coordinatorRef.current === coordinator
      && ownerEpoch.current === epoch
      && publicationSequence.current === sequence;
    setStored(initialState(true, accountId, currentRef.current.previousBounds, currentRef.current.monthBounds));
    void coordinator.load().then(snapshot => {
      if (!isCurrent()) return;
      if (!snapshot) {
        recoverCurrentnessOrSettle();
        return;
      }
      setSourceRevision(value => value + 1);
    }).catch((error: unknown) => {
      if (!isCurrent()) return;
      setStored(previous => ({
        ...previous,
        phase: 'settled',
        previousView: null,
        monthView: null,
        isolationError: error instanceof CompositeWorkoutReadIsolationError,
      }));
    });
  }, [enabled, accountId, refresh, recoverCurrentnessOrSettle]);

  useEffect(() => {
    if (!enabled || !coordinatorRef.current?.currentSnapshot) return;
    const coordinator = coordinatorRef.current;
    const epoch = ownerEpoch.current;
    const sequence = ++publicationSequence.current;
    const capturedAccount = accountId;
    const capturedPrevious = { ...previousBounds };
    const capturedMonth = { ...monthBounds };
    const isCurrent = () => currentRef.current.enabled
      && currentRef.current.accountId === capturedAccount
      && currentRef.current.previousBounds.startDate === capturedPrevious.startDate
      && currentRef.current.previousBounds.endDate === capturedPrevious.endDate
      && currentRef.current.monthBounds.startDate === capturedMonth.startDate
      && currentRef.current.monthBounds.endDate === capturedMonth.endDate
      && coordinatorRef.current === coordinator
      && ownerEpoch.current === epoch
      && publicationSequence.current === sequence;
    setStored(previous => ({ ...previous, phase: 'loading', accountId,
      previousBounds: capturedPrevious, monthBounds: capturedMonth }));
    void Promise.all([
      coordinator.deriveRange(capturedPrevious.startDate, capturedPrevious.endDate),
      coordinator.deriveRange(capturedMonth.startDate, capturedMonth.endDate),
    ]).then(([previousView, monthView]) => {
      if (!isCurrent()) return;
      if (!previousView || !monthView) {
        recoverCurrentnessOrSettle();
        return;
      }
      automaticCurrentnessRetryUsed.current = false;
      setStored({
        phase: 'settled',
        accountId,
        previousBounds: capturedPrevious,
        monthBounds: capturedMonth,
        previousView,
        monthView,
        isolationError: false,
      });
    }).catch((error: unknown) => {
      if (!isCurrent()) return;
      setStored({
        phase: 'settled',
        accountId,
        previousBounds: capturedPrevious,
        monthBounds: capturedMonth,
        previousView: null,
        monthView: null,
        isolationError: error instanceof CompositeWorkoutReadIsolationError,
      });
    });
  }, [enabled, accountId, previousBounds.startDate, previousBounds.endDate,
    monthBounds.startDate, monthBounds.endDate, sourceRevision, recoverCurrentnessOrSettle]);

  const visible = enabled
    && stored.accountId === accountId
    && stored.previousBounds.startDate === previousBounds.startDate
    && stored.previousBounds.endDate === previousBounds.endDate
    && stored.monthBounds.startDate === monthBounds.startDate
    && stored.monthBounds.endDate === monthBounds.endDate
    ? stored
    : initialState(enabled, accountId, previousBounds, monthBounds);
  return { ...visible, retry, invalidateAndReload };
}
