import { describe, expect, it } from 'vitest';
import {
  formatK97gBatchSyncReport,
  readK97gBatchSyncPolicy,
  runK97gBatchSyncMatrix,
} from './k97gBatchSyncAudit';

describe('k97gBatchSyncAudit', () => {
  it('reads batch sync policy from backend', () => {
    const policy = readK97gBatchSyncPolicy();
    expect(policy.batchEndpointPresent).toBe(true);
    expect(policy.singlePostPreserved).toBe(true);
    expect(policy.configurableChunkSize).toBe(true);
    expect(policy.defaultChunkSize50).toBe(true);
  });

  it('reduces request counts with chunk sizes 20 / 50 / 100', () => {
    const rows = runK97gBatchSyncMatrix();
    expect(rows).toHaveLength(4);
    const row1k = rows.find(r => r.noteCount === 1000)!;
    expect(row1k.singleRequestCount).toBe(1000);
    expect(row1k.chunks.find(c => c.chunkSize === 50)?.requestCount).toBe(20);
    expect(row1k.chunks.find(c => c.chunkSize === 100)?.requestCount).toBe(10);
  }, 120_000);

  it('prints batch sync matrix', () => {
    const rows = runK97gBatchSyncMatrix();
    // eslint-disable-next-line no-console
    console.log(formatK97gBatchSyncReport(rows));
  }, 120_000);
});
