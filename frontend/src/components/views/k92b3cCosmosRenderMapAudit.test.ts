// @vitest-environment happy-dom
/**
 * K-92B3C — Cosmos renderMap & display-position pipeline audit.
 * Run: npm test -- k92b3cCosmosRenderMap
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b3cBenchmarkTable,
  formatK92b3cDisplayPosTable,
  formatK92b3cRenderMapTable,
  formatK92b3cTickDependencyGraph,
  listK92b3cHotspots,
  listK92b3cOptimizationCandidates,
  readK92b3cPolicySnapshot,
  recommendK92b3cNextStep,
  runK92b3cBenchmarkRow,
  runK92b3cDisplayPosAudit,
  runK92b3cRenderMapAudit,
} from './k92b3cCosmosRenderMapAudit';

const SCALES = [100, 300, 500, 1000] as const;

describe('K-92B3C cosmos renderMap pipeline audit', () => {
  it('reads current production policy (post-B3B baseline)', () => {
    const policy = readK92b3cPolicySnapshot();
    expect(policy.renderMapInlineBuild).toBe(false);
    expect(policy.renderMapMemoized).toBe(true);
    expect(policy.getDisplayPosTickCoupled).toBe(true);
    expect(policy.getDisplayPosParentLinearScan).toBe(true);
    expect(policy.matchedIdsTickCoupled).toBe(true);
    expect(policy.galaxyResolveGatedOnSettle).toBe(false);
    expect(policy.orbitResolveGatedOnSettle).toBe(false);
  });

  it('prints tick dependency graph', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3cTickDependencyGraph());
  });

  it('prints renderMap audit table @ 100/300/500/1000', () => {
    const rows = SCALES.map(n => runK92b3cRenderMapAudit(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3cRenderMapTable(rows));
    expect(rows[3]?.renderMapEntriesPerBuild).toBeGreaterThan(rows[0]?.renderMapEntriesPerBuild ?? 0);
  }, 300_000);

  it('prints display position audit table @ 100/300/500/1000', () => {
    const rows = SCALES.map(n => runK92b3cDisplayPosAudit(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3cDisplayPosTable(rows));
    expect(rows[3]?.getDisplayPosCallsPerCommit).toBeGreaterThan(rows[0]?.getDisplayPosCallsPerCommit ?? 0);
  }, 300_000);

  it('prints combined benchmark table @ 100/300/500/1000', () => {
    const rows = SCALES.map(n => runK92b3cBenchmarkRow(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3cBenchmarkTable(rows));
    for (const row of rows) {
      expect(row.renderMapBuildsPerSettle).toBe(row.reactCommits);
      expect(row.pipelineCostSharePct).toBeGreaterThan(0);
    }
  }, 300_000);

  it('documents hotspots, candidates, and recommendation @ 1000', () => {
    const hotspots = listK92b3cHotspots();
    const candidates = listK92b3cOptimizationCandidates();
    const rec = recommendK92b3cNextStep();
    // eslint-disable-next-line no-console
    console.log('\nK-92B3C recommendation:', rec);
    // eslint-disable-next-line no-console
    console.log('Top candidates:', candidates.slice(0, 3).map(c => c.id).join(', '));
    expect(hotspots.length).toBe(10);
    expect(candidates.length).toBe(5);
    expect(['K-92B3C1', 'K-92B3C2', 'K-92B4', 'no_further_optimization']).toContain(rec.recommendation);
  }, 120_000);
});
