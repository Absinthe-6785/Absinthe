import { isStrengthSet, type StrengthSet, type WorkoutSet } from '../../../../types';
import {
  formatSavedWeight,
  savedWeightSource,
  type WeightUnit,
} from './healthWeight';

export type PreviousMicroCue =
  | { kind: 'weighted'; weight: string; unit: WeightUnit; reps: string | null }
  | { kind: 'bodyweight'; reps: string };

function validReps(value: StrengthSet['reps']): string | null {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return String(parsed);
}

function hasPositiveSavedWeight(set: StrengthSet): boolean {
  const source = savedWeightSource(set);
  return source !== null && source.value > 0;
}

function isBodyweightSet(set: StrengthSet, blockType: string): boolean {
  return blockType === 'bodyweight' || set.type === 'bodyweight';
}

/**
 * Choose the representative previous performance without changing PR meaning.
 * Historical `prev_sets` order is retained; the first completed set with a
 * usable value wins, so an empty or incomplete leading set cannot hide later
 * historical data and no max/best-set semantics are invented.
 */
export function selectPreviousMicroCueSet(
  prevSets: readonly WorkoutSet[] | undefined,
  blockType = 'strength',
): StrengthSet | null {
  if (!prevSets?.length) return null;
  return prevSets
    .filter(isStrengthSet)
    .find(set => {
      if (!set.done) return false;
      return isBodyweightSet(set, blockType)
        ? validReps(set.reps) !== null
        : hasPositiveSavedWeight(set);
    }) ?? null;
}

/**
 * Format the compact, display-only cue from already-fetched block data.
 * Missing weighted values intentionally produce no cue rather than guessing
 * bodyweight; bodyweight is determined by the set/block type.
 */
export function formatPreviousMicroCue(
  prevSets: readonly WorkoutSet[] | undefined,
  displayUnit: WeightUnit,
  blockType = 'strength',
): PreviousMicroCue | null {
  const set = selectPreviousMicroCueSet(prevSets, blockType);
  if (!set) return null;

  if (isBodyweightSet(set, blockType)) {
    const reps = validReps(set.reps);
    return reps ? { kind: 'bodyweight', reps } : null;
  }

  const weight = formatSavedWeight(set, displayUnit);
  if (!weight) return null;
  return {
    kind: 'weighted',
    weight,
    unit: displayUnit,
    reps: validReps(set.reps),
  };
}
