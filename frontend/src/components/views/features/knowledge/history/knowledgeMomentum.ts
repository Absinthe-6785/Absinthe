import { getProperty } from '../properties/noteProperties';
import type { NoteBase } from '../../../noteUtils';
import type { AreaEvolutionRow, KnowledgeTimeline } from '../timeline/timelineTypes';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { noteBelongsToArea } from './historyAreaEvolutionQueries';
import { loadKnowledgeHistoryEvents } from './historyStorage';

const DAY_MS = 86_400_000;

/**
 * Deterministic momentum weights (K-47).
 * - NOTE_CREATED: 3 — primary growth signal
 * - LINK_CREATED: 2 — connection activity
 * - HUB_CREATED: 4 — structural milestone
 * - AREA_ASSIGNED: 2 — organization
 * - DISCOVERY_RESOLVED: 3 — intentional improvement
 */
export const MOMENTUM_WEIGHTS = {
  NOTE_CREATED: 3,
  LINK_CREATED: 2,
  HUB_CREATED: 4,
  AREA_ASSIGNED: 2,
  DISCOVERY_RESOLVED: 3,
} as const;

export interface AreaMomentumScore {
  areaLabel: string;
  score: number;
  notesAdded: number;
  linksAdded: number;
  eventsCount: number;
}

export interface KnowledgeMomentumSnapshot {
  fastestGrowingArea: string | null;
  mostActiveArea: string | null;
  mostConnectedArea: string | null;
  mostImprovedArea: string | null;
  cosmosMomentumScore: number;
  periodNotesAdded: number;
  periodLinksAdded: number;
  periodDays: number;
  areaScores: readonly AreaMomentumScore[];
}

function eventWeight(type: KnowledgeHistoryEvent['type']): number {
  return MOMENTUM_WEIGHTS[type as keyof typeof MOMENTUM_WEIGHTS] ?? 0;
}

function areaLabelForEvent(
  event: KnowledgeHistoryEvent,
  notes: readonly NoteBase[],
): string | null {
  const direct = event.areaId ?? event.metadata?.areaLabel;
  if (direct) return direct;
  const note = notes.find(n => n.id === event.noteId);
  if (!note) return null;
  return getProperty(note, 'area')?.trim() ?? null;
}

export function buildKnowledgeMomentumSnapshot(
  notes: readonly NoteBase[],
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  timeline?: KnowledgeTimeline,
  periodDays = 30,
  now = Date.now(),
): KnowledgeMomentumSnapshot {
  const startMs = now - periodDays * DAY_MS;
  const periodEvents = events.filter(e => e.timestamp >= startMs);
  const active = notes.filter(n => !n.deletedAt);

  let periodNotesAdded = 0;
  let periodLinksAdded = 0;
  let cosmosMomentumScore = 0;

  const areaMap = new Map<string, AreaMomentumScore>();

  const ensureArea = (label: string): AreaMomentumScore => {
    const existing = areaMap.get(label);
    if (existing) return existing;
    const entry: AreaMomentumScore = {
      areaLabel: label,
      score: 0,
      notesAdded: 0,
      linksAdded: 0,
      eventsCount: 0,
    };
    areaMap.set(label, entry);
    return entry;
  };

  for (const event of periodEvents) {
    const weight = eventWeight(event.type);
    if (weight === 0) continue;
    cosmosMomentumScore += weight;

    if (event.type === 'NOTE_CREATED') periodNotesAdded += 1;
    if (event.type === 'LINK_CREATED') periodLinksAdded += 1;

    const label = areaLabelForEvent(event, active);
    if (!label) continue;
    const area = ensureArea(label);
    area.score += weight;
    area.eventsCount += 1;
    if (event.type === 'NOTE_CREATED') area.notesAdded += 1;
    if (event.type === 'LINK_CREATED') area.linksAdded += 1;
  }

  const areaScores = [...areaMap.values()].sort((a, b) => b.score - a.score);

  const fastestGrowingArea = timeline?.recentEvolution.fastestGrowingArea
    ?? fastestGrowingFromRows(timeline?.areaEvolution ?? [])
    ?? areaScores.sort((a, b) => b.notesAdded - a.notesAdded)[0]?.areaLabel
    ?? null;

  const mostActiveArea = areaScores[0]?.areaLabel ?? null;

  const linkCounts = new Map<string, number>();
  for (const event of periodEvents) {
    if (event.type !== 'LINK_CREATED') continue;
    const label = areaLabelForEvent(event, active);
    if (label) linkCounts.set(label, (linkCounts.get(label) ?? 0) + 1);
  }
  const mostConnectedArea = [...linkCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const improvedCounts = new Map<string, number>();
  for (const event of periodEvents) {
    if (event.type !== 'DISCOVERY_RESOLVED' && event.type !== 'AREA_ASSIGNED') continue;
    const label = areaLabelForEvent(event, active);
    if (label) improvedCounts.set(label, (improvedCounts.get(label) ?? 0) + 1);
  }
  const mostImprovedArea = [...improvedCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? areaScores.sort((a, b) => b.score - a.score)[0]?.areaLabel
    ?? null;

  return {
    fastestGrowingArea,
    mostActiveArea,
    mostConnectedArea,
    mostImprovedArea,
    cosmosMomentumScore,
    periodNotesAdded,
    periodLinksAdded,
    periodDays,
    areaScores,
  };
}

function fastestGrowingFromRows(rows: readonly AreaEvolutionRow[]): string | null {
  let best: { label: string; delta: number } | null = null;
  for (const row of rows) {
    const first = row.periods[0]?.noteCount ?? 0;
    const last = row.periods[row.periods.length - 1]?.noteCount ?? 0;
    const delta = last - first;
    if (!best || delta > best.delta) best = { label: row.areaLabel, delta };
  }
  return best && best.delta > 0 ? best.label : null;
}

export function momentumForArea(
  areaLabel: string,
  snapshot: KnowledgeMomentumSnapshot,
): AreaMomentumScore | null {
  return snapshot.areaScores.find(a => a.areaLabel === areaLabel) ?? null;
}
