/**
 * K-95D — Discovery candidate memory optimization audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import {
  buildDiscoveryFeed,
  buildDiscoveryRefreshBundle,
} from '@/components/views/features/knowledge/discovery';
import {
  ensureConnectionCandidateIndex,
  type ConnectionCandidateIndex,
  type DiscoveryFeedContext,
} from '@/components/views/features/knowledge/discovery/discoveryFeedContext';
import { buildCosmosVaultAnalysis } from '@/components/views/features/knowledge/cosmos/intelligence/cosmosAnalysis';
import { feedsAreEquivalent, vaultAnalysisIsEquivalent } from '@/components/views/k95aDiscoveryFeedAudit';
import { K95_NOTE_COUNTS, type K95NoteCount } from '@/components/views/k95KnowledgeIndexAudit';

export const K95D_NOTE_COUNTS = K95_NOTE_COUNTS;
export type K95DNoteCount = K95NoteCount;

const MAP_ENTRY_OVERHEAD = 32;
const ARRAY_OVERHEAD = 24;
const LEGACY_SUGGESTION_OBJECT_BYTES = 120;

function stringBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function jsonBytes(value: unknown): number {
  return stringBytes(JSON.stringify(value));
}

function estimateIdBucketMapBytes(map: Map<string, string[]>): number {
  let bytes = map.size * MAP_ENTRY_OVERHEAD;
  for (const ids of map.values()) {
    bytes += ARRAY_OVERHEAD + ids.length * 12;
    for (const id of ids) bytes += stringBytes(id);
  }
  return bytes;
}

function estimateCompactCandidatePoolBytes(pool: ConnectionCandidateIndex): number {
  return estimateIdBucketMapBytes(pool.galaxyMembers)
    + estimateIdBucketMapBytes(pool.titleTokens);
}

function estimateLegacyCandidatePoolBytes(pool: ConnectionCandidateIndex): number {
  let entryCount = 0;
  for (const ids of pool.galaxyMembers.values()) entryCount += ids.length;
  for (const ids of pool.titleTokens.values()) entryCount += ids.length;
  return estimateCompactCandidatePoolBytes(pool)
    + entryCount * LEGACY_SUGGESTION_OBJECT_BYTES;
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

export interface K95DDiscoveryMemoryRow {
  noteCount: number;
  candidatePoolBytes: number;
  signalBytes: number;
  galaxyBucketBytes: number;
  duplicateGalaxyBucketBytes: number;
  retainedObjectCount: number;
  legacyCandidatePoolBytes: number;
  candidateReductionPct: number;
  indexReductionPct: number;
}

function countRetainedDiscoveryObjects(ctx: DiscoveryFeedContext): number {
  const pool = ensureConnectionCandidateIndex(ctx);
  let count = pool.galaxyMembers.size + pool.titleTokens.size;
  for (const ids of pool.galaxyMembers.values()) count += ids.length;
  for (const ids of pool.titleTokens.values()) count += ids.length;
  count += ctx.connectionSignals?.length ?? 0;
  count += ctx.relationshipSignals?.forgotten.length ?? 0;
  count += ctx.relationshipSignals?.drift.length ?? 0;
  count += ctx.importanceByNoteId.size;
  return count;
}

export function buildK95DDiscoveryAuditFixture(noteCount: number): {
  notes: NoteBase[];
  service: KnowledgeIndexService;
} {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(notes);
  return { notes, service };
}

export function measureK95DDiscoveryMemoryRow(noteCount: number): K95DDiscoveryMemoryRow {
  const { notes, service } = buildK95DDiscoveryAuditFixture(noteCount);
  const bundle = buildDiscoveryRefreshBundle(notes, service, {
    perSectionLimit: 4,
    galaxyCacheKey: `k95d-${noteCount}`,
  });
  const ctx = bundle.context;
  const pool = ensureConnectionCandidateIndex(ctx);
  const candidatePoolBytes = estimateCompactCandidatePoolBytes(pool);
  const legacyCandidatePoolBytes = estimateLegacyCandidatePoolBytes(pool);
  const signalBytes = jsonBytes(ctx.connectionSignals ?? [])
    + jsonBytes(ctx.relationshipSignals ?? { forgotten: [], drift: [] });
  const galaxyBucketBytes = estimateIdBucketMapBytes(pool.galaxyMembers);
  const duplicateGalaxyBucketBytes = ctx.galaxyMemberIds === pool.galaxyMembers
    ? 0
    : estimateIdBucketMapBytes(ctx.galaxyMemberIds ?? new Map());

  const legacyContextBytes = candidatePoolBytes
    + duplicateGalaxyBucketBytes
    + legacyCandidatePoolBytes
    - candidatePoolBytes;
  const currentContextBytes = candidatePoolBytes + signalBytes;

  return {
    noteCount,
    candidatePoolBytes,
    signalBytes,
    galaxyBucketBytes,
    duplicateGalaxyBucketBytes,
    retainedObjectCount: countRetainedDiscoveryObjects(ctx),
    legacyCandidatePoolBytes,
    candidateReductionPct: pctReduction(legacyCandidatePoolBytes, candidatePoolBytes),
    indexReductionPct: pctReduction(legacyContextBytes, currentContextBytes),
  };
}

export function runK95DDiscoveryMemoryMatrix(): K95DDiscoveryMemoryRow[] {
  return K95D_NOTE_COUNTS.map(noteCount => measureK95DDiscoveryMemoryRow(noteCount));
}

export function formatK95DDiscoveryMemoryReport(rows: readonly K95DDiscoveryMemoryRow[]): string {
  const lines = ['K-95D discovery memory audit', ''];
  for (const row of rows) {
    lines.push(
      `${row.noteCount} notes — candidatePool ${(row.candidatePoolBytes / 1024).toFixed(1)} KB `
      + `(↓${row.candidateReductionPct}%) | signals ${(row.signalBytes / 1024).toFixed(1)} KB | `
      + `galaxy ${(row.galaxyBucketBytes / 1024).toFixed(1)} KB | dup ${row.duplicateGalaxyBucketBytes} B | `
      + `objects ${row.retainedObjectCount}`,
    );
  }
  return lines.join('\n');
}

export function verifyK95DDiscoveryCompatibility(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): {
  feedEquivalent: boolean;
  vaultAnalysisEquivalent: boolean;
  cosmosStandaloneBytes: number;
  bundleBytes: number;
} {
  const feedEquivalent = feedsAreEquivalent(notes, service);
  const vaultAnalysisEquivalent = vaultAnalysisIsEquivalent(notes, service);
  const bundle = buildDiscoveryRefreshBundle(notes, service, { galaxyCacheKey: 'k95d-compat' });
  return {
    feedEquivalent,
    vaultAnalysisEquivalent,
    cosmosStandaloneBytes: jsonBytes(buildCosmosVaultAnalysis(notes, service)),
    bundleBytes: jsonBytes(bundle.feed) + jsonBytes(bundle.vaultAnalysis),
  };
}
