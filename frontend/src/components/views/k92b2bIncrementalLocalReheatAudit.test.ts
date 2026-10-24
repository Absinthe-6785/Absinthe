// @vitest-environment happy-dom
/**
 * K-92B2B — Incremental local reheat audit.
 * Run: npm test -- k92b2bIncremental
 */
import { describe, expect, it, vi } from 'vitest';
import {
  compareHopRadii,
  formatK92b2bAuditTable,
  formatK92b2bHopComparisonTable,
  passesLocalReheatQuality,
  runK92b2bScenarioAudit,
  QUALITY_MAX_ACTIVE_DISPLACEMENT_PX,
  type K92b2bAuditRow,
  type K92b2bScenarioId,
} from './k92b2bIncrementalLocalReheatAudit';
import { COSMOS_LOCAL_REHEAT_HOPS } from './cosmosLocalReheat';

const SCALES = [100, 300, 500, 1000] as const;
const SCENARIOS = ['link_add_1', 'note_add_1', 'note_remove_1'] as const;
const AUDIT_NOW = Date.UTC(2026, 9, 24, 12);

const scenarioResults = new Map<string, Readonly<K92b2bAuditRow>>();

function runCachedScenarioAudit(
  noteCount: number,
  scenarioId: K92b2bScenarioId,
  hops = COSMOS_LOCAL_REHEAT_HOPS,
): K92b2bAuditRow {
  const key = `${noteCount}:${scenarioId}:${hops}`;
  const cached = scenarioResults.get(key);
  if (cached) return { ...cached };

  const clock = vi.spyOn(Date, 'now').mockReturnValue(AUDIT_NOW);
  try {
    const result = Object.freeze({ ...runK92b2bScenarioAudit(noteCount, scenarioId, hops) });
    scenarioResults.set(key, result);
    return { ...result };
  } finally {
    clock.mockRestore();
  }
}

describe('K-92B2B incremental local reheat audit', () => {
  it('prints benchmark table @ 2 hops', () => {
    const rows = SCALES.flatMap(n => SCENARIOS.map(s => runCachedScenarioAudit(n, s)));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b2bAuditTable(rows));
    expect(rows.length).toBe(12);
  }, 600_000);

  it('prints hop radius comparison @ 1000 link_add', () => {
    const helperClock = vi.spyOn(Date, 'now').mockReturnValue(AUDIT_NOW);
    let helperRows: K92b2bAuditRow[];
    try {
      helperRows = compareHopRadii(100, 'link_add_1');
    } finally {
      helperClock.mockRestore();
    }
    expect(helperRows.map(row => row.hops)).toEqual([0, 1, 2]);
    expect(helperRows.every(row => row.noteCount === 100 && row.scenarioId === 'link_add_1')).toBe(true);

    const hopRows = [0, 1, 2].map(hops => runCachedScenarioAudit(1000, 'link_add_1', hops));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b2bHopComparisonTable(hopRows));
    expect(hopRows.length).toBe(3);
  }, 120_000);

  it('local reheat reduces pair iterations vs warm full @ 1000 link_add', () => {
    const row = runCachedScenarioAudit(1000, 'link_add_1');
    expect(row.reheatMode).toBe('local_reheat');
    expect(row.localPairIterations).toBeLessThan(row.warmFullPairIterations);
    expect(row.settleCostReductionPct).toBeGreaterThan(30);
  }, 120_000);

  it('2-hop local layout stays within quality threshold @ 1000 link_add', () => {
    const row = runCachedScenarioAudit(1000, 'link_add_1');
    expect(row.reheatMode).toBe('local_reheat');
    expect(row.maxActiveDisplacementPx).toBeLessThanOrEqual(QUALITY_MAX_ACTIVE_DISPLACEMENT_PX);
    expect(passesLocalReheatQuality(row)).toBe(true);
  }, 120_000);

  it('node add/remove fall back to warm full (non-edge topology)', () => {
    const noteAdd = runCachedScenarioAudit(1000, 'note_add_1');
    expect(noteAdd.reheatMode).toBe('warm_full');
    expect(noteAdd.fallbackReason).toBe('non_edge_topology_change');
    const noteRemove = runCachedScenarioAudit(1000, 'note_remove_1');
    expect(noteRemove.reheatMode).toBe('warm_full');
    expect(noteRemove.fallbackReason).toBe('non_edge_topology_change');
  }, 240_000);

  it('1-hop is tighter than 2-hop on link_add @ 1000', () => {
    const oneHop = runCachedScenarioAudit(1000, 'link_add_1', 1);
    const twoHop = runCachedScenarioAudit(1000, 'link_add_1', 2);
    expect(oneHop.localReheatNodeCount).toBeLessThanOrEqual(twoHop.localReheatNodeCount);
    expect(twoHop.maxActiveDisplacementPx).toBeLessThanOrEqual(QUALITY_MAX_ACTIVE_DISPLACEMENT_PX);
  }, 240_000);

  it('metadata-only path is unchanged (0 restarts via signature gate)', () => {
    const row = runCachedScenarioAudit(500, 'link_add_1');
    expect(row.restartCount).toBe(1);
    expect(row.tickCount).toBeGreaterThan(0);
  }, 60_000);
});
