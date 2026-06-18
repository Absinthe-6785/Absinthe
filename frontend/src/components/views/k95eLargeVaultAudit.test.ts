// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import {
  MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES,
  clearLinkContextOffsetIndex,
  getParagraphOffsetCacheStats,
} from '@/components/views/features/knowledge/linkContext/linkContextOffsetIndex';
import {
  K95E_NOTE_COUNTS,
  formatK95eCombinedMemoryReport,
  formatK95eLargeVaultReport,
  formatK95eLongSessionReport,
  listK95eAllocationHotspots,
  measureK95eLargeVaultRow,
  readK95ePolicySnapshot,
  runK95eCombinedMemoryTable,
  runK95eLargeVaultMatrix,
  runK95eLongSessionMatrix,
  verifyK95eCompatibility,
} from '@/components/views/k95eLargeVaultAudit';
import { feedsAreEquivalent, vaultAnalysisIsEquivalent } from '@/components/views/k95aDiscoveryFeedAudit';

describe('k95eLargeVaultAudit policy', () => {
  it('reads post-K-95E cleanup hooks from source', () => {
    const policy = readK95ePolicySnapshot();
    expect(policy.paragraphOffsetCacheBounded).toBe(true);
    expect(policy.enrichGraphSingleSpread).toBe(true);
    expect(policy.discoveryUsesActiveNotesCount).toBe(true);
    expect(policy.refreshBundlePresent).toBe(true);
    expect(policy.compactRelatedPresent).toBe(true);
    expect(policy.compactCandidatesPresent).toBe(true);
  });
});

describe('k95eLargeVaultAudit matrix', () => {
  it('measures retained + transient memory at 100 / 300 / 1000 / 3000 / 10000 notes', () => {
    const rows = runK95eLargeVaultMatrix();
    expect(rows).toHaveLength(5);

    for (const row of rows) {
      expect(row.retainedBytes).toBeGreaterThan(0);
      expect(row.transientAllocations).toBeGreaterThanOrEqual(0);
      expect(row.objectCount).toBeGreaterThan(row.noteCount);
      expect(row.subsystems.indexBytes).toBeGreaterThan(0);
      expect(row.subsystems.discoveryBytes).toBeGreaterThan(0);
      expect(row.subsystems.cosmosHudBytes).toBeGreaterThan(0);
      expect(row.subsystems.graphMetadataBytes).toBeGreaterThan(0);
      expect(row.cacheSizes.paragraphOffsetMax).toBe(MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES);
      expect(row.cacheSizes.paragraphOffsetEntries).toBeLessThanOrEqual(MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES);
    }

    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.retainedBytes).toBeGreaterThan(rows[i - 1]!.retainedBytes);
    }

    // eslint-disable-next-line no-console
    console.log(formatK95eLargeVaultReport(rows));
  }, 300_000);
});

describe('k95e allocation hotspots', () => {
  it('ranks top churn paths with bounded offset cache noted', () => {
    const hotspots = listK95eAllocationHotspots();
    expect(hotspots.length).toBeGreaterThanOrEqual(5);
    expect(hotspots[0]?.churnScore).toBeGreaterThanOrEqual(hotspots[hotspots.length - 1]?.churnScore ?? 0);

    const offsetHotspot = hotspots.find(h => h.path.includes('linkContextOffsetIndex'));
    expect(offsetHotspot?.summary).toContain('512');
  });
});

describe('k95e long-session simulation', () => {
  it('plateaus retained growth at 1h / 3h / 10h on 1000-note vault', () => {
    const rows = runK95eLongSessionMatrix(1000);
    expect(rows).toHaveLength(3);

    for (const row of rows) {
      expect(row.plateau).toBe(true);
      expect(row.paragraphOffsetCacheSize).toBeLessThanOrEqual(MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES);
      expect(row.heapGrowthPct).toBeLessThan(8);
    }

    // eslint-disable-next-line no-console
    console.log(formatK95eLongSessionReport(rows));
  }, 180_000);
});

describe('k95e combined memory table', () => {
  it('reports pre-K95 vs post-K95 improvements', () => {
    const rows = runK95eCombinedMemoryTable();
    expect(rows).toHaveLength(5);

    for (const row of rows) {
      expect(row.postK95TotalBytes).toBeLessThan(row.preK95TotalBytes);
      expect(row.totalImprovementPct).toBeGreaterThan(0);
      expect(row.indexImprovementPct).toBeGreaterThan(0);
      expect(row.candidateImprovementPct).toBeGreaterThanOrEqual(20);
    }

    // eslint-disable-next-line no-console
    console.log(formatK95eCombinedMemoryReport(rows));
  }, 300_000);
});

describe('k95e compatibility', () => {
  it('preserves backlinks, related notes, graph, HUD, discovery, and link contexts', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 300 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    const compat = verifyK95eCompatibility(notes, service);
    expect(compat.backlinksStable).toBe(true);
    expect(compat.relatedNotesStable).toBe(true);
    expect(compat.graphStable).toBe(true);
    expect(compat.cosmosHudStable).toBe(true);
    expect(compat.discoveryFeedStable).toBe(true);
    expect(compat.vaultAnalysisStable).toBe(true);
    expect(compat.linkContextsStable).toBe(true);
    expect(feedsAreEquivalent(notes, service)).toBe(true);
    expect(vaultAnalysisIsEquivalent(notes, service)).toBe(true);
  });

  it('measures 10000-note row within bounded caches', () => {
    clearLinkContextOffsetIndex();
    const row = measureK95eLargeVaultRow(10000);
    expect(row.noteCount).toBe(10000);
    expect(row.cacheSizes.paragraphOffsetEntries).toBeLessThanOrEqual(MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES);
    expect(getParagraphOffsetCacheStats().bounded).toBe(true);
  }, 120_000);
});
