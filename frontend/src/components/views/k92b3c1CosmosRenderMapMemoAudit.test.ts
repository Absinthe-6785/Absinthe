// @vitest-environment happy-dom
/**
 * K-92B3C1 — Cosmos renderMap memoization audit.
 * Run: npm test -- k92b3c1CosmosRenderMap
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b3c1BenchmarkTable,
  listK92b3c1HotspotUpdates,
  readK92b3c1PolicySnapshot,
  recommendK92b3c1Merge,
  runK92b3c1BenchmarkRow,
} from './k92b3c1CosmosRenderMapMemoAudit';
import { readK92b3cPolicySnapshot } from './k92b3cCosmosRenderMapAudit';

const SCALES = [100, 300, 500, 1000] as const;

describe('K-92B3C1 cosmos renderMap memoization audit', () => {
  it('reads K-92B3C1 production policy', () => {
    const policy = readK92b3c1PolicySnapshot();
    const baseline = readK92b3cPolicySnapshot();
    expect(policy.renderMapMemoizedOnTopology).toBe(true);
    expect(policy.inlineRenderMapRemoved).toBe(true);
    expect(policy.nodeByIdUsesRenderMap).toBe(true);
    expect(policy.memoDeps).toEqual(['graphTopologySignature']);
    expect(baseline.renderMapMemoized).toBe(true);
    expect(baseline.renderMapInlineBuild).toBe(false);
  });

  it('prints before/after benchmark table @ 100/300/500/1000', () => {
    const rows = SCALES.map(n => runK92b3c1BenchmarkRow(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3c1BenchmarkTable(rows));
    for (const row of rows) {
      expect(row.k92b3c1RenderMapBuilds).toBe(1);
      expect(row.k92b3c1RenderMapBuilds).toBeLessThan(row.legacyRenderMapBuilds);
      expect(row.allocationReductionPct).toBeGreaterThan(90);
    }
  }, 300_000);

  it('reduces renderMap builds by ≥97% at 1000 notes', () => {
    const row = runK92b3c1BenchmarkRow(1000);
    expect(row.legacyRenderMapBuilds).toBeGreaterThanOrEqual(30);
    expect(row.k92b3c1RenderMapBuilds).toBe(1);
    expect(row.buildReductionPct).toBeGreaterThanOrEqual(97);
    expect(row.renderMapMsReductionPct).toBeGreaterThanOrEqual(90);
  }, 120_000);

  it('documents hotspot updates and merge recommendation', () => {
    const updates = listK92b3c1HotspotUpdates();
    const rec = recommendK92b3c1Merge();
    // eslint-disable-next-line no-console
    console.log('\nK-92B3C1 merge recommendation:', rec);
    expect(updates[0]?.status).toBe('reduced');
    expect(rec.verdict).toBe('safe_to_merge');
  }, 120_000);
});
