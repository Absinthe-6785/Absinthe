import { useMemo } from 'react';
import type { DateTime } from 'luxon';
import type { NoteBase } from '../../../noteUtils';
import type { AppSettings, DDay, Routine, Schedule, Todo, WeeklySchedule } from '../../../../../types';
import { useNotesStore } from '../../../../../store/useNotesStore';
import {
  buildPlannerCalendarProjection,
  buildPlannerEventCatalog,
  formatPlannerCalendarPresentation,
  resolvePlannerLocale,
  type PlannerCalendarPresentation,
  type PlannerCalendarProjection,
  type PlannerCalendarViewMode,
  type PlannerDatedRoutine,
  type PlannerDatedSchedule,
  type PlannerDatedTodo,
  type PlannerEventCatalog,
} from '../calendar';

type ScheduleWithCarry = Schedule & { end_next_day?: boolean };

export interface UsePlannerCalendarProjectionInput {
  now: DateTime;
  anchorDate: string;
  viewMode: PlannerCalendarViewMode;
  schedules: readonly Schedule[];
  previousDaySchedules?: readonly Schedule[];
  previousDayDate?: string;
  todos: readonly Todo[];
  routines: readonly Routine[];
  weeklySchedules: readonly WeeklySchedule[];
  legacyDdays: readonly DDay[];
  appSettings: AppSettings;
  routineExceptionDates?: ReadonlySet<string>;
}

export interface UsePlannerCalendarProjectionResult {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  eventCatalog: PlannerEventCatalog;
}

function toDatedSchedules(
  schedules: readonly Schedule[],
  date: string,
): PlannerDatedSchedule[] {
  return schedules
    .filter(schedule => !schedule.is_dday)
    .map(schedule => {
      const extended = schedule as ScheduleWithCarry;
      return {
        ...schedule,
        date,
        end_next_day: extended.end_next_day,
      };
    });
}

function toDatedTodos(todos: readonly Todo[], date: string): PlannerDatedTodo[] {
  return todos.map(todo => ({ ...todo, date }));
}

function toDatedRoutines(routines: readonly Routine[], date: string): PlannerDatedRoutine[] {
  return routines.map(routine => ({ ...routine, date }));
}

export function buildPlannerCalendarShellProjection(
  input: UsePlannerCalendarProjectionInput & {
    notes: readonly NoteBase[];
    eventCatalog?: PlannerEventCatalog;
  },
): UsePlannerCalendarProjectionResult {
  const eventCatalog = input.eventCatalog ?? buildPlannerEventCatalog(input.notes);
  const scheduleBlocks = [
    ...toDatedSchedules(input.schedules, input.anchorDate),
    ...(input.previousDayDate
      ? toDatedSchedules(input.previousDaySchedules ?? [], input.previousDayDate)
      : []),
  ];

  const projection = buildPlannerCalendarProjection({
    notes: input.notes,
    scheduleBlocks,
    weeklySchedules: input.weeklySchedules ?? [],
    todos: toDatedTodos(input.todos, input.anchorDate),
    routines: toDatedRoutines(input.routines, input.anchorDate),
    legacyDdays: input.legacyDdays ?? [],
    anchorDate: input.anchorDate,
    viewMode: input.viewMode,
    now: input.now,
    routineExceptionDates: input.routineExceptionDates,
    eventCatalog,
  });

  const presentation = formatPlannerCalendarPresentation(
    projection,
    resolvePlannerLocale(input.appSettings.language),
  );

  return { projection, presentation, eventCatalog };
}

/**
 * Thin hook — assembles Planner Calendar read model from vault + operational props.
 * All business logic lives in buildPlannerCalendarProjection.
 */
export function usePlannerCalendarProjection(
  input: UsePlannerCalendarProjectionInput,
): UsePlannerCalendarProjectionResult {
  const notes = useNotesStore(state => state.notes);

  const eventCatalog = useMemo(
    () => buildPlannerEventCatalog(notes),
    [notes],
  );

  const scheduleBlocks = useMemo(
    () => [
      ...toDatedSchedules(input.schedules, input.anchorDate),
      ...(input.previousDayDate
        ? toDatedSchedules(input.previousDaySchedules ?? [], input.previousDayDate)
        : []),
    ],
    [input.schedules, input.anchorDate, input.previousDaySchedules, input.previousDayDate],
  );

  const datedTodos = useMemo(
    () => toDatedTodos(input.todos, input.anchorDate),
    [input.todos, input.anchorDate],
  );

  const datedRoutines = useMemo(
    () => toDatedRoutines(input.routines, input.anchorDate),
    [input.routines, input.anchorDate],
  );

  const projection = useMemo(
    () => buildPlannerCalendarProjection({
      notes,
      scheduleBlocks,
      weeklySchedules: input.weeklySchedules,
      todos: datedTodos,
      routines: datedRoutines,
      legacyDdays: input.legacyDdays,
      anchorDate: input.anchorDate,
      viewMode: input.viewMode,
      now: input.now,
      routineExceptionDates: input.routineExceptionDates,
      eventCatalog,
    }),
    [
      notes,
      scheduleBlocks,
      input.weeklySchedules,
      datedTodos,
      datedRoutines,
      input.legacyDdays,
      input.anchorDate,
      input.viewMode,
      input.now,
      input.routineExceptionDates,
      eventCatalog,
    ],
  );

  const presentation = useMemo(
    () => formatPlannerCalendarPresentation(
      projection,
      resolvePlannerLocale(input.appSettings.language),
    ),
    [projection, input.appSettings.language],
  );

  return { projection, presentation, eventCatalog };
}
