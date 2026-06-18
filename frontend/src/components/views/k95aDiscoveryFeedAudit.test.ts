import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import {
  buildDiscoveryFeed,
  buildDiscoveryRefreshBundle,
} from '@/components/views/features/knowledge/discovery';
import { buildCosmosVaultAnalysis } from '@/components/views/features/knowledge/cosmos/intelligence/cosmosAnalysis';
import * as galaxyClustering from '@/components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import * as discoveryFeedContext from '@/components/views/features/knowledge/discovery/discoveryFeedContext';
import {
  estimateK95aAllocation,
  feedsAreEquivalent,
  K95A_NOTE_COUNTS,
  measureK95aRefreshAttribution,
  readK95aPolicySnapshot,
  runK95aCandidateRow,
  runLegacyDiscoveryRefresh,
  vaultAnalysisIsEquivalent,
} from './k95aDiscoveryFeedAudit';

function buildFixture(noteCount: number) {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(dataset.notes);
  return { notes: dataset.notes, service };
}

describe('k95aDiscoveryFeedAudit policy', () => {
  it('reads shared-context hooks from production sources', () => {
    const policy = readK95aPolicySnapshot();
    expect(policy.refreshBundleExported).toBe(true);
    expect(policy.contextCachesConnectionSignals).toBe(true);
    expect(policy.contextCachesRelationshipSignals).toBe(true);
    expect(policy.cosmosAnalysisAcceptsContext).toBe(true);
    expect(policy.noteGraphUsesRefreshBundle).toBe(true);
  });
});

describe('k95aDiscoveryFeedAudit equivalence', () => {
  it.each(K95A_NOTE_COUNTS)('feed unchanged at %i notes', noteCount => {
    const { notes, service } = buildFixture(noteCount);
    expect(feedsAreEquivalent(notes, service)).toBe(true);
  });

  it.each(K95A_NOTE_COUNTS)('vault analysis unchanged at %i notes', noteCount => {
    const { notes, service } = buildFixture(noteCount);
    expect(vaultAnalysisIsEquivalent(notes, service)).toBe(true);
  });
});

describe('k95aDiscoveryFeedAudit runtime attribution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shared bundle builds galaxy map once', () => {
    const { notes, service } = buildFixture(300);
    const galaxySpy = vi.spyOn(galaxyClustering, 'getNoteGalaxyMap');
    buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: 'k95a-runtime' });
    expect(galaxySpy).toHaveBeenCalledTimes(1);
  });

  it('legacy refresh builds galaxy map twice', () => {
    const { notes, service } = buildFixture(300);
    const galaxySpy = vi.spyOn(galaxyClustering, 'getNoteGalaxyMap');
    runLegacyDiscoveryRefresh(notes, service, 'k95a-runtime-legacy');
    expect(galaxySpy).toHaveBeenCalledTimes(2);
  });

  it('shared bundle creates one discovery context', () => {
    const { notes, service } = buildFixture(300);
    const ctxSpy = vi.spyOn(discoveryFeedContext, 'createDiscoveryFeedContext');
    buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: 'k95a-ctx' });
    expect(ctxSpy).toHaveBeenCalledTimes(1);
  });

  it('caches connection and relationship signals on context', () => {
    const { notes, service } = buildFixture(300);
    const bundle = buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: 'k95a-cache' });
    expect(bundle.context.connectionSignals?.length).toBeGreaterThan(0);
    expect(bundle.context.relationshipSignals).toBeDefined();
    expect(bundle.context.candidatePool ?? bundle.context.connectionIndex).toBeDefined();
  });
});

describe('k95aDiscoveryFeedAudit allocation', () => {
  it.each(K95A_NOTE_COUNTS)('models refresh reduction at %i notes', noteCount => {
    const attribution = measureK95aRefreshAttribution(noteCount);
    expect(attribution.galaxyMapReductionPct).toBe(50);
    expect(attribution.contextReductionPct).toBe(50);
  });

  it.each(K95A_NOTE_COUNTS)('reports candidate row at %i notes', noteCount => {
    const row = runK95aCandidateRow(noteCount);
    expect(row.feedItemCount).toBeGreaterThan(0);
    expect(row.candidatePoolGalaxyBuckets).toBeGreaterThan(0);
  });

  it('shared path does not increase output bytes', () => {
    const estimate = estimateK95aAllocation(300);
    expect(estimate.sharedTransientBytes).toBeLessThanOrEqual(estimate.legacyTransientBytes);
  });
});

describe('k95aDiscoveryFeedAudit standalone feed parity', () => {
  it('buildDiscoveryFeed still works without pre-built context', () => {
    const { notes, service } = buildFixture(100);
    const feed = buildDiscoveryFeed(notes, service, { perSectionLimit: 4 });
    expect(feed.items.length).toBeGreaterThan(0);
  });

  it('buildCosmosVaultAnalysis still works without context', () => {
    const { notes, service } = buildFixture(100);
    const analysis = buildCosmosVaultAnalysis(notes, service);
    expect(analysis.coreHubCount).toBeGreaterThanOrEqual(0);
  });
});
