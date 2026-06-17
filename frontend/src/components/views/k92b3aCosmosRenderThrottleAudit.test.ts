// @vitest-environment happy-dom
/**
 * K-92B3A — Cosmos render throttle audit.
 * Run: npm test -- k92b3aCosmosRender
 */
import { describe, expect, it } from 'vitest';
import {
  COSMOS_LEGACY_SIM_RENDER_DIVISOR,
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
} from './cosmosRenderThrottle';
import {
  formatK92b3aBenchmarkTable,
  readK92b3aPolicySnapshot,
  recommendK92b3aMerge,
  runK92b3aBenchmarkRow,
  assertK92b3LegacyBaseline,
} from './k92b3aCosmosRenderThrottleAudit';
import { readCosmosRenderPolicyFromNoteGraphView } from './k92b3CosmosSvgRenderAudit';

const SCALES = [100, 300, 500, 1000] as const;

describe('K-92B3A cosmos render throttle audit', () => {
  it('reads K-92B3A production policy', () => {
    const policy = readK92b3aPolicySnapshot();
    const noteGraphPolicy = readCosmosRenderPolicyFromNoteGraphView();
    expect(policy.legacyDivisor).toBe(COSMOS_LEGACY_SIM_RENDER_DIVISOR);
    expect(policy.settleDivisor).toBe(COSMOS_SIM_SETTLE_RENDER_DIVISOR);
    expect(policy.memoLayersPresent).toBe(true);
    expect(policy.settleSuppressionPresent).toBe(true);
    expect(policy.finalCommitOnSettleComplete).toBe(true);
    expect(noteGraphPolicy.renderTickDivisor).toBe(COSMOS_SIM_SETTLE_RENDER_DIVISOR);
    expect(noteGraphPolicy.nodeEdgeMapsMemoized).toBe(true);
  });

  it('preserves K-92B3 legacy baseline divisor', () => {
    assertK92b3LegacyBaseline();
  });

  it('prints before/after benchmark table @ 100/300/500/1000 cold open', () => {
    const rows = SCALES.map(n => runK92b3aBenchmarkRow(n, 'cold_open_settle'));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3aBenchmarkTable(rows));
    for (const row of rows) {
      expect(row.k92b3aReactCommits).toBeLessThan(row.legacyReactCommits);
      expect(row.k92b3aSvgAttrWrites).toBeLessThan(row.legacySvgAttrWrites);
      expect(row.renderCostReductionPct).toBeGreaterThan(0);
    }
  }, 300_000);

  it('cold open @ 1000 reduces modeled render cost vs legacy N=3', () => {
    const row = runK92b3aBenchmarkRow(1000, 'cold_open_settle');
    expect(row.legacyReactCommits).toBeGreaterThanOrEqual(40);
    expect(row.k92b3aReactCommits).toBeLessThanOrEqual(35);
    expect(row.renderCostReductionPct).toBeGreaterThanOrEqual(15);
  }, 120_000);

  it('recommends merge when policy hooks are present', () => {
    const rec = recommendK92b3aMerge();
    // eslint-disable-next-line no-console
    console.log('\nK-92B3A merge recommendation:', rec);
    expect(rec.verdict).toBe('safe_to_merge');
  }, 120_000);
});
