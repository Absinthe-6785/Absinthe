import {
  normalizeAssistedRepetitionsInput,
  normalizeCardioDurationInput,
  normalizeKilometersToMeters,
  normalizeRepetitionInput,
  normalizeWeightInput,
  snapshotWorkoutSessionV1,
  validateWorkoutSessionV1,
  type WorkoutBodyweightSetV1,
  type WorkoutCardioSetV1,
  type WorkoutExerciseSnapshotV1,
  type WorkoutSessionV1,
  type WorkoutStrengthSetV1,
} from '../../../../lib/workoutSessionV1';

export type WorkoutEditorIdFactory = () => string;
const defaultWorkoutEditorIdFactory: WorkoutEditorIdFactory = () => crypto.randomUUID();
type RepetitionInput = string | number | null;
type EditorSet<T extends { id: string }> = Omit<T, 'id'> & { setId: string };

export type WorkoutEditorStrengthSet = EditorSet<WorkoutStrengthSetV1>;
export type WorkoutEditorBodyweightSet = EditorSet<WorkoutBodyweightSetV1>;
export type WorkoutEditorCardioSet = EditorSet<WorkoutCardioSetV1>;
export type WorkoutEditorSet = WorkoutEditorStrengthSet | WorkoutEditorBodyweightSet | WorkoutEditorCardioSet;

export interface WorkoutEditorEntry {
  entryId: string;
  exerciseSnapshot: WorkoutExerciseSnapshotV1;
  sets: WorkoutEditorSet[];
}

export interface WorkoutSessionEditor {
  sessionId: string;
  localDate: string;
  expectedLocalRevision: number | null;
  entries: WorkoutEditorEntry[];
}

export type WorkoutSessionEditorErrorCode = 'UNSUPPORTED_EDITOR_FIELD' | 'INVALID_EDITOR_VALUE';

export class WorkoutSessionEditorError extends Error {
  constructor(readonly code: WorkoutSessionEditorErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'WorkoutSessionEditorError';
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_KEYS = ['sessionId', 'localDate', 'expectedLocalRevision', 'entries'] as const;
const ENTRY_KEYS = ['entryId', 'exerciseSnapshot', 'sets'] as const;
const EXERCISE_KEYS = ['id', 'name', 'type', 'tags', 'cardioMode'] as const;
const STRENGTH_KEYS = ['setId', 'ordinal', 'done', 'kind', 'loadKind', 'weightKg', 'sourceValue', 'sourceUnit', 'reps', 'assistedReps', 'dropset'] as const;
const BODYWEIGHT_KEYS = ['setId', 'ordinal', 'done', 'kind', 'loadKind', 'reps', 'assistedReps', 'dropset'] as const;
const CARDIO_KEYS = ['setId', 'ordinal', 'done', 'kind', 'durationSeconds', 'distanceMeters'] as const;
const STRENGTH_INPUT_KEYS = ['weightInput', 'weightUnit', 'repsInput', 'assistedRepsInput', 'dropset', 'done'] as const;
const BODYWEIGHT_INPUT_KEYS = ['repsInput', 'assistedRepsInput', 'dropset', 'done'] as const;
const CARDIO_INPUT_KEYS = ['durationInput', 'distanceKilometersInput', 'done'] as const;

function invalid(detail: string): never {
  throw new WorkoutSessionEditorError('INVALID_EDITOR_VALUE', detail);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return invalid(path);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) {
      throw new WorkoutSessionEditorError('UNSUPPORTED_EDITOR_FIELD', `${path}.${String(key)}`);
    }
  }
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(value, key)) invalid(`${path}.${key}`);
}

function withCanonicalErrors<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof WorkoutSessionEditorError) throw error;
    throw new WorkoutSessionEditorError('INVALID_EDITOR_VALUE', error instanceof Error ? error.message : 'canonical value');
  }
}

function allocateId(idFactory: WorkoutEditorIdFactory): string {
  const id = idFactory();
  if (!UUID_V4.test(id)) invalid('idFactory must produce a UUIDv4');
  return id;
}

function checkExerciseSnapshot(value: WorkoutExerciseSnapshotV1): WorkoutExerciseSnapshotV1 {
  const exercise = record(value, 'exerciseSnapshot');
  exactKeys(exercise, EXERCISE_KEYS, 'exerciseSnapshot');
  if ((exercise.id !== null && typeof exercise.id !== 'string') || typeof exercise.name !== 'string'
    || !['strength', 'bodyweight', 'cardio'].includes(exercise.type as string)
    || !Array.isArray(exercise.tags) || exercise.tags.some(tag => typeof tag !== 'string')
    || (exercise.type === 'cardio'
      ? !['time', 'distance', 'both'].includes(exercise.cardioMode as string)
      : exercise.cardioMode !== null)) invalid('exerciseSnapshot');
  return value;
}

function checkInput(value: unknown, allowed: readonly string[], path: string): Record<string, unknown> {
  const input = record(value, path);
  exactKeys(input, allowed, path);
  if (typeof input.done !== 'boolean' || ('dropset' in input && typeof input.dropset !== 'boolean')) invalid(path);
  return input;
}

/** A new draft is intentionally incomplete until it has entries and sets. */
export function createWorkoutSessionEditor(localDate: string, idFactory: WorkoutEditorIdFactory = defaultWorkoutEditorIdFactory): WorkoutSessionEditor {
  return { sessionId: allocateId(idFactory), localDate, expectedLocalRevision: null, entries: [] };
}

/** Snapshot the catalog value at entry creation; no later catalog reference is retained. */
export function createWorkoutEditorEntry(
  exerciseSnapshot: WorkoutExerciseSnapshotV1,
  idFactory: WorkoutEditorIdFactory = defaultWorkoutEditorIdFactory,
): WorkoutEditorEntry {
  checkExerciseSnapshot(exerciseSnapshot);
  return {
    entryId: allocateId(idFactory),
    exerciseSnapshot: {
      id: exerciseSnapshot.id,
      name: exerciseSnapshot.name,
      type: exerciseSnapshot.type,
      tags: [...exerciseSnapshot.tags],
      cardioMode: exerciseSnapshot.cardioMode,
    },
    sets: [],
  };
}

export interface StrengthSetInput {
  weightInput: string;
  weightUnit: 'kg' | 'lbs';
  repsInput: RepetitionInput;
  assistedRepsInput: RepetitionInput;
  dropset: boolean;
  done: boolean;
}

export interface BodyweightSetInput {
  repsInput: RepetitionInput;
  assistedRepsInput: RepetitionInput;
  dropset: boolean;
  done: boolean;
}

export interface CardioSetInput {
  durationInput: string;
  distanceKilometersInput: string;
  done: boolean;
}

function strengthValues(input: StrengthSetInput): Omit<WorkoutEditorStrengthSet, 'setId' | 'ordinal'> {
  return withCanonicalErrors(() => {
    checkInput(input, STRENGTH_INPUT_KEYS, 'strengthInput');
    if (typeof input.weightInput !== 'string' || (input.weightUnit !== 'kg' && input.weightUnit !== 'lbs')) invalid('strengthInput.weight');
    const weight = normalizeWeightInput(input.weightInput, input.weightUnit);
    const reps = normalizeRepetitionInput(input.repsInput);
    return {
      kind: 'strength', loadKind: 'external_weight', ...weight, reps,
      assistedReps: normalizeAssistedRepetitionsInput(input.assistedRepsInput, reps),
      dropset: input.dropset, done: input.done,
    };
  });
}

function bodyweightValues(input: BodyweightSetInput): Omit<WorkoutEditorBodyweightSet, 'setId' | 'ordinal'> {
  return withCanonicalErrors(() => {
    checkInput(input, BODYWEIGHT_INPUT_KEYS, 'bodyweightInput');
    const reps = normalizeRepetitionInput(input.repsInput);
    return {
      kind: 'bodyweight', loadKind: 'bodyweight', reps,
      assistedReps: normalizeAssistedRepetitionsInput(input.assistedRepsInput, reps),
      dropset: input.dropset, done: input.done,
    };
  });
}

function cardioValues(input: CardioSetInput): Omit<WorkoutEditorCardioSet, 'setId' | 'ordinal'> {
  return withCanonicalErrors(() => {
    checkInput(input, CARDIO_INPUT_KEYS, 'cardioInput');
    if (typeof input.durationInput !== 'string' || typeof input.distanceKilometersInput !== 'string') invalid('cardioInput');
    return {
      kind: 'cardio',
      durationSeconds: normalizeCardioDurationInput(input.durationInput),
      distanceMeters: input.distanceKilometersInput === '' ? null : normalizeKilometersToMeters(input.distanceKilometersInput),
      done: input.done,
    };
  });
}

export function createWorkoutEditorStrengthSet(input: StrengthSetInput, ordinal: number, idFactory: WorkoutEditorIdFactory = defaultWorkoutEditorIdFactory): WorkoutEditorStrengthSet {
  const values = strengthValues(input);
  return { setId: allocateId(idFactory), ordinal, ...values };
}

export function createWorkoutEditorBodyweightSet(input: BodyweightSetInput, ordinal: number, idFactory: WorkoutEditorIdFactory = defaultWorkoutEditorIdFactory): WorkoutEditorBodyweightSet {
  const values = bodyweightValues(input);
  return { setId: allocateId(idFactory), ordinal, ...values };
}

export function createWorkoutEditorCardioSet(input: CardioSetInput, ordinal: number, idFactory: WorkoutEditorIdFactory = defaultWorkoutEditorIdFactory): WorkoutEditorCardioSet {
  const values = cardioValues(input);
  return { setId: allocateId(idFactory), ordinal, ...values };
}

/** Value edits replace only supported values, never identities or ordinals. */
export function editWorkoutEditorStrengthSet(set: WorkoutEditorStrengthSet, input: StrengthSetInput): WorkoutEditorStrengthSet {
  return { ...set, ...strengthValues(input) };
}

export function editWorkoutEditorBodyweightSet(set: WorkoutEditorBodyweightSet, input: BodyweightSetInput): WorkoutEditorBodyweightSet {
  return { ...set, ...bodyweightValues(input) };
}

export function editWorkoutEditorCardioSet(set: WorkoutEditorCardioSet, input: CardioSetInput): WorkoutEditorCardioSet {
  return { ...set, ...cardioValues(input) };
}

/** Hydration copies a validated persisted V1 snapshot and allocates no IDs. */
export function hydrateWorkoutSessionEditor(session: WorkoutSessionV1, expectedLocalRevision: number): WorkoutSessionEditor {
  if (!Number.isSafeInteger(expectedLocalRevision) || expectedLocalRevision < 1) invalid('expectedLocalRevision');
  const snapshot = withCanonicalErrors(() => snapshotWorkoutSessionV1(session));
  return {
    sessionId: snapshot.id,
    localDate: snapshot.localDate,
    expectedLocalRevision,
    entries: snapshot.entries.map(entry => ({
      entryId: entry.id,
      exerciseSnapshot: { ...entry.exercise, tags: [...entry.exercise.tags] },
      sets: entry.sets.map(set => {
        const { id, ...values } = set;
        return { setId: id, ...values };
      }),
    })),
  };
}

/** Validate unknown editor data before picking any V1 fields; then validate the V1 output independently. */
export function projectWorkoutSessionEditor(input: unknown): WorkoutSessionV1 {
  const session = record(input, 'session');
  exactKeys(session, SESSION_KEYS, 'session');
  if (session.expectedLocalRevision !== null && (!Number.isSafeInteger(session.expectedLocalRevision) || (session.expectedLocalRevision as number) < 1)) {
    invalid('expectedLocalRevision');
  }
  if (!Array.isArray(session.entries)) invalid('entries');
  const entries = session.entries.map((unknownEntry, entryIndex) => {
    const path = `entries[${entryIndex}]`;
    if (unknownEntry === '__session__') throw new WorkoutSessionEditorError('UNSUPPORTED_EDITOR_FIELD', '__session__ separator');
    const entry = record(unknownEntry, path);
    // The view-only separator is a legacy block_id, not a canonical snapshot id or name.
    if (entry.block_id === '__session__') {
      throw new WorkoutSessionEditorError('UNSUPPORTED_EDITOR_FIELD', '__session__ separator');
    }
    exactKeys(entry, ENTRY_KEYS, path);
    const exercise = record(entry.exerciseSnapshot, `${path}.exerciseSnapshot`);
    exactKeys(exercise, EXERCISE_KEYS, `${path}.exerciseSnapshot`);
    if (!Array.isArray(exercise.tags)) invalid(`${path}.exerciseSnapshot.tags`);
    if (!Array.isArray(entry.sets)) invalid(`${path}.sets`);
    const sets = entry.sets.map((unknownSet, setIndex) => {
      const setPath = `${path}.sets[${setIndex}]`;
      const set = record(unknownSet, setPath);
      const allowed = set.kind === 'strength' ? STRENGTH_KEYS : set.kind === 'bodyweight' ? BODYWEIGHT_KEYS : set.kind === 'cardio' ? CARDIO_KEYS : invalid(`${setPath}.kind`);
      exactKeys(set, allowed, setPath);
      // A fresh object prevents noncanonical editor-only fields from leaking into V1.
      const { setId, ordinal: _editorOrdinal, ...values } = set;
      if (!Number.isSafeInteger(_editorOrdinal) || (_editorOrdinal as number) < 1) invalid(`${setPath}.ordinal`);
      return { id: setId, ordinal: setIndex + 1, ...values };
    });
    return {
      id: entry.entryId,
      exercise: { id: exercise.id, name: exercise.name, type: exercise.type, tags: [...exercise.tags], cardioMode: exercise.cardioMode },
      sets,
    };
  });
  const canonical = { version: 1, id: session.sessionId, localDate: session.localDate, entries };
  return withCanonicalErrors(() => {
    validateWorkoutSessionV1(canonical);
    return canonical;
  });
}
