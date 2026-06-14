import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { KnowledgeMilestone, AreaEvolutionRow } from '../timeline/timelineTypes';
import { countHubs, countLinksForNotes, noteEffectiveCreatedAt } from '../timeline/timelineMetrics';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { loadKnowledgeHistoryEvents } from './historyStorage';
import { hasNonImportedHistory } from './historyBootstrap';
import { isImportedEvent } from './historyEventPresentation';
import type { TranslationKey } from '../../../../../lib/i18n';
import { getProperty } from '../properties/noteProperties';

export interface CosmosEvolutionSummary {
  firstNoteAt: number | null;
  firstLinkAt: number | null;
  firstHubAt: number | null;
  firstNoteId: string | null;
  firstLinkNoteId: string | null;
  firstHubNoteId: string | null;
  currentNotes: number;
  currentLinks: number;
  currentHubs: number;
  importedOnly: boolean;
}

export interface CosmosEvolutionStory {
  beganAt: number | null;
  firstLinkAt: number | null;
  firstHubAt: number | null;
  daysToFirstLink: number | null;
  daysToFirstHub: number | null;
  notesAdded: number;
  linksAdded: number;
  hubsAdded: number;
  importedOnly: boolean;
}

export interface ExpandedCosmosEvolutionStory extends CosmosEvolutionStory {
  fastestGrowingArea: string | null;
  longestActiveArea: string | null;
  mostConnectedArea: string | null;
  recentMilestoneTitleKey: TranslationKey | null;
}

export type DiscoveryTrend = 'up' | 'stable' | 'down' | 'none';

export interface DiscoveryProgressSummary {
  resolvedCount: number;
  recentResolved: KnowledgeHistoryEvent[];
  connectCount: number;
  hubCount: number;
  areaCount: number;
  mostImprovedArea: string | null;
  momentumScore: number;
  periodDays: number;
  recentResolvedCount: number;
  recentConnectCount: number;
  recentHubCount: number;
  recentAreaCount: number;
  resolvedTrend: DiscoveryTrend;
}

const DAY_MS = 86_400_000;

function firstEventOfType(
  type: KnowledgeHistoryEvent['type'],
  events: readonly KnowledgeHistoryEvent[],
): KnowledgeHistoryEvent | null {
  return [...events]
    .filter(e => e.type === type)
    .sort((a, b) => a.timestamp - b.timestamp)[0] ?? null;
}

export function buildCosmosEvolutionSummary(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): CosmosEvolutionSummary {
  const active = notes.filter(n => !n.deletedAt);
  const firstNote = firstEventOfType('NOTE_CREATED', events);
  const firstLink = firstEventOfType('LINK_CREATED', events);
  const firstHub = firstEventOfType('HUB_CREATED', events);

  return {
    firstNoteAt: firstNote?.timestamp ?? (active[0] ? noteEffectiveCreatedAt(active[0]) : null),
    firstLinkAt: firstLink?.timestamp ?? null,
    firstHubAt: firstHub?.timestamp ?? null,
    firstNoteId: firstNote?.noteId ?? active[0]?.id ?? null,
    firstLinkNoteId: firstLink?.noteId ?? null,
    firstHubNoteId: firstHub?.noteId ?? null,
    currentNotes: active.length,
    currentLinks: countLinksForNotes(active, service),
    currentHubs: countHubs(active, service),
    importedOnly: events.length > 0 && !hasNonImportedHistory(events),
  };
}

export function buildExpandedCosmosEvolutionStory(
  summary: CosmosEvolutionSummary,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  notes: readonly NoteBase[] = [],
  areaRows: readonly AreaEvolutionRow[] = [],
  milestones: readonly KnowledgeMilestone[] = [],
  now = Date.now(),
): ExpandedCosmosEvolutionStory {
  const base = buildCosmosEvolutionStory(summary, events, now);

  let fastestGrowingArea: string | null = null;
  let bestDelta = -1;
  for (const row of areaRows) {
    const first = row.periods[0]?.noteCount ?? 0;
    const last = row.periods[row.periods.length - 1]?.noteCount ?? 0;
    const delta = last - first;
    if (delta > bestDelta) {
      bestDelta = delta;
      fastestGrowingArea = row.areaLabel;
    }
  }
  if (bestDelta <= 0) fastestGrowingArea = null;

  const areaFirstSeen = new Map<string, number>();
  for (const event of events) {
    const label = event.areaId ?? event.metadata?.areaLabel;
    if (!label) continue;
    const prev = areaFirstSeen.get(label);
    if (prev == null || event.timestamp < prev) areaFirstSeen.set(label, event.timestamp);
  }
  const longestActiveArea = [...areaFirstSeen.entries()]
    .sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;

  const areaLinkCounts = new Map<string, number>();
  const active = notes.filter(n => !n.deletedAt);
  for (const event of events) {
    if (event.type !== 'LINK_CREATED') continue;
    const label = event.areaId ?? event.metadata?.areaLabel;
    if (label) {
      areaLinkCounts.set(label, (areaLinkCounts.get(label) ?? 0) + 1);
      continue;
    }
    const note = active.find(n => n.id === event.noteId);
    if (note) {
      const area = getProperty(note, 'area')?.trim();
      if (area) areaLinkCounts.set(area, (areaLinkCounts.get(area) ?? 0) + 1);
    }
  }  const mostConnectedArea = [...areaLinkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const latest = latestAchievedMilestone(milestones);

  return {
    ...base,
    fastestGrowingArea,
    longestActiveArea,
    mostConnectedArea,
    recentMilestoneTitleKey: latest?.titleKey ?? null,
  };
}

export function buildCosmosEvolutionStory(
  summary: CosmosEvolutionSummary,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  now = Date.now(),
): CosmosEvolutionStory {
  const realEvents = events.filter(e => !isImportedEvent(e));
  const source = realEvents.length > 0 ? realEvents : events;

  const notesAdded = source.filter(e => e.type === 'NOTE_CREATED' && e.timestamp <= now).length;
  const linksAdded = source.filter(e => e.type === 'LINK_CREATED' && e.timestamp <= now).length;
  const hubsAdded = source.filter(e => e.type === 'HUB_CREATED' && e.timestamp <= now).length;

  const daysToFirstLink = summary.firstNoteAt && summary.firstLinkAt
    ? Math.max(0, Math.round((summary.firstLinkAt - summary.firstNoteAt) / DAY_MS))
    : null;
  const daysToFirstHub = summary.firstNoteAt && summary.firstHubAt
    ? Math.max(0, Math.round((summary.firstHubAt - summary.firstNoteAt) / DAY_MS))
    : null;

  return {
    beganAt: summary.firstNoteAt,
    firstLinkAt: summary.firstLinkAt,
    firstHubAt: summary.firstHubAt,
    daysToFirstLink,
    daysToFirstHub,
    notesAdded,
    linksAdded,
    hubsAdded,
    importedOnly: summary.importedOnly,
  };
}

export function buildDiscoveryProgressSummary(
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  periodDays = 30,
  now = Date.now(),
): DiscoveryProgressSummary {
  const startMs = now - periodDays * DAY_MS;
  const prevStartMs = startMs - periodDays * DAY_MS;
  const resolved = events.filter(e => e.type === 'DISCOVERY_RESOLVED');
  const recent = resolved.filter(e => e.timestamp >= startMs);
  const prevResolved = resolved.filter(e => e.timestamp >= prevStartMs && e.timestamp < startMs);
  const connectCount = resolved.filter(e => e.metadata?.action === 'connect' || e.metadata?.action === 'create-relation').length;
  const hubCount = resolved.filter(e => e.metadata?.action === 'create-hub').length;
  const areaCount = resolved.filter(e => e.metadata?.action === 'assign-area').length;

  const recentConnectCount = recent.filter(e => e.metadata?.action === 'connect' || e.metadata?.action === 'create-relation').length;
  const recentHubCount = recent.filter(e => e.metadata?.action === 'create-hub').length;
  const recentAreaCount = recent.filter(e => e.metadata?.action === 'assign-area').length;

  let resolvedTrend: DiscoveryTrend = 'none';
  if (recent.length > prevResolved.length) resolvedTrend = 'up';
  else if (recent.length === prevResolved.length && recent.length > 0) resolvedTrend = 'stable';
  else if (recent.length < prevResolved.length) resolvedTrend = 'down';

  const areaCounts = new Map<string, number>();
  for (const event of events) {
    if (event.timestamp < startMs) continue;
    const label = event.areaId ?? event.metadata?.areaLabel;
    if (!label) continue;
    if (event.type === 'AREA_ASSIGNED' || event.type === 'HUB_CREATED' || event.type === 'LINK_CREATED') {
      areaCounts.set(label, (areaCounts.get(label) ?? 0) + 1);
    }
  }
  const mostImprovedArea = [...areaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const momentumScore =
    events.filter(e => e.timestamp >= startMs && (e.type === 'LINK_CREATED' || e.type === 'DISCOVERY_RESOLVED')).length;

  return {
    resolvedCount: resolved.length,
    recentResolved: [...resolved].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    connectCount,
    hubCount,
    areaCount,
    mostImprovedArea,
    momentumScore,
    periodDays,
    recentResolvedCount: recent.length,
    recentConnectCount,
    recentHubCount,
    recentAreaCount,
    resolvedTrend,
  };
}

export function getMilestoneNoteId(
  milestoneId: string,
  events: readonly KnowledgeHistoryEvent[],
): string | null {
  switch (milestoneId) {
    case 'first-note':
      return firstEventOfType('NOTE_CREATED', events)?.noteId ?? null;
    case 'first-link':
      return firstEventOfType('LINK_CREATED', events)?.noteId ?? null;
    case 'first-hub':
      return firstEventOfType('HUB_CREATED', events)?.noteId ?? null;
    default:
      return null;
  }
}

export function latestAchievedMilestone(
  milestones: readonly KnowledgeMilestone[],
): KnowledgeMilestone | null {
  const achieved = milestones.filter(m => m.achieved && m.achievedAt);
  if (achieved.length === 0) return null;
  return [...achieved].sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0))[0] ?? null;
}
