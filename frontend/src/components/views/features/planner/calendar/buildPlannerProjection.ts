import type {
  PlannerCalendarPresentation,
  PlannerCalendarProjection,
  PlannerWeeklySlotRow,
} from './calendarModels';
import { buildUpcomingAgendaGroups } from '../calendar-ui/agenda/buildUpcomingAgendaGroups';
import {
  buildUpcomingTierGroups,
  type UpcomingTierSection,
} from '../calendar-ui/agenda/buildUpcomingTierGroups';
import type { UnifiedAgendaItem } from '../calendar-ui/agenda/agendaItemModel';
import { buildUnifiedAgendaItems } from '../calendar-ui/agenda/agendaItemModel';
import { buildDayViewPayload } from './buildPlannerViewPayloads';

export interface PlannerProjection {
  calendar: PlannerCalendarProjection;
  todayItems: readonly UnifiedAgendaItem[];
  upcomingItems: readonly UnifiedAgendaItem[];
  groupedUpcoming: readonly UpcomingTierSection[];
  timetableToday: readonly PlannerWeeklySlotRow[];
}

function resolveTodayTimelineItems(
  projection: PlannerCalendarProjection,
  presentation: PlannerCalendarPresentation,
  todayKey: string,
  isReviewed: (id: string) => boolean,
): readonly UnifiedAgendaItem[] {
  const dayPayload = projection.views.day.dateKey === todayKey
    ? projection.views.day
    : buildDayViewPayload({
      anchorDate: todayKey,
      byDate: projection.byDate,
      allScheduleBlocks: projection.core.scheduleBlocks.map(block => ({
        id: block.id,
        date: block.dateKey,
        text: block.title,
        start_time: block.startTime,
        end_time: block.endTime,
        end_next_day: block.endNextDay ?? false,
        category: block.category,
        color: block.color,
        is_dday: false,
      })),
      todayKey,
    });

  const bundle = projection.byDate.get(todayKey);
  const dayCountdowns = projection.core.countdowns.filter(cd => cd.targetDate === todayKey);
  const allDay = bundle?.events.filter(e => e.isAllDay) ?? [];
  const timed = bundle?.events.filter(e => !e.isAllDay) ?? [];

  return buildUnifiedAgendaItems({
    blocks: dayPayload.timeline.blocks,
    carryOverBlocks: dayPayload.timeline.carryOverBlocks,
    allDayEvents: allDay,
    timedEvents: timed,
    countdowns: dayCountdowns,
    presentation,
    isReviewed,
    maxCountdowns: 12,
  });
}

/** Single-pass planner workspace projection — K-108. */
export function buildPlannerProjection(input: {
  calendarProjection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  todayKey: string;
  isReviewed: (id: string) => boolean;
  relativeLabel: (dateKey: string) => string;
  laterTierLabel?: string;
}): PlannerProjection {
  const { calendarProjection, presentation, todayKey, isReviewed, relativeLabel, laterTierLabel = 'Later' } = input;

  const flatGroups = buildUpcomingAgendaGroups(
    calendarProjection,
    presentation,
    todayKey,
    isReviewed,
  );

  const todayBundle = calendarProjection.byDate.get(todayKey);
  const timetableToday = [...(todayBundle?.weeklySlots ?? [])].sort(
    (a, b) => a.startTime.localeCompare(b.startTime),
  );

  return {
    calendar: calendarProjection,
    todayItems: resolveTodayTimelineItems(calendarProjection, presentation, todayKey, isReviewed),
    upcomingItems: flatGroups.flatMap(g => g.items),
    groupedUpcoming: buildUpcomingTierGroups(flatGroups, todayKey, relativeLabel, laterTierLabel),
    timetableToday,
  };
}

/** Synthetic schedule rows for performance benchmarks. */
export function synthesizePlannerScheduleRows(count: number, startDate = '2026-06-01'): {
  date: string;
  id: string;
  text: string;
  start_time: string;
  end_time: string;
}[] {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (i % 90));
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    rows.push({
      date: dateKey,
      id: `sch-${i}`,
      text: `Event ${i}`,
      start_time: `${String(8 + (i % 10)).padStart(2, '0')}:00`,
      end_time: `${String(9 + (i % 10)).padStart(2, '0')}:00`,
    });
  }
  return rows;
}
