// @vitest-environment happy-dom
/**
 * K-92B3B — Tick-decoupled Cosmos memo pipeline audit.
 * Run: npm test -- k92b3bCosmosMemo
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b3bBenchmarkTable,
  formatK92b3bDependencyGraph,
  listK92b3bHotspots,
  readK92b3bPolicySnapshot,
  recommendK92b3bMerge,
  runK92b3bBenchmarkRow,
  runK92b3bMemoRecomputationAudit,
} from './k92b3bCosmosMemoPipelineAudit';
import { countTickCoupledMemoHooks } from './cosmosGraphMemoPipeline';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCALES = [100, 300, 500, 1000] as const;

function noteGraphSource(): string {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'NoteGraphView.tsx'),
    'utf8',
  );
}

describe('K-92B3B cosmos memo pipeline audit', () => {
  it('reads K-92B3B production policy', () => {
    const policy = readK92b3bPolicySnapshot();
    expect(policy.visibleGraphMemoized).toBe(true);
    expect(policy.galaxyTopologyDecoupled).toBe(true);
    expect(policy.orbitTopologyDecoupled).toBe(true);
    expect(policy.focusDepthMapTickDecoupled).toBe(true);
    expect(policy.focusNeighborhoodTickDecoupled).toBe(true);
    expect(countTickCoupledMemoHooks(noteGraphSource())).toBeLessThanOrEqual(1);
  });

  it('prints dependency graph before and after', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3bDependencyGraph(false));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3bDependencyGraph(true));
  });

  it('prints before/after benchmark table @ 100/300/500/1000', () => {
    const rows = SCALES.map(n => runK92b3bBenchmarkRow(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3bBenchmarkTable(rows));
    for (const row of rows) {
      expect(row.k92b3bMemoRecomputations).toBeLessThan(row.legacyMemoRecomputations);
      expect(row.renderReductionPct).toBeGreaterThan(0);
    }
  }, 300_000);

  it('reduces memo recomputations at 1000 notes', () => {
    const row = runK92b3bMemoRecomputationAudit(1000);
    expect(row.memoReductionPct).toBeGreaterThanOrEqual(90);
  }, 120_000);

  it('documents render hotspots and merge recommendation', () => {
    const hotspots = listK92b3bHotspots();
    const rec = recommendK92b3bMerge();
    // eslint-disable-next-line no-console
    console.log('\nK-92B3B merge recommendation:', rec);
    expect(hotspots.filter(h => h.status === 'removed').length).toBeGreaterThanOrEqual(4);
    expect(rec.verdict).toBe('safe_to_merge');
  }, 120_000);
});
