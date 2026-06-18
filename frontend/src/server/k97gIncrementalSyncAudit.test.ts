import { describe, expect, it } from 'vitest';
import {
  formatK97gIncrementalSyncReport,
  measureK97gIncrementalSyncRow,
  readK97gIncrementalSyncPolicy,
  runK97gIncrementalSyncMatrix,
} from './k97gIncrementalSyncAudit';
import { filterNotesIncremental } from './k97gNotesSyncLogic';

describe('k97gIncrementalSyncAudit', () => {
  it('reads incremental sync policy from backend', () => {
    const policy = readK97gIncrementalSyncPolicy();
    expect(policy.updatedAfterParam).toBe(true);
    expect(policy.backwardCompatibleFullSync).toBe(true);
    expect(policy.batchEndpointPresent).toBe(true);
    expect(policy.deletedNotesIncluded).toBe(true);
  });

  it('filters changed and deleted notes after watermark', () => {
    const rows = filterNotesIncremental([
      { id: 'a', title: 'A', body: '', updated_at: 100, folder_id: null, deleted_at: null },
      { id: 'b', title: 'B', body: '', updated_at: 50, folder_id: null, deleted_at: 200 },
      { id: 'c', title: 'C', body: '', updated_at: 10, folder_id: null, deleted_at: null },
    ], 75);
    expect(rows.map(r => r.id)).toEqual(['a', 'b']);
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
