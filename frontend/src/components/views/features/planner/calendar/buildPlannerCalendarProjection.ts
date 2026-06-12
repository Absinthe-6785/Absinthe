import type { DateTime } from 'luxon';
import type { DDay, Routine, Todo, WeeklySchedule } from '../../../../../types';
import type {
  PlannerCalendarCore,
  PlannerCalendarProjection,
  PlannerCalendarProjectionInput,
  PlannerCalendarViews,
  PlannerCountdownRow,
  PlannerDayBundle,
  PlannerDatedRoutine,
  PlannerDatedSchedule,
  PlannerDatedTodo,
  PlannerEventOccurrence,
  PlannerMilestoneRow,
  PlannerScheduleRow,
  PlannerWeeklySlotRow,
} from './calendarModels';
import {
  buildPlannerEventCatalog,
  buildPlannerMilestoneRows,
  expandEventOccurrences,
} from './buildPlannerEventCatalog';
import {
  daysBetween,
  enumerateDateKeys,
  isoWeekdayFromDateKey,
  monthGridBounds,
  resolvePlannerCalendarRange,
  resolvePlannerIndexRange,
} from './plannerCalendarDateUtils';
import { parseDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';
import {
  buildAgendaViewPayload,
  buildDayViewPayload,
  buildMonthViewPayload,
  buildWeekViewPayload,
} from './buildPlannerViewPayloads';

function normalizeScheduleBlocks(
  blocks: readonly PlannerDatedSchedule[],
  range: { startDate: string; endDate: string },
): PlannerScheduleRow[] {
  const rows: PlannerScheduleRow[] = [];

  for (const block of blocks) {
    if (!block.date || block.is_dday) continue;
    if (block.date < range.startDate || block.date > range.endDate) continue;

    rows.push({
      id: block.id,
      dateKey: block.date,
      title: block.text,
      startTime: block.start_time,
      endTime: block.end_time,
      endNextDay: Boolean(block.end_next_day),
      category: block.category,
      color: block.color,
      source: 'schedule',
    });
  }

  rows.sort((a, b) => {
    const dateCmp = a.dateKey.localeCompare(b.dateKey);
    if (dateCmp !== 0) return dateCmp;
    return a.startTime.localeCompare(b.startTime);
  });

  return rows;
}

function normalizeWeeklySlots(
  weeklySchedules: readonly WeeklySchedule[],
): PlannerWeeklySlotRow[] {
  return weeklySchedules.map(slot => ({
    id: slot.id,
    weekday: slot.day,
    title: slot.title,
    startTime: slot.start_time,
    endTime: slot.end_time,
    color: slot.color,
    source: 'weekly-template' as const,
  }));
}

function groupByDate<T extends { date: string }>(items: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.date) continue;
    const bucket = map.get(item.date);
    if (bucket) bucket.push(item);
    else map.set(item.date, [item]);
  }
  return map;
}

function finalizeDayHints(
  events: readonly PlannerEventOccurrence[],
  blocks: readonly PlannerScheduleRow[],
  milestones: readonly PlannerMilestoneRow[],
): PlannerDayBundle['hints'] {
  const primaryEventNoteIds: string[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (seen.has(event.noteId)) continue;
    seen.add(event.noteId);
    primaryEventNoteIds.push(event.noteId);
    if (primaryEventNoteIds.length >= 2) break;
  }

  const eventCount = events.length;
  const overflowEventCount = Math.max(0, eventCount - 2);

  return {
    blockCount: blocks.length,
    eventCount,
    hasAllDayEvent: events.some(event => event.isAllDay),
    hasTimedEvent: events.some(event => !event.isAllDay && Boolean(event.startTime)),
    milestoneCount: milestones.length,
    primaryEventNoteIds,
    overflowEventCount,
  };
}

function createEmptyBundle(dateKey: string, isRoutineException: boolean): PlannerDayBundle {
  const weekday = isoWeekdayFromDateKey(dateKey) ?? 0;
  return {
    dateKey,
    weekday,
    events: [],
    milestones: [],
    blocks: [],
    todos: [],
    routines: [],
    weeklySlots: [],
    isRoutineException,
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
}

function buildPlannerByDateIndex(params: {
  range: { startDate: string; endDate: string };
  eventOccurrences: readonly PlannerEventOccurrence[];
  milestones: readonly PlannerMilestoneRow[];
  scheduleBlocks: readonly PlannerScheduleRow[];
  weeklySlots: readonly PlannerWeeklySlotRow[];
  todosByDate: Map<string, PlannerDatedTodo[]>;
  routinesByDate: Map<string, PlannerDatedRoutine[]>;
  routineExceptionDates?: ReadonlySet<string>;
}): Map<string, PlannerDayBundle> {
  const byDate = new Map<string, PlannerDayBundle>();
  const dateKeys = enumerateDateKeys(params.range.startDate, params.range.endDate);

  for (const dateKey of dateKeys) {
    const weekday = isoWeekdayFromDateKey(dateKey) ?? 0;
    byDate.set(
      dateKey,
      createEmptyBundle(dateKey, params.routineExceptionDates?.has(dateKey) ?? false),
    );

    const bundle = byDate.get(dateKey)!;
    bundle.weeklySlots = params.weeklySlots.filter(slot => slot.weekday === weekday);
  }

  for (const occurrence of params.eventOccurrences) {
    const bundle = byDate.get(occurrence.dateKey);
    if (!bundle) continue;
    (bundle.events as PlannerEventOccurrence[]).push(occurrence);
  }

  for (const milestone of params.milestones) {
    const bundle = byDate.get(milestone.dateKey);
    if (!bundle) continue;
    (bundle.milestones as PlannerMilestoneRow[]).push(milestone);
  }

  for (const block of params.scheduleBlocks) {
    const bundle = byDate.get(block.dateKey);
    if (!bundle) continue;
    (bundle.blocks as PlannerScheduleRow[]).push(block);
  }

  for (const [dateKey, todos] of params.todosByDate.entries()) {
    const bundle = byDate.get(dateKey);
    if (!bundle) continue;
    bundle.todos = todos.map(({ date: _date, ...todo }) => todo);
  }

  for (const [dateKey, routines] of params.routinesByDate.entries()) {
    const bundle = byDate.get(dateKey);
    if (!bundle) continue;
    bundle.routines = routines.map(({ date: _date, ...routine }) => routine);
  }

  for (const bundle of byDate.values()) {
    bundle.events = [...bundle.events].sort((a, b) => {
      const aTime = a.startTime ?? '00:00';
      const bTime = b.startTime ?? '00:00';
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
    bundle.blocks = [...bundle.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    bundle.hints = finalizeDayHints(bundle.events, bundle.blocks, bundle.milestones);
  }

  return byDate;
}

function normalizeCountdownTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function buildPlannerCountdowns(
  eventDefinitions: readonly { noteId: string; title: string; startDate: string }[],
  legacyDdays: readonly DDay[],
  now: DateTime,
): PlannerCountdownRow[] {
  const todayKey = now.toFormat('yyyy-MM-dd');
  const rows: PlannerCountdownRow[] = [];
  const seen = new Set<string>();

  for (const definition of eventDefinitions) {
    const daysUntil = daysBetween(todayKey, definition.startDate);
    if (daysUntil == null || daysUntil < 0) continue;

    const dedupeKey = `${definition.startDate}:${normalizeCountdownTitle(definition.title)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      id: `event:${definition.noteId}`,
      title: definition.title,
      targetDate: definition.startDate,
      daysUntil,
      source: 'note-event',
      sourceRefId: definition.noteId,
    });
  }

  for (const dday of legacyDdays) {
    if (!dday.date) continue;
    const daysUntil = daysBetween(todayKey, dday.date);
    if (daysUntil == null || daysUntil < 0) continue;

    const dedupeKey = `${dday.date}:${normalizeCountdownTitle(dday.text)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      id: `legacy-dday:${dday.id}`,
      title: dday.text,
      targetDate: dday.date,
      daysUntil,
      source: 'legacy-dday',
      sourceRefId: dday.id,
    });
  }

  rows.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });

  return rows;
}

function emptyViews(anchorDate: string): PlannerCalendarViews {
  const emptyBundle = createEmptyBundle(anchorDate, false);
  return {
    month: {
      year: 0,
      month: 0,
      gridStartDate: anchorDate,
      gridEndDate: anchorDate,
      weekdayOrder: [0, 1, 2, 3, 4, 5, 6],
      cells: [],
    },
    week: { startDate: anchorDate, endDate: anchorDate, columns: [] },
    day: {
      dateKey: anchorDate,
      bundle: emptyBundle,
      allDayEvents: [],
      timedEvents: [],
      timeline: { slotCount: 48, slotMinutes: 30, blocks: [], carryOverBlocks: [] },
      isToday: false,
    },
    agenda: {
      horizon: { startDate: anchorDate, endDate: anchorDate },
      countdownSection: [],
      dayGroups: [],
    },
  };
}

function emptyProjection(input: PlannerCalendarProjectionInput): PlannerCalendarProjection {
  const generatedAt = input.now.toISO() ?? new Date().toISOString();
  return {
    meta: {
      viewMode: input.viewMode,
      anchorDate: input.anchorDate,
      range: { startDate: input.anchorDate, endDate: input.anchorDate },
      generatedAt,
    },
    core: {
      eventOccurrences: [],
      milestones: [],
      scheduleBlocks: [],
      weeklySlots: [],
      countdowns: [],
      eventsByNoteId: new Map(),
      blocksById: new Map(),
    },
    byDate: new Map(),
    views: emptyViews(input.anchorDate),
  };
}

export function buildPlannerCalendarProjection(
  input: PlannerCalendarProjectionInput,
): PlannerCalendarProjection {
  const safeNotes = input.notes ?? [];
  const safeBlocks = input.scheduleBlocks ?? [];
  const safeWeekly = input.weeklySchedules ?? [];
  const safeTodos = input.todos ?? [];
  const safeRoutines = input.routines ?? [];
  const safeDdays = input.legacyDdays ?? [];

  if (!parseDateKey(input.anchorDate)) {
    return emptyProjection(input);
  }

  const resolvedRange = resolvePlannerCalendarRange(input.viewMode, input.anchorDate);
  if (!resolvedRange) {
    return emptyProjection(input);
  }

  const indexRange = resolvePlannerIndexRange(input.anchorDate) ?? resolvedRange;

  const catalog = input.eventCatalog ?? buildPlannerEventCatalog(safeNotes);
  const eventOccurrences = expandEventOccurrences(catalog, indexRange);
  const milestones = buildPlannerMilestoneRows(safeNotes, indexRange);
  const scheduleBlocks = normalizeScheduleBlocks(safeBlocks, indexRange);
  const weeklySlots = normalizeWeeklySlots(safeWeekly);
  const todosByDate = groupByDate(safeTodos);
  const routinesByDate = groupByDate(safeRoutines);

  const byDate = buildPlannerByDateIndex({
    range: indexRange,
    eventOccurrences,
    milestones,
    scheduleBlocks,
    weeklySlots,
    todosByDate,
    routinesByDate,
    routineExceptionDates: input.routineExceptionDates,
  });

  const blocksById = new Map(scheduleBlocks.map(block => [block.id, block]));
  const countdowns = buildPlannerCountdowns(catalog.definitions, safeDdays, input.now);
  const todayKey = input.now.toFormat('yyyy-MM-dd');

  const core: PlannerCalendarCore = {
    eventOccurrences,
    milestones,
    scheduleBlocks,
    weeklySlots,
    countdowns,
    eventsByNoteId: catalog.byNoteId,
    blocksById,
  };

  const monthBounds = monthGridBounds(input.anchorDate);
  const views: PlannerCalendarViews = {
    month: buildMonthViewPayload({
      anchorDate: input.anchorDate,
      monthBounds,
      byDate,
      todayKey,
    }),
    week: buildWeekViewPayload({
      anchorDate: input.anchorDate,
      byDate,
    }),
    day: buildDayViewPayload({
      anchorDate: input.anchorDate,
      byDate,
      allScheduleBlocks: safeBlocks,
      todayKey,
    }),
    agenda: buildAgendaViewPayload({
      anchorDate: input.anchorDate,
      byDate,
      countdowns,
    }),
  };

  return {
    meta: {
      viewMode: input.viewMode,
      anchorDate: input.anchorDate,
      range: { startDate: resolvedRange.startDate, endDate: resolvedRange.endDate },
      generatedAt: input.now.toISO() ?? new Date().toISOString(),
    },
    core,
    byDate,
    views,
  };
}

export { buildPlannerEventCatalog, expandEventOccurrences, buildPlannerMilestoneRows };
