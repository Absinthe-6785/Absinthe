/**
 * K-95 — Knowledge index memory footprint audit (test/dev only).
 *
 * Attributes retained heap for KnowledgeIndexService maps, Zustand note bodies,
 * extractLinkContexts scans, and discovery feed allocations.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { extractLinkContexts, noteReferencesTitle } from '@/components/views/noteUtils';
import {
  KnowledgeIndexService,
} from '@/components/views/features/knowledge/KnowledgeIndexService';
import { decodeRelatedReasonFlags, type CompactRelatedRef } from '@/components/views/features/knowledge/related/relatedCompactRef';
import type { RelationEdge } from '@/components/views/features/knowledge/relations/relationModels';
import { buildDiscoveryFeed } from '@/components/views/features/knowledge/discovery/discoveryEngine';
import { buildCosmosVaultAnalysis } from '@/components/views/features/knowledge/cosmos/intelligence/cosmosAnalysis';
import { collectMissingConnectionSignals } from '@/components/views/features/knowledge/discovery/discoverySignals';
import { createDiscoveryFeedContext } from '@/components/views/features/knowledge/discovery/discoveryFeedContext';
import { getNoteGalaxyMap } from '@/components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';

export const K95_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K95NoteCount = (typeof K95_NOTE_COUNTS)[number];

const MAP_ENTRY_OVERHEAD = 32;
const OBJECT_OVERHEAD = 48;
const ARRAY_OVERHEAD = 24;

/** Soft-private KnowledgeIndexService fields — readable at runtime in Vitest. */
interface IndexInternals {
  incomingByTitle: Map<string, Set<string>>;
  outgoingByNoteId: Map<string, string[]>;
  mentionsByTargetId: Map<string, Set<string>>;
  mentionsFromSourceId: Map<string, string[]>;
  relatedByNoteId: Map<string, CompactRelatedRef[]>;
  notesByTag: Map<string, Map<string, string>>;
  tagsByNoteId: Map<string, readonly string[]>;
  notesByProperty: Map<string, Map<string, Set<string>>>;
  propertyValueLabels: Map<string, Map<string, string>>;
  titleSearchIndex: string[];
  activeNotes: Map<string, { title: string; updatedAt: number }>;
  propertiesByNoteId: Map<string, Readonly<Record<string, string>>>;
  noteIdByTitleKey: Map<string, string>;
  tagMembersByTitle: Map<string, string[]>;
  outgoingRelationsByNoteId: Map<string, RelationEdge[]>;
  incomingRelationsByTargetId: Map<string, RelationEdge[]>;
  notesWithOutgoingRelationKey: Map<string, Set<string>>;
}

export interface K95IndexMapCounts {
  incomingTitleBuckets: number;
  incomingRefEntries: number;
  outgoingNotes: number;
  outgoingLinkStrings: number;
  mentionTargetBuckets: number;
  mentionRefEntries: number;
  mentionSourceLists: number;
  relatedNoteLists: number;
  relatedNoteEntries: number;
  uniqueRelatedEntries: number;
  tagKeys: number;
  tagMembershipEntries: number;
  propertyKeys: number;
  propertyMembershipEntries: number;
  titleSearchEntries: number;
  activeNoteEntries: number;
  relationOutgoingLists: number;
  relationIncomingLists: number;
}

export interface K95MemoryBreakdown {
  noteCount: number;
  notesBodiesBytes: number;
  notesMetadataBytes: number;
  indexTotalBytes: number;
  backlinksBytes: number;
  mentionsBytes: number;
  relatedByNoteIdBytes: number;
  uniqueRelatedCountBytes: number;
  tagsBytes: number;
  propertiesBytes: number;
  titleIndexBytes: number;
  relationsBytes: number;
  activeNotesMetaBytes: number;
  otherIndexBytes: number;
}

export interface K95RelatedFootprint {
  noteCount: number;
  relatedLists: number;
  relatedEntries: number;
  avgNeighborsPerNote: number;
  maxNeighbors: number;
  uniqueRelatedEntries: number;
  avgUniqueRelated: number;
  estimatedRelatedBytes: number;
  estimatedCompactRelatedBytes: number;
  compactReductionPct: number;
  titleDuplicationBytes: number;
}

export interface K95LinkContextScanMetrics {
  noteCount: number;
  targetTitle: string;
  notesScanned: number;
  bodiesBytesScanned: number;
  matchingNotes: number;
  excerptStringsAllocated: number;
  resultBytes: number;
  scanMs: number;
}

export interface K95DiscoveryMemoryRow {
  noteCount: number;
  feedItems: number;
  feedRetainedBytes: number;
  rawCandidateCount: number;
  vaultAnalysisBytes: number;
  connectionSignalCount: number;
  connectionSignalBytes: number;
  galaxyMapBuilt: boolean;
}

export interface K95OptimizationOpportunity {
  id: string;
  area: 'index' | 'links-tab' | 'discovery' | 'rebuild';
  retainedHeapReductionPct: number;
  allocationReductionPct: number;
  complexity: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  summary: string;
}

export interface K95BenchmarkRow {
  noteCount: K95NoteCount;
  mapCounts: K95IndexMapCounts;
  memory: K95MemoryBreakdown;
  related: K95RelatedFootprint;
  linkContext: K95LinkContextScanMetrics;
  discovery: K95DiscoveryMemoryRow;
}

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

function readInternals(service: KnowledgeIndexService): IndexInternals {
  return service as unknown as IndexInternals;
}

function countNestedSetEntries<K>(map: Map<K, Set<string>>): number {
  let total = 0;
  for (const bucket of map.values()) total += bucket.size;
  return total;
}

function countNestedMapEntries<K, V>(map: Map<K, Map<string, V>>): number {
  let total = 0;
  for (const bucket of map.values()) total += bucket.size;
  return total;
}

function countStringListEntries(map: Map<string, string[]>): number {
  let total = 0;
  for (const list of map.values()) total += list.length;
  return total;
}

export function countKnowledgeIndexMaps(service: KnowledgeIndexService): K95IndexMapCounts {
  const idx = readInternals(service);
  let relatedEntries = 0;
  let maxRelated = 0;
  for (const list of idx.relatedByNoteId.values()) {
    relatedEntries += list.length;
    maxRelated = Math.max(maxRelated, list.length);
  }
  void maxRelated;

  let propertyMembership = 0;
  for (const values of idx.notesByProperty.values()) {
    for (const noteIds of values.values()) propertyMembership += noteIds.size;
  }

  let relationOutgoing = 0;
  for (const edges of idx.outgoingRelationsByNoteId.values()) relationOutgoing += edges.length;
  let relationIncoming = 0;
  for (const edges of idx.incomingRelationsByTargetId.values()) relationIncoming += edges.length;

  return {
    incomingTitleBuckets: idx.incomingByTitle.size,
    incomingRefEntries: countNestedSetEntries(idx.incomingByTitle),
    outgoingNotes: idx.outgoingByNoteId.size,
    outgoingLinkStrings: countStringListEntries(idx.outgoingByNoteId),
    mentionTargetBuckets: idx.mentionsByTargetId.size,
    mentionRefEntries: countNestedSetEntries(idx.mentionsByTargetId),
    mentionSourceLists: idx.mentionsFromSourceId.size,
    relatedNoteLists: idx.relatedByNoteId.size,
    relatedNoteEntries: relatedEntries,
    uniqueRelatedEntries: idx.activeNotes.size,
    tagKeys: idx.notesByTag.size,
    tagMembershipEntries: countNestedMapEntries(idx.notesByTag),
    propertyKeys: idx.notesByProperty.size,
    propertyMembershipEntries: propertyMembership,
    titleSearchEntries: idx.titleSearchIndex.length,
    activeNoteEntries: idx.activeNotes.size,
    relationOutgoingLists: relationOutgoing,
    relationIncomingLists: relationIncoming,
  };
}


function estimateCompactRelatedNoteBytes(): number {
  return 24;
}

function estimateLegacyRelatedNoteBytes(
  related: CompactRelatedRef,
  title: string,
): number {
  let bytes = OBJECT_OVERHEAD + stringBytes(related.noteId) + stringBytes(title) + 8;
  const reasons = decodeRelatedReasonFlags(related.reasonFlags);
  bytes += ARRAY_OVERHEAD + reasons.length * 24;
  for (const reason of reasons) bytes += stringBytes(reason);
  return bytes;
}

function estimateStoredCompactRelatedBytes(related: CompactRelatedRef): number {
  return estimateCompactRelatedNoteBytes() + stringBytes(related.noteId);
}

export function estimateNotesStoreBytes(notes: readonly NoteBase[]): {
  bodiesBytes: number;
  metadataBytes: number;
} {
  let bodiesBytes = 0;
  let metadataBytes = 0;
  for (const note of notes) {
    if (note.deletedAt) continue;
    bodiesBytes += stringBytes(note.body ?? '');
    metadataBytes += jsonBytes({
      id: note.id,
      title: note.title,
      folderId: note.folderId,
      properties: note.properties,
      relations: note.relations,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    });
  }
  return { bodiesBytes, metadataBytes };
}

export function estimateIndexMemoryBreakdown(
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): K95MemoryBreakdown {
  const idx = readInternals(service);
  const noteCount = idx.activeNotes.size;

  let backlinksBytes = idx.incomingByTitle.size * MAP_ENTRY_OVERHEAD;
  for (const bucket of idx.incomingByTitle.values()) {
    backlinksBytes += bucket.size * (MAP_ENTRY_OVERHEAD + 12);
    for (const sourceId of bucket) backlinksBytes += stringBytes(sourceId);
  }

  let outgoingBytes = idx.outgoingByNoteId.size * MAP_ENTRY_OVERHEAD;
  for (const titles of idx.outgoingByNoteId.values()) {
    outgoingBytes += ARRAY_OVERHEAD + titles.length * 24;
    for (const title of titles) outgoingBytes += stringBytes(title);
  }
  backlinksBytes += outgoingBytes;

  let mentionsBytes = idx.mentionsByTargetId.size * MAP_ENTRY_OVERHEAD;
  for (const bucket of idx.mentionsByTargetId.values()) {
    mentionsBytes += bucket.size * (MAP_ENTRY_OVERHEAD + 12);
    for (const sourceId of bucket) mentionsBytes += stringBytes(sourceId);
  }
  for (const targets of idx.mentionsFromSourceId.values()) {
    mentionsBytes += ARRAY_OVERHEAD + targets.length * 12;
  }

  let relatedBytes = idx.relatedByNoteId.size * MAP_ENTRY_OVERHEAD;
  for (const list of idx.relatedByNoteId.values()) {
    relatedBytes += ARRAY_OVERHEAD;
    for (const rel of list) relatedBytes += estimateStoredCompactRelatedBytes(rel);
  }

  const uniqueRelatedBytes = 0;

  let tagsBytes = idx.notesByTag.size * MAP_ENTRY_OVERHEAD;
  for (const bucket of idx.notesByTag.values()) {
    tagsBytes += bucket.size * MAP_ENTRY_OVERHEAD;
    for (const display of bucket.values()) tagsBytes += stringBytes(display);
  }
  for (const tags of idx.tagsByNoteId.values()) {
    tagsBytes += ARRAY_OVERHEAD;
    for (const tag of tags) tagsBytes += stringBytes(tag);
  }
  for (const members of idx.tagMembersByTitle.values()) {
    tagsBytes += ARRAY_OVERHEAD + members.length * 12;
  }

  let propertiesBytes = idx.notesByProperty.size * MAP_ENTRY_OVERHEAD;
  for (const values of idx.notesByProperty.values()) {
    propertiesBytes += values.size * MAP_ENTRY_OVERHEAD;
    for (const noteIds of values.values()) {
      propertiesBytes += OBJECT_OVERHEAD + noteIds.size * 12;
    }
  }
  for (const props of idx.propertiesByNoteId.values()) {
    propertiesBytes += jsonBytes(props);
  }

  let titleIndexBytes = ARRAY_OVERHEAD + idx.titleSearchIndex.length * 12;
  for (const noteId of idx.titleSearchIndex) titleIndexBytes += stringBytes(noteId);

  let relationsBytes = 0;
  for (const edges of idx.outgoingRelationsByNoteId.values()) {
    relationsBytes += ARRAY_OVERHEAD + edges.length * 80;
  }
  for (const edges of idx.incomingRelationsByTargetId.values()) {
    relationsBytes += ARRAY_OVERHEAD + edges.length * 80;
  }

  let activeNotesMetaBytes = idx.activeNotes.size * MAP_ENTRY_OVERHEAD;
  for (const meta of idx.activeNotes.values()) {
    activeNotesMetaBytes += OBJECT_OVERHEAD + stringBytes(meta.title) + 8;
  }

  activeNotesMetaBytes += idx.noteIdByTitleKey.size * (MAP_ENTRY_OVERHEAD + 24);

  const { bodiesBytes, metadataBytes } = estimateNotesStoreBytes(notes);
  const indexTotalBytes = backlinksBytes + mentionsBytes + relatedBytes + uniqueRelatedBytes
    + tagsBytes + propertiesBytes + titleIndexBytes + relationsBytes + activeNotesMetaBytes;

  return {
    noteCount,
    notesBodiesBytes: bodiesBytes,
    notesMetadataBytes: metadataBytes,
    indexTotalBytes,
    backlinksBytes,
    mentionsBytes,
    relatedByNoteIdBytes: relatedBytes,
    uniqueRelatedCountBytes: uniqueRelatedBytes,
    tagsBytes,
    propertiesBytes,
    titleIndexBytes,
    relationsBytes,
    activeNotesMetaBytes,
    otherIndexBytes: 0,
  };
}

export function analyzeRelatedByNoteIdFootprint(service: KnowledgeIndexService): K95RelatedFootprint {
  const idx = readInternals(service);
  const noteCount = idx.activeNotes.size;
  let relatedEntries = 0;
  let maxNeighbors = 0;
  let titleDuplicationBytes = 0;
  let estimatedLegacyRelatedBytes = idx.relatedByNoteId.size * MAP_ENTRY_OVERHEAD;
  let estimatedCompactRelatedBytes = idx.relatedByNoteId.size * MAP_ENTRY_OVERHEAD;

  for (const list of idx.relatedByNoteId.values()) {
    relatedEntries += list.length;
    maxNeighbors = Math.max(maxNeighbors, list.length);
    estimatedLegacyRelatedBytes += ARRAY_OVERHEAD;
    estimatedCompactRelatedBytes += ARRAY_OVERHEAD;
    for (const rel of list) {
      const title = idx.activeNotes.get(rel.noteId)?.title ?? '';
      estimatedLegacyRelatedBytes += estimateLegacyRelatedNoteBytes(rel, title);
      estimatedCompactRelatedBytes += estimateStoredCompactRelatedBytes(rel);
    }
  }

  for (const bucket of idx.incomingByTitle.values()) {
    for (const sourceId of bucket) {
      titleDuplicationBytes += stringBytes(idx.activeNotes.get(sourceId)?.title ?? '');
    }
  }
  for (const bucket of idx.mentionsByTargetId.values()) {
    for (const sourceId of bucket) {
      titleDuplicationBytes += stringBytes(idx.activeNotes.get(sourceId)?.title ?? '');
    }
  }

  let uniqueSum = 0;
  for (const noteId of idx.activeNotes.keys()) {
    uniqueSum += service.deriveUniqueRelatedCount(noteId);
  }

  return {
    noteCount,
    relatedLists: idx.relatedByNoteId.size,
    relatedEntries,
    avgNeighborsPerNote: noteCount > 0 ? Math.round((relatedEntries / noteCount) * 100) / 100 : 0,
    maxNeighbors,
    uniqueRelatedEntries: idx.activeNotes.size,
    avgUniqueRelated: noteCount > 0 ? Math.round((uniqueSum / noteCount) * 100) / 100 : 0,
    estimatedRelatedBytes: estimatedLegacyRelatedBytes,
    estimatedCompactRelatedBytes,
    compactReductionPct: pctReduction(estimatedLegacyRelatedBytes, estimatedCompactRelatedBytes),
    titleDuplicationBytes,
  };
}

export function measureExtractLinkContextsScan(
  targetTitle: string,
  notes: readonly NoteBase[],
): K95LinkContextScanMetrics {
  const active = notes.filter(n => !n.deletedAt);
  const start = performance.now();
  let notesScanned = 0;
  let bodiesBytesScanned = 0;
  let matchingNotes = 0;
  let excerptStringsAllocated = 0;

  for (const note of active) {
    notesScanned += 1;
    const body = note.body ?? '';
    bodiesBytesScanned += stringBytes(body);
    if (!noteReferencesTitle(body, targetTitle)) continue;
    matchingNotes += 1;
    const paragraphs = body.split(/\n{2,}/);
    excerptStringsAllocated += Math.min(paragraphs.length, 2);
  }

  const result = extractLinkContexts(targetTitle, [...notes]);
  const scanMs = performance.now() - start;

  return {
    noteCount: active.length,
    targetTitle,
    notesScanned,
    bodiesBytesScanned,
    matchingNotes,
    excerptStringsAllocated,
    resultBytes: jsonBytes(result),
    scanMs: Math.round(scanMs * 100) / 100,
  };
}

export function measureDiscoveryFeedMemory(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  now = Date.now(),
): K95DiscoveryMemoryRow {
  const galaxyMap = getNoteGalaxyMap(notes, service);
  const ctx = createDiscoveryFeedContext(notes, service, galaxyMap, now);
  const connectionSignals = collectMissingConnectionSignals(notes, service, galaxyMap, ctx);
  const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 4, galaxyCacheKey: 'k95-audit' });
  const analysis = buildCosmosVaultAnalysis(notes, service);

  return {
    noteCount: notes.filter(n => !n.deletedAt).length,
    feedItems: feed.items.length,
    feedRetainedBytes: jsonBytes(feed),
    rawCandidateCount: feed.summary.totalCount,
    vaultAnalysisBytes: jsonBytes(analysis),
    connectionSignalCount: connectionSignals.length,
    connectionSignalBytes: jsonBytes(connectionSignals),
    galaxyMapBuilt: galaxyMap.size > 0,
  };
}

export function listK95OptimizationOpportunities(): K95OptimizationOpportunity[] {
  return [
    {
      id: 'related-compact-storage',
      area: 'index',
      retainedHeapReductionPct: 35,
      allocationReductionPct: 10,
      complexity: 'medium',
      risk: 'medium',
      summary: 'Store structural neighbors as compact tuples (noteId + score + reason flags) and resolve titles from activeNotes on read.',
    },
    {
      id: 'related-lazy-generation',
      area: 'index',
      retainedHeapReductionPct: 25,
      allocationReductionPct: 15,
      complexity: 'high',
      risk: 'medium',
      summary: 'Lazy-build relatedByNoteId on first getRelatedNotes access with LRU cap instead of full vault precompute.',
    },
    {
      id: 'unique-related-derived',
      area: 'index',
      retainedHeapReductionPct: 2,
      allocationReductionPct: 5,
      complexity: 'low',
      risk: 'low',
      summary: 'Derive uniqueRelatedCount from structural length + tag touch formula on demand; drop parallel Map.',
    },
    {
      id: 'link-context-index',
      area: 'links-tab',
      retainedHeapReductionPct: 0,
      allocationReductionPct: 85,
      complexity: 'medium',
      risk: 'medium',
      summary: 'Cache paragraph offsets for wiki targets in the index; extractLinkContexts reads slices instead of scanning all bodies.',
    },
    {
      id: 'link-context-incremental',
      area: 'links-tab',
      retainedHeapReductionPct: 0,
      allocationReductionPct: 70,
      complexity: 'high',
      risk: 'medium',
      summary: 'Invalidate per-target excerpt cache on note body edit; avoid full vault rescan when Links tab opens.',
    },
    {
      id: 'discovery-context-reuse',
      area: 'discovery',
      retainedHeapReductionPct: 5,
      allocationReductionPct: 40,
      complexity: 'low',
      risk: 'low',
      summary: 'Share one DiscoveryFeedContext + galaxyMap between dashboard, Cosmos HUD, and palette (partially done in K-89B2B).',
    },
    {
      id: 'discovery-signal-cap',
      area: 'discovery',
      retainedHeapReductionPct: 10,
      allocationReductionPct: 25,
      complexity: 'medium',
      risk: 'medium',
      summary: 'Cap raw missing-connection candidate generation before refineDiscoveryItems to reduce transient arrays.',
    },
    {
      id: 'index-incremental-neighbor-scope',
      area: 'rebuild',
      retainedHeapReductionPct: 0,
      allocationReductionPct: 50,
      complexity: 'medium',
      risk: 'medium',
      summary: 'On single-note update, rebuild relatedByNoteId only for structural neighbors instead of tag-wide fan-out.',
    },
  ];
}

export function rankK95MemoryConsumers(row: K95BenchmarkRow): { id: string; bytes: number; sharePct: number }[] {
  const total = row.memory.notesBodiesBytes
    + row.memory.notesMetadataBytes
    + row.memory.indexTotalBytes
    + row.discovery.feedRetainedBytes
    + row.discovery.vaultAnalysisBytes;

  const entries = [
    { id: 'zustand-note-bodies', bytes: row.memory.notesBodiesBytes },
    { id: 'knowledge-index-total', bytes: row.memory.indexTotalBytes },
    { id: 'zustand-note-metadata', bytes: row.memory.notesMetadataBytes },
    { id: 'index-relatedByNoteId', bytes: row.memory.relatedByNoteIdBytes },
    { id: 'index-mentions', bytes: row.memory.mentionsBytes },
    { id: 'index-backlinks', bytes: row.memory.backlinksBytes },
    { id: 'index-tags', bytes: row.memory.tagsBytes },
    { id: 'index-titleSearchIndex', bytes: row.memory.titleIndexBytes },
    { id: 'index-properties', bytes: row.memory.propertiesBytes },
    { id: 'discovery-feed-retained', bytes: row.discovery.feedRetainedBytes },
    { id: 'cosmos-vault-analysis', bytes: row.discovery.vaultAnalysisBytes },
  ].sort((a, b) => b.bytes - a.bytes);

  return entries.map(entry => ({
    ...entry,
    sharePct: total > 0 ? Math.round((entry.bytes / total) * 1000) / 10 : 0,
  }));
}

export function readK95PolicySnapshot(): {
  indexUsesBodyProvider: boolean;
  linksTabGatePresent: boolean;
  discoveryFeedDedupeComment: boolean;
} {
  const indexSrc = readFileSync(join(featuresRoot(), 'KnowledgeIndexService.ts'), 'utf8');
  const noteViewSrc = readFileSync(join(viewsRoot(), 'NoteView.tsx'), 'utf8');
  const paletteSrc = readFileSync(join(featuresRoot(), 'components', 'WorkspaceSearchPalette.tsx'), 'utf8');

  return {
    indexUsesBodyProvider: indexSrc.includes('setBodyProvider') && indexSrc.includes('bodyProvider'),
    linksTabGatePresent: noteViewSrc.includes('linksTabActive') && noteViewSrc.includes('extractLinkContexts'),
    discoveryFeedDedupeComment: paletteSrc.includes('duplicate `buildDiscoveryFeed`'),
  };
}

function pickLinkContextTarget(notes: readonly NoteBase[]): string {
  const linked = notes.find(n => !n.deletedAt && (n.body ?? '').includes('[['));
  return linked?.title ?? notes.find(n => !n.deletedAt)?.title ?? 'Reference 1';
}

export function buildK95IndexAuditFixture(noteCount: number): {
  notes: NoteBase[];
  service: KnowledgeIndexService;
} {
  const dataset = buildLargeVaultDataset({ noteCount });
  const notes = dataset.notes;
  const service = new KnowledgeIndexService();
  service.setBodyProvider(id => notes.find(n => n.id === id)?.body ?? '');
  service.buildFromNotes(notes);
  return { notes, service };
}

export function runK95BenchmarkRow(noteCount: K95NoteCount): K95BenchmarkRow {
  const { notes, service } = buildK95IndexAuditFixture(noteCount);
  const targetTitle = pickLinkContextTarget(notes);
  const mapCounts = countKnowledgeIndexMaps(service);
  const memory = estimateIndexMemoryBreakdown(service, notes);
  const related = analyzeRelatedByNoteIdFootprint(service);
  const linkContext = measureExtractLinkContextsScan(targetTitle, notes);
  const discovery = measureDiscoveryFeedMemory(notes, service);

  return {
    noteCount,
    mapCounts,
    memory,
    related,
    linkContext,
    discovery,
  };
}

export function runK95GrowthCurve(): K95BenchmarkRow[] {
  return K95_NOTE_COUNTS.map(runK95BenchmarkRow);
}
