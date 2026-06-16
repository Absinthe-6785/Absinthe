/**
 * K-89D — Discovery collector cost and overlap benchmarks.
 */
import { buildLargeVaultDataset } from './realisticUsageFixture';
import { measureMs } from '@/components/views/editorBenchmark';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildDiscoveryFeed } from '@/components/views/features/knowledge/discovery/discoveryEngine';
import { getNoteGalaxyMap, type GalaxyAssignment } from '@/components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import {
  collectAreaInsightSignals,
  collectEmergingTopicSignals,
  collectHubActivitySignals,
  collectIsolatedNotesSignals,
  collectMissingConnectionSignals,
  collectWeakHubSignals,
} from '@/components/views/features/knowledge/discovery/discoverySignals';
import { createDiscoveryFeedContext } from '@/components/views/features/knowledge/discovery/discoveryFeedContext';
import { applyHistoryToDiscoveryItems } from '@/components/views/features/knowledge/discovery/historyDiscoveryBoost';
import { groupRelatedNotes } from '@/components/views/features/knowledge/related/groupRelatedNotes';
import { evaluateDiscoveryFeedQuality } from '@/components/views/features/knowledge/discovery/validation/recommendationQuality';
import type { DiscoveryItem, DiscoveryKind } from '@/components/views/features/knowledge/discovery/discoveryTypes';
import type { NoteBase } from '@/components/views/noteUtils';

export const DISCOVERY_AUDIT_SCALES = [250, 500, 1000, 3000] as const;

export interface CollectorTimingRow {
  collector: string;
  ms: number;
  rawCandidates: number;
  wiredInFeed: boolean;
}

export interface CollectorOverlapRow {
  pair: string;
  sharedNoteIds: number;
  overlapPct: number;
}

export interface DiscoveryScaleAuditRow {
  noteCount: number;
  totalFeedMs: number;
  galaxyMapMs: number;
  groupRelatedNotesMs: number;
  feedItems: number;
  rawCandidatesBeforeRefine: number;
  qualityActionableCount: number;
  collectors: CollectorTimingRow[];
  overlap: CollectorOverlapRow[];
  byKindCounts: Record<string, number>;
}

const WIRED_COLLECTORS = new Set([
  'isolated-notes',
  'stale-area',
  'forgotten-knowledge',
  'missing-connection',
  'weak-hub',
  'knowledge-drift',
]);

function noteIdsFromItems(items: readonly DiscoveryItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.noteId) ids.add(item.noteId);
    if (item.targetNoteId) ids.add(item.targetNoteId);
  }
  return ids;
}

function overlapPct(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const id of a) {
    if (b.has(id)) shared += 1;
  }
  return Math.round((shared / Math.min(a.size, b.size)) * 1000) / 10;
}

function overlapPair(
  label: string,
  a: readonly DiscoveryItem[],
  b: readonly DiscoveryItem[],
): CollectorOverlapRow {
  const setA = noteIdsFromItems(a);
  const setB = noteIdsFromItems(b);
  let shared = 0;
  for (const id of setA) {
    if (setB.has(id)) shared += 1;
  }
  return {
    pair: label,
    sharedNoteIds: shared,
    overlapPct: overlapPct(setA, setB),
  };
}

function countByKind(items: readonly DiscoveryItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }
  return counts;
}

interface TimedCollectorResult {
  items: DiscoveryItem[];
  ms: number;
}

function timeCollector(fn: () => DiscoveryItem[]): TimedCollectorResult {
  let items: DiscoveryItem[] = [];
  const ms = measureMs(() => {
    items = fn();
  });
  return { items, ms };
}

export function measureDiscoveryAtScale(noteCount: number): DiscoveryScaleAuditRow {
  const dataset = buildLargeVaultDataset({ noteCount });
  const now = Date.parse('2026-06-16T12:00:00Z');
  const notes = dataset.notes.map((note, i) => {
    if (note.deletedAt) return note;
    const dayOffset = (i % 150) + 1;
    const openedOffset = i % 5 === 0 ? dayOffset + 20 : dayOffset;
    return {
      ...note,
      updatedAt: now - dayOffset * 86_400_000,
      lastOpenedAt: i % 8 === 0 ? now - openedOffset * 86_400_000 : note.lastOpenedAt,
    };
  });
  const service = new KnowledgeIndexService();
  service.buildFromNotes(notes);

  const galaxyCacheKey = `audit-${noteCount}`;

  let galaxyMap = new Map<string, GalaxyAssignment>();
  const galaxyMapMs = measureMs(() => {
    galaxyMap = getNoteGalaxyMap(notes, service, galaxyCacheKey);
  });

  const ctx = createDiscoveryFeedContext(notes, service, galaxyMap, now);

  const isolated = timeCollector(() => collectIsolatedNotesSignals(notes, service));
  const areaInsights = timeCollector(() => collectAreaInsightSignals(notes, service, now, galaxyMap, ctx));
  const staleArea = { items: areaInsights.items.filter(i => i.kind === 'stale-area'), ms: 0 };
  let hubResult = { forgotten: [] as DiscoveryItem[], drift: [] as DiscoveryItem[] };
  const hubActivityMs = measureMs(() => {
    hubResult = collectHubActivitySignals(ctx);
  });
  const forgotten = { items: hubResult.forgotten, ms: hubActivityMs };
  const drift = { items: hubResult.drift, ms: 0 };
  const missingConn = timeCollector(() => collectMissingConnectionSignals(notes, service, galaxyMap, ctx));
  const weakHub = timeCollector(() => collectWeakHubSignals(notes, service, galaxyMap, ctx));
  const emerging = timeCollector(() => collectEmergingTopicSignals(notes, service, now));

  const rawConcat = [
    ...isolated.items,
    ...staleArea.items,
    ...forgotten.items,
    ...missingConn.items,
    ...weakHub.items,
    ...drift.items,
  ];

  let historyBoosted: DiscoveryItem[] = [];
  const historyMs = measureMs(() => {
    historyBoosted = applyHistoryToDiscoveryItems(rawConcat, [], now);
  });

  const totalFeedMs = measureMs(() => {
    buildDiscoveryFeed(notes, service, { now, perSectionLimit: 4, galaxyCacheKey });
  });

  const feed = buildDiscoveryFeed(notes, service, { now, perSectionLimit: 4, galaxyCacheKey });
  const quality = evaluateDiscoveryFeedQuality(feed, historyBoosted.length);

  const sampleNote = notes[Math.floor(noteCount / 2)]!;
  const groupRelatedNotesMs = measureMs(() => {
    groupRelatedNotes(sampleNote.id, notes, service);
  });

  const collectors: CollectorTimingRow[] = [
    { collector: 'galaxyMap', ms: galaxyMapMs, rawCandidates: galaxyMap.size, wiredInFeed: true },
    { collector: 'isolated-notes', ms: isolated.ms, rawCandidates: isolated.items.length, wiredInFeed: true },
    { collector: 'area-insights (all)', ms: areaInsights.ms, rawCandidates: areaInsights.items.length, wiredInFeed: false },
    { collector: 'stale-area', ms: 0, rawCandidates: staleArea.items.length, wiredInFeed: true },
    { collector: 'forgotten-knowledge', ms: forgotten.ms, rawCandidates: forgotten.items.length, wiredInFeed: true },
    { collector: 'missing-connection', ms: missingConn.ms, rawCandidates: missingConn.items.length, wiredInFeed: true },
    { collector: 'weak-hub', ms: weakHub.ms, rawCandidates: weakHub.items.length, wiredInFeed: true },
    { collector: 'knowledge-drift', ms: drift.ms, rawCandidates: drift.items.length, wiredInFeed: true },
    { collector: 'emerging-topic (unwired)', ms: emerging.ms, rawCandidates: emerging.items.length, wiredInFeed: false },
    { collector: 'historyBoost', ms: historyMs, rawCandidates: historyBoosted.length, wiredInFeed: true },
    { collector: 'groupRelatedNotes', ms: groupRelatedNotesMs, rawCandidates: 0, wiredInFeed: false },
  ].sort((a, b) => b.ms - a.ms);

  const overlap: CollectorOverlapRow[] = [
    overlapPair('forgotten ↔ drift', forgotten.items, drift.items),
    overlapPair('forgotten ↔ missing-connection', forgotten.items, missingConn.items),
    overlapPair('drift ↔ missing-connection', drift.items, missingConn.items),
    overlapPair('isolated ↔ forgotten', isolated.items, forgotten.items),
    overlapPair('stale-area ↔ weak-hub', staleArea.items, weakHub.items),
  ];

  return {
    noteCount,
    totalFeedMs,
    galaxyMapMs,
    groupRelatedNotesMs,
    feedItems: feed.items.length,
    rawCandidatesBeforeRefine: historyBoosted.length,
    qualityActionableCount: quality.actionableCount,
    collectors,
    overlap,
    byKindCounts: countByKind(feed.items),
  };
}

export function runDiscoveryAudit(
  scales: readonly number[] = DISCOVERY_AUDIT_SCALES,
): DiscoveryScaleAuditRow[] {
  return scales.map(measureDiscoveryAtScale);
}

/** Top N collectors by median ms across scales (for report tables). */
export function rankCollectorsByCost(rows: readonly DiscoveryScaleAuditRow[]): string[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    for (const c of row.collectors) {
      if (c.collector === 'galaxyMap' || c.collector === 'historyBoost') continue;
      totals.set(c.collector, (totals.get(c.collector) ?? 0) + c.ms);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

export function relatedNotesOverlapWithFeed(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  feedItems: readonly DiscoveryItem[],
  sampleCount = 20,
): { samples: number; overlappingNotes: number; overlapPct: number } {
  const active = notes.filter(n => !n.deletedAt);
  const feedNoteIds = noteIdsFromItems(feedItems);
  const step = Math.max(1, Math.floor(active.length / sampleCount));
  let samples = 0;
  let overlapping = 0;

  for (let i = 0; i < active.length && samples < sampleCount; i += step) {
    const note = active[i]!;
    const grouped = groupRelatedNotes(note.id, notes, service);
    const relatedIds = new Set([
      ...grouped.mostRelated.map(r => r.noteId),
      ...grouped.worthRevisiting.map(r => r.noteId),
    ]);
    samples += 1;
    for (const id of relatedIds) {
      if (feedNoteIds.has(id) || feedNoteIds.has(note.id)) overlapping += 1;
    }
  }

  return {
    samples,
    overlappingNotes: overlapping,
    overlapPct: samples > 0 ? Math.round((overlapping / (samples * 10)) * 1000) / 10 : 0,
  };
}
