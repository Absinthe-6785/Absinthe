import type {
  HistoryGrowthMetrics,
  KnowledgeActivitySummary,
  KnowledgeHistoryEvent,
  KnowledgeHistoryEventType,
  NoteHistoryContext,
} from './eventTypes';
import { loadKnowledgeHistoryEvents } from './historyStorage';

const DAY_MS = 86_400_000;

export function getRecentEvents(
  limit = 50,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeHistoryEvent[] {
  return [...events]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function getEventsForNote(
  noteId: string,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeHistoryEvent[] {
  return events.filter(
    e => e.noteId === noteId || e.relatedNoteId === noteId,
  );
}

export function getEventsByType(
  type: KnowledgeHistoryEventType,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeHistoryEvent[] {
  return events.filter(e => e.type === type);
}

export function getEventsInWindow(
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeHistoryEvent[] {
  return events.filter(e => e.timestamp >= startMs && e.timestamp <= endMs);
}

export function countEventsInWindow(
  types: readonly KnowledgeHistoryEventType[],
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): number {
  return getEventsInWindow(startMs, endMs, events).filter(e => types.includes(e.type)).length;
}

export function getActivitySummary(
  periodDays = 30,
  now = Date.now(),
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): KnowledgeActivitySummary {
  const startMs = now - periodDays * DAY_MS;
  const windowEvents = getEventsInWindow(startMs, now, events);

  return {
    periodDays,
    notesCreated: windowEvents.filter(e => e.type === 'NOTE_CREATED').length,
    linksCreated: windowEvents.filter(e => e.type === 'LINK_CREATED').length,
    hubsCreated: windowEvents.filter(e => e.type === 'HUB_CREATED').length,
    discoveriesResolved: windowEvents.filter(e => e.type === 'DISCOVERY_RESOLVED').length,
    notesDeleted: windowEvents.filter(e => e.type === 'NOTE_DELETED').length,
    linksRemoved: windowEvents.filter(e => e.type === 'LINK_REMOVED').length,
  };
}

export function getGrowthMetrics(
  startMs: number,
  endMs: number,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): HistoryGrowthMetrics {
  const windowEvents = getEventsInWindow(startMs, endMs, events);
  return {
    notesCreated: windowEvents.filter(e => e.type === 'NOTE_CREATED').length,
    linksCreated: windowEvents.filter(e => e.type === 'LINK_CREATED').length,
    areasCreated: windowEvents.filter(e => e.type === 'AREA_ASSIGNED').length,
    hubsCreated: windowEvents.filter(e => e.type === 'HUB_CREATED').length,
    discoveriesResolved: windowEvents.filter(e => e.type === 'DISCOVERY_RESOLVED').length,
  };
}

export function hasRecordedHistory(
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): boolean {
  return events.length > 0;
}

export function getNoteHistoryContext(
  noteId: string,
  periodDays = 30,
  now = Date.now(),
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): NoteHistoryContext {
  const noteEvents = getEventsForNote(noteId, events).sort((a, b) => a.timestamp - b.timestamp);
  const firstSeen = noteEvents.find(e => e.type === 'NOTE_CREATED') ?? noteEvents[0];
  const linkEvents = noteEvents.filter(e => e.type === 'LINK_CREATED' || e.type === 'LINK_REMOVED');
  const lastLinked = linkEvents.length > 0 ? linkEvents[linkEvents.length - 1]!.timestamp : null;

  const majorTypes: KnowledgeHistoryEventType[] = [
    'NOTE_CREATED',
    'LINK_CREATED',
    'AREA_ASSIGNED',
    'HUB_CREATED',
    'DISCOVERY_RESOLVED',
  ];
  const majorEvents = noteEvents.filter(e => majorTypes.includes(e.type));
  const lastMajor = majorEvents.length > 0 ? majorEvents[majorEvents.length - 1]!.timestamp : null;

  const windowStart = now - periodDays * DAY_MS;
  const activityScore = noteEvents.filter(e => e.timestamp >= windowStart).length;

  return {
    firstSeenAt: firstSeen?.timestamp ?? null,
    lastLinkedAt: lastLinked,
    lastMajorUpdateAt: lastMajor,
    activityScore,
  };
}

export function getRecentlyLinkedNoteIds(
  windowDays: number,
  now = Date.now(),
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): Set<string> {
  const startMs = now - windowDays * DAY_MS;
  const ids = new Set<string>();
  for (const event of events) {
    if (event.timestamp < startMs || event.type !== 'LINK_CREATED') continue;
    ids.add(event.noteId);
    if (event.relatedNoteId) ids.add(event.relatedNoteId);
  }
  return ids;
}

export function getRecentlyActiveAreaLabels(
  windowDays: number,
  now = Date.now(),
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
): Set<string> {
  const startMs = now - windowDays * DAY_MS;
  const labels = new Set<string>();
  for (const event of events) {
    if (event.timestamp < startMs) continue;
    if (event.type !== 'AREA_ASSIGNED' && event.type !== 'HUB_CREATED') continue;
    const label = event.areaId ?? event.metadata?.areaLabel;
    if (label) labels.add(label);
  }
  return labels;
}
