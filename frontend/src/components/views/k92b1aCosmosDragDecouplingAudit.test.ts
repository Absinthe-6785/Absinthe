// @vitest-environment happy-dom
/**
 * K-92B1A — Cosmos drag-decoupled simulation verification.
 * Run: npm test -- k92b1aCosmosDrag
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b1aAuditTable,
  readForceSimEffectDepsFromNoteGraphView,
  runK92b1aDragDecouplingAudit,
} from './k92b1aCosmosDragDecouplingAudit';
import { snapshotProductionSimConfig } from './k92b1CosmosForceSimAudit';

const SCALE_POINTS = [100, 300, 500, 1000] as const;

describe('K-92B1A cosmos drag decoupling', () => {
  const rows = SCALE_POINTS.map(n => runK92b1aDragDecouplingAudit(n));

  it('prints before/after benchmark table', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b1aAuditTable(rows));
    expect(rows.length).toBe(4);
  });

  it('force sim effect does not list dragging as a dependency', () => {
    const deps = readForceSimEffectDepsFromNoteGraphView();
    expect(deps).not.toContain('dragging');
    expect(deps).toContain('vaultStructureVersion');
    expect(deps).toContain('graphViewMode');
  });

  it('production sim config snapshot excludes dragging from restart deps', () => {
    const cfg = snapshotProductionSimConfig(1000);
    expect(cfg.effectRestartDeps).not.toContain('dragging');
  });

  for (const noteCount of SCALE_POINTS) {
    it(`eliminates pointer-triggered sim restarts @ ${noteCount} notes`, () => {
      const row = rows.find(r => r.noteCount === noteCount)!;
      expect(row.before.clickNodeMs).toBeGreaterThan(row.coldSimSettleMs);
      expect(row.after.clickNodeMs).toBe(0);
      expect(row.after.dragStartMs).toBe(0);
      expect(row.after.dragEndMs).toBe(0);
      expect(row.after.topologyChangeMs).toBe(row.coldSimSettleMs);
    });
  }

  it('@ 1000 notes click path matches K-92B1 double-restart baseline before fix', () => {
    const row = rows.find(r => r.noteCount === 1000)!;
    expect(row.before.clickNodeMs).toBeGreaterThan(3000);
    expect(row.after.clickNodeMs).toBe(0);
  });
});
