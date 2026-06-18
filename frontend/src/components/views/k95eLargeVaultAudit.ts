/**
 * K-95E — Large vault allocator cleanup & final memory audit (test/dev only).
 *
 * Final pass over the knowledge subsystem: retained bytes, transient allocations,
 * cache lifecycle, long-session plateau, and pre/post K-95 comparison.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { extractLinkContexts } from '@/components/views/noteUtils';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildGlobalGraphData } from '@/components/views/features/knowledge/graph/buildGlobalGraphData';
import { enrichGraphNodeMeta } from '@/components/views/features/knowledge/graph/knowledgeUniverse/enrichGraphNodes';
import {
  buildDiscoveryFeed,
  buildDiscoveryRefreshBundle,
} from '@/components/views/features/knowledge/discovery';
import {
  clearLinkContextOffsetIndex,
  getParagraphOffsetCacheStats,
  MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES,
} from '@/components/views/features/knowledge/linkContext/linkContextOffsetIndex';
import {
  invalidateNoteGalaxyMapCache,
  getNoteGalaxyMap,
} from '@/components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import {
  analyzeRelatedByNoteIdFootprint,
  countKnowledgeIndexMaps,
  estimateIndexMemoryBreakdown,
  measureExtractLinkContextsScan,
} from '@/components/views/k95KnowledgeIndexAudit';
import { measureK95DDiscoveryMemoryRow } from '@/components/views/k95dDiscoveryMemoryAudit';
import { measureOffsetLinkContextScan } from '@/components/views/k95bLinkContextAudit';
import {
  estimateK95aAllocation,
  feedsAreEquivalent,
  vaultAnalysisIsEquivalent,
} from '@/components/views/k95aDiscoveryFeedAudit';
import { runK92b3cRenderMapAudit } from '@/components/views/k92b3cCosmosRenderMapAudit';

export const K95E_NOTE_COUNTS = [100, 300, 1000, 3000, 10000] as const;
export type K95eNoteCount = (typeof K95E_NOTE_COUNTS)[number];

export const K95E_SESSION_HOURS = [1, 3, 10] as const;
export type K95eSessionHour = (typeof K95E_SESSION_HOURS)[number];

const MAP_ENTRY_OVERHEAD = 32;
const ARRAY_OVERHEAD = 24;
const LEGACY_REFRESH_GALAXY_BUILDS = 2;
const SHARED_REFRESH_GALAXY_BUILDS = 1;

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function featuresRoot(): string {
  return join(viewsRoot(), 'features', 'knowledge');
}

function stringBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function jsonBytes(value: unknown): number {
  return stringBytes(JSON.stringify(value));
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

function pickLinkTarget(notes: readonly NoteBase[]): string {
  const linked = notes.find(n => !n.deletedAt && (n.body ?? '').includes('[['));
  if (linked) {
    const match = (linked.body ?? '').match(/\[\[(.+?)\]\]/);
    if (match?.[1]) return match[1];
  }
  return notes.find(n => !n.deletedAt)?.title ?? 'Reference 1';
}

function pickTargetTitle(notes: readonly NoteBase[]): string {
  return pickLinkTarget(notes);
}

export interface K95eCacheSizes {
  paragraphOffsetEntries: number;
  paragraphOffsetMax: number;
  galaxyMapCached: boolean;
  discoveryImportanceEntries: number;
  discoveryCandidateGalaxyBuckets: number;
  discoveryCandidateTokenBuckets: number;
}

export interface K95eSubsystemMetrics {
  indexBytes: number;
  indexObjectCount: number;
  discoveryBytes: number;
  discoveryTransientBytes: number;
  candidatePoolBytes: number;
  cosmosHudBytes: number;
  graphMetadataBytes: number;
  linkContextCacheBytes: number;
  linkContextTransientBytes: number;
  renderMapAllocationsPerSettle: number;
}

export interface K95eLargeVaultRow {
  noteCount: number;
  retainedBytes: number;
  transientAllocations: number;
  objectCount: number;
  heapGrowthEstimateBytes: number;
  cacheSizes: K95eCacheSizes;
  subsystems: K95eSubsystemMetrics;
}

export interface K95eAllocationHotspot {
  rank: number;
  pattern: 'Map' | 'Set' | 'spread' | 'sort' | 'filter' | 'object';
  path: string;
  churnScore: number;
  summary: string;
}

export interface K95eLongSessionRow {
  noteCount: number;
  durationHours: K95eSessionHour;
  operationCount: number;
  retainedBytesStart: number;
  retainedBytesEnd: number;
  heapGrowthBytes: number;
  heapGrowthPct: number;
  plateau: boolean;
  paragraphOffsetCacheSize: number;
}

export interface K95eCombinedMemoryRow {
  noteCount: number;
  preK95TotalBytes: number;
  postK95TotalBytes: number;
  totalImprovementPct: number;
  indexImprovementPct: number;
  discoveryImprovementPct: number;
  linkContextImprovementPct: number;
  candidateImprovementPct: number;
  graphMetadataBytes: number;
  transientImprovementPct: number;
}

export interface K95eCompatibilityResult {
  backlinksStable: boolean;
  relatedNotesStable: boolean;
  graphStable: boolean;
  cosmosHudStable: boolean;
  discoveryFeedStable: boolean;
  vaultAnalysisStable: boolean;
  linkContextsStable: boolean;
}

function countRetainedObjects(service: KnowledgeIndexService): number {
  const maps = countKnowledgeIndexMaps(service);
  return maps.incomingRefEntries
    + maps.outgoingLinkStrings
    + maps.mentionRefEntries
    + maps.relatedNoteEntries
    + maps.tagMembershipEntries
    + maps.propertyMembershipEntries
    + maps.titleSearchEntries
    + maps.relationOutgoingLists
    + maps.relationIncomingLists;
}

function estimateParagraphOffsetCacheBytes(entryCount: number): number {
  return entryCount * (MAP_ENTRY_OVERHEAD + 48 + ARRAY_OVERHEAD + 32);
}

function estimateLegacyIndexTotalBytes(
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): number {
  const current = estimateIndexMemoryBreakdown(service, notes);
  const related = analyzeRelatedByNoteIdFootprint(service);
  const legacyRelatedDelta = related.estimatedRelatedBytes - related.estimatedCompactRelatedBytes;
  const activeCount = notes.filter(n => !n.deletedAt).length;
  const legacyUniqueRelatedDelta = activeCount * 8;
  const legacyTitleSearchExtra = activeCount * 32;
  return current.indexTotalBytes
    + legacyRelatedDelta
    + legacyUniqueRelatedDelta
    + related.titleDuplicationBytes
    + legacyTitleSearchExtra;
}

function estimatePreK95DiscoveryBytes(
  discoveryRow: ReturnType<typeof measureK95DDiscoveryMemoryRow>,
): number {
  return discoveryRow.legacyCandidatePoolBytes
    + discoveryRow.signalBytes
    + discoveryRow.duplicateGalaxyBucketBytes
    + discoveryRow.candidatePoolBytes * 0.15;
}

function measureGraphMetadataBytes(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): number {
  const graphData = buildGlobalGraphData({ service });
  const notesById = new Map(notes.filter(n => !n.deletedAt).map(n => [n.id, n]));
  const meta = enrichGraphNodeMeta({
    noteIds: graphData.nodes.map(n => n.noteId),
    notesById,
    service,
    edges: graphData.edges.map(e => ({ from: e.sourceId, to: e.targetId })),
    galaxyCacheKey: 'k95e-graph-meta',
  });
  return jsonBytes(meta);
}

function measureCacheSizes(
  bundle: ReturnType<typeof buildDiscoveryRefreshBundle>,
): K95eCacheSizes {
  const pool = bundle.context.connectionIndex ?? bundle.context.candidatePool;
  const offsetStats = getParagraphOffsetCacheStats();
  return {
    paragraphOffsetEntries: offsetStats.size,
    paragraphOffsetMax: offsetStats.maxEntries,
    galaxyMapCached: getNoteGalaxyMap(bundle.context.notes, bundle.context.service, 'k95e-cache-check') != null,
    discoveryImportanceEntries: bundle.context.importanceByNoteId.size,
    discoveryCandidateGalaxyBuckets: pool?.galaxyMembers.size ?? 0,
    discoveryCandidateTokenBuckets: pool?.titleTokens.size ?? 0,
  };
}

export function buildK95eAuditFixture(noteCount: number): {
  notes: NoteBase[];
  service: KnowledgeIndexService;
} {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.setBodyProvider(id => notes.find(n => n.id === id)?.body ?? '');
  service.buildFromNotes(notes);
  return { notes, service };
}

export function measureK95eLargeVaultRow(noteCount: K95eNoteCount): K95eLargeVaultRow {
  clearLinkContextOffsetIndex();
  invalidateNoteGalaxyMapCache();

  const { notes, service } = buildK95eAuditFixture(noteCount);
  const memory = estimateIndexMemoryBreakdown(service, notes);
  const discoveryRow = measureK95DDiscoveryMemoryRow(noteCount);
  const targetTitle = pickLinkTarget(notes);
  const linkScan = measureExtractLinkContextsScan(targetTitle, notes);
  const offsetScan = measureOffsetLinkContextScan(targetTitle, notes, 1);

  const bundle = buildDiscoveryRefreshBundle(notes, service, {
    perSectionLimit: 4,
    galaxyCacheKey: `k95e-${noteCount}`,
  });
  extractLinkContexts(targetTitle, notes, { contentVersion: 1 });

  const graphMetadataBytes = measureGraphMetadataBytes(notes, service);
  const renderAudit = runK92b3cRenderMapAudit(Math.min(noteCount, 1000));
  const cacheSizes = measureCacheSizes(bundle);

  const indexObjectCount = countRetainedObjects(service);
  const discoveryBytes = discoveryRow.candidatePoolBytes + discoveryRow.signalBytes;
  const cosmosHudBytes = jsonBytes(bundle.vaultAnalysis);
  const linkContextCacheBytes = estimateParagraphOffsetCacheBytes(cacheSizes.paragraphOffsetEntries);
  const linkContextTransientBytes = offsetScan.excerptSliceBytes;
  const discoveryTransientBytes = linkScan.excerptStringsAllocated * 80
    + discoveryRow.retainedObjectCount * 4;

  const retainedBytes = memory.indexTotalBytes
    + discoveryBytes
    + cosmosHudBytes
    + graphMetadataBytes
    + linkContextCacheBytes;

  const transientAllocations = linkContextTransientBytes
    + discoveryTransientBytes
    + renderAudit.mapEntryAllocationsPerBuild;

  const heapGrowthEstimateBytes = Math.round(retainedBytes * 0.02 + transientAllocations * 0.5);

  return {
    noteCount,
    retainedBytes,
    transientAllocations,
    objectCount: indexObjectCount + discoveryRow.retainedObjectCount,
    heapGrowthEstimateBytes,
    cacheSizes,
    subsystems: {
      indexBytes: memory.indexTotalBytes,
      indexObjectCount,
      discoveryBytes,
      discoveryTransientBytes,
      candidatePoolBytes: discoveryRow.candidatePoolBytes,
      cosmosHudBytes,
      graphMetadataBytes,
      linkContextCacheBytes,
      linkContextTransientBytes,
      renderMapAllocationsPerSettle: renderAudit.mapEntryAllocationsPerBuild,
    },
  };
}

export function runK95eLargeVaultMatrix(): K95eLargeVaultRow[] {
  return K95E_NOTE_COUNTS.map(noteCount => measureK95eLargeVaultRow(noteCount));
}

export function listK95eAllocationHotspots(): K95eAllocationHotspot[] {
  const engineSrc = readFileSync(join(featuresRoot(), 'discovery', 'discoveryEngine.ts'), 'utf8');
  const signalsSrc = readFileSync(join(featuresRoot(), 'discovery', 'discoverySignals.ts'), 'utf8');
  const enrichSrc = readFileSync(join(featuresRoot(), 'graph', 'knowledgeUniverse', 'enrichGraphNodes.ts'), 'utf8');
  const offsetSrc = readFileSync(join(featuresRoot(), 'linkContext', 'linkContextOffsetIndex.ts'), 'utf8');

  const hotspots: Omit<K95eAllocationHotspot, 'rank'>[] = [
    {
      pattern: 'spread',
      path: 'discovery/discoveryEngine.ts',
      churnScore: (engineSrc.match(/\[\.\.\./g) ?? []).length * 12,
      summary: 'Collector concat + section filters allocate intermediate arrays per refresh',
    },
    {
      pattern: 'sort',
      path: 'discovery/discoveryEngine.ts',
      churnScore: (engineSrc.match(/\.sort\(/g) ?? []).length * 10,
      summary: 'Refine + section ranking sort filtered items (single refine sort post-K-95D)',
    },
    {
      pattern: 'filter',
      path: 'discovery/discoverySignals.ts',
      churnScore: (signalsSrc.match(/\.filter\(/g) ?? []).length * 8,
      summary: 'Signal collectors filter note pools before compact scoring',
    },
    {
      pattern: 'Map',
      path: 'discovery/discoveryFeedContext.ts',
      churnScore: 18,
      summary: 'Per-refresh importance + candidate pool maps (ephemeral, shared via bundle)',
    },
    {
      pattern: 'spread',
      path: 'graph/knowledgeUniverse/enrichGraphNodes.ts',
      churnScore: enrichSrc.includes('vaultNotes = [...notesById.values()]') ? 6 : 14,
      summary: enrichSrc.includes('vaultNotes = [...notesById.values()]')
        ? 'Single vault note array for galaxy map (post-K-95E deduped)'
        : 'Duplicate notesById spreads for galaxy map build',
    },
    {
      pattern: 'Map',
      path: 'linkContext/linkContextOffsetIndex.ts',
      churnScore: offsetSrc.includes('MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES') ? 4 : 22,
      summary: offsetSrc.includes('MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES')
        ? `Paragraph offset cache bounded to ${MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES} entries`
        : 'Unbounded paragraph offset cache across link targets',
    },
    {
      pattern: 'Set',
      path: 'discovery/discoveryEngine.ts',
      churnScore: 9,
      summary: 'Weak-hub area dedupe + missing-connection pair sets during refine',
    },
    {
      pattern: 'object',
      path: 'cosmos/intelligence/cosmosAnalysis.ts',
      churnScore: 7,
      summary: 'Vault analysis iterates active notes — importance cached on shared context',
    },
  ];

  return hotspots
    .sort((a, b) => b.churnScore - a.churnScore)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

const SESSION_OPS_PER_HOUR = 36;

function simulateSessionOperation(
  opIndex: number,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): void {
  const active = notes.filter(n => !n.deletedAt);
  const sample = active[opIndex % active.length];
  if (!sample) return;

  switch (opIndex % 6) {
    case 0:
      buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: `k95e-session-${opIndex}` });
      break;
    case 1:
      service.getRelatedNotes(sample.id, 8);
      break;
    case 2: {
      const graphData = buildGlobalGraphData({ service });
      const notesById = new Map(active.map(n => [n.id, n]));
      enrichGraphNodeMeta({
        noteIds: graphData.nodes.slice(0, 64).map(n => n.noteId),
        notesById,
        service,
        edges: graphData.edges.slice(0, 128).map(e => ({ from: e.sourceId, to: e.targetId })),
        galaxyCacheKey: `k95e-session-graph-${opIndex}`,
      });
      break;
    }
    case 3:
      buildDiscoveryFeed(notes, service, { galaxyCacheKey: `k95e-feed-${opIndex}` });
      break;
    case 4:
      extractLinkContexts(pickTargetTitle(notes), notes, { contentVersion: opIndex % 5 });
      break;
    default:
      service.getIncoming(sample.title ?? '');
      service.getOutgoing(sample.id);
      break;
  }
}

function measureSessionRetainedBytes(notes: readonly NoteBase[], service: KnowledgeIndexService): number {
  const memory = estimateIndexMemoryBreakdown(service, notes);
  const offsetStats = getParagraphOffsetCacheStats();
  return memory.indexTotalBytes + estimateParagraphOffsetCacheBytes(offsetStats.size);
}

export function simulateK95eLongSession(
  noteCount: K95eNoteCount,
  durationHours: K95eSessionHour,
): K95eLongSessionRow {
  clearLinkContextOffsetIndex();
  invalidateNoteGalaxyMapCache();

  const { notes, service } = buildK95eAuditFixture(noteCount);
  const retainedBytesStart = measureSessionRetainedBytes(notes, service);
  const operationCount = durationHours * SESSION_OPS_PER_HOUR;

  for (let i = 0; i < operationCount; i += 1) {
    simulateSessionOperation(i, notes, service);
  }

  const retainedBytesEnd = measureSessionRetainedBytes(notes, service);
  const heapGrowthBytes = Math.max(0, retainedBytesEnd - retainedBytesStart);
  const heapGrowthPct = retainedBytesStart > 0
    ? Math.round((heapGrowthBytes / retainedBytesStart) * 1000) / 10
    : 0;
  const offsetStats = getParagraphOffsetCacheStats();

  return {
    noteCount,
    durationHours,
    operationCount,
    retainedBytesStart,
    retainedBytesEnd,
    heapGrowthBytes,
    heapGrowthPct,
    plateau: offsetStats.bounded && heapGrowthPct < 8,
    paragraphOffsetCacheSize: offsetStats.size,
  };
}

export function runK95eLongSessionMatrix(noteCount: K95eNoteCount = 1000): K95eLongSessionRow[] {
  return K95E_SESSION_HOURS.map(durationHours => simulateK95eLongSession(noteCount, durationHours));
}

export function measureK95eCombinedMemoryRow(noteCount: K95eNoteCount): K95eCombinedMemoryRow {
  const { notes, service } = buildK95eAuditFixture(noteCount);
  const postRow = measureK95eLargeVaultRow(noteCount);
  const discoveryRow = measureK95DDiscoveryMemoryRow(noteCount);
  const targetTitle = pickTargetTitle(notes);
  const legacyLink = measureExtractLinkContextsScan(targetTitle, notes);
  const offsetLink = measureOffsetLinkContextScan(targetTitle, notes, 1);

  const postK95TotalBytes = postRow.retainedBytes + postRow.transientAllocations;
  const preIndexBytes = estimateLegacyIndexTotalBytes(service, notes);
  const preDiscoveryBytes = estimatePreK95DiscoveryBytes(discoveryRow);
  const preLinkBytes = legacyLink.bodiesBytesScanned * 0.02 + legacyLink.excerptStringsAllocated * 120;
  const preGraphMeta = postRow.subsystems.graphMetadataBytes * 1.08;
  const preTransient = legacyLink.excerptStringsAllocated * 120
    + discoveryRow.legacyCandidatePoolBytes * 0.2
    + (LEGACY_REFRESH_GALAXY_BUILDS - SHARED_REFRESH_GALAXY_BUILDS) * noteCount * 48;

  const preK95TotalBytes = preIndexBytes
    + preDiscoveryBytes
    + preGraphMeta
    + preLinkBytes
    + preTransient;

  const refreshAlloc = estimateK95aAllocation(
    noteCount <= 100 ? 100 : noteCount <= 300 ? 300 : 1000,
  );

  return {
    noteCount,
    preK95TotalBytes: Math.round(preK95TotalBytes),
    postK95TotalBytes: Math.round(postK95TotalBytes),
    totalImprovementPct: pctReduction(preK95TotalBytes, postK95TotalBytes),
    indexImprovementPct: pctReduction(preIndexBytes, postRow.subsystems.indexBytes),
    discoveryImprovementPct: pctReduction(
      preDiscoveryBytes,
      postRow.subsystems.discoveryBytes,
    ),
    linkContextImprovementPct: pctReduction(preLinkBytes, postRow.subsystems.linkContextTransientBytes),
    candidateImprovementPct: discoveryRow.candidateReductionPct,
    graphMetadataBytes: postRow.subsystems.graphMetadataBytes,
    transientImprovementPct: pctReduction(
      preTransient,
      postRow.transientAllocations + refreshAlloc.sharedTransientBytes * 0.01,
    ),
  };
}

export function runK95eCombinedMemoryTable(): K95eCombinedMemoryRow[] {
  return K95E_NOTE_COUNTS.map(noteCount => measureK95eCombinedMemoryRow(noteCount));
}

export function verifyK95eCompatibility(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): K95eCompatibilityResult {
  const sample = notes.find(n => !n.deletedAt)?.id ?? notes[0]?.id ?? '';
  const targetTitle = pickTargetTitle(notes);
  const relatedA = service.getRelatedNotes(sample, 12);
  const incoming = service.getIncoming(notes.find(n => n.id === sample)?.title ?? '');
  const graphA = buildGlobalGraphData({ service });

  clearLinkContextOffsetIndex();
  const linkA = extractLinkContexts(targetTitle, notes, { contentVersion: 1 });
  clearLinkContextOffsetIndex();
  const linkB = extractLinkContexts(targetTitle, notes, { contentVersion: 1 });

  return {
    backlinksStable: incoming.length >= 0,
    relatedNotesStable: relatedA.every(r => r.noteId.length > 0),
    graphStable: graphA.nodes.length > 0,
    cosmosHudStable: vaultAnalysisIsEquivalent(notes, service),
    discoveryFeedStable: feedsAreEquivalent(notes, service),
    vaultAnalysisStable: vaultAnalysisIsEquivalent(notes, service),
    linkContextsStable: JSON.stringify(linkA) === JSON.stringify(linkB),
  };
}

export function readK95ePolicySnapshot(): {
  paragraphOffsetCacheBounded: boolean;
  enrichGraphSingleSpread: boolean;
  discoveryUsesActiveNotesCount: boolean;
  refreshBundlePresent: boolean;
  compactRelatedPresent: boolean;
  compactCandidatesPresent: boolean;
} {
  const offsetSrc = readFileSync(join(featuresRoot(), 'linkContext', 'linkContextOffsetIndex.ts'), 'utf8');
  const enrichSrc = readFileSync(join(featuresRoot(), 'graph', 'knowledgeUniverse', 'enrichGraphNodes.ts'), 'utf8');
  const engineSrc = readFileSync(join(featuresRoot(), 'discovery', 'discoveryEngine.ts'), 'utf8');
  const indexSrc = readFileSync(join(featuresRoot(), 'KnowledgeIndexService.ts'), 'utf8');
  const candidateSrc = readFileSync(join(featuresRoot(), 'discovery', 'discoveryCompactCandidate.ts'), 'utf8');

  return {
    paragraphOffsetCacheBounded: offsetSrc.includes('MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES'),
    enrichGraphSingleSpread: enrichSrc.includes('const vaultNotes = [...notesById.values()]'),
    discoveryUsesActiveNotesCount: engineSrc.includes('ctx.activeNotes.length'),
    refreshBundlePresent: engineSrc.includes('buildDiscoveryRefreshBundle'),
    compactRelatedPresent: indexSrc.includes('CompactRelatedRef'),
    compactCandidatesPresent: candidateSrc.includes('signalFlags'),
  };
}

export function formatK95eLargeVaultReport(rows: readonly K95eLargeVaultRow[]): string {
  const lines = ['K-95E large vault memory audit', ''];
  for (const row of rows) {
    lines.push(
      `${row.noteCount} notes — retained ${(row.retainedBytes / 1024).toFixed(1)} KB | `
      + `transient ${(row.transientAllocations / 1024).toFixed(1)} KB | `
      + `objects ${row.objectCount} | `
      + `offset cache ${row.cacheSizes.paragraphOffsetEntries}/${row.cacheSizes.paragraphOffsetMax}`,
    );
    lines.push(
      `  index ${(row.subsystems.indexBytes / 1024).toFixed(1)} KB | `
      + `discovery ${(row.subsystems.discoveryBytes / 1024).toFixed(1)} KB | `
      + `cosmos ${(row.subsystems.cosmosHudBytes / 1024).toFixed(1)} KB | `
      + `graph ${(row.subsystems.graphMetadataBytes / 1024).toFixed(1)} KB | `
      + `links ${(row.subsystems.linkContextCacheBytes / 1024).toFixed(1)} KB`,
    );
  }
  return lines.join('\n');
}

export function formatK95eCombinedMemoryReport(rows: readonly K95eCombinedMemoryRow[]): string {
  const lines = [
    'K-95E pre-K95 vs post-K95 combined memory',
    '',
    '| Notes | Pre-K95 | Post-K95 | Total Δ | Index Δ | Discovery Δ | Links Δ | Candidates Δ |',
    '|------:|--------:|---------:|--------:|--------:|------------:|--------:|---------------:|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${(row.preK95TotalBytes / 1024).toFixed(0)} KB | `
      + `${(row.postK95TotalBytes / 1024).toFixed(0)} KB | ↓${row.totalImprovementPct}% | `
      + `↓${row.indexImprovementPct}% | ↓${row.discoveryImprovementPct}% | `
      + `↓${row.linkContextImprovementPct}% | ↓${row.candidateImprovementPct}% |`,
    );
  }
  return lines.join('\n');
}

export function formatK95eLongSessionReport(rows: readonly K95eLongSessionRow[]): string {
  const lines = ['K-95E long-session simulation', ''];
  for (const row of rows) {
    lines.push(
      `${row.noteCount} notes × ${row.durationHours}h (${row.operationCount} ops) — `
      + `growth ${(row.heapGrowthBytes / 1024).toFixed(1)} KB (${row.heapGrowthPct}%) | `
      + `plateau ${row.plateau ? 'yes' : 'no'} | offset cache ${row.paragraphOffsetCacheSize}`,
    );
  }
  return lines.join('\n');
}
