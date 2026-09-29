import { describe, expect, it } from 'vitest';
import type { WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import {
  CompositeWorkoutReadIsolationError,
  projectCompositeWorkoutRead,
  type ActiveCanonicalWorkoutReadInput,
  type CompositeWorkoutReadInput,
  type LegacyWorkoutReadInput,
} from './compositeWorkoutReadProjection';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ENTRY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENTRY_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SET_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SET_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const context = { accountId: 'account-a', namespaceKey: 'workout:account-a', generationId: 'generation-1' };

function session(id = A, localDate = '2026-09-29'): WorkoutSessionV1 {
  return {
    version: 1, id, localDate,
    entries: [{
      id: ENTRY_A,
      exercise: { id: 'squat', name: 'Frozen Squat', type: 'strength', tags: ['HISTORICAL'], cardioMode: null },
      sets: [{ id: SET_A, ordinal: 1, done: true, kind: 'strength', loadKind: 'external_weight',
        weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false }],
    }],
  };
}

function canonical(overrides: Partial<ActiveCanonicalWorkoutReadInput> = {}): ActiveCanonicalWorkoutReadInput {
  return { ...context, entityId: A, localRevision: 1, session: session(), ...overrides };
}

function legacy(overrides: Partial<LegacyWorkoutReadInput> = {}): LegacyWorkoutReadInput {
  return {
    accountId: context.accountId, rowId: 'legacy-1', localDate: '2026-09-29', blockId: 'squat', sortOrder: 0,
    exerciseDisplay: { kind: 'current_catalog', block: { id: 'squat', name: 'Current Squat', type: 'strength', tags: ['CURRENT'] } },
    sets: [{ type: 'strength', set: 1, kg: 10, reps: 8, done: true }],
    ...overrides,
  };
}

function read(
  legacyRows: readonly LegacyWorkoutReadInput[] = [],
  canonicalRows: readonly ActiveCanonicalWorkoutReadInput[] = [],
): CompositeWorkoutReadInput {
  return { context, legacy: { status: 'success', records: legacyRows },
    canonical: { status: 'success', records: canonicalRows } };
}

function expectIsolation(input: CompositeWorkoutReadInput, code: CompositeWorkoutReadIsolationError['code']) {
  try {
    projectCompositeWorkoutRead(input);
    throw new Error('expected isolation failure');
  } catch (error) {
    expect(error).toBeInstanceOf(CompositeWorkoutReadIsolationError);
    expect((error as CompositeWorkoutReadIsolationError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('dormant composite Workout read projection', () => {
  it('publishes persisted legacy rows alone with source-qualified read-only identity', () => {
    const row = legacy();
    const result = projectCompositeWorkoutRead(read([row]));
    expect(result.status).toBe('complete');
    expect(result.legacyStatus).toBe('success');
    expect(result.canonicalStatus).toBe('success');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ source: 'legacy', capability: 'read_only',
      readId: JSON.stringify(['legacy', 'account-a', 'legacy-1']), localDate: '2026-09-29' });
    expect(result.records[0]?.source === 'legacy' && result.records[0].legacy).toBe(row);
  });

  it('publishes an active canonical session alone without resolving its frozen exercise snapshot', () => {
    const row = canonical();
    const result = projectCompositeWorkoutRead(read([], [row]));
    expect(result.status).toBe('complete');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ source: 'canonical', capability: 'read_only_in_G5B2',
      readId: JSON.stringify(['canonical', context.namespaceKey, context.generationId, A]) });
    if (result.records[0]?.source !== 'canonical') throw new Error('canonical record missing');
    expect(result.records[0].canonical.session).toBe(row.session);
    expect(result.records[0].canonical.session.entries[0]?.exercise).toEqual({
      id: 'squat', name: 'Frozen Squat', type: 'strength', tags: ['HISTORICAL'], cardioMode: null,
    });
  });

  it('keeps same-date legacy and multiple canonical sessions, even with matching raw IDs/content', () => {
    const first = canonical();
    const secondSession = session(B);
    secondSession.entries.push({ ...secondSession.entries[0]!, id: ENTRY_B,
      sets: [{ ...secondSession.entries[0]!.sets[0]!, id: SET_B }] });
    const second = canonical({ entityId: B, session: secondSession });
    const row = legacy({ rowId: A, exerciseDisplay: { kind: 'historical_fallback', name: 'Frozen Squat' } });
    const result = projectCompositeWorkoutRead(read([row], [second, first]));
    expect(result.status).toBe('complete');
    expect(result.records.map(record => record.source)).toEqual(['canonical', 'canonical', 'legacy']);
    expect(new Set(result.records.map(record => record.readId)).size).toBe(3);
    expect(result.records[2]?.readId).toBe(JSON.stringify(['legacy', context.accountId, A]));
    expect(result.records[0]?.readId).toBe(JSON.stringify(['canonical', context.namespaceKey, context.generationId, A]));
    expect(secondSession.entries).toHaveLength(2);
    if (result.records[1]?.source !== 'canonical') throw new Error('second session missing');
    expect(result.records[1].canonical.session.entries).toHaveLength(2);
    expect(result.records[1].canonical.session.entries.map(entry => entry.exercise.id)).toEqual(['squat', 'squat']);
  });

  it('uses stable date/source/entity/sort-order/row-ID technical order, independent of input order', () => {
    const older = legacy({ rowId: 'older', localDate: '2026-09-28' });
    const rowB = legacy({ rowId: 'b', sortOrder: 2 });
    const rowA = legacy({ rowId: 'a', sortOrder: 2 });
    const rowZero = legacy({ rowId: 'z', sortOrder: 0 });
    const newerB = canonical({ entityId: B, session: session(B) });
    const newerA = canonical();
    const first = projectCompositeWorkoutRead(read([older, rowB, rowA, rowZero], [newerB, newerA]));
    const reversed = projectCompositeWorkoutRead(read([rowZero, rowA, rowB, older], [newerA, newerB]));
    expect(reversed).toEqual(first);
    expect(first.records.map(record => record.readId)).toEqual([
      JSON.stringify(['canonical', context.namespaceKey, context.generationId, A]),
      JSON.stringify(['canonical', context.namespaceKey, context.generationId, B]),
      JSON.stringify(['legacy', context.accountId, 'z']),
      JSON.stringify(['legacy', context.accountId, 'a']),
      JSON.stringify(['legacy', context.accountId, 'b']),
      JSON.stringify(['legacy', context.accountId, 'older']),
    ]);
  });

  it.each([undefined, ''])('rejects missing or empty persisted legacy row ID (%s) as a whole-source error', rowId => {
    const result = projectCompositeWorkoutRead(read([legacy(), legacy({ rowId: rowId as string })], [canonical()]));
    expect(result).toMatchObject({ status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success' });
    expect(result.records.map(record => record.source)).toEqual(['canonical']);
  });

  it('rejects duplicate legacy identity as a whole-source error, preserving canonical only', () => {
    const result = projectCompositeWorkoutRead(read([legacy(), legacy({ sortOrder: 5 })], [canonical()]));
    expect(result).toMatchObject({ status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success' });
    expect(result.records.map(record => record.source)).toEqual(['canonical']);
  });

  it('rejects UUID-value duplicate canonical identity, preserving legacy only', () => {
    const upperId = A.toUpperCase();
    const result = projectCompositeWorkoutRead(read([legacy()], [canonical(),
      canonical({ entityId: upperId, session: session(upperId) })]));
    expect(result).toMatchObject({ status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error' });
    expect(result.records.map(record => record.source)).toEqual(['legacy']);
  });

  it('preserves original canonical UUID spelling while only the read ID is case-folded', () => {
    const upperId = A.toUpperCase();
    const row = canonical({ entityId: upperId, session: session(upperId) });
    const result = projectCompositeWorkoutRead(read([], [row]));
    expect(result.records[0]?.readId).toBe(JSON.stringify(['canonical', context.namespaceKey, context.generationId, A]));
    if (result.records[0]?.source !== 'canonical') throw new Error('canonical record missing');
    expect(result.records[0].canonical.entityId).toBe(upperId);
    expect(result.records[0].canonical.session.id).toBe(upperId);
  });

  it('does not mistake source failures for truthful empty data', () => {
    expect(projectCompositeWorkoutRead(read())).toEqual({ status: 'complete', legacyStatus: 'success',
      canonicalStatus: 'success', records: [] });
    expect(projectCompositeWorkoutRead({ context, legacy: { status: 'error' }, canonical: { status: 'error' } }))
      .toEqual({ status: 'error', legacyStatus: 'error', canonicalStatus: 'error', records: [] });
    expect(projectCompositeWorkoutRead({ context, legacy: { status: 'error' }, canonical: { status: 'success', records: [] } }))
      .toEqual({ status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success', records: [] });
    expect(projectCompositeWorkoutRead({ context, legacy: { status: 'success', records: [] }, canonical: { status: 'error' } }))
      .toEqual({ status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error', records: [] });
  });

  it('fails closed for legacy and canonical account mismatches', () => {
    expectIsolation(read([legacy({ accountId: 'account-b' })], [canonical()]), 'ACCOUNT_MISMATCH');
    expectIsolation(read([legacy()], [canonical({ accountId: 'account-b' })]), 'ACCOUNT_MISMATCH');
    expectIsolation(read([legacy({ rowId: '' }), legacy({ accountId: 'account-b' })], []), 'ACCOUNT_MISMATCH');
  });

  it('fails closed for canonical namespace and generation mismatches without publishing legacy records', () => {
    expectIsolation(read([legacy()], [canonical({ namespaceKey: 'other' })]), 'NAMESPACE_MISMATCH');
    expectIsolation(read([legacy()], [canonical({ generationId: 'other' })]), 'GENERATION_MISMATCH');
    expectIsolation({ ...read(), context: { ...context, generationId: '' } }, 'INVALID_CONTEXT');
  });

  it('rejects a persisted-shaped legacy view separator without canonicalizing it', () => {
    const result = projectCompositeWorkoutRead(read([legacy({ blockId: '__session__' })]));
    expect(result).toEqual({ status: 'partial_data', legacyStatus: 'error', canonicalStatus: 'success', records: [] });
  });

  it('keeps historical legacy missing-block fallback honest and distinct from a frozen V1 snapshot', () => {
    const row = legacy({ exerciseDisplay: { kind: 'historical_fallback', name: 'Old Squat' } });
    const result = projectCompositeWorkoutRead(read([row], [canonical()]));
    const legacyRecord = result.records.find(record => record.source === 'legacy');
    expect(legacyRecord?.source === 'legacy' && legacyRecord.legacy.exerciseDisplay).toBe(row.exerciseDisplay);
    expect(result.records).toHaveLength(2);
  });

  it('rejects invalid canonical V1 or entity/session identity as an ordinary canonical source error', () => {
    const mismatch = canonical({ entityId: B });
    const invalid = canonical({ session: { ...session(), entries: [] } });
    for (const row of [mismatch, invalid]) {
      const result = projectCompositeWorkoutRead(read([legacy()], [row]));
      expect(result).toMatchObject({ status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error' });
      expect(result.records.map(record => record.source)).toEqual(['legacy']);
    }
  });

  it('does not mutate source arrays, nested legacy sets, canonical entries, tags, or snapshots', () => {
    const input = deepFreeze(read([legacy({ rowId: 'b', sortOrder: 1 }), legacy({ rowId: 'a', sortOrder: 0 })],
      [canonical({ entityId: B, session: session(B) }), canonical()]));
    const before = structuredClone(input);
    const result = projectCompositeWorkoutRead(input);
    expect(input).toEqual(before);
    expect(input.legacy.status === 'success' && input.legacy.records.map(row => row.rowId)).toEqual(['b', 'a']);
    expect(input.canonical.status === 'success' && input.canonical.records.map(row => row.entityId)).toEqual([B, A]);
    expect(result.records).toHaveLength(4);
  });
});
