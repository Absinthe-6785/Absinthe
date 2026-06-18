/**
 * K-94 — Timeline graph build deduplication audit (test/dev only).
 *
 * Attributes legacy `(B + 1) × buildGlobalGraphData` frequency and models
 * post-dedupe edge collection counts for timeline + discover refresh paths.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildKnowledgeTimeline } from '@/components/views/features/knowledge/timeline/knowledgeTimeline';
import { buildPeriodBuckets } from '@/components/views/features/knowledge/timeline/timelineSnapshots';
import type { TimelinePeriodMode } from '@/components/views/features/knowledge/timeline/timelineTypes';
import { countVaultLinks, resolveCosmosVaultPhase } from '@/components/views/features/knowledge/cosmos/onboarding/cosmosVaultState';
import { buildCosmosEvolutionSummary } from '@/components/views/features/knowledge/history/historyEvolutionQueries';
import {
  collectGlobalGraphEdges,
  buildGlobalGraphData,
} from '@/components/views/features/knowledge/graph/buildGlobalGraphData';

export interface K94PolicySnapshot {
  timelineUsesSharedEdges: boolean;
  discoverUsesEdgeCount: boolean;
  evolutionUsesEdgeCount: boolean;
  exportsCollectGlobalGraphEdges: boolean;
}

export interface K94GraphBuildRow {
  noteCount: number;
  mode: TimelinePeriodMode;
  bucketCount: number;
  legacyTimelineGraphBuilds: number;
  currentTimelineEdgeCollections: number;
  legacyDiscoverGraphBuilds: number;
  currentDiscoverEdgeCollections: number;
  timelineReductionPct: number;
  discoverReductionPct: number;
  globalEdgeCount: number;
}

export interface K94AllocationEstimate {
  noteCount: number;
  mode: TimelinePeriodMode;
  bucketCount: number;
  legacyTimelineCollections: number;
  currentTimelineCollections: number;
  legacyTransientEdgeArrays: number;
  currentTransientEdgeArrays: number;
  estimatedLegacyBytes: number;
  estimatedCurrentBytes: number;
  estimatedReductionPct: number;
}

/** Fixed audit anchor — ~3 years of month buckets when notes are spread. */
export const K94_AUDIT_NOW = Date.parse('2026-06-13T12:00:00Z');
export const K94_HISTORY_SPAN_YEARS = 3;

const ESTIMATED_BYTES_PER_EDGE = 120;
const ESTIMATED_BYTES_PER_NODE = 96;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function featuresRoot(): string {
  return join(viewsRoot(), 'features', 'knowledge');
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

/** Spread note timestamps across a multi-year window for realistic bucket counts. */
export function spreadNotesAcrossHistory(
  notes: readonly NoteBase[],
  now: number,
  spanYears = K94_HISTORY_SPAN_YEARS,
): NoteBase[] {
  const spanMs = spanYears * 365 * 86_400_000;
  const start = now - spanMs;
  return notes.map((note, index) => {
    const createdAt = start + Math.floor((index / Math.max(notes.length - 1, 1)) * spanMs);
    return { ...note, createdAt, updatedAt: createdAt };
  });
}

/** Legacy model: one full graph build per bucket plus one evolution past snapshot. */
export function estimateLegacyTimelineGraphBuilds(bucketCount: number): number {
  return bucketCount + 1;
}

/** Current model: one shared edge collection per timeline refresh. */
export function estimateCurrentTimelineEdgeCollections(): number {
  return 1;
}

/** Legacy discover path built a full graph to read `.edges.length`. */
export function estimateLegacyDiscoverGraphBuilds(): number {
  return 1;
}

/** Current discover path uses index edge count (edge map only, no node array). */
export function estimateCurrentDiscoverEdgeCollections(): number {
  return 1;
}

export function readK94PolicySnapshot(): K94PolicySnapshot {
  const timelineSrc = readFileSync(
    join(featuresRoot(), 'timeline', 'knowledgeTimeline.ts'),
    'utf8',
  );
  const vaultSrc = readFileSync(
    join(featuresRoot(), 'cosmos', 'onboarding', 'cosmosVaultState.ts'),
    'utf8',
  );
  const evolutionSrc = readFileSync(
    join(featuresRoot(), 'history', 'historyEvolutionQueries.ts'),
    'utf8',
  );
  const graphIndexSrc = readFileSync(
    join(featuresRoot(), 'graph', 'index.ts'),
    'utf8',
  );

  return {
    timelineUsesSharedEdges: timelineSrc.includes('collectGlobalGraphEdges(service)')
      && timelineSrc.includes('graphEdges'),
    discoverUsesEdgeCount: vaultSrc.includes('getGlobalEdgeCount()')
      && !vaultSrc.includes('buildGlobalGraphData'),
    evolutionUsesEdgeCount: evolutionSrc.includes('getGlobalEdgeCount()'),
    exportsCollectGlobalGraphEdges: graphIndexSrc.includes('collectGlobalGraphEdges'),
  };
}

export function runK94GraphBuildRow(
  noteCount: number,
  mode: TimelinePeriodMode,
  now = K94_AUDIT_NOW,
): K94GraphBuildRow {
  const dataset = buildLargeVaultDataset({ noteCount });
  const notes = spreadNotesAcrossHistory(dataset.notes, now);
  const service = new KnowledgeIndexService();
  service.buildFromNotes(notes);

  const buckets = buildPeriodBuckets(notes, mode, now);
  const bucketCount = buckets.length;
  const legacyTimeline = estimateLegacyTimelineGraphBuilds(bucketCount);
  const currentTimeline = estimateCurrentTimelineEdgeCollections();
  const legacyDiscover = estimateLegacyDiscoverGraphBuilds();
  const currentDiscover = estimateCurrentDiscoverEdgeCollections();
  const globalEdgeCount = collectGlobalGraphEdges(service).length;

  void buildKnowledgeTimeline(notes, service, undefined, { mode, now });
  void resolveCosmosVaultPhase(notes, service, 0);
  void buildCosmosEvolutionSummary(notes, service, []);

  return {
    noteCount,
    mode,
    bucketCount,
    legacyTimelineGraphBuilds: legacyTimeline,
    currentTimelineEdgeCollections: currentTimeline,
    legacyDiscoverGraphBuilds: legacyDiscover,
    currentDiscoverEdgeCollections: currentDiscover,
    timelineReductionPct: pctReduction(legacyTimeline, currentTimeline),
    discoverReductionPct: pctReduction(legacyDiscover, currentDiscover),
    globalEdgeCount,
  };
}

/** Rough transient allocation model: each full graph build materializes edges + nodes. */
export function estimateK94Allocation(
  noteCount: number,
  mode: TimelinePeriodMode,
  now = K94_AUDIT_NOW,
): K94AllocationEstimate {
  const row = runK94GraphBuildRow(noteCount, mode, now);
  const edgeCount = row.globalEdgeCount;
  const legacyCollections = row.legacyTimelineGraphBuilds;
  const currentCollections = row.currentTimelineEdgeCollections;

  const bytesPerFullGraphBuild = edgeCount * ESTIMATED_BYTES_PER_EDGE
    + noteCount * ESTIMATED_BYTES_PER_NODE;
  const bytesPerEdgeCollection = edgeCount * ESTIMATED_BYTES_PER_EDGE;

  const estimatedLegacyBytes = legacyCollections * bytesPerFullGraphBuild;
  const estimatedCurrentBytes = currentCollections * bytesPerEdgeCollection;

  return {
    noteCount,
    mode,
    bucketCount: row.bucketCount,
    legacyTimelineCollections: legacyCollections,
    currentTimelineCollections: currentCollections,
    legacyTransientEdgeArrays: legacyCollections,
    currentTransientEdgeArrays: currentCollections,
    estimatedLegacyBytes,
    estimatedCurrentBytes,
    estimatedReductionPct: pctReduction(estimatedLegacyBytes, estimatedCurrentBytes),
  };
}

/** Verify shared-edge link counts match a one-off full graph build. */
export function verifySharedEdgeLinkCountEquivalence(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): boolean {
  const shared = collectGlobalGraphEdges(service);
  const full = buildGlobalGraphData({ service }).edges;
  if (shared.length !== full.length) return false;
  const activeIds = new Set(notes.filter(n => !n.deletedAt).map(n => n.id));
  const filterEdges = (edges: typeof shared) =>
    edges.filter(e => activeIds.has(e.sourceId) && activeIds.has(e.targetId)).length;
  return filterEdges(shared) === filterEdges(full);
}

export function countVaultLinksViaFullGraph(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): number {
  if (notes.filter(n => !n.deletedAt).length === 0) return 0;
  return buildGlobalGraphData({ service }).edges.length;
}
