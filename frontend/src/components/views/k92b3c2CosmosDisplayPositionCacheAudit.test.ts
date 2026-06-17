// @vitest-environment happy-dom
/**
 * K-92B3C2 — Cosmos display position cache audit.
 * Run: npm test -- k92b3c2CosmosDisplay
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b3c2BenchmarkTable,
  readK92b3c2PolicySnapshot,
  recommendK92b3c2Merge,
  runK92b3c2BenchmarkRow,
} from './k92b3c2CosmosDisplayPositionCacheAudit';

const SCALES = [100, 300, 500, 1000] as const;

describe('K-92B3C2 cosmos display position cache audit', () => {
  it('reads K-92B3C2 production policy', () => {
    const policy = readK92b3c2PolicySnapshot();
    expect(policy.parentIndexViaRenderMap).toBe(true);
    expect(policy.linearParentScanRemoved).toBe(true);
    expect(policy.displayPosCacheEnabled).toBe(true);
    expect(policy.getDisplayPosUsesResolverFactory).toBe(true);
    expect(policy.tickDrivesDisplayContext).toBe(true);
  });

  it('prints before/after benchmark table @ 100/300/500/1000', () => {
    const rows = SCALES.map(n => runK92b3c2BenchmarkRow(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3c2BenchmarkTable(rows));
    for (const row of rows) {
      expect(row.k92b3c2DisplayPosComputationsPerSettle)
        .toBeLessThan(row.legacyDisplayPosComputationsPerSettle);
      expect(row.computeReductionPct).toBeGreaterThan(40);
    }
  }, 300_000);

  it('removes O(n) parent scans at 1000 notes when orbit nodes present', () => {
    const row = runK92b3c2BenchmarkRow(1000);
    expect(row.getDisplayPosCallsPerSettle).toBeGreaterThan(10000);
    if (row.legacyParentScansPerSettle > 0) {
      expect(row.k92b3c2ParentLookupsPerSettle).toBeLessThan(row.legacyParentScansPerSettle);
    }
  }, 120_000);

  it('recommends merge when policy hooks are present', () => {
    const rec = recommendK92b3c2Merge();
    // eslint-disable-next-line no-console
    console.log('\nK-92B3C2 merge recommendation:', rec);
    expect(rec.verdict).toBe('safe_to_merge');
  }, 120_000);
});
