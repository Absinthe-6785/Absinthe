import { authFetch } from '@/lib/supabase';
import { API_URL } from '@/lib/config';
import { shouldUseRemoteData } from '@/lib/remoteBoundary';
import type { WorkoutSet } from '@/types';
import {
  finishHealthRequestBatch,
  startHealthRequestBatch,
} from './healthRequestInstrumentation';
import { createConcurrencyPool } from './runWithConcurrencyLimit';

/** Max concurrent /api/workouts/prev/{id} calls — K-91F mitigation. */
export const PREV_WORKOUT_FETCH_CONCURRENCY = 4;

export interface PrevWorkoutPayload {
  prev_sets: WorkoutSet[];
  prev_date: string | null;
  pr_kg: number | null;
}

const prevWorkoutPool = createConcurrencyPool(PREV_WORKOUT_FETCH_CONCURRENCY);

async function fetchPrevWorkoutOnce(
  blockId: string,
  beforeDate: string,
  batch: ReturnType<typeof startHealthRequestBatch>,
): Promise<PrevWorkoutPayload | undefined> {
  batch.trackStart();
  try {
    const res = await prevWorkoutPool(() =>
      authFetch(`${API_URL}/api/workouts/prev/${blockId}?before_date=${beforeDate}`),
    );
    if (!res.ok) return undefined;
    return (await res.json()) as PrevWorkoutPayload;
  } catch {
    return undefined;
  } finally {
    batch.trackEnd();
  }
}

/**
 * Load previous workout snapshots for many blocks with bounded concurrency.
 * Behavior matches prior per-block fetches; only parallelism is capped.
 */
export async function fetchPrevWorkoutForBlocks(
  blockIds: readonly string[],
  beforeDate: string,
  source: string,
): Promise<Record<string, PrevWorkoutPayload>> {
  if (!shouldUseRemoteData()) {
    return {};
  }

  const unique = [...new Set(blockIds.filter(Boolean))];
  const out: Record<string, PrevWorkoutPayload> = {};
  if (unique.length === 0) return out;

  const batch = startHealthRequestBatch(source, '/api/workouts/prev/{id}', unique.length);

  await Promise.all(
    unique.map(async blockId => {
      const data = await fetchPrevWorkoutOnce(blockId, beforeDate, batch);
      if (data) out[blockId] = data;
    }),
  );

  finishHealthRequestBatch(batch, PREV_WORKOUT_FETCH_CONCURRENCY, 'bounded');
  return out;
}
