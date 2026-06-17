// @vitest-environment happy-dom
/**
 * K-92B1 — Cosmos force simulation optimization audit.
 * Run: npm test -- k92b1CosmosForceSim
 */
import { describe, expect, it } from 'vitest';
import {
  countAlphaTicks,
  estimateBarnesHutSpeedup,
  formatK92b1AuditTable,
  runK92b1ForceSimAudit,
  snapshotProductionSimConfig,
} from './k92b1CosmosForceSimAudit';
import { graphSimulationAlphaFloor } from './graphScalePolicy';

const SCALE_POINTS = [100, 300, 500, 1000] as const;

describe('K-92B1 cosmos force sim audit', () => {
  const rows = SCALE_POINTS.map(n => runK92b1ForceSimAudit(n));

  it('prints benchmark table', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b1AuditTable(rows));
    expect(rows.length).toBe(4);
  });

  for (let i = 0; i < SCALE_POINTS.length; i++) {
    const noteCount = SCALE_POINTS[i];
    it(`attributes force sim @ ${noteCount} notes`, () => {
      const row = rows[i];
      expect(row.noteCount).toBe(noteCount);
      expect(row.expandNodeMs).toBeLessThan(5);
      expect(row.coldSimSettleMs).toBeGreaterThan(0);
      expect(row.coldSimSettleMs).toBeGreaterThan(row.expandNodeMs * 10);
      expect(row.warmPartialReheatMs).toBeLessThan(row.coldSimSettleMs);
      expect(row.config.usesBarnesHut).toBe(false);
    });
  }

  it('documents production sim config @ 1000 nodes', () => {
    const cfg = snapshotProductionSimConfig(1000);
    expect(cfg.initialAlpha).toBe(1);
    expect(cfg.alphaDecayPerTick).toBe(0.97);
    expect(cfg.effectRestartDeps).toContain('dragging');
    expect(countAlphaTicks(cfg.alphaFloor)).toBeGreaterThan(100);
    expect(estimateBarnesHutSpeedup(1000)).toBeGreaterThan(10);
  });

  it('warm partial reheat reduces tick count vs cold start', () => {
    const row = rows.find(r => r.noteCount === 500)!;
    expect(row.warmPartialReheatTicks).toBeLessThanOrEqual(row.coldSimTicks);
    expect(row.raisedFloorSimMs).toBeLessThan(row.coldSimSettleMs);
  });

  it('alpha floor policy matches graphScalePolicy', () => {
    expect(graphSimulationAlphaFloor(1000)).toBe(0.02);
    expect(graphSimulationAlphaFloor(100)).toBe(0.005);
  });
});
