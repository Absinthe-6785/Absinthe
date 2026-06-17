// @vitest-environment happy-dom
/**
 * K-92B2 — Cosmos incremental sim restart audit.
 * Run: npm test -- k92b2CosmosIncremental
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b2AuditTable,
  formatK92b2BaselineTable,
  incrementalPairShare,
  listCosmosTriggerCatalog,
  readForceSimEffectDeps,
  runK92b2ScenarioAudit,
} from './k92b2CosmosIncrementalSimAudit';
import { resolveCosmosSimInitialAlpha, type CosmosSimContextSnapshot } from './cosmosSimReheat';

const SCALES = [100, 300, 500, 1000] as const;
const SCENARIOS = ['note_add_1', 'link_add_1', 'note_remove_1', 'metadata_only'] as const;

describe('K-92B2 cosmos incremental sim restart audit', () => {
  it('prints baseline warm-full tick cost', () => {
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b2BaselineTable(SCALES));
    expect(SCALES.length).toBe(4);
  }, 120_000);

  it('prints scenario cost model', () => {
    const rows = SCALES.flatMap(n => SCENARIOS.map(s => runK92b2ScenarioAudit(n, s)));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b2AuditTable(rows));
    expect(rows.length).toBe(16);
  }, 300_000);

  it('documents force sim effect dependencies', () => {
    const deps = readForceSimEffectDeps();
    expect(deps).toContain('vaultStructureVersion');
    expect(deps).toContain('indexContentVersion');
    expect(deps).not.toContain('dragging');
  });

  it('metadata-only edit should not require restart (policy gap)', () => {
    const base: CosmosSimContextSnapshot = {
      vaultStructureVersion: 1,
      indexContentVersion: 1,
      sizeW: 800,
      sizeH: 600,
      relationshipFilter: 'all',
      graphViewMode: 'universe',
      reducedMotion: false,
    };
    const afterTitle: CosmosSimContextSnapshot = { ...base, vaultStructureVersion: 2 };
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 1000,
      totalNodeCount: 1000,
      prev: base,
      next: afterTitle,
    })).toBe(0.2);
  });

  it('incremental pair share shrinks with localized edits @ 1000 notes', () => {
    const row = runK92b2ScenarioAudit(1000, 'link_add_1');
    expect(row.incrementalPairShare).toBeLessThan(0.15);
    expect(row.modeledTickCost).toBeLessThan(row.settleTicks);
    expect(incrementalPairShare(50, 1000)).toBeLessThan(0.1);
  }, 60_000);

  it('catalog marks metadata-only triggers as over-restarting today', () => {
    const overRestart = listCosmosTriggerCatalog().filter(t => t.metadataOnly && t.currentBehavior === 'warm_full');
    expect(overRestart.length).toBeGreaterThanOrEqual(4);
    expect(overRestart.every(t => t.recommendedBehavior === 'none')).toBe(true);
  });
});
