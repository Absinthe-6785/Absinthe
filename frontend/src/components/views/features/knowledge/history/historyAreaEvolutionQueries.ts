import type { Language, TranslationKey } from '../../../../../lib/i18n';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getProperty } from '../properties/noteProperties';
import { isAreaNote } from '../trace/areaNotes';
import type { AreaEvolutionRow, KnowledgeTimeline } from '../timeline/timelineTypes';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { presentHistoryEvent } from './historyEventPresentation';
import { getMilestoneNoteId } from './historyEvolutionQueries';
import { loadKnowledgeHistoryEvents } from './historyStorage';

const DAY_MS = 86_400_000;
const MONTH_MS = 30 * DAY_MS;

export interface AreaEvolutionDetail {
  areaLabel: string;
  ageMonths: number;
  noteCount: number;
  linkCount: number;
  trend: AreaEvolutionRow['trend'];
  milestones: readonly AreaEvolutionMilestone[];
  recentActivity: readonly KnowledgeHistoryEvent[];
  journeyPeriods: readonly AreaJourneyPeriod[];
}

export interface AreaEvolutionMilestone {
  actionKey: TranslationKey;
  detail: string;
  timestamp: number;
  noteId: string;
}

export interface AreaJourneyPeriod {
  periodKey: string;
  periodLabel: string;
  noteDelta: number;
  highlights: readonly AreaJourneyHighlight[];
}

export interface AreaJourneyHighlight {
  actionKey: TranslationKey;
  detail: string;
  noteId: string;
  timestamp: number;
}

export interface EvolutionDashboardSummary {
  fastestGrowingArea: string | null;
  mostActiveArea: string | null;
  latestMilestoneTitleKey: TranslationKey | null;
  latestMilestoneNoteId: string | null;
  momentumScore: number;
}

export function noteBelongsToArea(note: NoteBase, areaLabel: string): boolean {
  const area = getProperty(note, 'area')?.trim();
  if (area === areaLabel) return true;
  if (isAreaNote(note) && (note.title ?? '').trim() === areaLabel) return true;
  return false;
}

function eventBelongsToArea(
  event: KnowledgeHistoryEvent,
  areaLabel: string,
  noteIdsInArea: ReadonlySet<string>,
): boolean {
  const label = event.areaId ?? event.metadata?.areaLabel;
  if (label === areaLabel) return true;
  if (noteIdsInArea.has(event.noteId)) return true;
  if (event.relatedNoteId && noteIdsInArea.has(event.relatedNoteId)) return true;
  return false;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabel(ts: number, lang: Language): string {
  return new Date(ts).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { month: 'short' },
  );
}

export function buildAreaEvolutionDetail(
  areaLabel: string,
  notes: readonly NoteBase[],
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  row?: AreaEvolutionRow,
  lang: Language = 'en',
  now = Date.now(),
): AreaEvolutionDetail {
  const active = notes.filter(n => !n.deletedAt);
  const areaNotes = active.filter(n => noteBelongsToArea(n, areaLabel));
  const noteIdsInArea = new Set(areaNotes.map(n => n.id));

  const areaEvents = events
    .filter(e => eventBelongsToArea(e, areaLabel, noteIdsInArea))
    .sort((a, b) => a.timestamp - b.timestamp);

  const firstAt = areaEvents[0]?.timestamp ?? null;
  const ageMonths = firstAt ? Math.max(1, Math.round((now - firstAt) / MONTH_MS)) : 0;

  const noteCount = areaNotes.length;
  const linkCount = areaEvents.filter(e => e.type === 'LINK_CREATED').length;

  const milestoneTypes = new Set<KnowledgeHistoryEvent['type']>(['HUB_CREATED', 'DISCOVERY_RESOLVED']);
  const milestones = areaEvents
    .filter(e => milestoneTypes.has(e.type))
    .slice(-5)
    .map(e => {
      const row = presentHistoryEvent(e, notes);
      return {
        actionKey: row.actionKey,
        detail: row.detail,
        timestamp: e.timestamp,
        noteId: row.noteId,
      };
    });

  const recentActivity = [...areaEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

  const noteCreatedByMonth = new Map<string, number>();
  for (const event of areaEvents) {
    if (event.type !== 'NOTE_CREATED') continue;
    const key = monthKey(event.timestamp);
    noteCreatedByMonth.set(key, (noteCreatedByMonth.get(key) ?? 0) + 1);
  }

  const highlightTypes = new Set<KnowledgeHistoryEvent['type']>([
    'HUB_CREATED',
    'DISCOVERY_RESOLVED',
    'AREA_ASSIGNED',
  ]);
  const highlightsByMonth = new Map<string, AreaJourneyHighlight[]>();
  for (const event of areaEvents) {
    if (!highlightTypes.has(event.type) && event.type !== 'NOTE_CREATED') continue;
    const key = monthKey(event.timestamp);
    const presented = presentHistoryEvent(event, notes);
    const list = highlightsByMonth.get(key) ?? [];
    if (event.type === 'HUB_CREATED' || event.type === 'DISCOVERY_RESOLVED') {
      list.push({
        actionKey: presented.actionKey,
        detail: presented.detail,
        noteId: presented.noteId,
        timestamp: event.timestamp,
      });
    }
    highlightsByMonth.set(key, list);
  }

  const periodKeys = new Set([
    ...noteCreatedByMonth.keys(),
    ...highlightsByMonth.keys(),
  ]);

  const journeyPeriods = [...periodKeys]
    .map(key => {
      const ts = areaEvents.find(e => monthKey(e.timestamp) === key)?.timestamp ?? now;
      return {
        periodKey: key,
        periodLabel: monthLabel(ts, lang),
        noteDelta: noteCreatedByMonth.get(key) ?? 0,
        highlights: highlightsByMonth.get(key) ?? [],
      };
    })
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  return {
    areaLabel,
    ageMonths,
    noteCount,
    linkCount,
    trend: row?.trend ?? 'stable',
    milestones,
    recentActivity,
    journeyPeriods,
  };
}

export function buildEvolutionDashboardSummary(
  timeline: KnowledgeTimeline,
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  now = Date.now(),
): EvolutionDashboardSummary {
  const startMs = now - 30 * DAY_MS;
  const areaActivity = new Map<string, number>();

  for (const event of events) {
    if (event.timestamp < startMs) continue;
    const label = event.areaId ?? event.metadata?.areaLabel;
    if (!label) continue;
    areaActivity.set(label, (areaActivity.get(label) ?? 0) + 1);
  }

  const fastestGrowingArea = timeline.recentEvolution.fastestGrowingArea
    ?? timeline.areaEvolution.find(r => r.trend === 'growing')?.areaLabel
    ?? null;

  const mostActiveArea = [...areaActivity.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    ?? timeline.areaEvolution[0]?.areaLabel
    ?? null;

  const achieved = timeline.milestones.filter(m => m.achieved);
  const latest = achieved.length > 0
    ? [...achieved].sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0))[0]
    : null;

  const momentumScore = events.filter(
    e => e.timestamp >= startMs && (e.type === 'LINK_CREATED' || e.type === 'NOTE_CREATED'),
  ).length;

  return {
    fastestGrowingArea,
    mostActiveArea,
    latestMilestoneTitleKey: latest?.titleKey ?? null,
    latestMilestoneNoteId: latest ? getMilestoneNoteId(latest.id, events) : null,
    momentumScore,
  };
}

/** Area with highest note-count growth between first and last period. */
export function fastestGrowingAreaFromRows(rows: readonly AreaEvolutionRow[]): string | null {
  let best: { label: string; delta: number } | null = null;
  for (const row of rows) {
    const first = row.periods[0]?.noteCount ?? 0;
    const last = row.periods[row.periods.length - 1]?.noteCount ?? 0;
    const delta = last - first;
    if (!best || delta > best.delta) best = { label: row.areaLabel, delta };
  }
  return best && best.delta > 0 ? best.label : null;
}
