import type { NoteBase } from '../../../noteUtils';
import { logMemAudit } from '../../../../../lib/memAudit';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getNoteGalaxyMap, type GalaxyAssignment } from '../graph/knowledgeUniverse/galaxyClustering';
import type { BuildDiscoveryFeedOptions, DiscoveryFeed, DiscoveryItem, DiscoveryKind, DiscoverySummary } from './discoveryTypes';
import {
  collectWeakHubSignals,
  collectIsolatedNotesSignals,
  collectAreaInsightSignals,
  ensureSharedConnectionSignals,
  ensureSharedRelationshipSignals,
} from './discoverySignals';
import { createDiscoveryFeedContext, type DiscoveryFeedContext } from './discoveryFeedContext';
import { applyHistoryToDiscoveryItems } from './historyDiscoveryBoost';
import { DISCOVERY_WEIGHTS, discoveryConfidenceTier } from './discoveryScoring';
import { buildCosmosVaultAnalysis, type CosmosVaultAnalysis } from '../cosmos/intelligence/cosmosAnalysis';

const DISCOVERY_KINDS: DiscoveryKind[] = [
  'isolated-notes',
  'stale-area',
  'forgotten-knowledge',
  'missing-connection',
  'weak-hub',
  'knowledge-drift',
];

function emptySections(): Record<DiscoveryKind, DiscoveryItem[]> {
  return {
    'isolated-notes': [],
    'recently-active-area': [],
    'stale-area': [],
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
  const isolatedNotesCount = sections['isolated-notes'].length;
  const recentlyActiveAreaCount = sections['recently-active-area'].length;
  const staleAreaCount = sections['stale-area'].length;
  return {
    forgottenCount,
    missingConnectionCount,
    emergingTopicCount,
    weakHubCount,
    knowledgeDriftCount,
    isolatedNotesCount,
    recentlyActiveAreaCount,
    staleAreaCount,
    totalCount:
      forgottenCount
      + missingConnectionCount
      + emergingTopicCount
      + weakHubCount
      + knowledgeDriftCount
      + isolatedNotesCount
      + recentlyActiveAreaCount
      + staleAreaCount,
  };
}

function enrichItem(item: DiscoveryItem): DiscoveryItem {
  return {
    ...item,
    confidence: discoveryConfidenceTier(item.score),
  };
}

function passesQualityGate(item: DiscoveryItem): boolean {
  if (item.score < DISCOVERY_WEIGHTS.MIN_FEED_SCORE) return false;

  if (item.kind === 'missing-connection') {
    const signalCount = item.signals?.length ?? 0;
    if (
      signalCount < DISCOVERY_WEIGHTS.MIN_CONNECTION_SIGNALS
      && item.score < DISCOVERY_WEIGHTS.MIN_SINGLE_SIGNAL_SCORE
    ) {
      return false;
    }
  }

  return true;
}

/** Remove duplicate or low-value discoveries before ranking. */
function refineDiscoveryItems(items: DiscoveryItem[]): DiscoveryItem[] {
  const filtered = items.filter(passesQualityGate);

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

  return result
    .map(enrichItem)
    .filter(item => item.confidence !== 'low');
}

/** Build vault-wide ranked discovery feed from deterministic signals. */
export function buildDiscoveryFeed(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  options: BuildDiscoveryFeedOptions = {},
): DiscoveryFeed {
  const now = options.now ?? Date.now();
  const perSection = options.perSectionLimit ?? 3;
  const totalLimit = options.limit ?? 18;

  const galaxyMap = options.context
    ? options.context.galaxyMap
    : getNoteGalaxyMap(notes, service, options.galaxyCacheKey);
  const ctx = options.context ?? createDiscoveryFeedContext(notes, service, galaxyMap, now);
  const hubActivity = ensureSharedRelationshipSignals(ctx);

  const raw = refineDiscoveryItems(
    applyHistoryToDiscoveryItems(
      [
        ...collectIsolatedNotesSignals(notes, service),
        ...hubActivity.forgotten,
        ...ensureSharedConnectionSignals(notes, service, ctx),
        ...collectAreaInsightSignals(notes, service, now, ctx.galaxyMap as Map<string, GalaxyAssignment>, ctx).filter(item => item.kind === 'stale-area'),
        ...collectWeakHubSignals(notes, service, ctx.galaxyMap as Map<string, GalaxyAssignment>, ctx),
        ...hubActivity.drift,
      ],
      options.historyEvents ?? [],
      now,
    ),
  );

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

  logMemAudit({
    source: 'buildDiscoveryFeed',
    notes: notes.filter(n => !n.deletedAt).length,
    discoveryItems: items.length,
    relatedCandidates: raw.length,
  });

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

export interface DiscoveryRefreshBundle {
  context: DiscoveryFeedContext;
  feed: DiscoveryFeed;
  vaultAnalysis: CosmosVaultAnalysis;
}

/** One shared context per refresh for discovery feed + vault analysis (K-95A). */
export function buildDiscoveryRefreshBundle(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  options: BuildDiscoveryFeedOptions = {},
): DiscoveryRefreshBundle {
  const now = options.now ?? Date.now();
  const galaxyMap = getNoteGalaxyMap(notes, service, options.galaxyCacheKey);
  const context = options.context ?? createDiscoveryFeedContext(notes, service, galaxyMap, now);
  const feed = buildDiscoveryFeed(notes, service, { ...options, now, context });
  const vaultAnalysis = buildCosmosVaultAnalysis(notes, service, context);
  return { context, feed, vaultAnalysis };
}
