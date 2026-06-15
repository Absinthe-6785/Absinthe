import type { DateTime } from 'luxon';
import type { NoteBase } from '../../../noteUtils';
import type { Routine, Schedule, Todo, WeeklySchedule } from '../../../../../types';

export type PlannerCalendarViewMode = 'month' | 'week' | 'day';
export type PlannerLocale = 'en' | 'ko' | 'ja';
export type PlannerEventSpanPosition = 'single' | 'start' | 'middle' | 'end';
export type PlannerCountdownSource = 'note-event' | 'schedule-dday';

export interface PlannerDatedSchedule extends Schedule {
  date: string;
  end_next_day?: boolean;
}

export interface PlannerDatedTodo extends Todo {
  date: string;
}

export interface PlannerDatedRoutine extends Routine {
  date: string;
}

export interface PlannerCalendarProjectionInput {
  notes: readonly NoteBase[];
  scheduleBlocks: readonly PlannerDatedSchedule[];
  weeklySchedules: readonly WeeklySchedule[];
  todos: readonly PlannerDatedTodo[];
  routines: readonly PlannerDatedRoutine[];
  anchorDate: string;
  viewMode: PlannerCalendarViewMode;
  now: DateTime;
  routineExceptionDates?: ReadonlySet<string>;
  eventCatalog?: PlannerEventCatalog;
}

export interface PlannerEventDefinition {
  noteId: string;
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
}

export interface PlannerEventCatalog {
  definitions: readonly PlannerEventDefinition[];
  byNoteId: ReadonlyMap<string, PlannerEventDefinition>;
}

export interface PlannerEventOccurrence {
  occurrenceId: string;
  noteId: string;
  title: string;
  dateKey: string;
  spanPosition: PlannerEventSpanPosition;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  definition: PlannerEventDefinition;
}

export interface PlannerMilestoneRow {
  noteId: string;
  title: string;
  dateKey: string;
  label: string;
}

export interface PlannerScheduleRow {
  id: string;
  dateKey: string;
  title: string;
  startTime: string;
  endTime: string;
  endNextDay: boolean;
  category: string;
  color: string;
  source: 'schedule';
}

export interface PlannerWeeklySlotRow {
  id: string;
  weekday: number;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  source: 'weekly-template';
}

export interface PlannerCountdownRow {
  id: string;
  title: string;
  targetDate: string;
  daysUntil: number;
  source: PlannerCountdownSource;
  sourceRefId: string;
}

export interface PlannerDayHints {
  blockCount: number;
  eventCount: number;
  hasAllDayEvent: boolean;
  hasTimedEvent: boolean;
  milestoneCount: number;
  primaryEventNoteIds: readonly string[];
  overflowEventCount: number;
}

export interface PlannerDayBundle {
  dateKey: string;
  weekday: number;
  events: readonly PlannerEventOccurrence[];
  milestones: readonly PlannerMilestoneRow[];
  blocks: readonly PlannerScheduleRow[];
  todos: readonly Todo[];
  routines: readonly Routine[];
  weeklySlots: readonly PlannerWeeklySlotRow[];
  isRoutineException: boolean;
  hints: PlannerDayHints;
}

export interface PlannerCalendarMeta {
  viewMode: PlannerCalendarViewMode;
  anchorDate: string;
  range: { startDate: string; endDate: string };
  generatedAt: string;
}

export interface PlannerCalendarCore {
  eventOccurrences: readonly PlannerEventOccurrence[];
  milestones: readonly PlannerMilestoneRow[];
  scheduleBlocks: readonly PlannerScheduleRow[];
  weeklySlots: readonly PlannerWeeklySlotRow[];
  countdowns: readonly PlannerCountdownRow[];
  eventsByNoteId: ReadonlyMap<string, PlannerEventDefinition>;
  blocksById: ReadonlyMap<string, PlannerScheduleRow>;
}

export interface PlannerMonthCellPayload {
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isAnchorSelected: boolean;
  bundle: PlannerDayBundle;
}

export interface PlannerMonthViewPayload {
  year: number;
  month: number;
  gridStartDate: string;
  gridEndDate: string;
  weekdayOrder: readonly number[];
  cells: readonly PlannerMonthCellPayload[];
}

export interface PlannerWeekColumnPayload {
  dateKey: string;
  bundle: PlannerDayBundle;
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  blocks: readonly PlannerScheduleRow[];
  templateSlots: readonly PlannerWeeklySlotRow[];
  routineSummary: { done: number; total: number } | null;
}

export interface PlannerWeekViewPayload {
  startDate: string;
  endDate: string;
  columns: readonly PlannerWeekColumnPayload[];
}

export interface PlannerDayTimelinePayload {
  slotCount: number;
  slotMinutes: number;
  blocks: readonly PlannerScheduleRow[];
  carryOverBlocks: readonly PlannerScheduleRow[];
}

export interface PlannerDayViewPayload {
  dateKey: string;
  bundle: PlannerDayBundle;
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  timeline: PlannerDayTimelinePayload;
  isToday: boolean;
}

export interface PlannerCalendarViews {
  month: PlannerMonthViewPayload;
  week: PlannerWeekViewPayload;
  day: PlannerDayViewPayload;
}

export interface PlannerCalendarProjection {
  meta: PlannerCalendarMeta;
  core: PlannerCalendarCore;
  byDate: ReadonlyMap<string, PlannerDayBundle>;
  views: PlannerCalendarViews;
}

export interface PlannerCalendarPresentationLabels {
  monthTitle: string;
  weekRangeLabel: string;
  dayHeading: string;
  weekdayShortLabels: readonly string[];
  agendaHorizonLabel: string;
  countdownLabels: ReadonlyMap<string, string>;
  agendaDateHeaders: ReadonlyMap<string, string>;
}

export interface PlannerCalendarPresentation {
  locale: PlannerLocale;
  labels: PlannerCalendarPresentationLabels;
}

export const EMPTY_PLANNER_DAY_HINTS: PlannerDayHints = {
  blockCount: 0,
  eventCount: 0,
  hasAllDayEvent: false,
  hasTimedEvent: false,
  milestoneCount: 0,
  primaryEventNoteIds: [],
  overflowEventCount: 0,
};
