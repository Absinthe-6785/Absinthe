import type { NoteBase } from '../../../noteUtils';
import { getProperty } from '../properties/noteProperties';
import { isAreaNote } from '../trace/areaNotes';
import type { AreaEvolutionRow } from '../timeline/timelineTypes';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { noteBelongsToArea } from './historyAreaEvolutionQueries';
import { loadKnowledgeHistoryEvents } from './historyStorage';

const DAY_MS = 86_400_000;

/** Days without meaningful activity before an area is considered dormant. */
export const DORMANT_THRESHOLD_DAYS = 60;

const MEANINGFUL_TYPES = new Set<KnowledgeHistoryEvent['type']>([
  'NOTE_CREATED',
  'LINK_CREATED',
  'AREA_ASSIGNED',
  'HUB_CREATED',
  'DISCOVERY_RESOLVED',
]);

export interface DormantAreaInsight {
  areaLabel: string;
  lastActivityAt: number | null;
  daysSinceActivity: number;
  noteCount: number;
}

function collectAreaLabels(
  notes: readonly NoteBase[],
  areaRows: readonly AreaEvolutionRow[],
  events: readonly KnowledgeHistoryEvent[],
): string[] {
  const labels = new Set<string>();
  for (const row of areaRows) labels.add(row.areaLabel);
  for (const note of notes) {
    if (note.deletedAt) continue;
    const area = getProperty(note, 'area')?.trim();
    if (area) labels.add(area);
    if (isAreaNote(note)) labels.add((note.title ?? '').trim());
  }
  for (const event of events) {
    const label = event.areaId ?? event.metadata?.areaLabel;
    if (label) labels.add(label);
  }
  return [...labels];
}

function lastAreaActivityAt(
  areaLabel: string,
  notes: readonly NoteBase[],
  events: readonly KnowledgeHistoryEvent[],
): number | null {
  const noteIds = new Set(
    notes.filter(n => !n.deletedAt && noteBelongsToArea(n, areaLabel)).map(n => n.id),
  );
  let last: number | null = null;
  for (const event of events) {
    if (!MEANINGFUL_TYPES.has(event.type)) continue;
    const label = event.areaId ?? event.metadata?.areaLabel;
    const matches = label === areaLabel || noteIds.has(event.noteId);
    if (!matches) continue;
    if (last == null || event.timestamp > last) last = event.timestamp;
  }
  return last;
}

/** Identify areas with no meaningful recent activity. */
export function analyzeDormantAreas(
  notes: readonly NoteBase[],
  events: readonly KnowledgeHistoryEvent[] = loadKnowledgeHistoryEvents(),
  areaRows: readonly AreaEvolutionRow[] = [],
  now = Date.now(),
  thresholdDays = DORMANT_THRESHOLD_DAYS,
): DormantAreaInsight[] {
  const thresholdMs = thresholdDays * DAY_MS;
  const labels = collectAreaLabels(notes, areaRows, events);
  const dormant: DormantAreaInsight[] = [];

  for (const areaLabel of labels) {
    const noteCount = notes.filter(n => !n.deletedAt && noteBelongsToArea(n, areaLabel)).length;
    if (noteCount === 0) continue;

    const row = areaRows.find(r => r.areaLabel === areaLabel);
    const lastAt = lastAreaActivityAt(areaLabel, notes, events);
    const daysSince = lastAt ? Math.floor((now - lastAt) / DAY_MS) : thresholdDays + 1;
    const inactive = lastAt == null || now - lastAt >= thresholdMs;
    const rowDormant = row?.trend === 'dormant';

    if (inactive || rowDormant) {
      dormant.push({
        areaLabel,
        lastActivityAt: lastAt,
        daysSinceActivity: daysSince,
        noteCount,
      });
    }
  }

  return dormant.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}
