import { describe, expect, it, vi } from 'vitest';
import {
  HEALTH_RECOVERY_DATASETS,
  buildHealthRecoveryExport,
  collectHealthRecoveryDatasetsReadOnly,
  deriveHealthRelationshipDiagnostics,
  serializeHealthRecoveryExport,
  validateHealthRecoveryDatasets,
  verifyHealthRecoveryExportText,
  type HealthRecoveryDatasets,
} from './healthRecoveryExport';

const USER_ID = '18c8ab7d-6ba7-4547-aa55-f254ce900075';
const BLOCK_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_BLOCK_ID = '22222222-2222-4222-8222-222222222222';
const ROUTINE_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_ID = '44444444-4444-4444-8444-444444444444';

function datasets(): HealthRecoveryDatasets {
  return {
    exercise_blocks: [{ id: BLOCK_ID, user_id: USER_ID, name: 'Squat', type: 'strength', tags: [], cardio_mode: null }],
    workout_logs: [{
      id: '55555555-5555-4555-8555-555555555555', user_id: USER_ID, date: '2026-03-10', block_id: BLOCK_ID,
      sets: [{ type: 'strength', set: 1, kg: '60', reps: '5', done: true }], sort_order: 0,
    }],
    inbody_logs: [{ id: '66666666-6666-4666-8666-666666666666', user_id: USER_ID, date: '2026-03-11', weight: 70, smm: 35, pbf: 15 }],
    health_routines: [{
      id: '77777777-7777-4777-8777-777777777777', user_id: USER_ID, day_name: 'Day 1', blocks: [BLOCK_ID, MISSING_BLOCK_ID],
    }],
    routines: [{
      id: ROUTINE_ID, user_id: USER_ID, text: 'Stretch', created_at: '2026-03-08', created_date: '2026-03-08',
      created_timestamp: '2026-03-08T00:00:00Z', deleted_at: null, is_active: true,
    }],
    routine_logs: [
      { id: '88888888-8888-4888-8888-888888888888', user_id: USER_ID, routine_id: null, date: '2026-03-09', done: true, is_completed: false },
      { id: '99999999-9999-4999-8999-999999999999', user_id: USER_ID, routine_id: null, date: '2026-03-09', done: true, is_completed: false },
    ],
    protein_profiles: [{ user_id: USER_ID, weight: 70, goal: 'maintain', activity: 'active', daily_target_g: 120, updated_at: '2026-05-01T00:00:00Z' }],
    protein_sources: [{
      id: SOURCE_ID, user_id: USER_ID, name: 'Egg', source_type: 'serving', protein_per_serving: 6,
      protein_per_100g: null, category: 'food', created_at: '2026-05-01T00:00:00Z',
    }],
    protein_intake_logs: [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: USER_ID, date: '2026-05-02', source_id: SOURCE_ID,
      amount_g: 100, protein_g: 12, note: null, created_at: '2026-05-02T00:00:00Z',
    }],
    workout_memos: [],
  };
}

describe('complete Health recovery export', () => {
  it('retains all ten datasets, including a zero-count dataset, and binds counts', async () => {
    const result = await buildHealthRecoveryExport({
      sourceAccount: { userId: USER_ID, email: 'dhlee6785@gmail.com' },
      exportedAt: '2026-08-12T00:00:00Z', datasets: datasets(),
    });
    expect(Object.keys(result.datasets)).toEqual(HEALTH_RECOVERY_DATASETS);
    expect(result.datasets.workout_memos).toEqual([]);
    expect(result.inventory).toHaveLength(10);
    for (const entry of result.inventory) {
      expect(entry.sourceRowCount).toBe(result.datasets[entry.dataset].length);
      expect(entry.exportedRowCount).toBe(entry.sourceRowCount);
    }
  });

  it('orders records deterministically and produces the same canonical checksum', async () => {
    const first = datasets();
    first.routine_logs.reverse();
    const second = datasets();
    const left = await buildHealthRecoveryExport({ sourceAccount: { userId: USER_ID, email: 'a@b.test' }, exportedAt: '2026-08-12T00:00:00Z', datasets: first });
    const right = await buildHealthRecoveryExport({ sourceAccount: { userId: USER_ID, email: 'a@b.test' }, exportedAt: '2026-08-12T00:00:00Z', datasets: second });
    expect(serializeHealthRecoveryExport(left)).toBe(serializeHealthRecoveryExport(right));
    expect(left.checksum.value).toBe(right.checksum.value);
  });

  it('preserves unresolved references and every ambiguous multirow routine log', async () => {
    const input = datasets();
    const result = await buildHealthRecoveryExport({ sourceAccount: { userId: USER_ID, email: 'a@b.test' }, exportedAt: '2026-08-12T00:00:00Z', datasets: input });
    expect(result.diagnostics.anomalies.healthRoutineMissingBlockClassification).toBe('PRESERVABLE_UNRESOLVED_REFERENCE');
    expect(result.diagnostics.relationships.healthRoutineBlockReferences.missing).toEqual([
      expect.objectContaining({ blockId: MISSING_BLOCK_ID, referenceOrdinal: 2 }),
    ]);
    expect(result.diagnostics.anomalies.routineLogMultiplicityClassification).toBe('UNCLEAR');
    expect(result.diagnostics.anomalies.routineLogMultirowGroupCount).toBe(1);
    expect(result.diagnostics.anomalies.routineLogAdditionalRowCount).toBe(1);
    expect(result.datasets.routine_logs).toHaveLength(input.routine_logs.length);
    expect(result.diagnostics.anomalies.preservationRule).toBe('PRESERVE_EVERY_SOURCE_ROW_NO_WINNER_SELECTION');
  });

  it('derives all application relationship diagnostics', () => {
    const input = datasets();
    input.workout_logs[0].block_id = MISSING_BLOCK_ID;
    input.routine_logs.push({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: USER_ID,
      routine_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', date: '2026-03-12', done: false, is_completed: false,
    });
    input.protein_intake_logs[0].source_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const diagnostics = deriveHealthRelationshipDiagnostics(input);
    expect(diagnostics.workoutBlockReferences.missing).toHaveLength(1);
    expect(diagnostics.healthRoutineBlockReferences.missing).toHaveLength(1);
    expect(diagnostics.routineLogRoutineReferences.nullReferences).toHaveLength(2);
    expect(diagnostics.routineLogRoutineReferences.missing).toHaveLength(1);
    expect(diagnostics.proteinIntakeSourceReferences.missing).toHaveLength(1);
  });

  it('fails closed on malformed persisted fields without coercion', async () => {
    const input = datasets();
    input.inbody_logs[0].weight = Number.NaN;
    expect(validateHealthRecoveryDatasets(input, USER_ID)).toContainEqual(expect.objectContaining({
      dataset: 'inbody_logs', field: 'weight', code: 'nullable_finite_numeric_required',
    }));
    await expect(buildHealthRecoveryExport({
      sourceAccount: { userId: USER_ID, email: 'a@b.test' }, exportedAt: '2026-08-12T00:00:00Z', datasets: input,
    })).rejects.toThrow('health_field_validation_failed');
  });

  it('verifies canonical checksum and all derived metadata after readback', async () => {
    const result = await buildHealthRecoveryExport({ sourceAccount: { userId: USER_ID, email: 'a@b.test' }, exportedAt: '2026-08-12T00:00:00Z', datasets: datasets() });
    const serialized = serializeHealthRecoveryExport(result);
    await expect(verifyHealthRecoveryExportText(serialized)).resolves.toMatchObject({ datasetCount: 10, totalRowCount: 10 });
    const tampered = JSON.parse(serialized);
    tampered.datasets.exercise_blocks[0].name = 'Invented';
    await expect(verifyHealthRecoveryExportText(JSON.stringify(tampered))).rejects.toThrow('health_export_checksum_mismatch');
  });

  it('exposes only a paginated GET collector with owner-scoped URLs and no request body', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => [] }));
    const result = await collectHealthRecoveryDatasetsReadOnly({
      endpoint: 'https://example.supabase.co', apiKey: 'test-key', userId: USER_ID, fetchImpl,
    });
    expect(Object.keys(result)).toEqual(HEALTH_RECOVERY_DATASETS);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(url).toContain(`user_id=eq.${USER_ID}`);
      expect(url).toContain('select=*');
      expect(url).toMatch(/\/rest\/v1\/(exercise_blocks|workout_logs|inbody_logs|health_routines|routines|routine_logs|protein_profiles|protein_sources|protein_intake_logs|workout_memos)/);
    }
  });
});
