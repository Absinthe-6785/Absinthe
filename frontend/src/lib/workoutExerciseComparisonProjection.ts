import type { StrengthSet } from '../types';
import type {
  CompositeWorkoutReadIsolationCode, CompositeWorkoutRecord,
} from '../components/views/features/health/compositeWorkoutReadProjection';
import type { WorkoutReadSourceSnapshot } from '../components/views/features/health/verifiedWorkoutRangeSnapshot';
import { canonicalWeightKg } from '../components/views/features/health/healthWeight';

export type ExerciseComparisonKey = Readonly<{
  id: string;
  /** Null means current catalog evidence is unavailable, not a name fallback. */
  name: string | null;
  type: string | null;
}>;

export type ExerciseComparisonWeight =
  | Readonly<{
      status: 'trusted';
      /** Canonical decimal strings remain exact; legacy internal kg remain numbers. */
      weightKg: string | number;
      sourceValue: string | number | null;
      sourceUnit: 'kg' | 'lbs' | null;
      provenance: 'validated_canonical' | 'legacy_kg_only' | 'legacy_consistent_source';
    }>
  | Readonly<{ status: 'unknown' }>
  | Readonly<{
      status: 'untrusted';
      /** Conflicting values are provenance only, never trusted numeric input. */
      recorded: Readonly<{
        weightKg: string | number | null;
        sourceValue: string | number | null;
        sourceUnit: string | null;
      }>;
    }>;

export type ExerciseComparisonRepetitions =
  | Readonly<{
      status: 'trusted';
      total: number;
      /** Missing assistance is unknown, never synthesized as zero. */
      assisted: number | null;
      unassisted: number | null;
    }>
  | Readonly<{ status: 'unknown' | 'untrusted' }>;

export type ExerciseComparisonObservation = Readonly<{
  localDate: string;
  weight: ExerciseComparisonWeight;
  repetitions: ExerciseComparisonRepetitions;
  origin:
    | Readonly<{
        source: 'legacy'; readId: string; rowId: string; blockId: string;
        /** Legacy sets have no durable set UUID; position is NOT a session identity/chronology. */
        setIndex: number; setNumber: number;
        displayKind: 'current_catalog' | 'historical_fallback'; displayName: string;
      }>
    | Readonly<{
        source: 'canonical'; readId: string; entityId: string; sessionId: string;
        entryId: string; setId: string; ordinal: number; localRevision: number;
        exerciseId: string; frozenName: string; frozenType: 'strength';
      }>;
}>;

export type ExerciseComparisonSourceResult =
  | Readonly<{ source: 'legacy' | 'canonical'; status: 'unavailable' }>
  | Readonly<{
      source: 'legacy' | 'canonical'; status: 'success';
      evidence: 'eligible_evidence' | 'no_eligible_evidence';
      latestEligibleDate: string | null;
      observations: readonly ExerciseComparisonObservation[];
      /** Claim-specific exclusions across associated prior normal/done strength sets. */
      withheldWeightClaims: number;
      withheldRepetitionClaims: number;
    }>;

export type ExerciseComparisonRead =
  | Readonly<{
      status: 'current';
      /** Full active-domain paired snapshot, NOT a bounded WorkoutRangeView. */
      snapshot: WorkoutReadSourceSnapshot;
    }>
  | Readonly<{ status: 'pending' | 'disabled' | 'stale' }>
  | Readonly<{ status: 'isolation_error'; code: CompositeWorkoutReadIsolationCode }>;

export type WorkoutExerciseComparisonInput = Readonly<{
  selectedDate: string;
  exercise: ExerciseComparisonKey;
  read: ExerciseComparisonRead;
}>;

export type WorkoutExerciseComparisonResult =
  | Readonly<{
      status: 'pending' | 'disabled' | 'stale' | 'isolation_error';
      legacy: null; canonical: null;
    }>
  | Readonly<{
      /** Complete source reads do not imply remote/all-time or universal paired isolation. */
      status: 'complete' | 'partial_data' | 'unavailable';
      scope: Readonly<{
        accountId: string; namespaceKey: string | null; generationId: string | null;
        selectedDate: string; exercise: ExerciseComparisonKey;
        horizon: 'all_local_active_prior';
        eligibility: 'completed_normal_external_weight_factual_claims';
        association: 'legacy_exact_block_id_canonical_exact_id_name_type';
      }>;
      legacy: ExerciseComparisonSourceResult;
      canonical: ExerciseComparisonSourceResult;
    }>;

function nonnegativeNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function legacyWeight(set: Readonly<StrengthSet>): ExerciseComparisonWeight {
  const kg = nonnegativeNumber(set.kg);
  const hasValue = Object.prototype.hasOwnProperty.call(set, 'weight_source_value');
  const hasUnit = Object.prototype.hasOwnProperty.call(set, 'weight_source_unit');
  const untrusted: ExerciseComparisonWeight = {
    status: 'untrusted', recorded: {
      weightKg: set.kg,
      sourceValue: set.weight_source_value ?? null,
      sourceUnit: set.weight_source_unit ?? null,
    },
  };
  if (!hasValue && !hasUnit) {
    return kg === null ? (set.kg === '' ? { status: 'unknown' } : untrusted)
      : { status: 'trusted', weightKg: kg, sourceValue: null, sourceUnit: null,
        provenance: 'legacy_kg_only' };
  }
  // Never fall back to kg when saved source metadata is incomplete/inconsistent.
  const value = set.weight_source_value;
  const unit = set.weight_source_unit;
  if (kg === null || typeof value !== 'number' || !Number.isFinite(value) || value < 0
    || (unit !== 'kg' && unit !== 'lbs') || canonicalWeightKg(value, unit) !== kg) {
    return untrusted;
  }
  return { status: 'trusted', weightKg: kg, sourceValue: value, sourceUnit: unit,
    provenance: 'legacy_consistent_source' };
}

function legacyRepetitions(set: Readonly<StrengthSet>): ExerciseComparisonRepetitions {
  const total = nonnegativeNumber(set.reps);
  if (total === null || !Number.isSafeInteger(total)) {
    return { status: set.reps === '' ? 'unknown' : 'untrusted' };
  }
  if (!Object.prototype.hasOwnProperty.call(set, 'assisted_reps')) {
    return { status: 'trusted', total, assisted: null, unassisted: null };
  }
  const assisted = set.assisted_reps;
  // Persisted legacy assistance is a positive numeric subset, unlike an empty draft.
  if (typeof assisted !== 'number' || !Number.isSafeInteger(assisted)
    || assisted <= 0 || assisted > total) return { status: 'untrusted' };
  return { status: 'trusted', total, assisted, unassisted: total - assisted };
}

function sourceProjection(
  source: 'legacy' | 'canonical', status: 'success' | 'error',
  records: readonly CompositeWorkoutRecord[], selectedDate: string, key: ExerciseComparisonKey,
): ExerciseComparisonSourceResult {
  if (status === 'error') return { source, status: 'unavailable' };
  let latestEligibleDate: string | null = null;
  let observations: ExerciseComparisonObservation[] = [];
  let withheldWeightClaims = 0;
  let withheldRepetitionClaims = 0;
  const consider = (observation: ExerciseComparisonObservation) => {
    if (observation.weight.status === 'untrusted') withheldWeightClaims += 1;
    if (observation.repetitions.status === 'untrusted') withheldRepetitionClaims += 1;
    // Each factual claim needs only its own values. Unknown/untrusted kg never
    // becomes a kg comparison, but cannot erase independently trusted reps (or vice versa).
    if (observation.weight.status !== 'trusted' && observation.repetitions.status !== 'trusted') return;
    if (latestEligibleDate === null || observation.localDate > latestEligibleDate) {
      latestEligibleDate = observation.localDate;
      observations = [];
    }
    if (observation.localDate === latestEligibleDate) observations.push(observation);
  };
  if (key.type === 'strength') for (const record of records) {
    if (record.source !== source || record.localDate >= selectedDate) continue;
    if (record.source === 'legacy') {
      const row = record.legacy;
      if (row.blockId !== key.id) continue;
      row.sets.forEach((set, setIndex) => {
        if (set.type !== 'strength' || set.done !== true || set.is_dropset === true) return;
        consider({
          localDate: record.localDate, weight: legacyWeight(set), repetitions: legacyRepetitions(set),
          origin: { source: 'legacy', readId: record.readId, rowId: row.rowId, blockId: row.blockId,
            setIndex, setNumber: set.set, displayKind: row.exerciseDisplay.kind,
            displayName: row.exerciseDisplay.kind === 'current_catalog'
              ? row.exerciseDisplay.block.name : row.exerciseDisplay.name },
        });
      });
    } else {
      const row = record.canonical;
      for (const entry of row.session.entries) {
        const exercise = entry.exercise;
        if (exercise.id === null || exercise.id !== key.id || key.name === null
          || exercise.name !== key.name || exercise.type !== key.type) continue;
        for (const set of entry.sets) {
          if (set.kind !== 'strength' || set.loadKind !== 'external_weight'
            || set.done !== true || set.dropset) continue;
          consider({
            localDate: record.localDate,
            weight: set.weightKg === null ? { status: 'unknown' }
              : { status: 'trusted', weightKg: set.weightKg, sourceValue: set.sourceValue,
                sourceUnit: set.sourceUnit, provenance: 'validated_canonical' },
            repetitions: set.reps === null ? { status: 'unknown' }
              : { status: 'trusted', total: set.reps, assisted: set.assistedReps,
                unassisted: set.assistedReps === null ? null : set.reps - set.assistedReps },
            origin: { source: 'canonical', readId: record.readId, entityId: row.entityId,
              sessionId: row.session.id, entryId: entry.id, setId: set.id, ordinal: set.ordinal,
              localRevision: row.localRevision, exerciseId: exercise.id,
              frozenName: exercise.name, frozenType: 'strength' },
          });
        }
      }
    }
  }
  return { source, status: 'success', evidence: observations.length ? 'eligible_evidence' : 'no_eligible_evidence',
    latestEligibleDate, observations, withheldWeightClaims, withheldRepetitionClaims };
}

/**
 * Dormant pure read model: no production subscriber, storage, listeners, writer, PR or planning API.
 * Only the existing verified paired owner may supply a current full snapshot. A future adapter must
 * derive inside that owner's publication fence (including account/date ABA, device/generation,
 * supersession, enable lifetime/unmount and synchronous save/delete invalidation). `current` is an
 * input precondition, NOT a new currentness proof. A cached DTO never authorizes later publication.
 * The one-year Previous view is not an admissible substitute for this all-local-active input.
 * Legacy generic owner-validation failures remain ordinary partial errors; this does not repair
 * LEGACY_VERIFIED_OWNER_CLASSIFICATION_GAP. Typed isolation must be passed as isolation_error.
 */
export function projectWorkoutExerciseComparison(
  input: WorkoutExerciseComparisonInput,
): WorkoutExerciseComparisonResult {
  if (input.read.status !== 'current') {
    return { status: input.read.status, legacy: null, canonical: null };
  }
  // Validate the requested calendar boundary without interpreting timezone or "today".
  const [year, month, day] = input.selectedDate.split('-').map(Number);
  const leap = year! % 4 === 0 && (year! % 100 !== 0 || year! % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.selectedDate) || month! < 1 || month! > 12
    || day! < 1 || day! > days[month! - 1]!) {
    throw new Error('exercise_comparison_selected_date_invalid');
  }
  const { snapshot } = input.read;
  const { result } = snapshot;
  return {
    status: result.status === 'error' ? 'unavailable' : result.status,
    scope: {
      accountId: snapshot.accountId, namespaceKey: snapshot.scope?.namespaceKey ?? null,
      generationId: snapshot.scope?.generationId ?? null,
      selectedDate: input.selectedDate, exercise: { ...input.exercise },
      horizon: 'all_local_active_prior', eligibility: 'completed_normal_external_weight_factual_claims',
      association: 'legacy_exact_block_id_canonical_exact_id_name_type',
    },
    legacy: sourceProjection('legacy', result.legacyStatus, result.records, input.selectedDate, input.exercise),
    canonical: sourceProjection('canonical', result.canonicalStatus, result.records, input.selectedDate, input.exercise),
  };
}
