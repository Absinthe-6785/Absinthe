import type { HealthWorkoutAdoptionCapture } from '../healthLocalRepository';
import { hashCanonicalPayload } from '../localDatabase/canonicalPayload';
import {
  normalizeAssistedRepetitionsInput, normalizeCardioDurationInput, normalizeDecimalInput,
  normalizeKilometersToMeters, normalizeRepetitionInput, normalizeWeightInput,
  validateWorkoutSessionV1, type WorkoutExerciseSnapshotV1, type WorkoutSetV1, type WorkoutSessionV1,
} from '../workoutSessionV1';
import {
  WORKOUT_ADOPTION_ADAPTER, type CapturedWorkoutAdoptionItem, type WorkoutAdoptionSnapshot,
} from './types';

const SOURCE_FIELDS = ['id', 'user_id', 'date', 'block_id', 'sets', 'sort_order',
  'historical_exercise_snapshot', 'session_boundary'] as const;
const BLOCK_FIELDS = ['id', 'user_id', 'name', 'type', 'tags', 'cardio_mode'] as const;
const DUMMY_ID = '11111111-1111-4111-8111-111111111111';

export function compareWorkoutAdoptionKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function evidence(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error('workout_adoption_source_too_deep');
  if (value === undefined) return { sourceType: 'undefined' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { sourceType: 'nonfinite', value: String(value) };
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => evidence(item, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('workout_adoption_source_unserializable');
  }
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (/token|password|secret|authorization|cookie/i.test(key)) throw new Error('workout_adoption_source_sensitive');
    result[key] = evidence((value as Record<string, unknown>)[key], depth + 1);
  }
  return result;
}

function projectFields(record: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) if (Object.prototype.hasOwnProperty.call(record, field)) result[field] = evidence(record[field]);
  return result;
}

export function buildWorkoutAdoptionSnapshot(
  capture: HealthWorkoutAdoptionCapture,
  sourceInstanceId: string,
): WorkoutAdoptionSnapshot {
  if (!sourceInstanceId || capture.importState.status !== 'VERIFIED_IMPORT_COMPLETE'
    || capture.importState.accountId !== capture.accountId) throw new Error('workout_adoption_source_unstable');
  const blocks = new Map(capture.exerciseBlocks.map(wrapper => [wrapper.record.id, wrapper]));
  const items: CapturedWorkoutAdoptionItem[] = capture.workouts.map(wrapper => {
    const row = projectFields(wrapper.record, SOURCE_FIELDS);
    const block = blocks.get(wrapper.record.block_id);
    const referenceBlock = block ? projectFields(block.record, BLOCK_FIELDS) : null;
    const ownership: CapturedWorkoutAdoptionItem['ownership'] = wrapper.accountId === capture.accountId && row.user_id === capture.accountId
      && (!block || block.accountId === capture.accountId && referenceBlock?.user_id === capture.accountId)
      ? 'BOUND' : 'UNATTRIBUTABLE';
    const sourceKeyDigest = hashCanonicalPayload(['workout-source-key-v1', sourceInstanceId, wrapper.storageKey]);
    return {
      sourceReference: wrapper.storageKey, sourceKeyDigest,
      sourceItemDigest: hashCanonicalPayload([
        'workout-source-item-v1', WORKOUT_ADOPTION_ADAPTER, capture.sourceSchemaVersion,
        wrapper.storageKey, row, referenceBlock, ownership,
      ]),
      sourceRow: row, referenceBlock, ownership,
    };
  }).sort((a, b) => compareWorkoutAdoptionKeys(a.sourceReference, b.sourceReference));
  if (new Set(items.map(item => item.sourceKeyDigest)).size !== items.length) {
    throw new Error('workout_adoption_duplicate_source_key');
  }
  const sourceImportStateDigest = hashCanonicalPayload(capture.importState);
  return {
    accountId: capture.accountId, sourceInstanceId,
    sourceSchemaVersion: capture.sourceSchemaVersion,
    sourceImportStateDigest, items,
    sourceSnapshotDigest: hashCanonicalPayload([
      'workout-source-snapshot-v1', WORKOUT_ADOPTION_ADAPTER, capture.sourceSchemaVersion,
      capture.accountId, sourceInstanceId, sourceImportStateDigest,
      items.map(item => [item.sourceKeyDigest, item.sourceItemDigest]),
    ]),
  };
}

export type ConversionAssessment =
  | { classification: 'ADOPTABLE'; build: (sessionId: string, entryId: string, setIds: string[]) => WorkoutSessionV1 }
  | { classification: 'AMBIGUOUS_REVIEW' | 'INVALID_ACCOUNTED'; reason: string };

export function historicalExerciseEvidence(item: CapturedWorkoutAdoptionItem):
  Record<'id' | 'name' | 'type' | 'tags' | 'cardioMode',
    'SOURCE_EXACT' | 'CURRENT_CATALOG_DERIVED' | 'MISSING' | 'AMBIGUOUS'> {
  const historic = item.sourceRow.historical_exercise_snapshot;
  const snapshot = historic && typeof historic === 'object' && !Array.isArray(historic)
    ? historic as Record<string, unknown> : null;
  const fields = ['id', 'name', 'type', 'tags', 'cardioMode'] as const;
  return Object.fromEntries(fields.map(field => {
    if (snapshot && Object.prototype.hasOwnProperty.call(snapshot, field)) {
      const value = snapshot[field];
      const valid = field === 'id' ? typeof value === 'string' && value === item.sourceRow.block_id
        : field === 'name' ? typeof value === 'string' && value.length > 0
          : field === 'type' ? value === 'strength' || value === 'bodyweight' || value === 'cardio'
            : field === 'tags' ? Array.isArray(value) && value.every(tag => typeof tag === 'string')
              : value === null || value === 'time' || value === 'distance' || value === 'both';
      return [field, valid ? 'SOURCE_EXACT' : 'AMBIGUOUS'];
    }
    if (field === 'id' && typeof item.sourceRow.block_id === 'string') return [field, 'SOURCE_EXACT'];
    return [field, item.referenceBlock && Object.prototype.hasOwnProperty.call(item.referenceBlock,
      field === 'cardioMode' ? 'cardio_mode' : field) ? 'CURRENT_CATALOG_DERIVED' : 'MISSING'];
  })) as Record<(typeof fields)[number], 'SOURCE_EXACT' | 'CURRENT_CATALOG_DERIVED' | 'MISSING' | 'AMBIGUOUS'>;
}

function decimalText(value: unknown, scale: number): string | null {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('invalid_decimal');
  const text = String(value);
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(text)) throw new Error('invalid_decimal');
  return normalizeDecimalInput(text, scale);
}

function convertSet(value: unknown, ordinal: number, id: string): WorkoutSetV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_set');
  const set = value as Record<string, unknown>;
  if (set.set !== ordinal || typeof set.done !== 'boolean') throw new Error('invalid_set_order');
  if (set.type === 'strength' || set.type === 'bodyweight') {
    const reps = normalizeRepetitionInput(set.reps);
    const assistedReps = normalizeAssistedRepetitionsInput(set.assisted_reps, reps);
    const dropset = set.is_dropset === undefined ? false : set.is_dropset;
    if (typeof dropset !== 'boolean') throw new Error('invalid_dropset');
    if (set.type === 'bodyweight') {
      if (set.kg !== '' && set.kg !== null && set.kg !== undefined) throw new Error('ambiguous_bodyweight_load');
      return { id, ordinal, done: set.done, kind: 'bodyweight', loadKind: 'bodyweight', reps, assistedReps, dropset };
    }
    const storedKg = decimalText(set.kg, 2);
    const hasSourceValue = Object.prototype.hasOwnProperty.call(set, 'weight_source_value');
    const hasSourceUnit = Object.prototype.hasOwnProperty.call(set, 'weight_source_unit');
    if (hasSourceValue !== hasSourceUnit) throw new Error('invalid_weight_source_pair');
    if (!hasSourceValue && storedKg !== null) throw new Error('ambiguous_weight_source_unit');
    if (hasSourceValue && set.weight_source_unit !== 'kg' && set.weight_source_unit !== 'lbs') {
      throw new Error('invalid_weight_source_unit');
    }
    const sourceValue = hasSourceValue ? decimalText(set.weight_source_value, 2) : null;
    const normalized = sourceValue === null
      ? { weightKg: null, sourceValue: null, sourceUnit: null }
      : normalizeWeightInput(sourceValue, set.weight_source_unit as 'kg' | 'lbs');
    if (normalized.weightKg !== storedKg) throw new Error('invalid_weight_source_mismatch');
    return { id, ordinal, done: set.done, kind: 'strength', loadKind: 'external_weight',
      ...normalized, reps, assistedReps, dropset };
  }
  if (set.type === 'cardio') {
    if (Object.prototype.hasOwnProperty.call(set, 'assisted_reps')) throw new Error('invalid_cardio_assisted');
    if (typeof set.time !== 'string') throw new Error('invalid_cardio_time');
    const distance = decimalText(set.distance, 6);
    const durationSeconds = normalizeCardioDurationInput(set.time);
    const distanceMeters = distance === null ? null : normalizeKilometersToMeters(distance);
    if (durationSeconds === null && distanceMeters === null && typeof set.pace === 'string' && set.pace !== '') {
      throw new Error('ambiguous_pace_only');
    }
    return { id, ordinal, done: set.done, kind: 'cardio', durationSeconds, distanceMeters };
  }
  throw new Error('invalid_set_type');
}

export function assessWorkoutAdoptionItem(item: CapturedWorkoutAdoptionItem): ConversionAssessment {
  const row = item.sourceRow;
  if (item.ownership !== 'BOUND') return { classification: 'INVALID_ACCOUNTED', reason: 'source_owner_unattributable' };
  if (typeof row.id !== 'string' || typeof row.date !== 'string' || typeof row.block_id !== 'string'
    || !Array.isArray(row.sets) || row.sets.length === 0 || !Number.isInteger(row.sort_order)) {
    return { classification: 'INVALID_ACCOUNTED', reason: 'legacy_row_shape_invalid' };
  }
  try {
    row.sets.forEach((set, index) => convertSet(set, index + 1, DUMMY_ID));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'conversion_failed';
    return { classification: reason.startsWith('ambiguous_') ? 'AMBIGUOUS_REVIEW' : 'INVALID_ACCOUNTED', reason };
  }
  const boundary = row.session_boundary as Record<string, unknown> | undefined;
  if (!boundary || boundary.version !== 1 || boundary.kind !== 'single-row'
    || typeof boundary.sourceSessionId !== 'string' || !boundary.sourceSessionId) {
    return { classification: 'AMBIGUOUS_REVIEW', reason: 'session_boundary_unproven' };
  }
  const snapshot = row.historical_exercise_snapshot as WorkoutExerciseSnapshotV1 | undefined;
  if (!snapshot || Object.keys(snapshot).sort().join(',') !== 'cardioMode,id,name,tags,type'
    || typeof snapshot.id !== 'string' || snapshot.id !== row.block_id
    || typeof snapshot.name !== 'string' || !snapshot.name
    || !['strength', 'bodyweight', 'cardio'].includes(snapshot.type)
    || !Array.isArray(snapshot.tags) || snapshot.tags.some(tag => typeof tag !== 'string')
    || (snapshot.type === 'cardio'
      ? !['time', 'distance', 'both'].includes(snapshot.cardioMode as string)
      : snapshot.cardioMode !== null)) {
    return { classification: 'AMBIGUOUS_REVIEW', reason: 'historical_exercise_snapshot_unproven' };
  }
  if ((row.sets as Record<string, unknown>[]).some(set => set.type !== snapshot.type)) {
    return { classification: 'AMBIGUOUS_REVIEW', reason: 'historical_exercise_type_conflict' };
  }
  return {
    classification: 'ADOPTABLE',
    build(sessionId, entryId, setIds) {
      if (setIds.length !== (row.sets as unknown[]).length) throw new Error('workout_adoption_set_id_count');
      const candidate: WorkoutSessionV1 = {
        version: 1, id: sessionId, localDate: row.date as string,
        entries: [{ id: entryId, exercise: structuredClone(snapshot),
          sets: (row.sets as unknown[]).map((set, index) => convertSet(set, index + 1, setIds[index]!)) }],
      };
      validateWorkoutSessionV1(candidate);
      return candidate;
    },
  };
}
