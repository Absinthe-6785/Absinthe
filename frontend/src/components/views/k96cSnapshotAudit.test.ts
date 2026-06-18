import { describe, expect, it } from 'vitest';
import {
  K96C_NOTE_COUNTS,
  formatK96CSnapshotAuditReport,
  measureK96CSnapshotRow,
  runK96CSnapshotMatrix,
} from './k96cSnapshotAudit';

describe('k96cSnapshotAudit', () => {
  it.each([100, 300] as const)('reduces snapshot bytes at %i notes', noteCount => {
    const row = measureK96CSnapshotRow(noteCount, 0.1);
    expect(row.snapshotBytesAfter).toBeLessThanOrEqual(row.snapshotBytesBefore);
    expect(row.chunkCount).toBeGreaterThanOrEqual(1);
    expect(row.writeCount).toBe(row.chunkCount + 1);
    expect(row.omittedDeletedCount).toBe(Math.floor(noteCount * 0.1));
  });

  it('large vaults produce multiple chunks', () => {
    const row = measureK96CSnapshotRow(3000, 0);
    expect(row.chunkCount).toBeGreaterThan(1);
  });

  it('prints snapshot matrix', () => {
    const rows = runK96CSnapshotMatrix(0.1);
    expect(rows).toHaveLength(K96C_NOTE_COUNTS.length);
    const report = formatK96CSnapshotAuditReport(rows);
    console.log('\n' + report);
    expect(report).toContain('K-96C snapshot compaction audit');
  });
});
