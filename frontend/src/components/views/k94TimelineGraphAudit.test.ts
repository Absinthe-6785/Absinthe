import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildKnowledgeTimeline } from '@/components/views/features/knowledge/timeline/knowledgeTimeline';
import { buildPeriodBuckets } from '@/components/views/features/knowledge/timeline/timelineSnapshots';
import {
  countLinksForNotes,
  notesActiveAt,
} from '@/components/views/features/knowledge/timeline/timelineMetrics';
import {
  countVaultLinks,
  resolveCosmosVaultPhase,
} from '@/components/views/features/knowledge/cosmos/onboarding/cosmosVaultState';
import { buildCosmosEvolutionSummary } from '@/components/views/features/knowledge/history/historyEvolutionQueries';
import * as buildGlobalGraphDataModule from '@/components/views/features/knowledge/graph/buildGlobalGraphData';
import {
  estimateK94Allocation,
  estimateLegacyTimelineGraphBuilds,
  K94_AUDIT_NOW,
  readK94PolicySnapshot,
  runK94GraphBuildRow,
  spreadNotesAcrossHistory,
  verifySharedEdgeLinkCountEquivalence,
  countVaultLinksViaFullGraph,
} from './k94TimelineGraphAudit';

const NOTE_COUNTS = [100, 300, 1000] as const;
const MODES = ['month', 'quarter', 'all'] as const;

describe('k94TimelineGraphAudit policy', () => {
  it('reads dedupe hooks from production sources', () => {
    const policy = readK94PolicySnapshot();
    expect(policy.timelineUsesSharedEdges).toBe(true);
    expect(policy.discoverUsesEdgeCount).toBe(true);
    expect(policy.evolutionUsesEdgeCount).toBe(true);
    expect(policy.exportsCollectGlobalGraphEdges).toBe(true);
  });
});

describe('k94TimelineGraphAudit legacy build counts', () => {
  it.each(NOTE_COUNTS)('models month-mode bucket growth at %i notes', noteCount => {
    const row = runK94GraphBuildRow(noteCount, 'month');
    expect(row.bucketCount).toBeGreaterThanOrEqual(30);
    expect(row.legacyTimelineGraphBuilds).toBe(estimateLegacyTimelineGraphBuilds(row.bucketCount));
    expect(row.currentTimelineEdgeCollections).toBe(1);
    expect(row.timelineReductionPct).toBeGreaterThan(90);
  });

  it.each(NOTE_COUNTS)('quarter mode at %i notes', noteCount => {
    const row = runK94GraphBuildRow(noteCount, 'quarter');
    expect(row.bucketCount).toBeGreaterThanOrEqual(10);
    expect(row.legacyTimelineGraphBuilds).toBe(row.bucketCount + 1);
    expect(row.currentTimelineEdgeCollections).toBe(1);
  });

  it.each(NOTE_COUNTS)('all mode at %i notes', noteCount => {
    const row = runK94GraphBuildRow(noteCount, 'all');
    expect(row.bucketCount).toBe(1);
    expect(row.legacyTimelineGraphBuilds).toBe(2);
    expect(row.currentTimelineEdgeCollections).toBe(1);
  });
});

describe('k94TimelineGraphAudit runtime graph build attribution', () => {
  let buildSpy: ReturnType<typeof vi.spyOn>;
  let collectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    buildSpy = vi.spyOn(buildGlobalGraphDataModule, 'buildGlobalGraphData');
    collectSpy = vi.spyOn(buildGlobalGraphDataModule, 'collectGlobalGraphEdges');
  });

  afterEach(() => {
    buildSpy.mockRestore();
    collectSpy.mockRestore();
  });

  it('buildKnowledgeTimeline collects edges once and skips buildGlobalGraphData', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 300 });
    const notes = spreadNotesAcrossHistory(dataset.notes, K94_AUDIT_NOW);
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    buildKnowledgeTimeline(notes, service, undefined, { mode: 'month', now: K94_AUDIT_NOW });

    expect(collectSpy).toHaveBeenCalledTimes(1);
    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('resolveCosmosVaultPhase uses index edge count without buildGlobalGraphData', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 100 });
    const notes = spreadNotesAcrossHistory(dataset.notes, K94_AUDIT_NOW);
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    resolveCosmosVaultPhase(notes, service, 0);

    expect(buildSpy).not.toHaveBeenCalled();
  });

  it('buildCosmosEvolutionSummary skips buildGlobalGraphData', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 100 });
    const notes = spreadNotesAcrossHistory(dataset.notes, K94_AUDIT_NOW);
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    buildCosmosEvolutionSummary(notes, service, []);

    expect(buildSpy).not.toHaveBeenCalled();
  });
});

describe('k94TimelineGraphAudit metric equivalence', () => {
  it.each(NOTE_COUNTS)('shared edges match full graph link counts at %i notes', noteCount => {
    const dataset = buildLargeVaultDataset({ noteCount });
    const notes = spreadNotesAcrossHistory(dataset.notes, K94_AUDIT_NOW);
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    expect(verifySharedEdgeLinkCountEquivalence(notes, service)).toBe(true);
    expect(countVaultLinks(notes, service)).toBe(countVaultLinksViaFullGraph(notes, service));
  });

  it('bucket link counts match legacy per-bucket graph build', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 300 });
    const notes = spreadNotesAcrossHistory(dataset.notes, K94_AUDIT_NOW);
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    const shared = buildGlobalGraphDataModule.collectGlobalGraphEdges(service);
    const buckets = buildPeriodBuckets(notes, 'month', K94_AUDIT_NOW);

    for (const bucket of buckets) {
      const active = notesActiveAt(notes, bucket.endMs);
      const legacy = countLinksForNotes(active, service);
      const sharedCount = countLinksForNotes(active, service, shared);
      expect(sharedCount).toBe(legacy);
    }
  });

  it('timeline snapshots unchanged vs shared-edge path', () => {
    const dataset = buildLargeVaultDataset({ noteCount: 300 });
    const notes = spreadNotesAcrossHistory(dataset.notes, K94_AUDIT_NOW);
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);

    const timeline = buildKnowledgeTimeline(notes, service, undefined, {
      mode: 'month',
      now: K94_AUDIT_NOW,
    });
    const last = timeline.snapshots[timeline.snapshots.length - 1];
    expect(last?.linkCount).toBeGreaterThan(0);
    expect(last?.noteCount).toBe(300);
  });
});

describe('k94TimelineGraphAudit allocation estimates', () => {
  it.each(NOTE_COUNTS)('month allocation reduction at %i notes', noteCount => {
    const estimate = estimateK94Allocation(noteCount, 'month');
    expect(estimate.estimatedReductionPct).toBeGreaterThan(90);
    expect(estimate.currentTimelineCollections).toBe(1);
    expect(estimate.legacyTimelineCollections).toBeGreaterThan(30);
  });
});
