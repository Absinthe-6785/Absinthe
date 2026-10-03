import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StrengthSet, Workout } from '../types';
import { normalizeWeightInput, type WorkoutSessionV1, type WorkoutStrengthSetV1 } from './workoutSessionV1';
import {
  projectCompositeWorkoutRead,
  type ActiveCanonicalWorkoutReadInput, type LegacyWorkoutReadInput,
} from '../components/views/features/health/compositeWorkoutReadProjection';
import type { WorkoutReadSourceSnapshot } from '../components/views/features/health/verifiedWorkoutRangeSnapshot';
import { formatPreviousBestCue } from '../components/views/features/health/previousMicroCue';
import { computeWorkoutPrBadge } from '../components/views/features/health/computeWorkoutPrBadge';
import { buildSetsFromPrevCount, plannedSetCount } from '../components/views/features/health/workoutSetCount';
import {
  projectWorkoutExerciseComparison, type ExerciseComparisonKey,
  type ExerciseComparisonSourceResult, type WorkoutExerciseComparisonResult,
} from './workoutExerciseComparisonProjection';

const key: ExerciseComparisonKey = { id: 'squat', name: 'Squat', type: 'strength' };
const context = { accountId: 'a', namespaceKey: 'workout:a', generationId: 'g1' };
const uuid = (n: number) => `${n.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

function legacy(
  date = '2026-09-30', patch: Partial<StrengthSet> = {}, rowId = 'legacy-1',
): LegacyWorkoutReadInput {
  return { accountId: 'a', rowId, localDate: date, blockId: 'squat', sortOrder: 0,
    exerciseDisplay: { kind: 'current_catalog', block: { id: 'squat', name: 'Squat', type: 'strength' } },
    sets: [{ type: 'strength', set: 1, kg: 20, reps: 8, done: true, ...patch }] };
}

function canonical(
  date = '2026-09-30', patch: Partial<WorkoutStrengthSetV1> = {}, seed = 1,
): ActiveCanonicalWorkoutReadInput {
  const session: WorkoutSessionV1 = { version: 1, id: uuid(seed), localDate: date, entries: [{
    id: uuid(seed + 100), exercise: { ...key, id: key.id, name: key.name!, type: 'strength', tags: [], cardioMode: null },
    sets: [{ id: uuid(seed + 200), ordinal: 1, kind: 'strength', loadKind: 'external_weight',
      weightKg: '20', sourceValue: '20', sourceUnit: 'kg', reps: 8, assistedReps: null,
      dropset: false, done: true, ...patch }],
  }] };
  return { ...context, entityId: session.id, localRevision: 1, session };
}

function snapshot(
  rows: readonly LegacyWorkoutReadInput[] = [], sessions: readonly ActiveCanonicalWorkoutReadInput[] = [],
  errors: readonly ('legacy' | 'canonical')[] = [],
): WorkoutReadSourceSnapshot {
  return { accountId: 'a', scope: { ...context, deviceId: 'device-1' }, result: projectCompositeWorkoutRead({
    context,
    legacy: errors.includes('legacy') ? { status: 'error' } : { status: 'success', records: rows },
    canonical: errors.includes('canonical') ? { status: 'error' } : { status: 'success', records: sessions },
  }) };
}

function project(
  rows: readonly LegacyWorkoutReadInput[] = [], sessions: readonly ActiveCanonicalWorkoutReadInput[] = [],
  errors: readonly ('legacy' | 'canonical')[] = [], exercise = key,
): WorkoutExerciseComparisonResult {
  return projectWorkoutExerciseComparison({ selectedDate: '2026-10-02', exercise,
    read: { status: 'current', snapshot: snapshot(rows, sessions, errors) } });
}

function success(result: WorkoutExerciseComparisonResult, source: 'legacy' | 'canonical') {
  const group = result[source];
  expect(group?.status).toBe('success');
  return group as Extract<ExerciseComparisonSourceResult, { status: 'success' }>;
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

describe('dormant Option C source-separated exercise facts', () => {
  it('projects legacy-only eligible evidence with real row/position provenance', () => {
    const result = project([legacy()]);
    expect(success(result, 'legacy')).toMatchObject({ evidence: 'eligible_evidence', latestEligibleDate: '2026-09-30',
      observations: [{ weight: { status: 'trusted', weightKg: 20, provenance: 'legacy_kg_only' },
        origin: { source: 'legacy', rowId: 'legacy-1', setIndex: 0, setNumber: 1 } }] });
    expect(success(result, 'canonical')).toMatchObject({ evidence: 'no_eligible_evidence', latestEligibleDate: null });
  });

  it('includes canonical-only facts without fabricating legacy absence across both sources', () => {
    const result = project([], [canonical()]);
    expect(success(result, 'canonical').observations[0]).toMatchObject({
      weight: { status: 'trusted', weightKg: '20', provenance: 'validated_canonical' },
      origin: { sessionId: uuid(1), entryId: uuid(101), setId: uuid(201) },
    });
    expect(result).toMatchObject({ scope: { selectedDate: '2026-10-02', exercise: key,
      horizon: 'all_local_active_prior', eligibility: 'completed_normal_external_weight_factual_claims' } });
  });

  it.each(['2026-09-29', '2026-09-30', '2026-10-01'])('keeps mixed sources separate for canonical date %s', date => {
    const result = project([legacy()], [canonical(date)]);
    expect(success(result, 'legacy').latestEligibleDate).toBe('2026-09-30');
    expect(success(result, 'canonical').latestEligibleDate).toBe(date);
    expect(success(result, 'legacy').observations).toHaveLength(1);
    expect(success(result, 'canonical').observations).toHaveLength(1);
    expect(result).not.toHaveProperty('latestEligibleDate');
    expect(result).not.toHaveProperty('previous');
    expect(result).not.toHaveProperty('winner');
  });

  it('retains two same-day sessions, repeated entries and every matching eligible set', () => {
    const first = canonical();
    const session = structuredClone(first.session) as WorkoutSessionV1;
    session.entries.push({ ...session.entries[0]!, id: uuid(301),
      sets: [{ ...session.entries[0]!.sets[0]!, id: uuid(401) }] });
    session.entries[0]!.sets.push({ ...session.entries[0]!.sets[0]!, id: uuid(501), ordinal: 2 });
    const result = project([], [{ ...first, session }, canonical('2026-09-30', {}, 2)]);
    const observations = success(result, 'canonical').observations;
    expect(observations).toHaveLength(4);
    expect(observations.map(o => o.origin.source === 'canonical' && o.origin.setId))
      .toEqual([uuid(201), uuid(501), uuid(401), uuid(202)]);
    expect(new Set(observations.map(o => o.origin.source === 'canonical' && o.origin.sessionId)).size).toBe(2);
  });

  it('does not deduplicate identical legacy sets, rows, dates or cross-source values', () => {
    const row = legacy();
    const result = project([{ ...row, sets: [row.sets[0]!, row.sets[0]!] }, legacy('2026-09-30', {}, 'legacy-2')],
      [canonical()]);
    expect(success(result, 'legacy').observations.map(o => o.origin.source === 'legacy' && o.origin.setIndex))
      .toEqual([0, 1, 0]);
    expect(success(result, 'canonical').observations).toHaveLength(1);
  });

  it('strictly excludes selectedDate and future records on both sources', () => {
    const result = project([legacy('2026-10-02'), legacy('2026-10-03', {}, 'future'), legacy('2026-09-30', {}, 'prior')],
      [canonical('2026-10-02'), canonical('2026-10-03', {}, 2), canonical('2026-09-30', {}, 3)]);
    expect(success(result, 'legacy').latestEligibleDate).toBe('2026-09-30');
    expect(success(result, 'canonical').latestEligibleDate).toBe('2026-09-30');
  });

  it.each(['unfinished', 'dropset', 'unknown'] as const)('applies %s eligibility BEFORE latest date selection', variant => {
    const lp: Partial<StrengthSet> = variant === 'unfinished' ? { done: false }
      : variant === 'dropset' ? { is_dropset: true } : { kg: '', reps: '' };
    const cp: Partial<WorkoutStrengthSetV1> = variant === 'unfinished' ? { done: false }
      : variant === 'dropset' ? { dropset: true } : { weightKg: null, sourceValue: null, sourceUnit: null, reps: null };
    const result = project([legacy('2026-10-01', lp), legacy('2026-09-30', {}, 'old')],
      [canonical('2026-10-01', cp), canonical('2026-09-30', {}, 2)]);
    expect(success(result, 'legacy').latestEligibleDate).toBe('2026-09-30');
    expect(success(result, 'canonical').latestEligibleDate).toBe('2026-09-30');
  });

  it('does not use a one-year horizon or claim cloud/all-time coverage', () => {
    const result = project([legacy('2020-01-01')], [canonical('2019-01-01')]);
    expect(success(result, 'legacy').latestEligibleDate).toBe('2020-01-01');
    expect(success(result, 'canonical').latestEligibleDate).toBe('2019-01-01');
    expect(result).toMatchObject({ scope: { horizon: 'all_local_active_prior' } });
  });

  it.each([
    { id: null }, { id: 'other' }, { id: 'SQUAT' }, { name: 'Renamed Squat' },
    { name: ' Squat' }, { name: 'squat' },
  ])('does not associate a null/different/case-varied/renamed snapshot: %j', patch => {
    const row = canonical();
    const session = structuredClone(row.session) as WorkoutSessionV1;
    Object.assign(session.entries[0]!.exercise, patch);
    expect(success(project([], [{ ...row, session }]), 'canonical')).toMatchObject({
      evidence: 'no_eligible_evidence', latestEligibleDate: null, observations: [],
    });
  });

  it.each([{ ...key, name: null }, { ...key, type: null }, { ...key, type: 'bodyweight' }])(
    'requires available exact catalog name/type: %j', exercise => {
      expect(success(project([], [canonical()], [], exercise), 'canonical').observations).toEqual([]);
    },
  );

  it('retains legacy exact block-ID association and honest historical fallback, without synthesizing catalog metadata', () => {
    const row: LegacyWorkoutReadInput = { ...legacy(), exerciseDisplay: { kind: 'historical_fallback', name: 'Historical exercise' } };
    const other: LegacyWorkoutReadInput = { ...legacy('2026-10-01', {}, 'other'), blockId: 'SQUAT',
      exerciseDisplay: { kind: 'historical_fallback', name: 'Squat' } };
    const result = project([row, other], [], [], { ...key, name: null });
    expect(success(result, 'legacy').observations).toHaveLength(1);
    expect(success(result, 'legacy').observations[0]?.origin).toMatchObject({
      blockId: 'squat', displayKind: 'historical_fallback', displayName: 'Historical exercise',
    });
  });

  it('preserves consistent legacy lbs source values and canonical exact normalized decimals', () => {
    const normalized = normalizeWeightInput('100', 'lbs');
    const result = project([legacy('2026-09-30', { kg: 45.36, weight_source_value: 100, weight_source_unit: 'lbs' })],
      [canonical('2026-09-30', normalized)]);
    expect(success(result, 'legacy').observations[0]?.weight).toMatchObject({
      weightKg: 45.36, sourceValue: 100, sourceUnit: 'lbs', provenance: 'legacy_consistent_source',
    });
    expect(success(result, 'canonical').observations[0]?.weight).toMatchObject({
      weightKg: '45.36', sourceValue: '100', sourceUnit: 'lbs',
    });
  });

  it.each([
    { kg: 99, weight_source_value: 100, weight_source_unit: 'lbs' as const },
    { weight_source_value: 20 }, { weight_source_unit: 'kg' as const },
  ])('withholds conflicting/incomplete kg claims, but preserves independently trusted reps: %j', patch => {
    const result = project([legacy('2026-10-01', patch)]);
    expect(success(result, 'legacy')).toMatchObject({ latestEligibleDate: '2026-10-01', withheldWeightClaims: 1,
      observations: [{ weight: { status: 'untrusted' }, repetitions: { status: 'trusted', total: 8 } }] });
    expect(success(result, 'legacy').observations[0]?.weight).not.toHaveProperty('weightKg');
    expect(success(result, 'legacy').observations[0]?.weight).toMatchObject({ recorded: {
      weightKg: patch.kg ?? 20,
      sourceValue: patch.weight_source_value ?? null, sourceUnit: patch.weight_source_unit ?? null,
    } });
  });

  it('unrelated untrusted repetitions do not destroy valid factual weight', () => {
    const result = project([legacy('2026-10-01', { reps: 1.5 })]);
    expect(success(result, 'legacy')).toMatchObject({ latestEligibleDate: '2026-10-01', withheldRepetitionClaims: 1,
      observations: [{ weight: { status: 'trusted', weightKg: 20 }, repetitions: { status: 'untrusted' } }] });
  });

  it('does not compare display-rounded labels or parse measurement suffixes as kg', () => {
    const result = project([legacy('2026-09-30', { kg: '20kg' })], [canonical('2026-09-30', {
      weightKg: '20.24', sourceValue: '20.24', sourceUnit: 'kg',
    })]);
    expect(success(result, 'legacy').observations[0]?.weight).toMatchObject({ status: 'untrusted', recorded: { weightKg: '20kg' } });
    expect(success(result, 'canonical').observations[0]?.weight).toMatchObject({ status: 'trusted', weightKg: '20.24' });
  });

  it('never UUID-case-normalizes the analytical exercise key', () => {
    const row = canonical();
    const session = structuredClone(row.session) as WorkoutSessionV1;
    session.entries[0]!.exercise.id = uuid(101);
    const exercise = { ...key, id: uuid(101).toUpperCase() };
    expect(success(project([], [{ ...row, session }], [], exercise), 'canonical').observations).toEqual([]);
  });

  it('a latest date with no trusted claim cannot hide an older eligible date', () => {
    const result = project([legacy('2026-10-01', { kg: 99, weight_source_value: 100, weight_source_unit: 'lbs', reps: '' }),
      legacy('2026-09-30', {}, 'old')]);
    expect(success(result, 'legacy')).toMatchObject({ latestEligibleDate: '2026-09-30', withheldWeightClaims: 1 });
  });

  it('retains untrusted-claim disclosure even when no eligible observation survives', () => {
    const result = project([legacy('2026-10-01', { kg: 99, weight_source_value: 100, weight_source_unit: 'lbs', reps: '' })]);
    expect(success(result, 'legacy')).toMatchObject({ evidence: 'no_eligible_evidence', observations: [], withheldWeightClaims: 1 });
  });

  it('keeps missing numbers unknown and explicit zeros factual, without any PR', () => {
    const result = project([legacy('2026-09-30', { kg: 0, reps: '' })],
      [canonical('2026-09-30', { weightKg: null, sourceValue: null, sourceUnit: null, reps: 0 })]);
    expect(success(result, 'legacy').observations[0]).toMatchObject({
      weight: { status: 'trusted', weightKg: 0 }, repetitions: { status: 'unknown' },
    });
    expect(success(result, 'canonical').observations[0]).toMatchObject({
      weight: { status: 'unknown' }, repetitions: { status: 'trusted', total: 0, assisted: null, unassisted: null },
    });
    const json = JSON.stringify(result);
    for (const forbidden of ['pr_kg', 'isPR', 'oneRepMax', 'globalPR', 'winner', 'rank']) expect(json).not.toContain(forbidden);
  });

  it('exposes factual total/assisted/unassisted, including all-assisted zero, never a ranking', () => {
    const result = project([legacy('2026-09-30', { assisted_reps: 8 })], [canonical('2026-09-30', { assistedReps: 3 })]);
    expect(success(result, 'legacy').observations[0]?.repetitions).toEqual({ status: 'trusted', total: 8, assisted: 8, unassisted: 0 });
    expect(success(result, 'canonical').observations[0]?.repetitions).toEqual({ status: 'trusted', total: 8, assisted: 3, unassisted: 5 });
  });

  it.each([0, 9, '3'])('does not invent a trusted assisted split from invalid durable subset %s', assisted_reps => {
    expect(success(project([legacy('2026-09-30', { assisted_reps })]), 'legacy').observations[0]?.repetitions)
      .toEqual({ status: 'untrusted' });
  });

  it.each(['bodyweight', 'cardio'] as const)('excludes new %s evidence without changing existing source history', type => {
    const row = canonical();
    const session = structuredClone(row.session) as WorkoutSessionV1;
    session.entries[0]!.exercise = { ...session.entries[0]!.exercise, type, cardioMode: type === 'cardio' ? 'both' : null };
    session.entries[0]!.sets = [type === 'bodyweight'
      ? { id: uuid(201), ordinal: 1, kind: 'bodyweight', loadKind: 'bodyweight', done: true, reps: 8, assistedReps: null, dropset: false }
      : { id: uuid(201), ordinal: 1, kind: 'cardio', done: true, durationSeconds: 60, distanceMeters: '1000' }];
    const input = snapshot([legacy('2026-09-30', { type: 'bodyweight' })], [{ ...row, session }]);
    const result = projectWorkoutExerciseComparison({ selectedDate: '2026-10-02', exercise: key, read: { status: 'current', snapshot: input } });
    expect(success(result, 'legacy').observations).toEqual([]);
    expect(success(result, 'canonical').observations).toEqual([]);
    expect(input.result.records).toHaveLength(2);
  });

  it.each(['legacy', 'canonical'] as const)('ordinary %s error yields explicitly incomplete surviving facts (not failed-source empty)', failed => {
    for (const withMatch of [true, false]) {
      const result = project(withMatch ? [legacy()] : [], withMatch ? [canonical()] : [], [failed]);
      expect(result.status).toBe('partial_data');
      expect(result[failed]).toEqual({ source: failed, status: 'unavailable' });
      const surviving = success(result, failed === 'legacy' ? 'canonical' : 'legacy');
      expect(surviving.evidence).toBe(withMatch ? 'eligible_evidence' : 'no_eligible_evidence');
    }
    // Ordinary error input models the current legacy classification gap; not a real driver/isolation proof.
  });

  it('both ordinary failures mean unavailable, never verified empty', () => {
    const result = project([], [], ['legacy', 'canonical']);
    expect(result.status).toBe('unavailable');
    expect(result.legacy).toEqual({ source: 'legacy', status: 'unavailable' });
    expect(result.canonical).toEqual({ source: 'canonical', status: 'unavailable' });
  });

  it.each(['ACCOUNT_MISMATCH', 'NAMESPACE_MISMATCH', 'GENERATION_MISMATCH', 'INVALID_CONTEXT'] as const)(
    'typed isolation %s suppresses both groups (DTO-level, not a real persisted-path proof)', code => {
      expect(projectWorkoutExerciseComparison({ selectedDate: '2026-10-02', exercise: key,
        read: { status: 'isolation_error', code } })).toEqual({ status: 'isolation_error', legacy: null, canonical: null });
    },
  );

  it.each(['pending', 'disabled', 'stale'] as const)('never returns settled evidence for owner-declared %s', status => {
    expect(projectWorkoutExerciseComparison({ selectedDate: '2026-10-02', exercise: key, read: { status } }))
      .toEqual({ status, legacy: null, canonical: null });
  });

  it('is pure, preserves exact persisted identities and frozen input, and returns no adoption/write/copy plan', () => {
    const input = freezeDeep({ selectedDate: '2026-10-02', exercise: key,
      read: { status: 'current' as const, snapshot: snapshot([legacy()], [canonical()]) } });
    const before = JSON.stringify(input);
    const result = projectWorkoutExerciseComparison(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(success(result, 'canonical').observations[0]?.origin).toMatchObject({
      readId: input.read.snapshot.result.records[0]!.readId, entityId: uuid(1), sessionId: uuid(1), entryId: uuid(101), setId: uuid(201),
    });
    expect(JSON.stringify(result)).not.toMatch(/adopt|dedupe|mutation|payload|deliveryBinding|plannedSetCount/);
  });

  it('leaves compatibility cue/PR/all-array planning semantics independent of the new eligible-date choice', () => {
    const latest = legacy('2026-10-01', { kg: 100, done: false });
    const older = legacy('2026-09-30', {}, 'older');
    const result = project([latest, older]);
    expect(success(result, 'legacy').latestEligibleDate).toBe('2026-09-30');
    const compatibilitySets = structuredClone(latest.sets) as StrengthSet[];
    expect(formatPreviousBestCue(compatibilitySets, 'kg')).toBeNull();
    expect(plannedSetCount('squat', [], { squat: { prev_sets: [...compatibilitySets, ...compatibilitySets] } })).toBe(2);
    expect(buildSetsFromPrevCount('strength', compatibilitySets)).toEqual([{ type: 'strength', set: 1, kg: '', reps: '', done: false }]);
    const workout: Workout = { id: 'draft', block_id: 'squat', exercise_blocks: { id: 'squat', name: 'Squat', type: 'strength' },
      sets: [{ type: 'strength', set: 1, kg: 60, reps: 8, done: true }] };
    expect(computeWorkoutPrBadge(workout, { prev_sets: compatibilitySets, prev_date: '2026-10-01', pr_kg: 100 }, kg => kg, 'kg'))
      .toMatchObject({ isPR: false, prevMax: 0 });
  });

  it('has only the existing pure conversion runtime import; no reader, React or persistence runtime dependency', () => {
    const source = readFileSync(new URL('./workoutExerciseComparisonProjection.ts', import.meta.url), 'utf8');
    const runtimeImports = source.match(/^import (?!type )[\s\S]*?from ['"][^'"]+['"];$/gm);
    expect(runtimeImports).toEqual(["import { canonicalWeightKg } from '../components/views/features/health/healthWeight';"]);
    // Type-only snapshot imports erase; each projection adds zero canonical/legacy storage reads.
  });

  it.each(['2026-02-29', '2026-13-01', '2026-00-01', '2026-10-00', '2026-10-32', '2026-1-01'])(
    'rejects an invalid selectedDate %s instead of broadening the horizon', selectedDate => {
      expect(() => projectWorkoutExerciseComparison({ selectedDate, exercise: key,
        read: { status: 'current', snapshot: snapshot() } })).toThrow('exercise_comparison_selected_date_invalid');
    },
  );
});
