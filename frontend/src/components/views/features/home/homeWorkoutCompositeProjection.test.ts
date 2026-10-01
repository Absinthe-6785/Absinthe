import { describe, expect, it, vi } from 'vitest';
import { validateWorkoutSessionV1, type WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import { projectCompositeWorkoutRead, type ActiveCanonicalWorkoutReadInput,
  type LegacyWorkoutReadInput, type SourceRead } from '../health/compositeWorkoutReadProjection';
import type { HealthSelectedDayReadModel } from '../health/useHealthSelectedDayComposite';
import { buildHomeWorkoutCompositeProjection } from './homeWorkoutCompositeProjection';
import type { HomeWorkoutDraftRead } from './homeWorkoutDraftRead';

const accountId = 'a', localDate = '2026-10-01';
const context = { accountId, namespaceKey: 'ns-a', generationId: 'g1' };
function canonical(index = 1): ActiveCanonicalWorkoutReadInput {
  const session: WorkoutSessionV1 = { version: 1, id: `11111111-1111-4111-8111-11111111111${index}`, localDate,
    entries: [{ id: '22222222-2222-4222-8222-222222222222',
      exercise: { id: 'bench', name: 'Frozen', type: 'strength', tags: [], cardioMode: null },
      sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, kind: 'strength',
        loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8,
        assistedReps: null, dropset: false, done: false }] }] };
  validateWorkoutSessionV1(session); // Valid fixtures must be representable by the frozen authority.
  return { ...context, entityId: session.id, localRevision: 1, session };
}
const legacy: LegacyWorkoutReadInput = { accountId, rowId: 'row1', localDate, blockId: 'bench', sortOrder: 0,
  exerciseDisplay: { kind: 'historical_fallback', name: 'Bench' }, sets: [{ type: 'strength', set: 1, done: true }] };
function read(l: SourceRead<LegacyWorkoutReadInput>, c: SourceRead<ActiveCanonicalWorkoutReadInput>): HealthSelectedDayReadModel {
  return { phase: 'settled', accountId, localDate, cacheKey: null, legacyDaily: null,
    isolationError: false, retry: vi.fn(), result: projectCompositeWorkoutRead({ context, legacy: l, canonical: c }) };
}
const absent: HomeWorkoutDraftRead = { accountId, localDate, status: 'absent' };
const present: HomeWorkoutDraftRead = { accountId, localDate, status: 'present',
  counts: { exerciseCount: 5, setCount: 6, doneCount: 4 } };
function project(model: HealthSelectedDayReadModel, draft = absent) {
  return buildHomeWorkoutCompositeProjection({ accountId, localDate, read: model, draft });
}
const success = <T>(records: T[]): SourceRead<T> => ({ status: 'success', records });
const error = { status: 'error' } as const;

describe('pure current-day Home composite truth', () => {
  it('only proves absent for complete both-empty; draft remains separate', () => {
    const model = read(success([]), success([]));
    expect(project(model)).toMatchObject({ phase: 'complete', persistedPresence: 'absent', records: [] });
    expect(project(model, present)).toMatchObject({ persistedPresence: 'absent', draft: present });
  });
  it.each([[true, false], [false, true], [true, true]])('preserves sources L=%s C=%s and draft separately', (l, c) => {
    const model = read(success(l ? [legacy] : []), success(c ? [canonical()] : []));
    const projection = project(model, present);
    expect(projection.persistedPresence).toBe('present');
    expect(projection.draft).toEqual(present);
    expect(projection.legacy?.rowCount).toBe(Number(l));
    expect(projection.canonical?.sessionCount).toBe(Number(c));
    expect(projection.legacy?.counts?.doneCount).toBe(Number(l));
    expect(projection.canonical?.doneCount).toBe(0);
  });
  it('retains every source-qualified and nested identity; no exercise/date/content dedupe', () => {
    const model = read(success([legacy, { ...legacy, rowId: 'row2' }]), success([canonical(1), canonical(2)]));
    const projection = project(model);
    expect(projection.records).toBe(model.result!.records);
    expect(new Set(projection.records.map(row => row.readId)).size).toBe(4);
    expect(projection.canonical).toEqual({ sessionCount: 2, entryCount: 2, setCount: 2, doneCount: 0 });
    expect(projection.records.filter(row => row.source === 'canonical')[0]?.canonical.session.entries[0]?.sets[0]?.id)
      .toBe('33333333-3333-4333-8333-333333333333');
  });
  it.each(['entries', 'sets'])('invalid canonical empty %s is existing whole-source error, no counts/presence', kind => {
    const invalid = structuredClone(canonical());
    if (kind === 'entries') (invalid.session as WorkoutSessionV1).entries = [];
    else (invalid.session as WorkoutSessionV1).entries[0]!.sets = [];
    expect(() => validateWorkoutSessionV1(invalid.session)).toThrow();
    for (const l of [success([legacy]), success([]), error]) {
      const result = project(read(l, success([invalid])));
      expect(result.canonical).toBeNull();
      expect(result.records.every(row => row.source === 'legacy')).toBe(true);
      expect(result.persistedPresence).toBe(l.status === 'success' && l.records.length ? 'present' : 'unknown');
      expect(result.phase).toBe(l.status === 'success' ? 'partial_data' : 'error');
    }
  });
  it.each([[error, success([canonical()])], [success([legacy]), error], [success([]), error],
    [error, success([])], [error, error]] as const)('never turns incomplete coverage into empty', (l, c) => {
    const projection = project(read(l, c));
    expect(projection.persistedPresence).not.toBe('absent');
    expect(projection.phase).not.toBe('complete');
  });
  it('suppresses old-scope/loading/isolation evidence independent of scoped draft', () => {
    const model = read(success([legacy]), success([canonical()]));
    for (const change of [{ accountId: 'b' }, { localDate: '2020-01-01' },
      { phase: 'loading' as const }, { isolationError: true }, { result: null }]) {
      expect(project({ ...model, ...change }, present)).toMatchObject({ persistedPresence: 'unknown', records: [], draft: present });
    }
    expect(project(model, { ...present, accountId: 'b' }).draft.status).toBe('unavailable');
  });
  it('does not coerce malformed legacy completion into counts', () => {
    const model = read(success([{ ...legacy, sets: [{ type: 'strength', set: 1, done: 'yes' } as never] }]), success([]));
    expect(project(model).legacy).toEqual({ rowCount: 1, counts: null });
  });
});
