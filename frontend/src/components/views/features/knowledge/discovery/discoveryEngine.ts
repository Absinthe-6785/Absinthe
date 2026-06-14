import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { BuildDiscoveryFeedOptions, DiscoveryFeed, DiscoveryItem, DiscoveryKind, DiscoverySummary } from './discoveryTypes';
import {
  collectEmergingTopicSignals,
  collectForgottenKnowledgeSignals,
  collectKnowledgeDriftSignals,
  collectMissingConnectionSignals,
  collectWeakHubSignals,
} from './discoverySignals';
import { DISCOVERY_WEIGHTS, discoveryConfidenceTier } from './discoveryScoring';

const DISCOVERY_KINDS: DiscoveryKind[] = [
  'forgotten-knowledge',
  'missing-connection',
  'emerging-topic',
  'weak-hub',
  'knowledge-drift',
];

function emptySections(): Record<DiscoveryKind, DiscoveryItem[]> {
  return {
    'forgotten-knowledge': [],
    'missing-connection': [],
    'emerging-topic': [],
    'weak-hub': [],
    'knowledge-drift': [],
  };
}

function buildSummary(sections: Record<DiscoveryKind, DiscoveryItem[]>): DiscoverySummary {
  const forgottenCount = sections['forgotten-knowledge'].length;
  const missingConnectionCount = sections['missing-connection'].length;
  const emergingTopicCount = sections['emerging-topic'].length;
  const weakHubCount = sections['weak-hub'].length;
  const knowledgeDriftCount = sections['knowledge-drift'].length;
  return {
    forgottenCount,
    missingConnectionCount,
    emergingTopicCount,
    weakHubCount,
    knowledgeDriftCount,
    totalCount:
      forgottenCount
      + missingConnectionCount
      + emergingTopicCount
      + weakHubCount
      + knowledgeDriftCount,
  };
}

function enrichItem(item: DiscoveryItem): DiscoveryItem {
  return {
    ...item,
    confidence: discoveryConfidenceTier(item.score),
  };
}

/** Remove duplicate or low-value discoveries before ranking. */
function refineDiscoveryItems(items: DiscoveryItem[]): DiscoveryItem[] {
  const minScore = DISCOVERY_WEIGHTS.MIN_FEED_SCORE;
  const filtered = items.filter(item => item.score >= minScore);

  const noteActivityBest = new Map<string, DiscoveryItem>();
  for (const item of filtered) {
    if (item.kind !== 'forgotten-knowledge' && item.kind !== 'knowledge-drift') continue;
    const noteKey = item.noteId ?? item.id;
    const existing = noteActivityBest.get(noteKey);
    if (!existing || item.score > existing.score) {
      noteActivityBest.set(noteKey, item);
    }
  }

  const weakHubAreas = new Set(
    filtered.filter(i => i.kind === 'weak-hub').map(i => i.areaLabel ?? i.title),
  );

  const seenPairs = new Set<string>();
  const result: DiscoveryItem[] = [];

  for (const item of filtered.sort((a, b) => b.score - a.score)) {
    if (item.kind === 'emerging-topic' && item.areaLabel && weakHubAreas.has(item.areaLabel)) {
      continue;
    }

    if (item.kind === 'forgotten-knowledge' || item.kind === 'knowledge-drift') {
      const noteKey = item.noteId ?? item.id;
      if (noteActivityBest.get(noteKey)?.id !== item.id) continue;
    }

    if (item.kind === 'missing-connection' && item.noteId && item.targetNoteId) {
      const pairKey = [item.noteId, item.targetNoteId].sort().join(':');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
    }

    result.push(item);
  }

  return result.map(enrichItem);
}

/** Build vault-wide ranked discovery feed from deterministic signals. */
export function buildDiscoveryFeed(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  options: BuildDiscoveryFeedOptions = {},
): DiscoveryFeed {
  const now = options.now ?? Date.now();
  const perSection = options.perSectionLimit ?? 6;
  const totalLimit = options.limit ?? 30;

  const raw = refineDiscoveryItems([
    ...collectForgottenKnowledgeSignals(notes, service, now),
    ...collectMissingConnectionSignals(notes, service),
    ...collectEmergingTopicSignals(notes, service, now),
    ...collectWeakHubSignals(notes, service),
    ...collectKnowledgeDriftSignals(notes, service, now),
  ]);

  const sections = emptySections();
  for (const kind of DISCOVERY_KINDS) {
    sections[kind] = raw
      .filter(item => item.kind === kind)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, perSection);
  }

  const items = [...raw]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, totalLimit);

  return {
    items,
    sections,
    summary: buildSummary(sections),
  };
}

export function countDiscoveriesForNote(
  noteId: string,
  feed: DiscoveryFeed,
): number {
  return feed.items.filter(
    item => item.noteId === noteId || item.targetNoteId === noteId,
  ).length;
}

export function isDiscoveryOpportunityNote(
  noteId: string,
  feed: DiscoveryFeed,
): boolean {
  return countDiscoveriesForNote(noteId, feed) > 0;
}
