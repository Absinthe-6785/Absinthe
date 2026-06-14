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

/** Build vault-wide ranked discovery feed from deterministic signals. */
export function buildDiscoveryFeed(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  options: BuildDiscoveryFeedOptions = {},
): DiscoveryFeed {
  const now = options.now ?? Date.now();
  const perSection = options.perSectionLimit ?? 6;
  const totalLimit = options.limit ?? 30;

  const raw: DiscoveryItem[] = [
    ...collectForgottenKnowledgeSignals(notes, service, now),
    ...collectMissingConnectionSignals(notes, service),
    ...collectEmergingTopicSignals(notes, service, now),
    ...collectWeakHubSignals(notes, service),
    ...collectKnowledgeDriftSignals(notes, service, now),
  ];

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
