import { isStrengthSet, type StrengthSet, type WorkoutSet } from '../../../../types';
import {
  canonicalWeightKg,
  formatSavedWeight,
  savedWeightSource,
  type WeightUnit,
} from './healthWeight';

export type PreviousPerformanceCue =
  | { kind: 'weighted'; weight: string; unit: WeightUnit; reps: string | null }
  | { kind: 'bodyweight'; reps: string };

function validRepsNumber(value: StrengthSet['reps']): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validReps(value: StrengthSet['reps']): string | null {
  const parsed = validRepsNumber(value);
  return parsed === null ? null : String(parsed);
}

function isBodyweightSet(set: StrengthSet, blockType: string): boolean {
  return blockType === 'bodyweight' || set.type === 'bodyweight';
}

function isDropSet(set: StrengthSet): boolean {
  return set.is_dropset === true;
}

function validSetNumber(set: StrengthSet): number | null {
  return Number.isInteger(set.set) && set.set > 0 ? set.set : null;
}

function savedPositiveWeightKg(set: StrengthSet): number | null {
  const source = savedWeightSource(set);
  if (!source || source.value <= 0) return null;
  const kg = canonicalWeightKg(source.value, source.unit);
  return Number.isFinite(kg) && kg > 0 ? kg : null;
}

function hasUsableReferenceValue(set: StrengthSet, blockType: string): boolean {
  return isBodyweightSet(set, blockType)
    ? validRepsNumber(set.reps) !== null
    : savedPositiveWeightKg(set) !== null;
}

function compatibleSet(current: StrengthSet, previous: StrengthSet, blockType: string): boolean {
  return isBodyweightSet(current, blockType) === isBodyweightSet(previous, blockType)
    && isDropSet(current) === isDropSet(previous);
}

function uniqueSetNumbers(sets: readonly StrengthSet[]): boolean {
  const numbers = sets.map(validSetNumber);
  return numbers.every(number => number !== null) && new Set(numbers).size === numbers.length;
}

function compatibleCurrentSets(
  currentSet: StrengthSet,
  currentSets: readonly WorkoutSet[] | undefined,
  blockType: string,
): StrengthSet[] {
  const source = currentSets ?? [currentSet];
  return source.filter(
    (set): set is StrengthSet => isStrengthSet(set) && compatibleSet(currentSet, set, blockType),
  );
}

/**
 * Select the best completed set inside this one already-fetched previous
 * block/session. Canonical kg is used only for comparison; source metadata is
 * retained for display through the HEALTH_03 formatter.
 */
export function selectPreviousBestSet(
  prevSets: readonly WorkoutSet[] | undefined,
  blockType = 'strength',
): StrengthSet | null {
  if (!prevSets?.length) return null;

  let best: StrengthSet | null = null;
  let bestKg = -Infinity;
  let bestReps = -Infinity;

  for (const set of prevSets) {
    if (!isStrengthSet(set) || !set.done || !hasUsableReferenceValue(set, blockType)) continue;
    // The exercise block decides which performance family is being summarized;
    // a malformed mixed array must not let bodyweight reps outrank a weighted
    // strength set (or vice versa).
    if (blockType === 'bodyweight' ? !isBodyweightSet(set, blockType) : isBodyweightSet(set, blockType)) continue;
    const reps = validRepsNumber(set.reps) ?? -Infinity;

    if (isBodyweightSet(set, blockType)) {
      if (reps > bestReps) {
        best = set;
        bestReps = reps;
      }
      continue;
    }

    const kg = savedPositiveWeightKg(set);
    if (kg === null) continue;
    if (kg > bestKg || (kg === bestKg && reps > bestReps)) {
      best = set;
      bestKg = kg;
      bestReps = reps;
    }
  }

  return best;
}

function formatPreviousPerformance(
  set: StrengthSet | null,
  displayUnit: WeightUnit,
  blockType: string,
): PreviousPerformanceCue | null {
  if (!set || !set.done || !hasUsableReferenceValue(set, blockType)) return null;
  if (isBodyweightSet(set, blockType)) {
    const reps = validReps(set.reps);
    return reps ? { kind: 'bodyweight', reps } : null;
  }

  const weight = formatSavedWeight(set, displayUnit);
  return weight
    ? { kind: 'weighted', weight, unit: displayUnit, reps: validReps(set.reps) }
    : null;
}

export function formatPreviousBestCue(
  prevSets: readonly WorkoutSet[] | undefined,
  displayUnit: WeightUnit,
  blockType = 'strength',
): PreviousPerformanceCue | null {
  return formatPreviousPerformance(selectPreviousBestSet(prevSets, blockType), displayUnit, blockType);
}

/**
 * Match one current row to this exercise's same-date previous set. Unique
 * semantic set numbers win; otherwise compatible historical order is used.
 * Incomplete/unusable history is never substituted with a later set when an
 * exact semantic match exists, preventing misleading drop-set pairings.
 */
export function matchPreviousSetReference(
  currentSet: WorkoutSet,
  prevSets: readonly WorkoutSet[] | undefined,
  blockType = 'strength',
  currentSets?: readonly WorkoutSet[],
): StrengthSet | null {
  if (!isStrengthSet(currentSet) || !prevSets?.length) return null;

  const compatiblePrevious = prevSets.filter(
    (set): set is StrengthSet => isStrengthSet(set) && compatibleSet(currentSet, set, blockType),
  );
  if (!compatiblePrevious.length) return null;

  const currentCompatible = compatibleCurrentSets(currentSet, currentSets, blockType);
  const currentNumber = validSetNumber(currentSet);
  if (
    currentNumber !== null
    && uniqueSetNumbers(currentCompatible)
    && uniqueSetNumbers(compatiblePrevious)
  ) {
    const semanticMatch = compatiblePrevious.find(set => validSetNumber(set) === currentNumber);
    if (semanticMatch) return hasUsableReferenceValue(semanticMatch, blockType) ? semanticMatch : null;
  }

  const usablePrevious = compatiblePrevious.filter(
    set => set.done && hasUsableReferenceValue(set, blockType),
  );
  const currentIndex = currentCompatible.indexOf(currentSet);
  if (currentIndex < 0) return null;
  return usablePrevious[currentIndex] ?? null;
}

export function formatPreviousSetReference(
  previousSet: StrengthSet | null,
  displayUnit: WeightUnit,
  blockType = 'strength',
): PreviousPerformanceCue | null {
  return formatPreviousPerformance(previousSet, displayUnit, blockType);
}
