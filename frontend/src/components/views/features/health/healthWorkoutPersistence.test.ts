import { describe, expect, it, vi } from 'vitest';
import type { LocalWorkoutWriteInput } from '../../../../lib/healthLocalRepository';
import type { Workout } from '../../../../types';
import {
  deleteHealthWorkout,
  saveHealthWorkouts,
  type HealthWorkoutPersistenceDependencies,
} from './healthWorkoutPersistence';

function workout(id: string, blockId: string): Workout {
  return {
    id,
    block_id: blockId,
    exercise_blocks: { id: blockId, name: blockId, type: 'strength', tags: [] },
    sets: [{ type: 'strength', set: 1, kg: '20', reps: '5', done: true }],
  };
}

function localDependencies() {
  const savedInputs: LocalWorkoutWriteInput[] = [];
  const saveWorkouts = vi.fn(async (inputs: LocalWorkoutWriteInput[]) => {
    savedInputs.push(...inputs);
    return inputs.map((input, index) => ({
      id: input.id ?? `generated-${index}`,
      date: input.date,
      version: `version-${index}`,
    }));
  });
  const deleteWorkout = vi.fn(async (_workoutId: string, _expectedVersion: string) => undefined);
  const createLocalHealthRepository = vi.fn(async () => ({ saveWorkouts, deleteWorkout }));
  return {
    dependencies: { createLocalHealthRepository } satisfies HealthWorkoutPersistenceDependencies,
    createLocalHealthRepository,
    saveWorkouts,
    deleteWorkout,
    savedInputs,
  };
}

describe('healthWorkoutPersistence', () => {
  it('dispatches local saves with account, expected-version, UUID, and session filtering', async () => {
    const local = localDependencies();

    const existing = { ...workout('123e4567-e89b-12d3-a456-426614174000', 'row'), local_version: 'version-7' };
    const result = await saveHealthWorkouts({
      mode: 'local',
      accountId: 'account-a',
      date: '2026-08-25',
      workouts: [workout('not-a-uuid', 'bench'), workout('session-1', '__session__'), existing],
      dependencies: local.dependencies,
    });

    expect(local.createLocalHealthRepository).toHaveBeenCalledWith('account-a');
    expect(local.savedInputs).toEqual([
      expect.objectContaining({
        id: undefined,
        date: '2026-08-25',
        blockId: 'bench',
        sortOrder: 0,
        expectedVersion: null,
      }),
      expect.objectContaining({
        id: '123e4567-e89b-12d3-a456-426614174000',
        blockId: 'row',
        sortOrder: 1,
        expectedVersion: 'version-7',
      }),
    ]);
    expect(result).toMatchObject({ status: 'success', total: 2, succeeded: 2, failed: 0 });
    expect(result.localResults).toHaveLength(2);
  });

  it('propagates local repository failures for HealthView classification', async () => {
    const failure = new Error('health_local_workout_write_failed');
    const dependencies = {
      createLocalHealthRepository: vi.fn(async () => ({
        saveWorkouts: vi.fn(async () => { throw failure; }),
        deleteWorkout: vi.fn(async () => undefined),
      })),
    } satisfies HealthWorkoutPersistenceDependencies;

    await expect(saveHealthWorkouts({
      mode: 'local',
      accountId: 'account-a',
      date: '2026-08-25',
      workouts: [workout('one', 'bench')],
      dependencies,
    })).rejects.toBe(failure);
  });

  it('dispatches remote saves sequentially with the unchanged endpoint and request shape', async () => {
    const requests: Array<{ url: string; options: RequestInit }> = [];
    const authFetch = vi.fn(async (url: string, options: RequestInit = {}) => {
      requests.push({ url, options });
      return new Response(null, { status: 201 });
    });

    const result = await saveHealthWorkouts({
      mode: 'remote',
      accountId: 'account-a',
      date: '2026-08-25',
      workouts: [workout('one', 'bench'), workout('two', 'row')],
      dependencies: { authFetch },
    });

    expect(authFetch).toHaveBeenCalledTimes(2);
    expect(requests.map(request => request.url)).toEqual([
      expect.stringMatching(/\/api\/workouts$/),
      expect.stringMatching(/\/api\/workouts$/),
    ]);
    expect(JSON.parse(String(requests[0].options.body))).toEqual({
      date: '2026-08-25',
      block_id: 'bench',
      sets: expect.any(Array),
      sort_order: 0,
    });
    expect(JSON.parse(String(requests[1].options.body)).sort_order).toBe(1);
    expect(result).toMatchObject({ status: 'success', total: 2, succeeded: 2, failed: 0 });
  });

  it('represents partial remote saves without deciding UI consequences', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));

    const result = await saveHealthWorkouts({
      mode: 'remote',
      accountId: 'account-a',
      date: '2026-08-25',
      workouts: [workout('one', 'bench'), workout('two', 'row'), workout('three', 'squat')],
      dependencies: { authFetch },
    });

    expect(result).toEqual({ status: 'partial', total: 3, succeeded: 2, failed: 1 });
  });

  it('represents full remote failure and network failure as persistence results', async () => {
    const authFetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    const result = await saveHealthWorkouts({
      mode: 'remote',
      accountId: 'account-a',
      date: '2026-08-25',
      workouts: [workout('one', 'bench'), workout('two', 'row')],
      dependencies: { authFetch },
    });

    expect(result).toEqual({ status: 'failure', total: 2, succeeded: 0, failed: 2 });
  });

  it('stops remote persistence when the HealthView scope becomes stale', async () => {
    let current = true;
    const authFetch = vi.fn(async () => {
      current = false;
      return new Response(null, { status: 201 });
    });

    const result = await saveHealthWorkouts({
      mode: 'remote',
      accountId: 'account-a',
      date: '2026-08-25',
      workouts: [workout('one', 'bench'), workout('two', 'row')],
      dependencies: { authFetch },
      shouldContinue: () => current,
    });

    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('aborted');
  });

  it('dispatches local deletes with the expected version', async () => {
    const local = localDependencies();

    const result = await deleteHealthWorkout({
      mode: 'local',
      accountId: 'account-a',
      workoutId: 'workout-1',
      expectedVersion: 'version-4',
      dependencies: local.dependencies,
    });

    expect(local.createLocalHealthRepository).toHaveBeenCalledWith('account-a');
    expect(local.deleteWorkout).toHaveBeenCalledWith('workout-1', 'version-4');
    expect(result).toEqual({ status: 'success' });
  });

  it('dispatches remote deletes and preserves non-OK failure status', async () => {
    const authFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteHealthWorkout({
      mode: 'remote',
      accountId: 'account-a',
      workoutId: 'workout-1',
      expectedVersion: '',
      dependencies: { authFetch },
    })).resolves.toEqual({ status: 'success' });
    expect(authFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/workouts\/workout-1$/), { method: 'DELETE' });

    const nonOkAuthFetch = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
    await expect(deleteHealthWorkout({
      mode: 'remote',
      accountId: 'account-a',
      workoutId: 'workout-1',
      expectedVersion: '',
      dependencies: { authFetch: nonOkAuthFetch },
    })).rejects.toThrow('[409]');
  });

  it('does not expose UI or cache dependencies', async () => {
    const local = localDependencies();
    const result = await deleteHealthWorkout({
      mode: 'local',
      accountId: 'account-a',
      workoutId: 'workout-1',
      expectedVersion: 'version-4',
      dependencies: local.dependencies,
    });

    expect(result).toEqual({ status: 'success' });
    expect('showToast' in result).toBe(false);
    expect('mutateDaily' in result).toBe(false);
  });
});
