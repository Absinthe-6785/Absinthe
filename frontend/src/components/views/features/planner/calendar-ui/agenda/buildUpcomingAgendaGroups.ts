import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import {
  buildUnifiedAgendaItems,
  type UnifiedAgendaItem,
} from './agendaItemModel';

export interface UpcomingAgendaGroup {
  dateKey: string;
  dateLabel: string;
  items: readonly UnifiedAgendaItem[];
}

const UPCOMING_HORIZON_DAYS = 120;

/** Chronological upcoming groups from projection index — K-80 unified timeline. */
export function buildUpcomingAgendaGroups(
  projection: PlannerCalendarProjection,
  presentation: PlannerCalendarPresentation,
  todayKey: string,
  isReviewed: (id: string) => boolean,
): UpcomingAgendaGroup[] {
  const dateKeys = new Set<string>();

  for (const dateKey of projection.byDate.keys()) {
    if (dateKey >= todayKey) dateKeys.add(dateKey);
  }
  for (const cd of projection.core.countdowns) {
    if (cd.targetDate >= todayKey) dateKeys.add(cd.targetDate);
  }

  const sorted = [...dateKeys].sort().slice(0, UPCOMING_HORIZON_DAYS);
  const groups: UpcomingAgendaGroup[] = [];

  for (const dateKey of sorted) {
    const bundle = projection.byDate.get(dateKey);
    const dayCountdowns = projection.core.countdowns.filter(cd => cd.targetDate === dateKey);
    const allDay = bundle?.events.filter(e => e.isAllDay) ?? [];
    const timed = bundle?.events.filter(e => !e.isAllDay) ?? [];
    const blocks = bundle?.blocks ?? [];

    const items = buildUnifiedAgendaItems({
      blocks,
      allDayEvents: allDay,
      timedEvents: timed,
      countdowns: dayCountdowns,
      presentation,
      isReviewed,
      maxCountdowns: 12,
    });

    if (items.length === 0) continue;

    const dateLabel = presentation.labels.agendaDateHeaders.get(dateKey) ?? dateKey;
    groups.push({ dateKey, dateLabel, items });
  }

  return groups;
}
