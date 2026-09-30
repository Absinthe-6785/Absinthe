import { describe, expect, it } from 'vitest';
import type { CompositeWorkoutRecord, CompositeWorkoutReadResult } from './compositeWorkoutReadProjection';
import { buildCompositePreviousWorkoutProjection } from './compositePreviousWorkoutProjection';
import type { WorkoutRangeView } from './verifiedWorkoutRangeSnapshot';

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

function legacy(date: string, rowId: string, setCount = 1): Extract<CompositeWorkoutRecord, { source: 'legacy' }> {
  return { source: 'legacy', readId: JSON.stringify(['legacy', 'a', rowId]), localDate: date,
    capability: 'read_only', legacy: { accountId: 'a', rowId, localDate: date, blockId: 'block',
      sortOrder: 0, exerciseDisplay: { kind: 'historical_fallback', name: 'Legacy bench' },
      sets: Array.from({ length: setCount }, () => ({ type: 'strength', set: 1, kg: 10, reps: 5, done: true })) } } as never;
}

function canonical(date: string, id: string, empty = false): Extract<CompositeWorkoutRecord, { source: 'canonical' }> {
  return { source: 'canonical', readId: JSON.stringify(['canonical', 'ns', 'g', id]), localDate: date,
    capability: 'read_only_in_G5B2', canonical: { accountId: 'a', namespaceKey: 'ns', generationId: 'g',
      entityId: id, localRevision: 1, session: { version: 1, id, localDate: date, entries: empty ? [] : [{
        id: '33333333-3333-4333-8333-333333333333', exercise: { id: null, name: 'Canonical row', type: 'strength', tags: [], cardioMode: null },
        sets: [],
      }] } } } as never;
}

function result(status: 'complete' | 'partial_data' | 'error', records: readonly CompositeWorkoutRecord[],
  legacyStatus: 'success' | 'error' = 'success', canonicalStatus: 'success' | 'error' = 'success'): CompositeWorkoutReadResult {
  return { status, legacyStatus, canonicalStatus, records } as CompositeWorkoutReadResult;
}

function view(readResult: CompositeWorkoutReadResult, dates: WorkoutRangeView['dates'],
  startDate = '2025-09-30', endDate = '2026-09-29'): WorkoutRangeView {
  return { accountId: 'a', scope: null, startDate, endDate, result: readResult, dates };
}

describe('composite Previous projection', () => {
  it('keeps source-qualified same-day records separate and preserves every canonical session', () => {
    const date = '2026-09-22';
    const l1 = legacy(date, SESSION_A);
    const l2 = legacy(date, 'legacy-2');
    const c1 = canonical(date, SESSION_A);
    const c2 = canonical(date, SESSION_B, true);
    const projection = buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29',
      selectedDate: date, view: view(result('complete', [l1, l2, c1, c2]), [{ localDate: date,
        legacyRows: [l1, l2], canonicalSessions: [c1, c2] }]) });
    expect(projection.status).toBe('complete');
    expect(projection.selectedBucket?.legacyGroup?.rows.map(row => row.readId)).toEqual([l1.readId, l2.readId]);
    expect(projection.selectedBucket?.canonicalSessions.map(row => row.canonical.session.id)).toEqual([SESSION_A, SESSION_B]);
    expect(projection.selectedBucket?.legacyGroup?.presentationKey).toContain('presentation-only');
    expect(projection.selectedBucket?.canonicalSessions[1]?.canonical.session.entries).toEqual([]);
  });

  it('excludes zero-set legacy rows only from Previous and keeps date-only default/selection semantics', () => {
    const sameWeekday = '2026-09-22';
    const newest = '2026-09-28';
    const zero = legacy(newest, 'zero', 0);
    const matching = legacy(sameWeekday, 'match');
    const projection = buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29',
      selectedDate: newest, view: view(result('complete', [zero, matching]), [
        { localDate: newest, legacyRows: [zero], canonicalSessions: [] },
        { localDate: sameWeekday, legacyRows: [matching], canonicalSessions: [] },
      ]) });
    expect(projection.dateBuckets.map(bucket => bucket.localDate)).toEqual([sameWeekday]);
    expect(projection.automaticDate).toBe(sameWeekday);
    expect(projection.effectiveDate).toBe(sameWeekday);
  });

  it('retains an explicit eligible date and drops out-of-range/reference-date buckets', () => {
    const older = legacy('2026-09-20', 'older');
    const newer = canonical('2026-09-28', SESSION_A);
    const reference = canonical('2026-09-29', SESSION_B);
    const projection = buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29',
      selectedDate: '2026-09-20', view: view(result('complete', [older, newer, reference]), [
        { localDate: '2026-09-29', legacyRows: [], canonicalSessions: [reference] },
        { localDate: '2026-09-28', legacyRows: [], canonicalSessions: [newer] },
        { localDate: '2026-09-20', legacyRows: [older], canonicalSessions: [] },
      ]) });
    expect(projection.effectiveDate).toBe('2026-09-20');
    expect(projection.dateBuckets.map(bucket => bucket.localDate)).toEqual(['2026-09-28', '2026-09-20']);
  });

  it('reports partial, both-error, isolation and verified complete-empty truthfully', () => {
    const row = legacy('2026-09-20', 'row');
    expect(buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29', selectedDate: null,
      view: view(result('partial_data', [row], 'success', 'error'), [{ localDate: row.localDate, legacyRows: [row], canonicalSessions: [] }]) })).toMatchObject({
        status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error', dateBuckets: [{ localDate: row.localDate }],
      });
    expect(buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29', selectedDate: null,
      view: view(result('error', [], 'error', 'error'), []) })).toMatchObject({ status: 'error', dateBuckets: [] });
    expect(buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29', selectedDate: null,
      view: view(result('complete', []), []) })).toMatchObject({ status: 'complete', dateBuckets: [] });
    expect(buildCompositePreviousWorkoutProjection({ phase: 'settled', referenceDate: '2026-09-29', selectedDate: null,
      view: view(result('complete', [row]), [{ localDate: row.localDate, legacyRows: [row], canonicalSessions: [] }]), isolationError: true })).toMatchObject({
        status: 'isolation_error', dateBuckets: [], selectedBucket: null,
      });
  });
});
