import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HealthExerciseComparisonBorrower, type HealthExerciseComparisonPort, type HealthExerciseComparisonRead } from './healthExerciseComparisonBorrower';
import type { WorkoutExerciseComparisonContext } from '../../../../lib/workoutExerciseComparisonOwner';
import {
  CompositeWorkoutReadIsolationError,
} from './compositeWorkoutReadProjection';
import {
  WorkoutReadSnapshotCoordinator,
  type WorkoutRangeView,
} from './verifiedWorkoutRangeSnapshot';

export type WorkoutRangeBounds = Readonly<{ startDate: string; endDate: string }>;

/** One optional child view; never a repository, cache, or source owner. */
export type WorkoutRangePreviewScope = Readonly<{
  localDate: string;
  lifetime: object;
  isCurrent: () => boolean;
}>;
export type WorkoutRangePreviewRead = Readonly<{
  scope: WorkoutRangePreviewScope;
  phase: 'loading' | 'settled';
  view: WorkoutRangeView | null;
  isolationError: boolean;
  publication: object | null;
  isCurrent: () => boolean;
}>;

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
  previewRead?: WorkoutRangePreviewRead;
  isPreviewCurrent: (read: WorkoutRangePreviewRead) => boolean;
  exerciseComparison?: HealthExerciseComparisonRead;
}>;

type StoredRangeRead = Omit<HealthWorkoutRangeReadModel, 'retry' | 'invalidateAndReload' | 'isPreviewCurrent' | 'exerciseComparison'>;

type RangeCoordinator = Pick<WorkoutReadSnapshotCoordinator,
  'load' | 'deriveRange' | 'invalidate' | 'close' | 'currentSnapshot'>
  & Partial<Pick<WorkoutReadSnapshotCoordinator, 'captureCurrentSnapshot'>>;

export type HealthWorkoutRangeDependencies = Readonly<{
  createCoordinator?: (accountId: string, storage: Storage) => RangeCoordinator;
  deviceStorage?: Storage;
}>;

type CommittedRangeSource = Readonly<{
  accountId: string;
  coordinator: RangeCoordinator;
  factory: HealthWorkoutRangeDependencies['createCoordinator'];
  deviceStorage: HealthWorkoutRangeDependencies['deviceStorage'];
}>;
type CommittedComparison = Readonly<{
  source: CommittedRangeSource;
  selectedDate: string;
  borrower: HealthExerciseComparisonBorrower;
  port: HealthExerciseComparisonPort;
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
  previewScope?: WorkoutRangePreviewScope,
  comparisonContext?: WorkoutExerciseComparisonContext,
): HealthWorkoutRangeReadModel {
  const [refresh, setRefresh] = useState(0);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [stored, setStored] = useState<StoredRangeRead>(() => (
    initialState(enabled, accountId, previousBounds, monthBounds)
  ));
  const coordinatorRef = useRef<RangeCoordinator | null>(null);
  const sourceLifetimeRef = useRef<CommittedRangeSource | null>(null);
  const comparisonRef = useRef<HealthExerciseComparisonBorrower | null>(null);
  const committedComparisonRef = useRef<CommittedComparison | null>(null);
  const [committedComparison, setCommittedComparison] = useState<CommittedComparison | null>(null);
  const ownerEpoch = useRef(0);
  const publicationSequence = useRef(0);
  const automaticCurrentnessRetryUsed = useRef(false);
  const currentRef = useRef({ enabled, accountId, previousBounds, monthBounds, previewScope, comparisonContext });
  // Async source callbacks and durable commit handlers observe the LAST COMMIT,
  // never props from a suspended/abandoned render.
  useLayoutEffect(() => {
    currentRef.current = { enabled, accountId, previousBounds, monthBounds, previewScope, comparisonContext };
  });
  const comparisonEnabled = enabled && !!comparisonContext?.enabled;
  const comparisonDate = comparisonContext?.selectedDate ?? '';
  useLayoutEffect(() => {
    const source = sourceLifetimeRef.current;
    const previous = committedComparisonRef.current;
    const eligible = comparisonEnabled && source?.accountId === accountId
      && source.factory === dependencies?.createCoordinator
      && source.deviceStorage === dependencies?.deviceStorage
      && source.coordinator === coordinatorRef.current && source.coordinator.captureCurrentSnapshot;
    if (eligible && previous?.source === source && previous.selectedDate === comparisonDate) return;
    // Reconcile only after a render commits. The render guard below hides an
    // incompatible old port, including from descendant layout effects (which run
    // before this parent effect). publish() always awaits durable verification;
    // this synchronous layout fence runs before its continuation can consume.
    comparisonRef.current?.close(false);
    comparisonRef.current = null;
    committedComparisonRef.current = null;
    if (!eligible) {
      if (previous) setCommittedComparison(null);
      return;
    }
    // Fresh object identity for every committed context/source/enable transition:
    // A -> B -> A never reinstalls an earlier borrower or request token.
    const borrower: HealthExerciseComparisonBorrower = new HealthExerciseComparisonBorrower({
      captureCurrentSnapshot: () => source.coordinator.captureCurrentSnapshot!(),
    }, () => committedComparisonRef.current?.borrower === borrower
      && sourceLifetimeRef.current === source && coordinatorRef.current === source.coordinator);
    const committed = { source, selectedDate: comparisonDate, borrower,
      port: borrower.setContext({ enabled: true, selectedDate: comparisonDate }) };
    comparisonRef.current = borrower;
    committedComparisonRef.current = committed;
    setCommittedComparison(committed);
  });
  useLayoutEffect(() => () => {
    comparisonRef.current?.close(false);
    comparisonRef.current = null;
    committedComparisonRef.current = null;
  }, []);
  const previewPublicationRef = useRef<WorkoutRangePreviewRead | null>(null);
  const isPreviewCurrent = useCallback((read: WorkoutRangePreviewRead) => {
    const current = currentRef.current;
    return current.enabled && current.previewScope === read.scope
      && read.scope.isCurrent() && read.publication !== null
      && previewPublicationRef.current === read;
  }, []);

  const invalidateAndReload = useCallback(() => {
    const current = currentRef.current;
    if (!current.enabled) return;
    automaticCurrentnessRetryUsed.current = false;
    previewPublicationRef.current = null;
    publicationSequence.current += 1;
    comparisonRef.current?.invalidate();
    coordinatorRef.current?.invalidate();
    setStored(initialState(true, current.accountId, current.previousBounds, current.monthBounds));
    setRefresh(value => value + 1);
  }, []);

  const recoverCurrentnessOrSettle = useCallback(() => {
    const current = currentRef.current;
    if (!current.enabled) return;
    previewPublicationRef.current = null;
    publicationSequence.current += 1;
    comparisonRef.current?.invalidate();
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
    previewPublicationRef.current = null;
    ownerEpoch.current += 1;
    publicationSequence.current += 1;
    automaticCurrentnessRetryUsed.current = false;
    comparisonRef.current?.close();
    comparisonRef.current = null;
    committedComparisonRef.current = null;
    coordinatorRef.current?.close();
    coordinatorRef.current = null;
    sourceLifetimeRef.current = null;
    if (!enabled) {
      setStored(initialState(false, accountId, previousBounds, monthBounds));
      return undefined;
    }
    const createCoordinator = dependencies?.createCoordinator
      ?? ((owner: string, storage: Storage) => new WorkoutReadSnapshotCoordinator(owner, storage));
    const storage = dependencies?.deviceStorage ?? window.localStorage;
    coordinatorRef.current = createCoordinator(accountId, storage);
    sourceLifetimeRef.current = { accountId, coordinator: coordinatorRef.current,
      factory: dependencies?.createCoordinator, deviceStorage: dependencies?.deviceStorage };
    setStored(initialState(true, accountId, previousBounds, monthBounds));
    return () => {
      previewPublicationRef.current = null;
      ownerEpoch.current += 1;
      publicationSequence.current += 1;
      comparisonRef.current?.close();
      comparisonRef.current = null;
      committedComparisonRef.current = null;
      coordinatorRef.current?.close();
      coordinatorRef.current = null;
      sourceLifetimeRef.current = null;
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
    previewPublicationRef.current = null;
    comparisonRef.current?.invalidate();
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
  }, [enabled, accountId, refresh, recoverCurrentnessOrSettle,
    dependencies?.createCoordinator, dependencies?.deviceStorage]);

  useEffect(() => {
    if (!enabled || !coordinatorRef.current?.currentSnapshot) return;
    const coordinator = coordinatorRef.current;
    const epoch = ownerEpoch.current;
    const sequence = ++publicationSequence.current;
    const capturedAccount = accountId;
    const capturedPrevious = { ...previousBounds };
    const capturedMonth = { ...monthBounds };
    const capturedPreview = previewScope;
    const isCurrent = () => currentRef.current.enabled
      && currentRef.current.accountId === capturedAccount
      && currentRef.current.previousBounds.startDate === capturedPrevious.startDate
      && currentRef.current.previousBounds.endDate === capturedPrevious.endDate
      && currentRef.current.monthBounds.startDate === capturedMonth.startDate
      && currentRef.current.monthBounds.endDate === capturedMonth.endDate
      && currentRef.current.previewScope === capturedPreview
      && (!capturedPreview || capturedPreview.isCurrent())
      && coordinatorRef.current === coordinator
      && ownerEpoch.current === epoch
      && publicationSequence.current === sequence;
    setStored(previous => ({ ...previous, phase: 'loading', accountId,
      previousBounds: capturedPrevious, monthBounds: capturedMonth }));
    previewPublicationRef.current = null;
    void Promise.all([
      coordinator.deriveRange(capturedPrevious.startDate, capturedPrevious.endDate),
      coordinator.deriveRange(capturedMonth.startDate, capturedMonth.endDate),
      capturedPreview
        ? coordinator.deriveRange(capturedPreview.localDate, capturedPreview.localDate)
        : Promise.resolve(null),
    ]).then(([previousView, monthView, previewView]) => {
      if (!isCurrent()) return;
      if (!previousView || !monthView || (capturedPreview && !previewView)) {
        recoverCurrentnessOrSettle();
        return;
      }
      automaticCurrentnessRetryUsed.current = false;
      const previewRead: WorkoutRangePreviewRead | undefined = capturedPreview ? {
        scope: capturedPreview, phase: 'settled', view: previewView,
        isolationError: false, publication: {}, isCurrent: () => isPreviewCurrent(previewRead!),
      } : undefined;
      previewPublicationRef.current = previewRead ?? null;
      setStored({
        phase: 'settled',
        accountId,
        previousBounds: capturedPrevious,
        monthBounds: capturedMonth,
        previousView,
        monthView,
        isolationError: false,
        previewRead,
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
    monthBounds.startDate, monthBounds.endDate, sourceRevision, recoverCurrentnessOrSettle, previewScope, isPreviewCurrent]);

  const visible = enabled
    && stored.accountId === accountId
    && stored.previousBounds.startDate === previousBounds.startDate
    && stored.previousBounds.endDate === previousBounds.endDate
    && stored.monthBounds.startDate === monthBounds.startDate
    && stored.monthBounds.endDate === monthBounds.endDate
    ? stored
    : initialState(enabled, accountId, previousBounds, monthBounds);
  const previewRead = previewScope && previewScope.isCurrent()
    ? (visible.previewRead?.scope === previewScope && isPreviewCurrent(visible.previewRead) ? visible.previewRead : {
      scope: previewScope,
      phase: visible.phase === 'settled' ? 'settled' as const : 'loading' as const,
      view: null,
      isolationError: visible.isolationError,
      publication: null,
      isCurrent: () => false,
    }) : undefined;
  // Pure render-scope guard: a speculative B render sees no A port, but cannot
  // mutate A's still-committed lifetime. State + committed identity also prevent ABA.
  const comparisonMatchesRender = comparisonEnabled && committedComparison
    && committedComparisonRef.current === committedComparison
    && sourceLifetimeRef.current === committedComparison.source
    && committedComparison.source.accountId === accountId
    && committedComparison.source.factory === dependencies?.createCoordinator
    && committedComparison.source.deviceStorage === dependencies?.deviceStorage
    && committedComparison.source.coordinator === coordinatorRef.current
    && committedComparison.selectedDate === comparisonDate;
  const exerciseComparison: HealthExerciseComparisonRead | undefined = comparisonMatchesRender
    ? { port: committedComparison.port, retry,
      phase: visible.isolationError ? 'isolation_error'
        : visible.phase !== 'settled' ? 'loading'
          : coordinatorRef.current?.currentSnapshot ? 'ready' : 'unavailable' }
    : undefined;
  return { ...visible, previewRead, retry, invalidateAndReload, isPreviewCurrent, exerciseComparison };
}
