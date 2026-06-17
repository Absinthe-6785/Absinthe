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
import { COSMOS_COLD_START_ALPHA, resolveCosmosSimInitialAlpha, type CosmosSimContextSnapshot } from './cosmosSimReheat';

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
    expect(deps).toContain('graphTopologySignature');
    expect(deps).not.toContain('vaultStructureVersion');
    expect(deps).not.toContain('indexContentVersion');
    expect(deps).not.toContain('dragging');
  });

  it('metadata-only edit does not restart sim (K-92B2A signature gate)', () => {
    const sig = 'n:a\nb\ne:a|b|backlink';
    const base: CosmosSimContextSnapshot = {
      graphTopologySignature: sig,
      sizeW: 800,
      sizeH: 600,
      relationshipFilter: 'all',
      graphViewMode: 'universe',
      reducedMotion: false,
    };
    const afterTitle: CosmosSimContextSnapshot = { ...base, graphTopologySignature: sig };
    expect(resolveCosmosSimInitialAlpha({
      preservedNodeCount: 1000,
      totalNodeCount: 1000,
      prev: base,
      next: afterTitle,
    })).toBe(COSMOS_COLD_START_ALPHA);
    const row = runK92b2ScenarioAudit(500, 'metadata_only');
    expect(row.restartCount).toBe(0);
    expect(row.settleTicks).toBe(0);
  });

  it('catalog marks metadata-only triggers as fixed by K-92B2A', () => {
    const metadata = listCosmosTriggerCatalog().filter(t => t.metadataOnly);
    expect(metadata.length).toBeGreaterThanOrEqual(4);
    expect(metadata.every(t => t.currentBehavior === 'none')).toBe(true);
    expect(metadata.every(t => t.recommendedBehavior === 'none')).toBe(true);
  });

  it('incremental pair share shrinks with localized edits @ 1000 notes', () => {
    const row = runK92b2ScenarioAudit(1000, 'link_add_1');
    expect(row.incrementalPairShare).toBeLessThan(0.15);
    expect(row.modeledTickCost).toBeLessThan(row.settleTicks);
    expect(incrementalPairShare(50, 1000)).toBeLessThan(0.1);
  }, 60_000);
});
