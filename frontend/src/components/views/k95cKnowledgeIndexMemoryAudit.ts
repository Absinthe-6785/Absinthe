/**
 * K-95C — Knowledge index memory reduction audit (test/dev only).
 */
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildDiscoveryFeed } from '@/components/views/features/knowledge/discovery/discoveryEngine';
import { groupRelatedNotes } from '@/components/views/features/knowledge/related/groupRelatedNotes';
import {
  analyzeRelatedByNoteIdFootprint,
  countKnowledgeIndexMaps,
  estimateIndexMemoryBreakdown,
  K95_NOTE_COUNTS,
  type K95NoteCount,
} from '@/components/views/k95KnowledgeIndexAudit';

export const K95C_NOTE_COUNTS = K95_NOTE_COUNTS;
export type K95CNoteCount = K95NoteCount;

export interface K95CKnowledgeIndexMemoryRow {
  noteCount: number;
  indexTotalBytes: number;
  relatedByNoteIdBytes: number;
  titleDuplicationBytes: number;
  retainedObjectCount: number;
  legacyRelatedBytes: number;
  compactRelatedBytes: number;
  relatedReductionPct: number;
  indexReductionPct: number;
}

function countRetainedIndexObjects(service: KnowledgeIndexService): number {
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

/** Baseline index bytes before K-95C compact storage (estimated from legacy shapes). */
function estimateLegacyIndexTotalBytes(
  service: KnowledgeIndexService,
  notes: readonly NoteBase[],
): number {
  const current = estimateIndexMemoryBreakdown(service, notes);
  const related = analyzeRelatedByNoteIdFootprint(service);
  const legacyRelatedDelta = related.estimatedRelatedBytes - related.estimatedCompactRelatedBytes;
  const legacyUniqueRelatedDelta = current.uniqueRelatedCountBytes;
  const activeCount = notes.filter(n => !n.deletedAt).length;
  const legacyTitleSearchExtra = activeCount * 32;
  return current.indexTotalBytes
    + legacyRelatedDelta
    + legacyUniqueRelatedDelta
    + related.titleDuplicationBytes
    + legacyTitleSearchExtra;
}

export function buildK95CIndexAuditFixture(noteCount: number): {
  notes: NoteBase[];
  service: KnowledgeIndexService;
} {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(notes);
  return { notes, service };
}

export function measureK95CKnowledgeIndexMemoryRow(noteCount: number): K95CKnowledgeIndexMemoryRow {
  const { notes, service } = buildK95CIndexAuditFixture(noteCount);
  const memory = estimateIndexMemoryBreakdown(service, notes);
  const related = analyzeRelatedByNoteIdFootprint(service);
  const legacyIndexTotal = estimateLegacyIndexTotalBytes(service, notes);

  return {
    noteCount,
    indexTotalBytes: memory.indexTotalBytes,
    relatedByNoteIdBytes: memory.relatedByNoteIdBytes,
    titleDuplicationBytes: related.titleDuplicationBytes,
    retainedObjectCount: countRetainedIndexObjects(service),
    legacyRelatedBytes: related.estimatedRelatedBytes,
    compactRelatedBytes: related.estimatedCompactRelatedBytes,
    relatedReductionPct: related.compactReductionPct,
    indexReductionPct: legacyIndexTotal > 0
      ? Math.round(((legacyIndexTotal - memory.indexTotalBytes) / legacyIndexTotal) * 1000) / 10
      : 0,
  };
}

export function runK95CKnowledgeIndexMemoryMatrix(): K95CKnowledgeIndexMemoryRow[] {
  return K95C_NOTE_COUNTS.map(noteCount => measureK95CKnowledgeIndexMemoryRow(noteCount));
}

export function formatK95CKnowledgeIndexMemoryReport(rows: readonly K95CKnowledgeIndexMemoryRow[]): string {
  const lines = ['K-95C knowledge index memory audit', ''];
  for (const row of rows) {
    lines.push(
      `${row.noteCount} notes — index ${(row.indexTotalBytes / 1024).toFixed(1)} KB `
      + `(↓${row.indexReductionPct}%) | related ${(row.relatedByNoteIdBytes / 1024).toFixed(1)} KB `
      + `(↓${row.relatedReductionPct}%) | title dedup ${(row.titleDuplicationBytes / 1024).toFixed(1)} KB | `
      + `objects ${row.retainedObjectCount}`,
    );
  }
  return lines.join('\n');
}

export function verifyK95CIndexBehaviorParity(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
): {
  relatedCount: number;
  backlinkCount: number;
  discoveryItems: number;
} {
  const sample = notes.find(n => !n.deletedAt)?.id ?? notes[0]?.id ?? '';
  const related = service.getRelatedNotes(sample, 12);
  const title = service.getNoteTitle(sample);
  const incoming = service.getIncoming(title);
  const feed = buildDiscoveryFeed(notes, service, {
    now: Date.now(),
    perSectionLimit: 4,
    galaxyCacheKey: 'k95c-audit',
  });
  const grouped = groupRelatedNotes(sample, notes, service);

  return {
    relatedCount: related.length + grouped.mostRelated.length + grouped.worthRevisiting.length,
    backlinkCount: incoming.length,
    discoveryItems: feed.items.length,
  };
}
