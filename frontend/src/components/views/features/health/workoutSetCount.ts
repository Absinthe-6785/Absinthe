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
  return Array.from({ length: count }, (_, i) => makeDefaultSet(blockType, i + 1));
}
