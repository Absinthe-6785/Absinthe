import type { WorkoutReadSnapshotCoordinator } from '../components/views/features/health/verifiedWorkoutRangeSnapshot';
import {
  projectWorkoutExerciseComparison,
  type ExerciseComparisonKey, type WorkoutExerciseComparisonResult,
} from './workoutExerciseComparisonProjection';

export type WorkoutExerciseComparisonContext = Readonly<{
  enabled: boolean;
  selectedDate: string;
}>;

/** No naked cached DTO is authority. Every publication/use must pass publish again. */
export type WorkoutExerciseComparisonPublication = Readonly<{
  /** Synchronous lifetime fence; NOT proof of durable generation currentness. */
  isCurrent: () => boolean;
  /**
   * Reverify owner scope, then deliver a deeply frozen DTO synchronously inside the final fence.
   * The callback must consume synchronously. A retained DTO cannot authorize later async/click use;
   * call publish again after any async gap. False means discard, never verified-empty history.
   */
  publish: (consume: (result: WorkoutExerciseComparisonResult) => void) => Promise<boolean>;
}>;

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

/**
 * Dormant optional view over an EXISTING paired read owner: construction performs no I/O.
 * No production caller, feature activation, listener, React/platform dependency or writer API.
 * The coordinator owns account/device/namespace/generation/load/retry and source invalidation.
 * This view owns date/enable/close lifetime and per-exercise request supersession, NOT reads.
 * Higher owners must synchronously setContext on date/gate transitions and close on unmount.
 * Shared save/delete/reset-relevant invalidation must target the borrowed coordinator; no
 * second mutation subscription is needed. Closing this view never closes the shared owner.
 * Many views/exercises reuse one full active snapshot; projection cost remains O(exercises * history).
 * Batching/indexing, mounted/public-copy acceptance and legacy isolation repair remain deferred.
 */
export class WorkoutExerciseComparisonOwner {
  private context: WorkoutExerciseComparisonContext = { enabled: false, selectedDate: '' };
  private lifetime: object = {};
  private closed = false;
  private readonly requests = new Map<string, object>();

  constructor(private readonly owner: Pick<WorkoutReadSnapshotCoordinator, 'captureCurrentSnapshot'>) {}

  /** Every explicit transition rotates identity, even Date A -> B -> A or disable -> enable. */
  setContext(context: WorkoutExerciseComparisonContext): void {
    if (this.closed) throw new Error('exercise_comparison_owner_closed');
    this.invalidate();
    this.context = Object.freeze({ ...context });
  }

  /** View-only invalidation. Source changes belong to the shared coordinator's invalidate(). */
  invalidate(): void {
    this.lifetime = {};
    this.requests.clear();
  }

  close(): void {
    this.closed = true;
    this.invalidate();
  }

  /** Null means disabled/closed/no current snapshot/superseded; never success with empty records. */
  async derive(exercise: ExerciseComparisonKey): Promise<WorkoutExerciseComparisonPublication | null> {
    if (this.closed || !this.context.enabled) return null;
    const lifetime = this.lifetime;
    const selectedDate = this.context.selectedDate;
    const key = Object.freeze({ ...exercise });
    const requestKey = JSON.stringify([key.id, key.name, key.type]);
    const request = {};
    this.requests.set(requestKey, request);
    const source = this.owner.captureCurrentSnapshot();
    if (!source) return null;
    const isCurrent = () => !this.closed && this.context.enabled && this.lifetime === lifetime
      && this.requests.get(requestKey) === request && source.isCurrent();
    if (!await source.verifyCurrent() || !isCurrent()) return null;
    const result = freezeDeep(projectWorkoutExerciseComparison({
      selectedDate, exercise: key, read: { status: 'current', snapshot: source.snapshot },
    }));
    return Object.freeze({
      isCurrent,
      publish: async (consume: (value: WorkoutExerciseComparisonResult) => void) => {
        if (!isCurrent() || !await source.verifyCurrent() || !isCurrent()) return false;
        consume(result);
        return true;
      },
    });
  }
}
