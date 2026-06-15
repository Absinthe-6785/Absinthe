import type {
  PlannerDayBundle,
  PlannerDayViewPayload,
  PlannerDatedSchedule,
  PlannerEventOccurrence,
  PlannerMonthViewPayload,
  PlannerScheduleRow,
  PlannerWeekViewPayload,
} from './calendarModels';
import {
  addDays,
  enumerateDateKeys,
  isoWeekBounds,
  isoWeekdayFromDateKey,
  monthGridBounds,
} from './plannerCalendarDateUtils';
import { parseDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';
import type { MonthGridBounds } from './plannerCalendarDateUtils';

function splitEvents(events: readonly PlannerEventOccurrence[]): {
  allDay: PlannerEventOccurrence[];
  timed: PlannerEventOccurrence[];
} {
  const allDay: PlannerEventOccurrence[] = [];
  const timed: PlannerEventOccurrence[] = [];

  for (const event of events) {
    if (event.isAllDay || !event.startTime) allDay.push(event);
    else timed.push(event);
  }

  return { allDay, timed };
}

function normalizeScheduleRow(block: PlannerDatedSchedule): PlannerScheduleRow {
  return {
    id: block.id,
    dateKey: block.date,
    title: block.text,
    startTime: block.start_time,
    endTime: block.end_time,
    endNextDay: Boolean(block.end_next_day),
    category: block.category,
    color: block.color,
    source: 'schedule',
  };
}

export function buildMonthViewPayload(params: {
  anchorDate: string;
  monthBounds: MonthGridBounds | null;
  byDate: ReadonlyMap<string, PlannerDayBundle>;
  todayKey: string;
}): PlannerMonthViewPayload {
  const bounds = params.monthBounds ?? monthGridBounds(params.anchorDate);
  if (!bounds) {
    return {
      year: 0,
      month: 0,
      gridStartDate: params.anchorDate,
      gridEndDate: params.anchorDate,
      weekdayOrder: [0, 1, 2, 3, 4, 5, 6],
      cells: [],
    };
  }

  const dateKeys = enumerateDateKeys(bounds.startDate, bounds.endDate);
  const cells = dateKeys.map(dateKey => {
    const parts = parseDateKey(dateKey);
    const bundle = params.byDate.get(dateKey) ?? {
      dateKey,
      weekday: isoWeekdayFromDateKey(dateKey) ?? 0,
      events: [],
      milestones: [],
      blocks: [],
      todos: [],
      routines: [],
      weeklySlots: [],
      isRoutineException: false,
      hints: {
        blockCount: 0,
        eventCount: 0,
        hasAllDayEvent: false,
        hasTimedEvent: false,
        milestoneCount: 0,
        primaryEventNoteIds: [],
        overflowEventCount: 0,
      },
    };

    return {
      dateKey,
      day: parts?.day ?? 0,
      inMonth: parts?.month === bounds.month && parts?.year === bounds.year,
      isToday: dateKey === params.todayKey,
      isAnchorSelected: dateKey === params.anchorDate,
      bundle,
    };
  });

  return {
    year: bounds.year,
    month: bounds.month,
    gridStartDate: bounds.startDate,
    gridEndDate: bounds.endDate,
    weekdayOrder: [0, 1, 2, 3, 4, 5, 6],
    cells,
  };
}

export function buildWeekViewPayload(params: {
  anchorDate: string;
  byDate: ReadonlyMap<string, PlannerDayBundle>;
}): PlannerWeekViewPayload {
  const week = isoWeekBounds(params.anchorDate);
  if (!week) {
    return { startDate: params.anchorDate, endDate: params.anchorDate, columns: [] };
  }

  const columns = enumerateDateKeys(week.startDate, week.endDate).map(dateKey => {
    const bundle = params.byDate.get(dateKey);
    const events = bundle?.events ?? [];
    const { allDay, timed } = splitEvents(events);
    const routines = bundle?.routines ?? [];
    const done = routines.filter(routine => routine.done).length;

    return {
      dateKey,
      bundle: bundle ?? {
        dateKey,
        weekday: isoWeekdayFromDateKey(dateKey) ?? 0,
        events: [],
        milestones: [],
        blocks: [],
        todos: [],
        routines: [],
        weeklySlots: [],
        isRoutineException: false,
        hints: {
          blockCount: 0,
          eventCount: 0,
          hasAllDayEvent: false,
          hasTimedEvent: false,
          milestoneCount: 0,
          primaryEventNoteIds: [],
          overflowEventCount: 0,
        },
      },
      allDayEvents: allDay,
      timedEvents: timed,
      blocks: bundle?.blocks ?? [],
      templateSlots: bundle?.weeklySlots ?? [],
      routineSummary: routines.length > 0 ? { done, total: routines.length } : null,
    };
  });

  return {
    startDate: week.startDate,
    endDate: week.endDate,
    columns,
  };
}

export function buildDayViewPayload(params: {
  anchorDate: string;
  byDate: ReadonlyMap<string, PlannerDayBundle>;
  allScheduleBlocks: readonly PlannerDatedSchedule[];
  todayKey: string;
}): PlannerDayViewPayload {
  const bundle = params.byDate.get(params.anchorDate);
  const events = bundle?.events ?? [];
  const { allDay, timed } = splitEvents(events);

  const previousDate = addDays(params.anchorDate, -1);
  const carryOverBlocks = previousDate
    ? params.allScheduleBlocks
      .filter(block => block.date === previousDate && block.end_next_day && !block.is_dday)
      .map(normalizeScheduleRow)
    : [];

  return {
    dateKey: params.anchorDate,
    bundle: bundle ?? {
      dateKey: params.anchorDate,
      weekday: isoWeekdayFromDateKey(params.anchorDate) ?? 0,
      events: [],
      milestones: [],
      blocks: [],
      todos: [],
      routines: [],
      weeklySlots: [],
      isRoutineException: false,
      hints: {
        blockCount: 0,
        eventCount: 0,
        hasAllDayEvent: false,
        hasTimedEvent: false,
        milestoneCount: 0,
        primaryEventNoteIds: [],
        overflowEventCount: 0,
      },
    },
    allDayEvents: allDay,
    timedEvents: timed,
    timeline: {
      slotCount: 48,
      slotMinutes: 30,
      blocks: bundle?.blocks ?? [],
      carryOverBlocks,
    },
    isToday: params.anchorDate === params.todayKey,
  };
}
