import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import type { DiscoveryItem } from './discoveryTypes';

const DAY_MS = 86_400_000;

/** Deterministic score adjustments from recorded knowledge history. */
export function applyHistoryToDiscoveryItems(
  items: DiscoveryItem[],
  events: readonly KnowledgeHistoryEvent[],
  now: number,
): DiscoveryItem[] {
  if (events.length === 0) return items;

  const recentWindow = 14 * DAY_MS;
  const recent = events.filter(e => now - e.timestamp <= recentWindow);
  const recentlyLinked = new Set(
    recent.filter(e => e.type === 'LINK_CREATED').map(e => e.noteId),
  );
  const recentAreas = new Set(
    recent
      .filter(e => e.type === 'AREA_ASSIGNED' || e.type === 'HUB_CREATED')
      .map(e => e.areaId ?? e.metadata?.areaLabel)
      .filter((v): v is string => Boolean(v)),
  );

  return items.map(item => {
    let boost = 0;

    if (item.noteId && recentlyLinked.has(item.noteId)) {
      if (item.kind === 'emerging-topic') boost += 8;
      if (item.kind === 'forgotten-knowledge' || item.kind === 'knowledge-drift') boost -= 12;
    }

    if (item.areaLabel && recentAreas.has(item.areaLabel) && item.kind === 'emerging-topic') {
      boost += 6;
    }

    if (item.noteId) {
      const reactivated = recent.some(
        e => e.noteId === item.noteId && (e.type === 'LINK_CREATED' || e.type === 'DISCOVERY_RESOLVED'),
      );
      if (reactivated && item.kind === 'knowledge-drift') boost -= 8;
    }

    if (boost === 0) return item;
    return { ...item, score: Math.max(0, item.score + boost) };
  });
}
