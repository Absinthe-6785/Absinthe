import { describe, expect, it, vi } from 'vitest';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryDatasets } from '../../../../lib/healthRecoveryExport';
import { loadVerifiedSelectedDayLegacySnapshot, projectVerifiedSelectedDayLegacySnapshot } from './selectedDayLegacySnapshot';

const mocks = vi.hoisted(() => ({ readAll: vi.fn() }));
vi.mock('../../../../lib/healthLocalRuntime', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../lib/healthLocalRuntime')>(),
  createLocalHealthRepository: vi.fn(async () => ({ readAll: mocks.readAll })),
}));

function datasets(): HealthRecoveryDatasets {
  return Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as HealthRecoveryDatasets;
}

describe('selected-day verified legacy snapshot', () => {
  it('derives persisted identity and editor workouts from one exact snapshot', () => {
    const source = datasets();
    source.exercise_blocks.push({ id: 'squat', name: 'Current Squat', type: 'strength', tags: [], user_id: 'a' });
    source.workout_logs.push({ id: 'row-1', user_id: 'a', date: '2026-09-29', block_id: 'squat',
      sort_order: 0, sets: [{ type: 'strength', set: 1, kg: 10, reps: 5, done: true }] });
    const result = projectVerifiedSelectedDayLegacySnapshot(source, 'a', '2026-09-29');
    expect(result.daily.workouts).toHaveLength(1);
    expect(result.persistedRows).toMatchObject([{
      accountId: 'a', rowId: 'row-1', blockId: 'squat', sortOrder: 0,
      exerciseDisplay: { kind: 'current_catalog', block: { name: 'Current Squat' } },
    }]);
    expect(result.daily.workouts[0]?.id).toBe(result.persistedRows[0]?.rowId);
  });

  it('uses historical fallback without inventing a row identity', () => {
    const source = datasets();
    source.workout_logs.push({ id: 'old-1', user_id: 'a', date: '2026-09-29', block_id: 'missing',
      sort_order: 1, sets: [], exercise_name: 'Frozen Name' });
    expect(projectVerifiedSelectedDayLegacySnapshot(source, 'a', '2026-09-29').persistedRows[0])
      .toMatchObject({ rowId: 'old-1', exerciseDisplay: { kind: 'historical_fallback', name: 'Frozen Name' } });
  });

  it.each([
    { id: '', user_id: 'a', block_id: 'squat', sort_order: 0, sets: [] },
    { id: 'row', user_id: 'a', block_id: '', sort_order: 0, sets: [] },
    { id: 'row', user_id: 'a', block_id: 'squat', sort_order: -1, sets: [] },
    { id: 'row', user_id: 'a', block_id: 'squat', sort_order: 0, sets: 'bad' },
  ])('fails closed for malformed persisted rows %#', row => {
    const source = datasets();
    source.workout_logs.push({ ...row, date: '2026-09-29' });
    expect(() => projectVerifiedSelectedDayLegacySnapshot(source, 'a', '2026-09-29'))
      .toThrow('health_selected_day_legacy_row_invalid');
  });

  it('treats a cross-account selected row as isolation, never partial legacy data', () => {
    const source = datasets();
    source.workout_logs.push({ id: 'row', user_id: 'b', date: '2026-09-29', block_id: 'squat',
      sort_order: 0, sets: [] });
    expect(() => projectVerifiedSelectedDayLegacySnapshot(source, 'a', '2026-09-29'))
      .toThrow('ACCOUNT_MISMATCH');
  });

  it('does not silently discard duplicate persisted identities', () => {
    const source = datasets();
    const row = { id: 'row', user_id: 'a', date: '2026-09-29', block_id: 'squat', sort_order: 0, sets: [] };
    source.workout_logs.push(row, { ...row });
    expect(() => projectVerifiedSelectedDayLegacySnapshot(source, 'a', '2026-09-29')).toThrow();
  });

  it('reads authoritative datasets once for both paired derivatives', async () => {
    const source = datasets();
    mocks.readAll.mockResolvedValueOnce(source);
    const pair = await loadVerifiedSelectedDayLegacySnapshot('a', '2026-09-29');
    expect(mocks.readAll).toHaveBeenCalledTimes(1);
    expect(pair.daily.workouts).toEqual([]);
    expect(pair.persistedRows).toEqual([]);
  });
});
