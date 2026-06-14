import type { NoteBase } from '../../../noteUtils';
import type { AreaEvolutionRow } from '../timeline/timelineTypes';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { noteBelongsToArea } from './historyAreaEvolutionQueries';
import { momentumForArea, type KnowledgeMomentumSnapshot } from './knowledgeMomentum';
import { loadKnowledgeHistoryEvents } from './historyStorage';

const DAY_MS = 86_400_000;

export interface AreaComparisonEntry {
  areaLabel: string;
  noteCount: number;
  linkCount: number;
  noteGrowth: number;
  linkGrowth: number;
  momentumScore: number;
  milestoneCount: number;
  trend: AreaEvolutionRow['trend'];
}

export interface AreaComparisonResult {
  periodDays: number;
  entries: readonly AreaComparisonEntry[];
}

function eventBelongsToArea(
  event: KnowledgeHistoryEvent,
  areaLabel: string,
  noteIds: ReadonlySet<string>,
): boolean {
  const label = event.areaId ?? event.metadata?.areaLabel;
  if (label === areaLabel) return true;
  return noteIds.has(event.noteId);
}

export function buildAreaComparison(
  areaLabels: readonly string[],
  notes: readonly NoteBase[],
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  areaRows: readonly AreaEvolutionRow[] = [],
  momentum?: KnowledgeMomentumSnapshot,
  periodDays = 30,
  now = Date.now(),
): AreaComparisonResult {
  const startMs = now - periodDays * DAY_MS;
  const active = notes.filter(n => !n.deletedAt);
  const uniqueLabels = [...new Set(areaLabels)].slice(0, 4);

  const entries = uniqueLabels.map(areaLabel => {
    const areaNotes = active.filter(n => noteBelongsToArea(n, areaLabel));
    const noteIds = new Set(areaNotes.map(n => n.id));
    const areaEvents = events.filter(e => eventBelongsToArea(e, areaLabel, noteIds));

    const periodEvents = areaEvents.filter(e => e.timestamp >= startMs);
    const noteGrowth = periodEvents.filter(e => e.type === 'NOTE_CREATED').length;
    const linkGrowth = periodEvents.filter(e => e.type === 'LINK_CREATED').length;
    const milestoneCount = periodEvents.filter(
      e => e.type === 'HUB_CREATED' || e.type === 'DISCOVERY_RESOLVED',
    ).length;

    const row = areaRows.find(r => r.areaLabel === areaLabel);
    const areaMomentum = momentum ? momentumForArea(areaLabel, momentum) : null;

    return {
      areaLabel,
      noteCount: areaNotes.length,
      linkCount: areaEvents.filter(e => e.type === 'LINK_CREATED').length,
      noteGrowth,
      linkGrowth,
      momentumScore: areaMomentum?.score ?? 0,
      milestoneCount,
      trend: row?.trend ?? 'stable',
    };
  });

  return { periodDays, entries };
}

export function defaultComparisonLabels(
  areaRows: readonly AreaEvolutionRow[],
  max = 2,
): string[] {
  return areaRows.slice(0, max).map(r => r.areaLabel);
}
