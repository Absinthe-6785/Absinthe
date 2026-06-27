import { describe, expect, it } from 'vitest';
import {
  analyzeK97fIncrementalSync,
  formatK97fOperationMemoryReport,
  formatK97fPayloadReport,
  listK97fCacheAuditRows,
  rankK97fOomCandidates,
  readK97fBackendPolicySnapshot,
  runK97fOperationMemoryMatrix,
  runK97fPayloadSizeMatrix,
  sampleProcessMemory,
} from './k97fServerMemoryAudit';

describe('k97fServerMemoryAudit policy', () => {
  it('reads backend full-vault patterns from main.py', () => {
    const policy = readK97fBackendPolicySnapshot();
    expect(policy.notesRouteFullVault).toBe(true);
    expect(policy.notesIncrementalFilter).toBe(true);
    expect(policy.backupParallelFetch).toBe(false);
    expect(policy.notesSelectStar).toBe(true);
    expect(policy.notesDeltaOrFilter).toBe(true);
  });
});

describe('k97fServerMemoryAudit payload matrix', () => {
  it('measures payload sizes at 100 / 300 / 1000 / 3000 notes', () => {
    const rows = runK97fPayloadSizeMatrix();
    expect(rows).toHaveLength(4);

    for (const row of rows) {
      expect(row.notesGetBytes).toBeGreaterThan(0);
      expect(row.syncFullVaultBytes).toBeGreaterThan(row.syncSingleNoteBytes);
      expect(row.exportZipEstimateBytes).toBeGreaterThanOrEqual(row.notesGetBytes);
    }

    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.notesGetBytes).toBeGreaterThan(rows[i - 1]!.notesGetBytes);
    }

    // eslint-disable-next-line no-console
    console.log(formatK97fPayloadReport(rows));
  }, 120_000);
});

describe('k97fServerMemoryAudit operation memory', () => {
  it('samples process.memoryUsage before/after modeled operations', () => {
    const sample = sampleProcessMemory();
    expect(sample.rss).toBeGreaterThan(0);
    expect(sample.heapUsed).toBeGreaterThan(0);

    const rows = runK97fOperationMemoryMatrix(1000);
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.payloadBytes).toBeGreaterThan(0);
    }

    // eslint-disable-next-line no-console
    console.log(formatK97fOperationMemoryReport(rows));
  }, 60_000);
});

describe('k97fServerMemoryAudit caches & OOM', () => {
  it('lists cache retention with bounded vs unbounded growth', () => {
    const caches = listK97fCacheAuditRows();
    expect(caches.some(c => c.cacheId === 'paragraphOffsetCache' && c.bounded)).toBe(true);
    expect(caches.some(c => c.cacheId === 'hydrateNotesResponse' && c.growthRisk === 'high')).toBe(true);
  });

  it('ranks OOM candidates with export and full-vault GET highest', () => {
    const ranked = rankK97fOomCandidates();
    expect(ranked[0]?.severity).toBe('critical');
    expect(ranked[0]?.route).toContain('/api/');
  });

  it('documents incremental sync savings without implementing filter', () => {
    const analysis = analyzeK97fIncrementalSync();
    expect(analysis.implementationStatus).toBe('implemented');
    expect(analysis.estimatedMemorySavingsPct).toBeGreaterThan(50);
    expect(analysis.currentPattern).toContain('/api/notes');
  });
});
