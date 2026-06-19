import { describe, expect, it } from 'vitest';
import {
  K95_NOTE_COUNTS,
  analyzeRelatedByNoteIdFootprint,
  buildK95IndexAuditFixture,
  countKnowledgeIndexMaps,
  estimateIndexMemoryBreakdown,
  listK95OptimizationOpportunities,
  measureDiscoveryFeedMemory,
  measureExtractLinkContextsScan,
  rankK95MemoryConsumers,
  readK95PolicySnapshot,
  runK95BenchmarkRow,
  runK95GrowthCurve,
} from './k95KnowledgeIndexAudit';

describe('k95KnowledgeIndexAudit policy', () => {
  it('reads expected production hooks from source', () => {
    const policy = readK95PolicySnapshot();
    expect(policy.indexUsesBodyProvider).toBe(true);
    expect(policy.linksTabGatePresent).toBe(true);
    expect(policy.discoveryFeedDedupeComment).toBe(true);
  });
});

describe('k95KnowledgeIndexAudit index attribution', () => {
  it.each(K95_NOTE_COUNTS)('counts index maps at %i notes', noteCount => {
    const { notes, service } = buildK95IndexAuditFixture(noteCount);
    const counts = countKnowledgeIndexMaps(service);
    const memory = estimateIndexMemoryBreakdown(service, notes);

    expect(counts.activeNoteEntries).toBe(noteCount);
    expect(counts.relatedNoteLists).toBe(noteCount);
    expect(counts.titleSearchEntries).toBe(noteCount);
    expect(memory.noteCount).toBe(noteCount);
    expect(memory.notesBodiesBytes).toBeGreaterThan(0);
    expect(memory.indexTotalBytes).toBeGreaterThan(0);
  }, 120_000);

  it('related footprint grows with vault size', () => {
    const small = analyzeRelatedByNoteIdFootprint(buildK95IndexAuditFixture(100).service);
    const large = analyzeRelatedByNoteIdFootprint(buildK95IndexAuditFixture(1000).service);

    expect(large.relatedEntries).toBeGreaterThan(small.relatedEntries);
    expect(large.estimatedRelatedBytes).toBeGreaterThan(small.estimatedRelatedBytes);
    expect(large.compactReductionPct).toBeGreaterThan(30);
  }, 60_000);

  it('growth curve is monotonic for index bytes', () => {
    const rows = runK95GrowthCurve();
    expect(rows).toHaveLength(4);

    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.memory.indexTotalBytes).toBeGreaterThan(rows[i - 1]!.memory.indexTotalBytes);
      expect(rows[i]!.memory.notesBodiesBytes).toBeGreaterThan(rows[i - 1]!.memory.notesBodiesBytes);
    }
  }, 120_000);
});

describe('k95KnowledgeIndexAudit extractLinkContexts', () => {
  it('attributes full-vault body scan cost', () => {
    const { notes } = buildK95IndexAuditFixture(300);
    const target = notes.find(n => (n.body ?? '').includes('[['))?.title ?? notes[0]!.title!;
    const metrics = measureExtractLinkContextsScan(target, notes);

    expect(metrics.notesScanned).toBe(300);
    expect(metrics.bodiesBytesScanned).toBeGreaterThan(metrics.resultBytes);
    expect(metrics.scanMs).toBeGreaterThanOrEqual(0);
  });
});

describe('k95KnowledgeIndexAudit discovery feed', () => {
  it('measures feed and vault analysis retained bytes', () => {
    const { notes, service } = buildK95IndexAuditFixture(300);
    const row = measureDiscoveryFeedMemory(notes, service);

    expect(row.noteCount).toBe(300);
    expect(row.feedRetainedBytes).toBeGreaterThan(0);
    expect(row.vaultAnalysisBytes).toBeGreaterThan(0);
    expect(row.connectionSignalCount).toBeGreaterThanOrEqual(0);
    expect(row.galaxyMapBuilt).toBe(true);
  });
});

describe('k95KnowledgeIndexAudit ranking and opportunities', () => {
  it('ranks note bodies or index as top consumers at 1000 notes', () => {
    const row = runK95BenchmarkRow(1000);
    const ranked = rankK95MemoryConsumers(row);

    expect(['zustand-note-bodies', 'knowledge-index-total']).toContain(ranked[0]?.id);
    const topTwoBytes = (ranked[0]?.bytes ?? 0) + (ranked[1]?.bytes ?? 0);
    const total = row.memory.notesBodiesBytes + row.memory.indexTotalBytes;
    expect(topTwoBytes / total).toBeGreaterThan(0.7);
  });

  it('lists optimization opportunities with risk metadata', () => {
    const opportunities = listK95OptimizationOpportunities();
    expect(opportunities.length).toBeGreaterThanOrEqual(6);
    expect(opportunities.some(o => o.id === 'related-compact-storage')).toBe(true);
    expect(opportunities.some(o => o.id === 'link-context-index')).toBe(true);
  });
});

describe('k95KnowledgeIndexAudit benchmark row', () => {
  it('produces complete row at 300 notes', () => {
    const row = runK95BenchmarkRow(300);
    expect(row.mapCounts.outgoingLinkStrings).toBeGreaterThan(0);
    expect(row.related.avgNeighborsPerNote).toBeGreaterThan(0);
    expect(row.linkContext.matchingNotes).toBeGreaterThanOrEqual(0);
    expect(row.discovery.feedItems).toBeGreaterThan(0);
  });

  it('prints growth metrics when K95_PRINT=1', () => {
    if (process.env.K95_PRINT !== '1') return;
    for (const row of runK95GrowthCurve()) {
      const top = rankK95MemoryConsumers(row)[0];
      // eslint-disable-next-line no-console
      console.log('K95_METRICS', JSON.stringify({
        noteCount: row.noteCount,
        bodiesMB: +(row.memory.notesBodiesBytes / 1e6).toFixed(2),
        indexMB: +(row.memory.indexTotalBytes / 1e6).toFixed(2),
        relatedMB: +(row.memory.relatedByNoteIdBytes / 1e6).toFixed(2),
        mentionsMB: +(row.memory.mentionsBytes / 1e6).toFixed(2),
        tagsMB: +(row.memory.tagsBytes / 1e6).toFixed(2),
        titleIdxMB: +(row.memory.titleIndexBytes / 1e6).toFixed(2),
        backlinksMB: +(row.memory.backlinksBytes / 1e6).toFixed(2),
        relatedEntries: row.related.relatedEntries,
        avgNeighbors: row.related.avgNeighborsPerNote,
        linkScanMB: +(row.linkContext.bodiesBytesScanned / 1e6).toFixed(2),
        discoveryKB: +(row.discovery.feedRetainedBytes / 1e3).toFixed(1),
        topConsumer: top?.id,
      }));
    }
  });
});
