import type { Workout, WorkoutSet } from '@/types';
import { makeDefaultSet } from '@/types';

export interface PrevSessionData {
  prev_sets?: WorkoutSet[];
}

/** Planned set count from today's workout, previous session, or default 1. */
export function plannedSetCount(
  blockId: string,
  localWorkouts: readonly Workout[],
  prevData: Readonly<Record<string, PrevSessionData>>,
): number {
  const today = localWorkouts.find(w => w.block_id === blockId);
  if (today && today.sets.length > 0) return today.sets.length;
  const prev = prevData[blockId]?.prev_sets;
  if (prev && prev.length > 0) return prev.length;
  return 1;
}

/** Build fresh sets matching previous session count (empty values). */
export function buildSetsFromPrevCount(
  blockType: string,
  prevSets?: readonly WorkoutSet[],
): WorkoutSet[] {
  const count = prevSets?.length ? prevSets.length : 1;
  return buildSetsFromPlannedCount(blockType, count);
}

/** Build fresh sets for a planned count (routine config or load). */
export function buildSetsFromPlannedCount(blockType: string, count: number): WorkoutSet[] {
  const n = blockType === 'cardio' ? 1 : Math.max(1, Math.min(12, count));
  return Array.from({ length: n }, (_, i) => makeDefaultSet(blockType, i + 1));
}
