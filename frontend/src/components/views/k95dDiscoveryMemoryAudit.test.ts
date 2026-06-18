// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import {
  buildDiscoveryConnectionSuggestions,
} from '@/components/views/features/knowledge/discovery/discoveryConnectionSuggestions';
import {
  buildDiscoveryRefreshBundle,
  collectMissingConnectionSignals,
} from '@/components/views/features/knowledge/discovery';
import {
  createDiscoveryFeedContext,
  ensureConnectionCandidateIndex,
  getGalaxyMemberIds,
} from '@/components/views/features/knowledge/discovery/discoveryFeedContext';
import { getNoteGalaxyMap } from '@/components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import {
  formatK95DDiscoveryMemoryReport,
  measureK95DDiscoveryMemoryRow,
  runK95DDiscoveryMemoryMatrix,
  verifyK95DDiscoveryCompatibility,
} from '@/components/views/k95dDiscoveryMemoryAudit';
import { feedsAreEquivalent, vaultAnalysisIsEquivalent } from '@/components/views/k95aDiscoveryFeedAudit';

describe('k95dDiscoveryMemoryAudit matrix', () => {
  it('measures discovery memory at 100 / 300 / 1000 / 3000 notes', () => {
    const rows = runK95DDiscoveryMemoryMatrix();
    expect(rows).toHaveLength(4);

    for (const row of rows) {
      expect(row.candidatePoolBytes).toBeGreaterThan(0);
      expect(row.signalBytes).toBeGreaterThan(0);
      expect(row.duplicateGalaxyBucketBytes).toBe(0);
      expect(row.candidateReductionPct).toBeGreaterThanOrEqual(20);
      expect(row.retainedObjectCount).toBeGreaterThan(row.noteCount);
    }

    // eslint-disable-next-line no-console
    console.log(formatK95DDiscoveryMemoryReport(rows));
  }, 120_000);
});

describe('k95d compact candidate pool', () => {
  it('shares galaxy buckets between candidate pool and galaxy member lookup', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 100 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    const galaxyMap = getNoteGalaxyMap(notes, service);
    const ctx = createDiscoveryFeedContext(notes, service, galaxyMap, Date.now());
    const pool = ensureConnectionCandidateIndex(ctx);
    const members = getGalaxyMemberIds(ctx, 'uncategorized');

    expect(ctx.galaxyMemberIds).toBe(pool.galaxyMembers);
    expect(Array.isArray(members)).toBe(true);
  });

  it('hydrates suggestion titles lazily from noteById', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 50 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    const galaxyMap = getNoteGalaxyMap(notes, service);
    const ctx = createDiscoveryFeedContext(notes, service, galaxyMap, Date.now());
    const source = notes.find(n => !n.deletedAt)?.id;
    expect(source).toBeTruthy();

    const suggestions = buildDiscoveryConnectionSuggestions(source!, ctx, 5);
    for (const suggestion of suggestions) {
      expect(suggestion.noteTitle.length).toBeGreaterThan(0);
      expect(suggestion.signals.length).toBeGreaterThan(0);
    }
  });
});

describe('k95d compatibility', () => {
  it('preserves discovery feed and vault analysis output', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 300 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    const compat = verifyK95DDiscoveryCompatibility(notes, service);
    expect(compat.feedEquivalent).toBe(true);
    expect(compat.vaultAnalysisEquivalent).toBe(true);
    expect(compat.bundleBytes).toBeGreaterThan(0);
  });

  it('keeps missing connection signal ranking stable for a fixed fixture', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 100 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    const items = collectMissingConnectionSignals(notes, service);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.kind).toBe('missing-connection');
    const sorted = [...items].sort((a, b) => b.score - a.score);
    expect(items.map(i => i.id)).toEqual(sorted.map(i => i.id));
  });

  it('refresh bundle matches standalone feed and analysis', () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 100 });
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    expect(feedsAreEquivalent(notes, service)).toBe(true);
    expect(vaultAnalysisIsEquivalent(notes, service)).toBe(true);
    const bundle = buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: 'k95d-bundle' });
    expect(bundle.feed.items.length).toBeGreaterThanOrEqual(0);
    expect(bundle.vaultAnalysis).toBeDefined();
  });
});
