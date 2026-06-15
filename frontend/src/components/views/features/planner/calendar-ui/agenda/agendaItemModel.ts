import type {
  PlannerCountdownRow,
  PlannerEventOccurrence,
  PlannerScheduleRow,
} from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import { formatEventTimeLabel } from '../day/dayCalendarPresentation';
import { filterUnreviewedCountdowns } from '../../hooks/useCountdownReviewed';

export type UnifiedAgendaItemKind = 'block' | 'event' | 'countdown';

export interface UnifiedAgendaItem {
  kind: UnifiedAgendaItemKind;
  key: string;
  sort: string;
  title: string;
  time?: string;
  allDay?: boolean;
  blockId?: string;
  noteId?: string;
  countdownLabel?: string;
  carryOver?: boolean;
}

export interface BuildAgendaItemsInput {
  blocks: readonly PlannerScheduleRow[];
  carryOverBlocks?: readonly PlannerScheduleRow[];
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  countdowns?: readonly PlannerCountdownRow[];
  presentation?: PlannerCalendarPresentation;
  isReviewed?: (id: string) => boolean;
  maxCountdowns?: number;
}

export function buildUnifiedAgendaItems({
  blocks,
  carryOverBlocks = [],
  allDayEvents,
  timedEvents,
  countdowns = [],
  presentation,
  isReviewed = () => false,
  maxCountdowns = 8,
}: BuildAgendaItemsInput): UnifiedAgendaItem[] {
  const items: UnifiedAgendaItem[] = [];

  for (const block of carryOverBlocks) {
    items.push({
      kind: 'block',
      key: `block-carry-${block.id}`,
      sort: block.startTime ?? '99:99',
      title: block.title,
      time: formatEventTimeLabel(block.startTime, block.endTime) ?? block.startTime,
      blockId: block.id,
      carryOver: true,
    });
  }

  for (const block of blocks) {
    items.push({
      kind: 'block',
      key: `block-${block.id}`,
      sort: block.startTime ?? '99:99',
      title: block.title,
      time: formatEventTimeLabel(block.startTime, block.endTime) ?? block.startTime,
      blockId: block.id,
    });
  }

  for (const event of allDayEvents) {
    items.push({
      kind: 'event',
      key: event.occurrenceId,
      sort: '00:00',
      title: event.title,
      noteId: event.noteId,
      allDay: true,
    });
  }

  for (const event of timedEvents) {
    items.push({
      kind: 'event',
      key: event.occurrenceId,
      sort: event.startTime ?? '12:00',
      title: event.title,
      time: formatEventTimeLabel(event.startTime, event.endTime) ?? undefined,
      noteId: event.noteId,
      allDay: false,
    });
  }

  const locale = presentation?.locale ?? 'en';
  for (const cd of filterUnreviewedCountdowns(countdowns, isReviewed, { upcomingOnly: true }).slice(0, maxCountdowns)) {
    items.push({
      kind: 'countdown',
      key: cd.id,
      sort: `zz-${String(cd.daysUntil).padStart(4, '0')}`,
      title: cd.title,
      countdownLabel: formatPlannerCountdownLabel(cd.daysUntil, locale),
      noteId: cd.sourceRefId,
    });
  }

  return items.sort((a, b) => a.sort.localeCompare(b.sort) || a.title.localeCompare(b.title));
}

export function agendaItemHasActions(
  item: UnifiedAgendaItem,
  scheduleActions?: { onEdit?: (id: string) => void; onDelete?: (id: string) => void; onDuplicate?: (id: string) => void },
  eventActions?: { onEdit?: (id: string) => void; onDelete?: (id: string) => void; onDuplicate?: (id: string) => void },
): boolean {
  if (item.kind === 'block' && item.blockId && !item.carryOver) {
    return Boolean(scheduleActions?.onEdit || scheduleActions?.onDelete || scheduleActions?.onDuplicate);
  }
  if ((item.kind === 'event' || item.kind === 'countdown') && item.noteId) {
    return Boolean(eventActions?.onEdit || eventActions?.onDelete || eventActions?.onDuplicate);
  }
  return false;
}
