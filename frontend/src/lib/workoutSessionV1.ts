import { canonicalPayloadJson, canonicalPayloadSnapshot } from './localDatabase/canonicalPayload';

export const WORKOUT_SESSION_V1_MAX_BYTES = 131_072;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/;
const INPUT_DECIMAL = /^(-?)([0-9]+)(?:\.([0-9]+))?$/;

export type WorkoutSessionDecimal = string;
export type WorkoutExerciseTypeV1 = 'strength' | 'bodyweight' | 'cardio';
export type WorkoutCardioModeV1 = 'time' | 'distance' | 'both';

export interface WorkoutExerciseSnapshotV1 {
  id: string | null;
  name: string;
  type: WorkoutExerciseTypeV1;
  tags: string[];
  cardioMode: WorkoutCardioModeV1 | null;
}

interface WorkoutSetCommonV1 {
  id: string;
  ordinal: number;
  done: boolean;
}

export interface WorkoutStrengthSetV1 extends WorkoutSetCommonV1 {
  kind: 'strength';
  loadKind: 'external_weight';
  weightKg: WorkoutSessionDecimal | null;
  sourceValue: WorkoutSessionDecimal | null;
  sourceUnit: 'kg' | 'lbs' | null;
  reps: number | null;
  assistedReps: number | null;
  dropset: boolean;
}

export interface WorkoutBodyweightSetV1 extends WorkoutSetCommonV1 {
  kind: 'bodyweight';
  loadKind: 'bodyweight';
  reps: number | null;
  assistedReps: number | null;
  dropset: boolean;
}

export interface WorkoutCardioSetV1 extends WorkoutSetCommonV1 {
  kind: 'cardio';
  durationSeconds: number | null;
  distanceMeters: WorkoutSessionDecimal | null;
}

export type WorkoutSetV1 = WorkoutStrengthSetV1 | WorkoutBodyweightSetV1 | WorkoutCardioSetV1;

export interface WorkoutEntryV1 {
  id: string;
  exercise: WorkoutExerciseSnapshotV1;
  sets: WorkoutSetV1[];
}

export interface WorkoutSessionV1 {
  version: 1;
  id: string;
  localDate: string;
  entries: WorkoutEntryV1[];
}

export interface NormalizedWeightV1 {
  weightKg: WorkoutSessionDecimal | null;
  sourceValue: WorkoutSessionDecimal | null;
  sourceUnit: 'kg' | 'lbs' | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  return required.every(key => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every(key => required.includes(key) || optional.includes(key));
}

function fail(): never {
  throw new Error('workout_session_invalid');
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

function validLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month! < 1 || month! > 12) return false;
  const leap = year! % 4 === 0 && (year! % 100 !== 0 || year! % 400 === 0);
  const daysByMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day! >= 1 && day! <= daysByMonth[month! - 1]!;
}

function validSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function validCanonicalDecimal(value: unknown, maxScale: number): value is string {
  if (typeof value !== 'string' || !CANONICAL_DECIMAL.test(value)) return false;
  const point = value.indexOf('.');
  return point < 0 || value.length - point - 1 <= maxScale;
}

function validNullableDecimal(value: unknown, maxScale: number): boolean {
  return value === null || validCanonicalDecimal(value, maxScale);
}

function canonicalFromScaledInteger(value: bigint, scale: number): string {
  if (value < 0n) return fail();
  if (scale === 0) return value.toString();
  const padded = value.toString().padStart(scale + 1, '0');
  const splitAt = padded.length - scale;
  const integer = padded.slice(0, splitAt);
  const fraction = padded.slice(splitAt).replace(/0+$/, '');
  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
}

/** Normalize a user-entered non-negative decimal using integer arithmetic and HALF_UP at scale. */
export function normalizeDecimalInput(value: string, maxScale: number): WorkoutSessionDecimal {
  if (typeof value !== 'string' || !Number.isSafeInteger(maxScale) || maxScale < 0) return fail();
  const match = INPUT_DECIMAL.exec(value);
  if (!match) return fail();
  const [, sign, integerPart, fraction = ''] = match;
  const allDigits = `${integerPart}${fraction}`;
  const isZero = !/[1-9]/.test(allDigits);
  if (sign === '-' && !isZero) return fail();

  const retained = fraction.slice(0, maxScale).padEnd(maxScale, '0');
  const coefficientText = `${integerPart}${retained}`;
  let coefficient = BigInt(coefficientText);
  const firstDiscarded = fraction[maxScale];
  if (firstDiscarded !== undefined && firstDiscarded >= '5') coefficient += 1n;
  return canonicalFromScaledInteger(coefficient, maxScale);
}

function decimalToScaledInteger(value: string, scale: number): bigint {
  const [integer, fraction = ''] = value.split('.');
  return BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
}

export function normalizeWeightInput(value: string, unit: 'kg' | 'lbs'): NormalizedWeightV1 {
  if (value === '') return { weightKg: null, sourceValue: null, sourceUnit: null };
  if (unit !== 'kg' && unit !== 'lbs') return fail();
  const sourceValue = normalizeDecimalInput(value, 2);
  if (unit === 'kg') return { weightKg: sourceValue, sourceValue, sourceUnit: unit };

  const sourceCents = decimalToScaledInteger(sourceValue, 2);
  const numerator = sourceCents * 45_359_237n;
  const kgCents = (numerator + 50_000_000n) / 100_000_000n;
  return {
    weightKg: canonicalFromScaledInteger(kgCents, 2),
    sourceValue,
    sourceUnit: unit,
  };
}

/** Convert an entered kilometer value to meters exactly; values needing >3 meter decimals fail. */
export function normalizeKilometersToMeters(value: string): WorkoutSessionDecimal {
  if (typeof value !== 'string') return fail();
  const match = INPUT_DECIMAL.exec(value);
  if (!match) return fail();
  const [, sign, integerPart, rawFraction = ''] = match;
  const fraction = rawFraction.replace(/0+$/, '');
  const coefficient = BigInt(`${integerPart}${fraction}`);
  if (sign === '-' && coefficient !== 0n) return fail();
  const scale = fraction.length;
  const numerator = coefficient * 1_000_000n;
  const denominator = 10n ** BigInt(scale);
  if (numerator % denominator !== 0n) return fail();
  const meterThousandths = numerator / denominator;
  return canonicalFromScaledInteger(meterThousandths, 3);
}

function parseSafeIntegerDigits(digits: string): number {
  if (!/^\d+$/.test(digits)) return fail();
  const parsed = BigInt(digits);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) return fail();
  return Number(parsed);
}

export function normalizeRepetitionInput(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return validSafeInteger(value) ? value : fail();
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return fail();
  if (value.startsWith('-')) {
    if (!/^-[0]+$/.test(value)) return fail();
    return 0;
  }
  return parseSafeIntegerDigits(value);
}

export function normalizeAssistedRepetitionsInput(value: unknown, reps: number | null): number | null {
  const normalized = normalizeRepetitionInput(value);
  if (normalized === null || normalized === 0) return null;
  if (reps === null || normalized > reps) return fail();
  return normalized;
}

function checkedSeconds(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return fail();
  return Number(value);
}

export function normalizeCardioDurationInput(value: string): number | null {
  if (value === '') return null;
  if (typeof value !== 'string') return fail();
  if (/^\d+$/.test(value)) {
    if (value.length <= 2) return checkedSeconds(BigInt(value) * 60n);
    if (value.length <= 4) {
      const minutes = parseSafeIntegerDigits(value.slice(0, -2));
      const seconds = parseSafeIntegerDigits(value.slice(-2));
      if (seconds > 59) return fail();
      return checkedSeconds(BigInt(minutes) * 60n + BigInt(seconds));
    }
    const hours = parseSafeIntegerDigits(value.slice(0, -4));
    const minutes = parseSafeIntegerDigits(value.slice(-4, -2));
    const seconds = parseSafeIntegerDigits(value.slice(-2));
    if (minutes > 59 || seconds > 59) return fail();
    return checkedSeconds(BigInt(hours) * 3600n + BigInt(minutes) * 60n + BigInt(seconds));
  }
  if (!/^\d+(?::\d+){1,2}$/.test(value)) return fail();
  const parts = value.split(':');
  if (parts.length === 2) {
    const minutes = parseSafeIntegerDigits(parts[0]!);
    const seconds = parseSafeIntegerDigits(parts[1]!);
    if (seconds > 59) return fail();
    return checkedSeconds(BigInt(minutes) * 60n + BigInt(seconds));
  }
  const hours = parseSafeIntegerDigits(parts[0]!);
  const minutes = parseSafeIntegerDigits(parts[1]!);
  const seconds = parseSafeIntegerDigits(parts[2]!);
  if (minutes > 59 || seconds > 59) return fail();
  return checkedSeconds(BigInt(hours) * 3600n + BigInt(minutes) * 60n + BigInt(seconds));
}

/** Match the current Health UI default when snapshotting a cardio block without cardio_mode. */
export function normalizeWorkoutCardioMode(
  exerciseType: WorkoutExerciseTypeV1,
  currentMode?: unknown,
): WorkoutCardioModeV1 | null {
  if (exerciseType !== 'cardio') return null;
  if (currentMode === undefined || currentMode === null) return 'both';
  return currentMode === 'time' || currentMode === 'distance' || currentMode === 'both' ? currentMode : fail();
}

function validateExercise(value: unknown): value is WorkoutExerciseSnapshotV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'name', 'type', 'tags', 'cardioMode'])
    || value.id !== null && typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || !['strength', 'bodyweight', 'cardio'].includes(value.type as string)
    || !Array.isArray(value.tags) || value.tags.some(tag => typeof tag !== 'string')) return false;
  if (value.type === 'cardio') return value.cardioMode === 'time' || value.cardioMode === 'distance' || value.cardioMode === 'both';
  return value.cardioMode === null;
}

function validateReps(reps: unknown, assistedReps: unknown): boolean {
  if (reps !== null && !validSafeInteger(reps)) return false;
  if (assistedReps === null) return true;
  return validSafeInteger(assistedReps) && assistedReps > 0 && reps !== null && validSafeInteger(reps)
    && assistedReps <= reps;
}

function validateSet(value: unknown, expectedKind: WorkoutExerciseTypeV1, ordinal: number): value is WorkoutSetV1 {
  if (!isRecord(value) || !validUuid(value.id) || value.ordinal !== ordinal || !validSafeInteger(value.ordinal)
    || typeof value.done !== 'boolean' || value.kind !== expectedKind) return false;
  if (expectedKind === 'strength') {
    if (!hasExactKeys(value, ['id', 'ordinal', 'kind', 'loadKind', 'weightKg', 'sourceValue', 'sourceUnit', 'reps', 'assistedReps', 'dropset', 'done'])
      || value.loadKind !== 'external_weight'
      || !validNullableDecimal(value.weightKg, 2)
      || !validNullableDecimal(value.sourceValue, 2)
      || !validateReps(value.reps, value.assistedReps)
      || typeof value.dropset !== 'boolean') return false;
    if (value.sourceValue === null || value.sourceUnit === null) {
      return value.sourceValue === null && value.sourceUnit === null && value.weightKg === null;
    }
    if (value.sourceUnit !== 'kg' && value.sourceUnit !== 'lbs' || value.weightKg === null) return false;
    const normalized = normalizeWeightInput(value.sourceValue as string, value.sourceUnit);
    return normalized.weightKg === value.weightKg;
  }
  if (expectedKind === 'bodyweight') {
    return hasExactKeys(value, ['id', 'ordinal', 'kind', 'loadKind', 'reps', 'assistedReps', 'dropset', 'done'])
      && value.loadKind === 'bodyweight' && validateReps(value.reps, value.assistedReps)
      && typeof value.dropset === 'boolean';
  }
  return hasExactKeys(value, ['id', 'ordinal', 'kind', 'durationSeconds', 'distanceMeters', 'done'])
    && (value.durationSeconds === null || validSafeInteger(value.durationSeconds))
    && validNullableDecimal(value.distanceMeters, 3);
}

/** Strictly validate canonical WorkoutSessionV1 and enforce its UTF-8 byte budget. */
export function validateWorkoutSessionV1(value: unknown): asserts value is WorkoutSessionV1 {
  if (!isRecord(value) || !hasExactKeys(value, ['version', 'id', 'localDate', 'entries'])
    || value.version !== 1 || !validUuid(value.id) || !validLocalDate(value.localDate)
    || !Array.isArray(value.entries) || value.entries.length === 0) fail();
  // UUID equality is value-based; retain each original spelling in the payload.
  const identities = new Set<string>([value.id.toLowerCase()]);
  for (const entry of value.entries) {
    if (!isRecord(entry) || !hasExactKeys(entry, ['id', 'exercise', 'sets'])
      || !validUuid(entry.id) || !validateExercise(entry.exercise)
      || !Array.isArray(entry.sets) || entry.sets.length === 0) fail();
    if (identities.has(entry.id.toLowerCase())) fail();
    identities.add(entry.id.toLowerCase());
    for (let index = 0; index < entry.sets.length; index += 1) {
      const set = entry.sets[index];
      if (!validateSet(set, entry.exercise.type, index + 1)) fail();
      if (identities.has(set.id.toLowerCase())) fail();
      identities.add(set.id.toLowerCase());
    }
  }
  const byteLength = new TextEncoder().encode(canonicalPayloadJson(value)).byteLength;
  if (byteLength > WORKOUT_SESSION_V1_MAX_BYTES) fail();
}

export function snapshotWorkoutSessionV1(value: unknown): WorkoutSessionV1 {
  validateWorkoutSessionV1(value);
  return canonicalPayloadSnapshot(value) as WorkoutSessionV1;
}
