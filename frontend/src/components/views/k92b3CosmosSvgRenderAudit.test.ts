// @vitest-environment happy-dom
/**
 * K-92B3 — Cosmos SVG render throttle audit.
 * Run: npm test -- k92b3CosmosSvg
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b3CostSplitTable,
  formatK92b3RenderAttributionTable,
  formatK92b3RoadmapTable,
  formatK92b3SvgAuditTable,
  listK92b3Hotspots,
  listK92b3OptimizationRoadmap,
  PRODUCTION_RENDER_TICK_DIVISOR,
  readCosmosRenderPolicyFromNoteGraphView,
  recommendNextImplementationBranch,
  runK92b3CostSplitAudit,
  runK92b3RenderAttributionAudit,
  runK92b3SvgAudit,
} from './k92b3CosmosSvgRenderAudit';
import { COSMOS_SIM_SETTLE_RENDER_DIVISOR } from './cosmosRenderThrottle';

const SCALES = [100, 300, 500, 1000] as const;
const SCENARIOS = ['cold_open_settle', 'warm_full_settle', 'warm_local_link_settle'] as const;

describe('K-92B3 cosmos SVG render audit', () => {
  it('reads production render throttle policy from NoteGraphView', () => {
    const policy = readCosmosRenderPolicyFromNoteGraphView();
    expect(policy.renderTickDivisor).toBe(COSMOS_SIM_SETTLE_RENDER_DIVISOR);
    expect(policy.tickStateDrivesRender).toBe(true);
    expect(policy.fullComponentRerenderOnTick).toBe(true);
    expect(policy.nodeEdgeMapsMemoized).toBe(true);
  });

  it('prints render attribution table', () => {
    const rows = SCALES.flatMap(n => SCENARIOS.map(s => runK92b3RenderAttributionAudit(n, s)));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3RenderAttributionTable(rows));
    expect(rows.length).toBe(12);
  }, 120_000);

  it('prints SVG audit table', () => {
    const rows = SCALES.map(n => runK92b3SvgAudit(n));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3SvgAuditTable(rows));
    expect(rows[3]?.attrWritesPerCommit).toBeGreaterThan(rows[0]?.attrWritesPerCommit ?? 0);
  }, 120_000);

  it('prints simulation vs rendering split', () => {
    const rows = SCALES.flatMap(n => SCENARIOS.map(s => runK92b3CostSplitAudit(n, s)));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3CostSplitTable(rows));
    expect(rows.length).toBe(12);
  }, 300_000);

  it('cold open @ 1000 still issues ~43 React commits during settle', () => {
    const row = runK92b3RenderAttributionAudit(1000, 'cold_open_settle');
    expect(row.simTicks).toBeGreaterThanOrEqual(120);
    expect(row.reactCommitsDuringSettle).toBe(Math.ceil(row.simTicks / PRODUCTION_RENDER_TICK_DIVISOR));
    expect(row.reactCommitsDuringSettle).toBeGreaterThanOrEqual(40);
  }, 60_000);

  it('post-B2B local link settle keeps tick count but lowers sim share', () => {
    const warm = runK92b3CostSplitAudit(1000, 'warm_full_settle');
    const local = runK92b3CostSplitAudit(1000, 'warm_local_link_settle');
    expect(local.simPct).toBeLessThan(warm.simPct);
    expect(local.reactPct).toBeGreaterThan(warm.reactPct);
  }, 120_000);

  it('documents top hotspots and roadmap', () => {
    const hotspots = listK92b3Hotspots();
    const roadmap = listK92b3OptimizationRoadmap();
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b3RoadmapTable(roadmap));
    expect(hotspots.length).toBe(10);
    expect(roadmap.length).toBe(10);
    expect(recommendNextImplementationBranch().branch).toBe('k92b3a-cosmos-render-throttle');
  });
});
