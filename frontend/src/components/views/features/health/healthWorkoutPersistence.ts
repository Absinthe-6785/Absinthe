import type { Workout } from '../../../../types';
import { API_URL } from '../../../../lib/config';
import { authFetch as defaultAuthFetch } from '../../../../lib/supabase';
import {
  createLocalHealthRepository as defaultCreateLocalHealthRepository,
} from '../../../../lib/healthLocalRuntime';
import type { HealthRepository, LocalHealthWriteResult } from '../../../../lib/healthLocalRepository';
import type { HealthRecoveryRecord } from '../../../../lib/healthRecoveryExport';

type LocalWorkoutRepository = Pick<HealthRepository, 'saveWorkouts' | 'deleteWorkout'>;

export type HealthWorkoutPersistenceMode = 'local' | 'remote';
export type HealthWorkoutPersistenceStatus = 'success' | 'partial' | 'failure' | 'aborted';

export type HealthWorkoutSaveResult = Readonly<{
  status: HealthWorkoutPersistenceStatus;
  total: number;
  succeeded: number;
  failed: number;
  localResults?: readonly LocalHealthWriteResult[];
}>;

export type HealthWorkoutDeleteResult = Readonly<{
  status: 'success' | 'aborted';
}>;

export type HealthWorkoutPersistenceDependencies = Readonly<{
  createLocalHealthRepository?: (accountId: string) => Promise<LocalWorkoutRepository>;
  authFetch?: typeof defaultAuthFetch;
}>;

export type SaveHealthWorkoutsInput = Readonly<{
  mode: HealthWorkoutPersistenceMode;
  accountId: string;
  date: string;
  workouts: readonly Workout[];
  dependencies?: HealthWorkoutPersistenceDependencies;
  /**
   * HealthView supplies this as a stop signal only.  Scope ownership and all
   * current-view completion effects remain in HealthView.
   */
  shouldContinue?: () => boolean;
}>;

export type DeleteHealthWorkoutInput = Readonly<{
  mode: HealthWorkoutPersistenceMode;
  accountId: string;
  workoutId: string;
  expectedVersion: string;
  dependencies?: HealthWorkoutPersistenceDependencies;
  shouldContinue?: () => boolean;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function persistedWorkouts(workouts: readonly Workout[]): Workout[] {
  // Session separators are view-only rows and have never been sent to either
  // persistence surface.  Keep the existing boundary exact.
  return workouts.filter(workout => workout.block_id !== '__session__');
}

function classifyRemoteSave(total: number, failed: number): HealthWorkoutSaveResult {
  return {
    status: failed === 0 ? 'success' : failed === total ? 'failure' : 'partial',
    total,
    succeeded: total - failed,
    failed,
  };
}

function abortedSave(total: number, succeeded: number, failed: number): HealthWorkoutSaveResult {
  return { status: 'aborted', total, succeeded, failed };
}

export async function saveHealthWorkouts({
  mode,
  accountId,
  date,
  workouts,
  dependencies,
  shouldContinue,
}: SaveHealthWorkoutsInput): Promise<HealthWorkoutSaveResult> {
  const repositoryFactory = dependencies?.createLocalHealthRepository
    ?? defaultCreateLocalHealthRepository;
  const authFetch = dependencies?.authFetch ?? defaultAuthFetch;
  const rows = persistedWorkouts(workouts);

  if (mode === 'local') {
    const repository = await repositoryFactory(accountId);
    if (shouldContinue && !shouldContinue()) return abortedSave(rows.length, 0, 0);
    const results = await repository.saveWorkouts(rows.map((workout, sortOrder) => ({
      id: UUID_PATTERN.test(workout.id) ? workout.id : undefined,
      date,
      blockId: workout.block_id,
      sets: workout.sets as unknown as HealthRecoveryRecord[],
      sortOrder,
      expectedVersion: workout.local_version ?? null,
    })));
    if (shouldContinue && !shouldContinue()) return abortedSave(rows.length, rows.length, 0);
    return {
      status: 'success',
      total: rows.length,
      succeeded: rows.length,
      failed: 0,
      localResults: results,
    };
  }

  let failed = 0;
  for (let sortOrder = 0; sortOrder < rows.length; sortOrder += 1) {
    const workout = rows[sortOrder];
    try {
      const response = await authFetch(`${API_URL}/api/workouts`, {
        method: 'POST',
        body: JSON.stringify({
          date,
          block_id: workout.block_id,
          sets: workout.sets,
          sort_order: sortOrder,
        }),
      });
      if (shouldContinue && !shouldContinue()) {
        return abortedSave(rows.length, sortOrder + 1 - failed, failed);
      }
      if (!response.ok) failed += 1;
    } catch {
      if (shouldContinue && !shouldContinue()) {
        return abortedSave(rows.length, sortOrder - failed, failed);
      }
      failed += 1;
    }
  }
  return classifyRemoteSave(rows.length, failed);
}

export async function deleteHealthWorkout({
  mode,
  accountId,
  workoutId,
  expectedVersion,
  dependencies,
  shouldContinue,
}: DeleteHealthWorkoutInput): Promise<HealthWorkoutDeleteResult> {
  const repositoryFactory = dependencies?.createLocalHealthRepository
    ?? defaultCreateLocalHealthRepository;
  const authFetch = dependencies?.authFetch ?? defaultAuthFetch;

  if (mode === 'local') {
    const repository = await repositoryFactory(accountId);
    if (shouldContinue && !shouldContinue()) return { status: 'aborted' };
    await repository.deleteWorkout(workoutId, expectedVersion);
    if (shouldContinue && !shouldContinue()) return { status: 'aborted' };
    return { status: 'success' };
  }

  const response = await authFetch(`${API_URL}/api/workouts/${workoutId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`[${response.status}]`);
  if (shouldContinue && !shouldContinue()) return { status: 'aborted' };
  return { status: 'success' };
}
