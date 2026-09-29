import { describe, expect, it, vi } from 'vitest';
import { validateWorkoutSessionV1, type WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import {
  createWorkoutEditorBodyweightSet,
  createWorkoutEditorCardioSet,
  createWorkoutEditorEntry,
  createWorkoutEditorStrengthSet,
  createWorkoutSessionEditor,
  editWorkoutEditorBodyweightSet,
  editWorkoutEditorCardioSet,
  editWorkoutEditorStrengthSet,
  hydrateWorkoutSessionEditor,
  projectWorkoutSessionEditor,
  WorkoutSessionEditorError,
  type WorkoutSessionEditor,
} from './workoutSessionEditorAdapter';

const IDS = Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`);
const strengthExercise = { id: 'catalog-squat', name: 'Squat', type: 'strength' as const, tags: ['LEGS'], cardioMode: null };
const bodyweightExercise = { id: 'catalog-pullup', name: 'Pull-up', type: 'bodyweight' as const, tags: ['BACK'], cardioMode: null };
const cardioExercise = { id: 'catalog-run', name: 'Run', type: 'cardio' as const, tags: ['RUN'], cardioMode: 'both' as const };
const strengthInput = { weightInput: '01.50', weightUnit: 'kg' as const, repsInput: '08', assistedRepsInput: '', dropset: false, done: true };
const bodyweightInput = { repsInput: '08', assistedRepsInput: '3', dropset: false, done: true };
const cardioInput = { durationInput: '1:30', distanceKilometersInput: '1.2500', done: true };

function ids() {
  let calls = 0;
  const factory = () => IDS[calls++]!;
  return { factory, count: () => calls };
}

function validEditor(): WorkoutSessionEditor {
  const session = createWorkoutSessionEditor('2026-09-29', () => IDS[0]!);
  const entry = createWorkoutEditorEntry(strengthExercise, () => IDS[1]!);
  entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, () => IDS[2]!));
  session.entries.push(entry);
  return session;
}

function canonical(input: unknown): WorkoutSessionV1 {
  const output = projectWorkoutSessionEditor(input);
  validateWorkoutSessionV1(output);
  return output;
}

function expectCode(operation: () => unknown, code: WorkoutSessionEditorError['code']) {
  try {
    operation();
    throw new Error('operation unexpectedly succeeded');
  } catch (error) {
    expect(error).toBeInstanceOf(WorkoutSessionEditorError);
    expect((error as WorkoutSessionEditorError).code).toBe(code);
  }
}

describe('dormant WorkoutSessionV1 editor adapter', () => {
  it('uses the actual default UUID factory with its Crypto receiver for every new object', () => {
    const originalRandomUUID = crypto.randomUUID;
    const generate = vi.spyOn(crypto, 'randomUUID').mockImplementation(function (this: Crypto) {
      if (this !== crypto) throw new TypeError('Crypto receiver required');
      return originalRandomUUID.call(crypto);
    });
    try {
      const session = createWorkoutSessionEditor('2026-09-29');
      const strength = createWorkoutEditorEntry(strengthExercise);
      strength.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1));
      const bodyweight = createWorkoutEditorEntry(bodyweightExercise);
      bodyweight.sets.push(createWorkoutEditorBodyweightSet(bodyweightInput, 1));
      const cardio = createWorkoutEditorEntry(cardioExercise);
      cardio.sets.push(createWorkoutEditorCardioSet(cardioInput, 1));
      session.entries.push(strength, bodyweight, cardio);
      const allIds = [session.sessionId, ...session.entries.flatMap(entry => [entry.entryId, ...entry.sets.map(set => set.setId)])];
      expect(allIds).toHaveLength(7);
      expect(new Set(allIds).size).toBe(7);
      expect(allIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))).toBe(true);
      expect(generate).toHaveBeenCalledTimes(7);
      expect(canonical(session).entries).toHaveLength(3);
    } finally {
      generate.mockRestore();
    }
  });

  it('allocates session, entry and set IDs once in entry order; repeated projection allocates none', () => {
    const source = ids();
    const session = createWorkoutSessionEditor('2026-09-29', source.factory);
    expect(session.sessionId).toBe(IDS[0]);
    expect(source.count()).toBe(1);
    const entry = createWorkoutEditorEntry(strengthExercise, source.factory);
    entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    session.entries.push(entry);
    expect(source.count()).toBe(3);
    expect([session.sessionId, entry.entryId, entry.sets[0]!.setId]).toEqual(IDS.slice(0, 3));
    expect(canonical(session)).toEqual(canonical(session));
    expect(source.count()).toBe(3);
    expect(session.expectedLocalRevision).toBeNull();
  });

  it('hydrates an exact persisted V1 snapshot with zero IDs and preserves supported values', () => {
    const existing = canonical(validEditor());
    const generate = vi.spyOn(crypto, 'randomUUID');
    try {
      const editor = hydrateWorkoutSessionEditor(existing, 7);
      expect(editor.expectedLocalRevision).toBe(7);
      expect(editor.sessionId).toBe(IDS[0]);
      expect(editor.entries[0]!.entryId).toBe(IDS[1]);
      expect(editor.entries[0]!.sets[0]!.setId).toBe(IDS[2]);
      expect(canonical(editor)).toEqual(existing);
      expect(generate).not.toHaveBeenCalled();
    } finally {
      generate.mockRestore();
    }
  });

  it('edits values without changing IDs, and retains exact canonical strength normalization', () => {
    const editor = hydrateWorkoutSessionEditor(canonical(validEditor()), 2);
    const set = editor.entries[0]!.sets[0]!;
    if (set.kind !== 'strength') throw new Error('fixture kind');
    editor.entries[0]!.sets[0] = editWorkoutEditorStrengthSet(set, {
      ...strengthInput, weightInput: '1.5', weightUnit: 'lbs', repsInput: '10', assistedRepsInput: '2', dropset: true,
    });
    const output = canonical(editor);
    expect([output.id, output.entries[0]!.id, output.entries[0]!.sets[0]!.id]).toEqual(IDS.slice(0, 3));
    expect(output.entries[0]!.sets[0]).toMatchObject({
      weightKg: '0.68', sourceValue: '1.5', sourceUnit: 'lbs', reps: 10, assistedReps: 2, dropset: true,
    });
    expect(editor.expectedLocalRevision).toBe(2);
    expect('expectedLocalRevision' in output).toBe(false);
  });

  it('reorders entries and sets by position while keeping UUIDs attached to their objects', () => {
    const source = ids();
    const session = createWorkoutSessionEditor('2026-09-29', source.factory);
    const first = createWorkoutEditorEntry(strengthExercise, source.factory);
    first.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    first.sets.push(createWorkoutEditorStrengthSet({ ...strengthInput, repsInput: '12' }, 2, source.factory));
    const second = createWorkoutEditorEntry(bodyweightExercise, source.factory);
    second.sets.push(createWorkoutEditorBodyweightSet(bodyweightInput, 1, source.factory));
    session.entries = [second, { ...first, sets: [first.sets[1]!, first.sets[0]!] }];
    const output = canonical(session);
    expect(output.entries.map(entry => entry.id)).toEqual([IDS[4], IDS[1]]);
    expect(output.entries[1]!.sets.map(set => [set.id, set.ordinal])).toEqual([[IDS[3], 1], [IDS[2], 2]]);
    expect(output.entries[1]!.sets.map(set => set.kind === 'strength' ? set.reps : null)).toEqual([12, 8]);
    expect(source.count()).toBe(6);
  });

  it('deletes a sibling without replacement IDs, then inserts only one new set ID', () => {
    const source = ids();
    const session = createWorkoutSessionEditor('2026-09-29', source.factory);
    const entry = createWorkoutEditorEntry(strengthExercise, source.factory);
    entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 2, source.factory));
    session.entries.push(entry);
    entry.sets.splice(0, 1);
    expect(canonical(session).entries[0]!.sets.map(set => set.id)).toEqual([IDS[3]]);
    expect(source.count()).toBe(4);
    entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 2, source.factory));
    expect(canonical(session).entries[0]!.sets.map(set => set.id)).toEqual([IDS[3], IDS[4]]);
    expect(source.count()).toBe(5);
  });

  it('deletes one entry and inserts another without changing surviving entry/set IDs', () => {
    const source = ids();
    const session = createWorkoutSessionEditor('2026-09-29', source.factory);
    const oldEntry = createWorkoutEditorEntry(strengthExercise, source.factory);
    oldEntry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    const survivor = createWorkoutEditorEntry(bodyweightExercise, source.factory);
    survivor.sets.push(createWorkoutEditorBodyweightSet(bodyweightInput, 1, source.factory));
    session.entries = [oldEntry, survivor];
    session.entries.shift();
    expect(canonical(session).entries.map(entry => [entry.id, entry.sets[0]!.id])).toEqual([[IDS[3], IDS[4]]]);
    expect(source.count()).toBe(5);
    const inserted = createWorkoutEditorEntry(cardioExercise, source.factory);
    inserted.sets.push(createWorkoutEditorCardioSet(cardioInput, 1, source.factory));
    session.entries.push(inserted);
    expect(canonical(session).entries.map(entry => [entry.id, entry.sets[0]!.id])).toEqual([[IDS[3], IDS[4]], [IDS[5], IDS[6]]]);
    expect(source.count()).toBe(7);
  });

  it('keeps duplicate exercise entries and same-day sessions distinct; freezes source snapshots', () => {
    const source = ids();
    const firstSession = createWorkoutSessionEditor('2026-09-29', source.factory);
    const mutableSource = { ...strengthExercise, tags: [...strengthExercise.tags] };
    const first = createWorkoutEditorEntry(mutableSource, source.factory);
    first.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    const second = createWorkoutEditorEntry(mutableSource, source.factory);
    second.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    firstSession.entries.push(first, second);
    mutableSource.name = 'Renamed';
    mutableSource.tags.push('CHANGED');
    expect(canonical(firstSession).entries.map(entry => [entry.id, entry.exercise.name, entry.exercise.tags])).toEqual([
      [IDS[1], 'Squat', ['LEGS']], [IDS[3], 'Squat', ['LEGS']],
    ]);
    const secondSession = createWorkoutSessionEditor('2026-09-29', source.factory);
    const third = createWorkoutEditorEntry(strengthExercise, source.factory);
    third.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, source.factory));
    secondSession.entries.push(third);
    expect(firstSession.localDate).toBe(secondSession.localDate);
    expect([canonical(firstSession).id, canonical(secondSession).id]).toEqual([IDS[0], IDS[5]]);
    expect(source.count()).toBe(8);
  });

  it('normalizes bodyweight assistance and cardio duration/distance using canonical helpers', () => {
    const source = ids();
    const session = createWorkoutSessionEditor('2026-09-29', source.factory);
    const body = createWorkoutEditorEntry(bodyweightExercise, source.factory);
    body.sets.push(createWorkoutEditorBodyweightSet(bodyweightInput, 1, source.factory));
    const cardio = createWorkoutEditorEntry(cardioExercise, source.factory);
    cardio.sets.push(createWorkoutEditorCardioSet(cardioInput, 1, source.factory));
    session.entries.push(body, cardio);
    const bodySet = body.sets[0]!;
    const cardioSet = cardio.sets[0]!;
    if (bodySet.kind !== 'bodyweight' || cardioSet.kind !== 'cardio') throw new Error('fixture kind');
    body.sets[0] = editWorkoutEditorBodyweightSet(bodySet, { ...bodyweightInput, assistedRepsInput: '0' });
    cardio.sets[0] = editWorkoutEditorCardioSet(cardioSet, { ...cardioInput, distanceKilometersInput: '0.000001' });
    const output = canonical(session);
    expect(output.entries[0]!.sets[0]).toEqual({ id: IDS[2], ordinal: 1, kind: 'bodyweight', loadKind: 'bodyweight', reps: 8, assistedReps: null, dropset: false, done: true });
    expect(output.entries[1]!.sets[0]).toEqual({ id: IDS[4], ordinal: 1, kind: 'cardio', durationSeconds: 90, distanceMeters: '0.001', done: true });
    expect(source.count()).toBe(5);
  });

  it('round-trips all three V1 variants without replacing a persisted snapshot or identities', () => {
    const source = ids();
    const session = createWorkoutSessionEditor('2026-02-28', source.factory);
    const strength = createWorkoutEditorEntry(strengthExercise, source.factory);
    strength.sets.push(createWorkoutEditorStrengthSet({ ...strengthInput, weightInput: '', done: false }, 1, source.factory));
    const body = createWorkoutEditorEntry(bodyweightExercise, source.factory);
    body.sets.push(createWorkoutEditorBodyweightSet(bodyweightInput, 1, source.factory));
    const cardio = createWorkoutEditorEntry(cardioExercise, source.factory);
    cardio.sets.push(createWorkoutEditorCardioSet({ ...cardioInput, distanceKilometersInput: '0.000001' }, 1, source.factory));
    session.entries = [strength, body, cardio];
    const saved = canonical(session);
    const hydrated = hydrateWorkoutSessionEditor(saved, 11);
    expect(canonical(hydrated)).toEqual(saved);
    expect(hydrated.expectedLocalRevision).toBe(11);
    expect(source.count()).toBe(7);
  });

  it('rejects invalid numeric inputs using the V1 normalizers', () => {
    const next = () => IDS[9]!;
    expectCode(() => createWorkoutEditorStrengthSet({ ...strengthInput, weightInput: '-1' }, 1, next), 'INVALID_EDITOR_VALUE');
    expectCode(() => createWorkoutEditorStrengthSet({ ...strengthInput, repsInput: '1.5' }, 1, next), 'INVALID_EDITOR_VALUE');
    expectCode(() => createWorkoutEditorBodyweightSet({ ...bodyweightInput, assistedRepsInput: '9' }, 1, next), 'INVALID_EDITOR_VALUE');
    expectCode(() => createWorkoutEditorCardioSet({ ...cardioInput, durationInput: '1:60' }, 1, next), 'INVALID_EDITOR_VALUE');
    expectCode(() => createWorkoutEditorCardioSet({ ...cardioInput, distanceKilometersInput: '0.0000001' }, 1, next), 'INVALID_EDITOR_VALUE');
    expectCode(() => createWorkoutEditorStrengthSet({ ...strengthInput, weightInput: '', weightUnit: 'stone' } as never, 1, next), 'INVALID_EDITOR_VALUE');
    expectCode(() => createWorkoutEditorStrengthSet({ ...strengthInput, performedAt: 'unsupported' } as never, 1, next), 'UNSUPPORTED_EDITOR_FIELD');
  });

  it('round-trips a V1-valid exercise named __session__ without treating its name as a separator', () => {
    const saved = canonical(validEditor());
    saved.entries[0]!.exercise.name = '__session__';
    validateWorkoutSessionV1(saved);
    const editor = hydrateWorkoutSessionEditor(saved, 4);
    expect(canonical(editor)).toEqual(saved);

    const newEditor = createWorkoutSessionEditor('2026-09-29', () => IDS[0]!);
    const entry = createWorkoutEditorEntry({ ...strengthExercise, name: '__session__' }, () => IDS[1]!);
    entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, () => IDS[2]!));
    newEditor.entries.push(entry);
    expect(canonical(newEditor).entries[0]!.exercise.name).toBe('__session__');
  });

  it('round-trips a V1-valid snapshot id __session__ while rejecting legacy block_id separators', () => {
    const saved = canonical(validEditor());
    saved.entries[0]!.exercise.id = '__session__';
    validateWorkoutSessionV1(saved);
    expect(canonical(hydrateWorkoutSessionEditor(saved, 4))).toEqual(saved);
    const editor = createWorkoutSessionEditor('2026-09-29', () => IDS[0]!);
    const entry = createWorkoutEditorEntry({ ...strengthExercise, id: '__session__' }, () => IDS[1]!);
    entry.sets.push(createWorkoutEditorStrengthSet(strengthInput, 1, () => IDS[2]!));
    editor.entries.push(entry);
    expect(canonical(editor).entries[0]!.exercise.id).toBe('__session__');
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [{ ...entry, block_id: '__session__' }] }), 'UNSUPPORTED_EDITOR_FIELD');
  });

  it.each(['performedAt', 'timeZone', 'sessionLabel', 'sessionSort', 'memo', 'unknown'])('rejects unsupported session-owned %s before projection', key => {
    const editor = validEditor();
    expectCode(() => projectWorkoutSessionEditor({ ...editor, [key]: 'must not disappear' }), 'UNSUPPORTED_EDITOR_FIELD');
  });

  it('leaves external date/account memo outside the canonical session boundary', () => {
    const externalMemo = { account: 'outside', localDate: '2026-09-29', memo: 'separate local state' };
    const output = canonical(validEditor());
    expect(externalMemo.memo).toBe('separate local state');
    expect(Object.keys(output)).toEqual(['version', 'id', 'localDate', 'entries']);
    expect('memo' in output).toBe(false);
  });

  it('rejects the view-only session separator instead of filtering it', () => {
    const editor = validEditor();
    const entry = editor.entries[0]!;
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [{ ...entry, block_id: '__session__' }] }), 'UNSUPPORTED_EDITOR_FIELD');
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: ['__session__'] }), 'UNSUPPORTED_EDITOR_FIELD');
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [{ ...entry, entryId: '__session__' }] }), 'INVALID_EDITOR_VALUE');
  });

  it('rejects unknown entry and exercise snapshot fields', () => {
    const editor = validEditor();
    const entry = editor.entries[0]!;
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [{ ...entry, sort_order: 1 }] }), 'UNSUPPORTED_EDITOR_FIELD');
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [{ ...entry, exerciseSnapshot: { ...entry.exerciseSnapshot, liveName: 'renamed' } }] }), 'UNSUPPORTED_EDITOR_FIELD');
    const hidden = validEditor() as WorkoutSessionEditor & { hidden?: string };
    Object.defineProperty(hidden, 'hidden', { value: 'not enumerable' });
    expectCode(() => projectWorkoutSessionEditor(hidden), 'UNSUPPORTED_EDITOR_FIELD');
  });

  it('rejects unknown and wrong-variant fields for each exact set shape', () => {
    for (const [exercise, create] of [
      [strengthExercise, () => createWorkoutEditorStrengthSet(strengthInput, 1, () => IDS[2]!)],
      [bodyweightExercise, () => createWorkoutEditorBodyweightSet(bodyweightInput, 1, () => IDS[2]!)],
      [cardioExercise, () => createWorkoutEditorCardioSet(cardioInput, 1, () => IDS[2]!)],
    ] as const) {
      const editor = createWorkoutSessionEditor('2026-09-29', () => IDS[0]!);
      const entry = createWorkoutEditorEntry(exercise, () => IDS[1]!);
      entry.sets.push(create());
      editor.entries.push(entry);
      const malformed = (extra: Record<string, unknown>) => ({ ...editor, entries: [{ ...entry, sets: [{ ...entry.sets[0], ...extra }] }] });
      expectCode(() => projectWorkoutSessionEditor(malformed({ surprise: true })), 'UNSUPPORTED_EDITOR_FIELD');
      expectCode(() => projectWorkoutSessionEditor(malformed(exercise.type === 'cardio' ? { assistedReps: 1 } : { durationSeconds: 10 })), 'UNSUPPORTED_EDITOR_FIELD');
      expectCode(() => projectWorkoutSessionEditor(malformed({ duratonSeconds: 10 })), 'UNSUPPORTED_EDITOR_FIELD');
    }
    const editor = validEditor();
    const entry = editor.entries[0]!;
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [{ ...entry, sets: [{ ...entry.sets[0], kind: 'bodyweight' }] }] }), 'UNSUPPORTED_EDITOR_FIELD');
  });

  it('distinguishes invalid canonical values from unsupported fields', () => {
    const editor = validEditor();
    expectCode(() => projectWorkoutSessionEditor({ ...editor, sessionId: 'legacy-row-id' }), 'INVALID_EDITOR_VALUE');
    expectCode(() => projectWorkoutSessionEditor({ ...editor, entries: [] }), 'INVALID_EDITOR_VALUE');
    expectCode(() => projectWorkoutSessionEditor({ ...editor, expectedLocalRevision: 0 }), 'INVALID_EDITOR_VALUE');
  });
});
