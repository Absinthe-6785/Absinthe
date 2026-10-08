import {
  WorkoutExerciseComparisonOwner,
  type WorkoutExerciseComparisonContext,
} from '../../../../lib/workoutExerciseComparisonOwner';
import type {
  ExerciseComparisonKey, WorkoutExerciseComparisonResult,
} from '../../../../lib/workoutExerciseComparisonProjection';
import type { WorkoutReadSnapshotCoordinator } from './verifiedWorkoutRangeSnapshot';

export type HealthExerciseComparisonEvidence = Readonly<{
  comparison: WorkoutExerciseComparisonResult;
  /** Proven inside the same guarded publication; no-match is not empty source storage. */
  verifiedBothSourcesEmpty: boolean;
}>;
export type HealthExerciseComparisonPublication = Readonly<{
  isCurrent: () => boolean;
  publish: (consume: (evidence: HealthExerciseComparisonEvidence) => void) => Promise<boolean>;
}>;
/** UI borrows only this port, never the source owner, snapshot, reader, or repository. */
export type HealthExerciseComparisonPort = Readonly<{
  isCurrent: () => boolean;
  derive: (exercise: ExerciseComparisonKey) => Promise<HealthExerciseComparisonPublication | null>;
  release: () => void;
  subscribe: (listener: () => void) => () => void;
  getRevision: () => number;
}>;
export type HealthExerciseComparisonRead = Readonly<{
  phase: 'loading' | 'ready' | 'unavailable' | 'isolation_error';
  port: HealthExerciseComparisonPort;
  retry: () => void;
}>;

/** Private child of the range hook. Construction/context changes perform no I/O. */
export class HealthExerciseComparisonBorrower {
  private readonly owner: WorkoutExerciseComparisonOwner;
  private token: object = {};
  private revision = 0;
  private closed = false;
  private context: WorkoutExerciseComparisonContext | null = null;
  private readonly listeners = new Set<() => void>();
  private portValue: HealthExerciseComparisonPort | null = null;

  constructor(
    private readonly source: Pick<WorkoutReadSnapshotCoordinator, 'captureCurrentSnapshot'>,
    private readonly sourceLifetimeCurrent: () => boolean,
  ) {
    this.owner = new WorkoutExerciseComparisonOwner(source);
  }

  /** Called synchronously by the owning hook, including date/enable ABA. */
  setContext(context: WorkoutExerciseComparisonContext): HealthExerciseComparisonPort {
    if (this.context?.enabled === context.enabled && this.context.selectedDate === context.selectedDate
      && this.portValue) return this.portValue;
    this.owner.setContext(context);
    this.context = Object.freeze({ ...context });
    const token = this.token = {};
    const isCurrent = () => !this.closed && this.token === token && !!this.context?.enabled
      && this.sourceLifetimeCurrent();
    const port: HealthExerciseComparisonPort = Object.freeze({
      isCurrent,
      derive: async (exercise: ExerciseComparisonKey) => {
        if (!isCurrent()) return null;
        // Capture only bounded empty-state metadata; the raw pair stays private.
        const source = this.source.captureCurrentSnapshot();
        const publication = await this.owner.derive(exercise);
        if (!source || !publication || !isCurrent()) return null;
        const current = () => isCurrent() && source.isCurrent() && publication.isCurrent();
        const verifiedBothSourcesEmpty = source.snapshot.result.status === 'complete'
          && source.snapshot.result.records.length === 0;
        return Object.freeze({
          isCurrent: current,
          publish: async (consume: (evidence: HealthExerciseComparisonEvidence) => void) => {
            if (!current()) return false;
            let consumed = false;
            await publication.publish(comparison => {
              if (!current()) return;
              consume(Object.freeze({ comparison, verifiedBothSourcesEmpty }));
              consumed = true;
            });
            return consumed;
          },
        });
      },
      // Owner's request map has no per-key eviction API. Removing/changing a card
      // clears ALL child requests; surviving cards rederive in memory, never reload.
      release: () => { if (isCurrent()) this.invalidate(); },
      subscribe: (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
      },
      getRevision: () => this.revision,
    });
    this.portValue = port;
    return port;
  }

  /** Same synchronous commit/source fence as the parent; no new mutation listener. */
  invalidate(): void {
    this.owner.invalidate();
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  close(notify = true): void {
    if (this.closed) return;
    this.closed = true;
    this.owner.close();
    this.revision += 1;
    if (notify) for (const listener of this.listeners) listener();
    this.listeners.clear();
    // Deliberately never close/invalidate the borrowed source here.
  }
}
