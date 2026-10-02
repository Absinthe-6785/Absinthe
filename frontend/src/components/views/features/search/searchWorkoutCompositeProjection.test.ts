import { describe, expect, it } from 'vitest';
import { projectCompositeWorkoutRead, type CompositeWorkoutReadResult,
  type ActiveCanonicalWorkoutReadInput, type LegacyWorkoutReadInput } from '../health/compositeWorkoutReadProjection';
import type { WorkoutRangePreviewRead } from '../health/useHealthWorkoutRangeSnapshot';
import { buildSearchWorkoutPreview } from './searchWorkoutCompositeProjection';
import { buildSearchProjection } from './buildSearchProjection';
import { SEARCH_WORKOUT_COMPOSITE_READER_ENABLED, isSearchWorkoutCompositeEnabled,
  type SearchHostLifetime } from './searchWorkoutCompositeConfig';

const date = '2026-09-30';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function canonical(n: number, names = ['Bench']): ActiveCanonicalWorkoutReadInput {
  return { accountId: 'a', namespaceKey: 'ns', generationId: 'g', entityId: uuid(n), localRevision: 1,
    session: { version: 1, id: uuid(n), localDate: date, entries: names.map((name, index) => ({
      id: uuid(100 + index), exercise: { id: null, name, type: 'bodyweight', tags: ['not-name'], cardioMode: null },
      sets: [{ id: uuid(200 + index), ordinal: 1, done: false, kind: 'bodyweight', loadKind: 'bodyweight',
        reps: 5, assistedReps: null, dropset: false }],
    })) } };
}
function legacy(rowId = 'row-1'): LegacyWorkoutReadInput {
  return { accountId: 'a', rowId, localDate: date, blockId: 'block', sortOrder: 0,
    exerciseDisplay: { kind: 'current_catalog', block: { id: 'block', name: 'Bench', type: 'strength' } }, sets: [] };
}
function result(legacyRows = [legacy()], canonicalRows = [canonical(1)]): CompositeWorkoutReadResult {
  return projectCompositeWorkoutRead({ context: { accountId: 'a', namespaceKey: 'ns', generationId: 'g' },
    legacy: { status: 'success', records: legacyRows }, canonical: { status: 'success', records: canonicalRows } });
}
function read(value = result()): WorkoutRangePreviewRead {
  return { scope: { localDate: date, lifetime: {}, isCurrent: () => true }, phase: 'settled', publication: {},
    isolationError: false, isCurrent: () => true, view: { accountId: 'a', scope: null, startDate: date, endDate: date, result: value, dates: [] } };
}
function projection(workoutPreviewRead?: WorkoutRangePreviewRead) {
  return buildSearchProjection({ query: 'Bench', notes: [], folders: [], schedules: [], todos: [], routines: [],
    workouts: [{ id: 'old', exercise_blocks: { name: 'Bench', type: 'strength' } }] as never,
    healthBlocks: [{ id: 'block', name: 'Bench', type: 'strength' }], weeklySchedules: [], recipes: [],
    recentSearches: [], now: new Date('2026-09-30T12:00:00Z'), workoutPreviewRead });
}

describe('D1 dormant gate and pure source-qualified projection', () => {
  it('defaults OFF and requires parent, child, account, mounted current open/nonempty host proof', () => {
    expect(SEARCH_WORKOUT_COMPOSITE_READER_ENABLED).toBe(false);
    const host: SearchHostLifetime = { accountId: 'a', mounted: true, current: null };
    const signal = { host, generation: 1, open: true, hasQuery: true };
    host.current = signal;
    expect(isSearchWorkoutCompositeEnabled(host, signal, 'a')).toBe(false);
    for (const [parentEnabled, childEnabled, expected] of [[false, true, false], [true, false, false], [true, true, true]]) {
      expect(isSearchWorkoutCompositeEnabled(host, signal, 'a', { parentEnabled, childEnabled })).toBe(expected);
    }
    const gates = { parentEnabled: true, childEnabled: true };
    expect(isSearchWorkoutCompositeEnabled(host, signal, 'b', gates)).toBe(false);
    expect(isSearchWorkoutCompositeEnabled({ ...host }, signal, 'a', gates)).toBe(false);
    host.current = { ...signal, generation: 2 };
    expect(isSearchWorkoutCompositeEnabled(host, signal, 'a', gates)).toBe(false);
    host.current = { ...signal, open: false };
    expect(isSearchWorkoutCompositeEnabled(host, host.current, 'a', gates)).toBe(false);
    host.current = { ...signal, hasQuery: false };
    expect(isSearchWorkoutCompositeEnabled(host, host.current, 'a', gates)).toBe(false);
  });
  it('gate-OFF retains saved legacy/catalog behavior; preview replaces only saved rows', () => {
    expect(projection().results.map(r => r.kind)).toEqual(['workout', 'exercise-block']);
    const active = projection(read());
    expect(active.results.map(r => r.kind)).toEqual(['exercise-block', 'workout-observation', 'workout-observation']);
    expect(active.workoutPreview).toMatchObject({ legacyMatches: 1, canonicalMatches: 1 });
  });
  it.each(['legacy', 'canonical'] as const)('represents %s-only persisted evidence without drafts', source => {
    const view = buildSearchWorkoutPreview('Bench', read(result(source === 'legacy' ? [legacy()] : [], source === 'canonical' ? [canonical(1)] : [])));
    expect(view.results).toHaveLength(1);
    expect(view.results[0]!.workoutPreview?.source).toBe(source);
    expect(view.results[0]!.plannerItemId).toBeUndefined();
  });
  it('retains repeated rows, same-name entries, same-day sessions and more than 12 observations', () => {
    const value = read(result([legacy('one'), legacy('two')], Array.from({ length: 14 }, (_, i) => canonical(i + 1, ['Bench', 'Bench']))));
    const preview = buildSearchWorkoutPreview('Bench', value);
    expect(preview.results).toHaveLength(30);
    expect(new Set(preview.results.map(r => r.id)).size).toBe(30);
    expect(preview.results.every(r => r.workoutPreview?.localDate === date)).toBe(true);
    expect(buildSearchWorkoutPreview('not-name', value).results).toEqual([]);
    expect(buildSearchWorkoutPreview('5', value).results).toEqual([]);
  });
  it.each(['legacy', 'canonical'] as const)('ordinary %s failure preserves the other source and partial-zero is never no-match', failed => {
    const complete = result();
    const partial = { status: 'partial_data', legacyStatus: failed === 'legacy' ? 'error' : 'success',
      canonicalStatus: failed === 'canonical' ? 'error' : 'success',
      records: complete.records.filter(r => r.source !== failed) } as CompositeWorkoutReadResult;
    expect(buildSearchWorkoutPreview('Bench', read(partial))).toMatchObject({ state: 'partial', results: [expect.anything()] });
    expect(buildSearchWorkoutPreview('missing', read(partial))).toMatchObject({ state: 'partial', results: [] });
    const zero = read({ ...partial, records: [] } as CompositeWorkoutReadResult);
    expect(projection(zero).empty.noResults).toBe(false); // catalog cannot attest source completeness
  });
  it('distinguishes complete no-match, loading, source unavailable, both errors and isolation', () => {
    const empty = read(result([], []));
    expect(buildSearchWorkoutPreview('Bench', empty).state).toBe('verified_no_match');
    expect(buildSearchWorkoutPreview('Bench', { ...empty, phase: 'loading' }).state).toBe('loading');
    expect(buildSearchWorkoutPreview('Bench', { ...empty, view: null }).state).toBe('unavailable');
    expect(buildSearchWorkoutPreview('Bench', { ...read(), isolationError: true }).results).toEqual([]);
    expect(buildSearchWorkoutPreview('Bench', { ...empty, isolationError: true }).state).toBe('isolation_error');
    expect(buildSearchWorkoutPreview('Bench', read({ status: 'error', legacyStatus: 'error', canonicalStatus: 'error', records: [] })).state).toBe('source_error');
  });
  it('does not publish a foreign date or revoked child view', () => {
    const value = read();
    expect(buildSearchWorkoutPreview('Bench', { ...value, scope: { ...value.scope, localDate: '2026-10-01' } }).results).toEqual([]);
    expect(buildSearchWorkoutPreview('Bench', { ...value, scope: { ...value.scope, isCurrent: () => false } }).results).toEqual([]);
  });
});
