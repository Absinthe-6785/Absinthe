import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import { getGrowthMetrics, hasRecordedHistory } from '../history/historyQueries';
import type { DiscoveryGrowthMetrics, TimelineGrowthMetrics, VaultGrowthMetrics } from './timelineTypes';

export function vaultGrowthFromHistory(
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[],
): VaultGrowthMetrics {
  const metrics = getGrowthMetrics(startMs, endMs, events);
  return {
    notesCreated: metrics.notesCreated,
    linksCreated: metrics.linksCreated,
    areasCreated: metrics.areasCreated + metrics.hubsCreated,
  };
}

export function discoveryGrowthFromHistory(
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[],
  discoveriesOpen: number,
): DiscoveryGrowthMetrics {
  const metrics = getGrowthMetrics(startMs, endMs, events);
  return {
    discoveriesGenerated: discoveriesOpen,
    discoveriesResolved: metrics.discoveriesResolved,
    connectionsAdded: metrics.linksCreated,
  };
}

export function mergeGrowthWithHistory(
  estimated: TimelineGrowthMetrics,
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[],
): TimelineGrowthMetrics {
  if (!hasRecordedHistory(events)) return estimated;

  const historyVault = vaultGrowthFromHistory(startMs, endMs, events);
  const historyDiscovery = discoveryGrowthFromHistory(startMs, endMs, events, estimated.discovery.discoveriesGenerated);

  return {
    ...estimated,
    vault: historyVault,
    discovery: historyDiscovery,
  };
}

export function recentEvolutionFromHistory(
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[],
  fallbackNotes: number,
  fallbackLinks: number,
): { notesAdded: number; linksAdded: number } {
  if (!hasRecordedHistory(events)) {
    return { notesAdded: fallbackNotes, linksAdded: fallbackLinks };
  }
  const metrics = getGrowthMetrics(startMs, endMs, events);
  return {
    notesAdded: metrics.notesCreated,
    linksAdded: metrics.linksCreated,
  };
}

export function discoveryHistoryFromEvents(
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[],
  fallback: { missingConnectionsResolved: number; weakHubsCreated: number; forgottenNotesRevisited: number },
): { missingConnectionsResolved: number; weakHubsCreated: number; forgottenNotesRevisited: number } {
  if (!hasRecordedHistory(events)) return fallback;

  const windowEvents = events.filter(e => e.timestamp >= startMs && e.timestamp <= endMs);
  const linksResolved = windowEvents.filter(e => e.type === 'LINK_CREATED').length;
  const hubsCreated = windowEvents.filter(e => e.type === 'HUB_CREATED').length;
  const discoveriesResolved = windowEvents.filter(e => e.type === 'DISCOVERY_RESOLVED').length;

  return {
    missingConnectionsResolved: linksResolved,
    weakHubsCreated: hubsCreated,
    forgottenNotesRevisited: discoveriesResolved,
  };
}
