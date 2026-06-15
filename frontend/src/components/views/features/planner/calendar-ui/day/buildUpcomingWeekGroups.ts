import type { PlannerCalendarPresentation, PlannerWeekViewPayload } from '../../calendar';
import { buildUnifiedAgendaItems, type UnifiedAgendaItem } from '../agenda/agendaItemModel';

export interface UpcomingWeekGroup {
  dateKey: string;
  dateLabel: string;
  items: readonly UnifiedAgendaItem[];
}

/** Days after today within the current week column set — for Today dashboard. */
export function buildUpcomingWeekGroups(
  week: PlannerWeekViewPayload,
  todayKey: string,
  presentation: PlannerCalendarPresentation,
  countdowns: readonly import('../../calendar').PlannerCountdownRow[],
  isReviewed: (id: string) => boolean,
): UpcomingWeekGroup[] {
  const groups: UpcomingWeekGroup[] = [];

  for (const column of week.columns) {
    if (column.dateKey <= todayKey) continue;

    const items = buildUnifiedAgendaItems({
      blocks: column.blocks,
      allDayEvents: column.allDayEvents,
      timedEvents: column.timedEvents,
      countdowns: countdowns.filter(cd => cd.targetDate === column.dateKey),
      presentation,
      isReviewed,
      maxCountdowns: 3,
    });

    if (items.length === 0) continue;

    const dateLabel = presentation.labels.agendaDateHeaders.get(column.dateKey)
      ?? column.dateKey;

    groups.push({ dateKey: column.dateKey, dateLabel, items });
  }

  return groups;
}
