import { describe, expect, it } from 'vitest';
import {
  expectedBackendNotesDeltaFilter,
  formatK97gIncrementalSyncReport,
  measureK97gIncrementalSyncRow,
  readK143BackendDeltaContract,
  readK97gIncrementalSyncPolicy,
  runK97gIncrementalSyncMatrix,
} from './k97gIncrementalSyncAudit';
import { buildNotesDeltaOrFilter, filterNotesIncremental } from './k97gNotesSyncLogic';

describe('k97gIncrementalSyncAudit', () => {
  it('reads incremental sync policy from backend', () => {
    const policy = readK97gIncrementalSyncPolicy();
    expect(policy.updatedAfterParam).toBe(true);
    expect(policy.backwardCompatibleFullSync).toBe(false);
    expect(policy.batchEndpointPresent).toBe(true);
    expect(policy.deletedNotesIncluded).toBe(true);
    expect(policy.tombstoneOrFilter).toBe(true);
    expect(policy.normalSyncFullFetchFallback).toBe(false);
  });

  it('filters changed and deleted notes after watermark', () => {
    const rows = filterNotesIncremental([
      { id: 'a', title: 'A', body: '', updated_at: 100, folder_id: null, deleted_at: null },
      { id: 'b', title: 'B', body: '', updated_at: 50, folder_id: null, deleted_at: 200 },
      { id: 'c', title: 'C', body: '', updated_at: 10, folder_id: null, deleted_at: null },
    ], 75);
    expect(rows.map(r => r.id)).toEqual(['b', 'a']);
  });

  it('sorts delete-only tombstones by their delete revision', () => {
    const rows = filterNotesIncremental([
      { id: 'edit', title: 'A', body: '', updated_at: 150, folder_id: null, deleted_at: null },
      { id: 'tombstone', title: 'B', body: '', updated_at: 50, folder_id: null, deleted_at: 300 },
    ], 100);

    expect(rows.map(r => r.id)).toEqual(['tombstone', 'edit']);
  });

  it('locks the backend Notes delta route contract', () => {
    const contract = readK143BackendDeltaContract();
    expect(contract).toMatchObject({
      notesRoutePresent: true,
      cursorDefaultsToZero: true,
      userScoped: true,
      tombstoneInclusiveQuery: true,
      noNormalFullFetchFallback: true,
      hardDeleteEndpointPresent: true,
      relationPayloadPreserved: true,
    });
  });

  it('builds the Supabase OR filter for edits and tombstones', () => {
    expect(buildNotesDeltaOrFilter(123)).toBe('updated_at.gt.123,deleted_at.gt.123');
    expect(expectedBackendNotesDeltaFilter(-5)).toBe('updated_at.gt.0,deleted_at.gt.0');
  });

  it('prints incremental payload matrix at 100 / 300 / 1000 / 3000', () => {
    const rows = runK97gIncrementalSyncMatrix();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.incrementalPayloadBytes).toBeLessThan(row.fullPayloadBytes);
      expect(row.reductionPct).toBeGreaterThan(50);
    }
    const row1k = measureK97gIncrementalSyncRow(1000);
    expect(row1k.changedNoteCount).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(formatK97gIncrementalSyncReport(rows));
  }, 120_000);
});
