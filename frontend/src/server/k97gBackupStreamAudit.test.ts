import { describe, expect, it } from 'vitest';
import {
  formatK97gBackupStreamReport,
  readK97gBackupStreamPolicy,
  runK97gBackupStreamMatrix,
} from './k97gBackupStreamAudit';

describe('k97gBackupStreamAudit', () => {
  it('reads backup streaming policy from backend', () => {
    const policy = readK97gBackupStreamPolicy();
    expect(policy.sequentialJsonBackup).toBe(true);
    expect(policy.streamingZipEndpoint).toBe(true);
    expect(policy.parallelGatherRemoved).toBe(true);
    expect(policy.manifestSchemaPreserved).toBe(true);
  });

  it('models lower peak heap for streaming at 100 / 300 / 1000 / 3000', () => {
    const rows = runK97gBackupStreamMatrix();
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.streamingPeakHeapBytes).toBeLessThan(row.bufferedPeakHeapBytes);
      expect(row.peakReductionPct).toBeGreaterThan(20);
    }
    // eslint-disable-next-line no-console
    console.log(formatK97gBackupStreamReport(rows));
  }, 120_000);
});
