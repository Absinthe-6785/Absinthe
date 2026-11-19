import { isStrengthSet, type StrengthSet, type Workout, type WorkoutSet } from '../../../../types';
import {
  getAssistedRepsBreakdown,
  hasAssistedRepsField,
  unassistedRepsForComparison,
} from '../../../../lib/healthAssistedReps';
import {
  canonicalWeightKg,
  formatSavedWeight,
  savedWeightSource,
  type WeightUnit,
} from './healthWeight';

export type PreviousPerformanceCue =
  | { kind: 'weighted'; weight: string; unit: WeightUnit; reps: string | null; assistedReps?: string }
  | { kind: 'bodyweight'; reps: string; assistedReps?: string };

function validRepsNumber(value: StrengthSet['reps']): number | null {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validReps(value: StrengthSet['reps']): string | null {
  const parsed = validRepsNumber(value);
  return parsed === null ? null : String(parsed);
}

function performanceReps(set: StrengthSet): { reps: string; assistedReps?: string } | null {
  const breakdown = getAssistedRepsBreakdown(set);
  if (breakdown) return { reps: String(breakdown.unassisted), assistedReps: String(breakdown.assisted) };
  if (hasAssistedRepsField(set)) return null;
  const reps = validReps(set.reps);
  return reps ? { reps } : null;
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
    ? unassistedRepsForComparison(set) !== null
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
    const reps = unassistedRepsForComparison(set) ?? -Infinity;

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
    const performance = performanceReps(set);
    return performance ? { kind: 'bodyweight', ...performance } : null;
  }

  const weight = formatSavedWeight(set, displayUnit);
  if (!weight) return null;
  const performance = performanceReps(set);
  return { kind: 'weighted', weight, unit: displayUnit, reps: performance?.reps ?? null, assistedReps: performance?.assistedReps };
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

type SetNumberIndex = { unique: boolean; byNumber: Map<number, StrengthSet> };

type PreviousSetReferenceGroup = {
  previousNumbers: SetNumberIndex;
  currentNumbersUnique: boolean;
  usablePrevious: StrengthSet[];
  semanticUsablePreviousSet: Set<StrengthSet>;
  currentIndex: Map<StrengthSet, number>;
};

function indexUniqueSetNumbers(sets: readonly StrengthSet[]): SetNumberIndex {
  const byNumber = new Map<number, StrengthSet>();
  let unique = true;
  for (const set of sets) {
    const number = validSetNumber(set);
    if (number === null || byNumber.has(number)) unique = false;
    else byNumber.set(number, set);
  }
  return { unique, byNumber };
}

function compatibilityKey(set: StrengthSet, blockType: string): string {
  return `${isBodyweightSet(set, blockType) ? 'bodyweight' : 'strength'}:${isDropSet(set) ? 'drop' : 'normal'}`;
}

/**
 * Build a render-lifetime lookup for all set rows in one current exercise.
 * This preserves matchPreviousSetReference semantics while moving compatible
 * filtering and uniqueness work out of the per-row render callback.
 */
export function createPreviousSetReferenceMatcher(
  prevSets: readonly WorkoutSet[] | undefined,
  currentSets: readonly WorkoutSet[],
  blockType = 'strength',
): { match: (currentSet: WorkoutSet) => StrengthSet | null } {
  if (!prevSets?.length) return { match: () => null };

  const previousGroups = new Map<string, StrengthSet[]>();
  for (const set of prevSets) {
    if (!isStrengthSet(set)) continue;
    const key = compatibilityKey(set, blockType);
    const group = previousGroups.get(key);
    if (group) group.push(set);
    else previousGroups.set(key, [set]);
  }

  const currentGroups = new Map<string, StrengthSet[]>();
  for (const set of currentSets) {
    if (!isStrengthSet(set)) continue;
    const key = compatibilityKey(set, blockType);
    const group = currentGroups.get(key);
    if (group) group.push(set);
    else currentGroups.set(key, [set]);
  }

  const indexes = new Map<string, PreviousSetReferenceGroup>();
  for (const [key, compatiblePrevious] of previousGroups) {
    const compatibleCurrent = currentGroups.get(key) ?? [];
    const previousNumbers = indexUniqueSetNumbers(compatiblePrevious);
    const currentNumbers = indexUniqueSetNumbers(compatibleCurrent);
    const usablePrevious: StrengthSet[] = [];
    const semanticUsablePreviousSet = new Set<StrengthSet>();
    for (const set of compatiblePrevious) {
      const usable = hasUsableReferenceValue(set, blockType);
      if (usable) semanticUsablePreviousSet.add(set);
      if (set.done && usable) usablePrevious.push(set);
    }
    const currentIndex = new Map<StrengthSet, number>();
    compatibleCurrent.forEach((set, index) => {
      if (!currentIndex.has(set)) currentIndex.set(set, index);
    });
    indexes.set(key, {
      previousNumbers,
      currentNumbersUnique: currentNumbers.unique,
      usablePrevious,
      semanticUsablePreviousSet,
      currentIndex,
    });
  }

  return {
    match(currentSet) {
      if (!isStrengthSet(currentSet)) return null;
      const group = indexes.get(compatibilityKey(currentSet, blockType));
      if (!group) return null;

      const currentNumber = validSetNumber(currentSet);
      if (currentNumber !== null && group.currentNumbersUnique && group.previousNumbers.unique) {
        const semanticMatch = group.previousNumbers.byNumber.get(currentNumber);
        if (semanticMatch) return group.semanticUsablePreviousSet.has(semanticMatch) ? semanticMatch : null;
      }

      const currentIndex = group.currentIndex.get(currentSet);
      if (currentIndex === undefined) return null;
      return group.usablePrevious[currentIndex] ?? null;
    },
  };
}

export function formatPreviousSetReference(
  previousSet: StrengthSet | null,
  displayUnit: WeightUnit,
  blockType = 'strength',
): PreviousPerformanceCue | null {
  return formatPreviousPerformance(previousSet, displayUnit, blockType);
}

export interface WorkoutPreviousCueProjection {
  previousBest: PreviousPerformanceCue | null;
  previousSets: Array<PreviousPerformanceCue | null>;
}

type WorkoutPreviousCueCacheEntry = {
  sourcePreviousSets: readonly WorkoutSet[] | undefined;
  currentSets: readonly WorkoutSet[];
  displayUnit: WeightUnit;
  blockType: string;
  projection: WorkoutPreviousCueProjection;
};

/**
 * Memoizes read-only cues for immutable Workout objects during one owner
 * lifetime. Callers must create a fresh cache when account/date/source
 * authority changes; weak keys let replaced draft rows be collected.
 */
export function createWorkoutPreviousCueCache() {
  const entries = new WeakMap<Workout, WorkoutPreviousCueCacheEntry>();
  return (
    workout: Workout,
    sourcePreviousSets: readonly WorkoutSet[] | undefined,
    displayUnit: WeightUnit,
    blockType = 'strength',
  ): WorkoutPreviousCueProjection => {
    const currentSets = workout.sets ?? [];
    const cached = entries.get(workout);
    if (cached && cached.sourcePreviousSets === sourcePreviousSets
      && cached.currentSets === currentSets
      && cached.displayUnit === displayUnit
      && cached.blockType === blockType) return cached.projection;

    const matcher = createPreviousSetReferenceMatcher(sourcePreviousSets, currentSets, blockType);
    const projection: WorkoutPreviousCueProjection = {
      previousBest: formatPreviousBestCue(sourcePreviousSets, displayUnit, blockType),
      previousSets: currentSets.map(set => formatPreviousSetReference(
        matcher.match(set), displayUnit, blockType,
      )),
    };
    entries.set(workout, { sourcePreviousSets, currentSets, displayUnit, blockType, projection });
    return projection;
  };
}
