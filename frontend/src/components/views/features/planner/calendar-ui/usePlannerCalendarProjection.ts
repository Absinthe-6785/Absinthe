import { useMemo } from 'react';
import type { DateTime } from 'luxon';
import type { NoteBase } from '../../../noteUtils';
import type { AppSettings, Schedule, WeeklySchedule } from '../../../../../types';
import { useNotesStore } from '../../../../../store/useNotesStore';
import { useTranslation } from '../../../../../lib/i18n';
import { buildRelativeDateLabels } from '../../../k102RelativeDateLabels';
import type { RelativeDateLabels } from '../../../k102DateFormat';
import {
  buildPlannerCalendarProjection,
  buildPlannerEventCatalog,
  formatPlannerCalendarPresentation,
  resolvePlannerLocale,
  type PlannerCalendarPresentation,
  type PlannerCalendarProjection,
  type PlannerDatedSchedule,
  type PlannerEventCatalog,
} from '../calendar';

type ScheduleWithCarry = Schedule & { end_next_day?: boolean };

export interface UsePlannerCalendarProjectionInput {
  now: DateTime;
  anchorDate: string;
  schedules: readonly Schedule[];
  previousDaySchedules?: readonly Schedule[];
  previousDayDate?: string;
  weeklySchedules: readonly WeeklySchedule[];
  appSettings: AppSettings;
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
  return schedules.map(schedule => {
    const extended = schedule as ScheduleWithCarry;
    return {
      ...schedule,
      date,
      end_next_day: extended.end_next_day,
    };
  });
}

export function buildPlannerCalendarShellProjection(
  input: UsePlannerCalendarProjectionInput & {
    notes: readonly NoteBase[];
    eventCatalog?: PlannerEventCatalog;
    relativeLabels?: RelativeDateLabels;
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
    todos: [],
    routines: [],
    anchorDate: input.anchorDate,
    viewMode: 'month',
    now: input.now,
    eventCatalog,
  });

  const presentation = formatPlannerCalendarPresentation(
    projection,
    resolvePlannerLocale(input.appSettings.language),
    {
      todayKey: input.now.toFormat('yyyy-MM-dd'),
      relativeLabels: input.relativeLabels,
    },
  );

  return { projection, presentation, eventCatalog };
}

/** Assembles calendar read model — month-only, no routine/todo domain (K-80). */
export function usePlannerCalendarProjection(
  input: UsePlannerCalendarProjectionInput,
): UsePlannerCalendarProjectionResult {
  const notes = useNotesStore(state => state.notes);
  const { t } = useTranslation();
  const relativeLabels = useMemo(() => buildRelativeDateLabels(t), [t]);
  const todayKey = input.now.toFormat('yyyy-MM-dd');

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

  const projection = useMemo(
    () => buildPlannerCalendarProjection({
      notes,
      scheduleBlocks,
      weeklySchedules: input.weeklySchedules,
      todos: [],
      routines: [],
      anchorDate: input.anchorDate,
      viewMode: 'month',
      now: input.now,
      eventCatalog,
    }),
    [
      notes,
      scheduleBlocks,
      input.weeklySchedules,
      input.anchorDate,
      input.now,
      eventCatalog,
    ],
  );

  const presentation = useMemo(
    () => formatPlannerCalendarPresentation(
      projection,
      resolvePlannerLocale(input.appSettings.language),
      { todayKey, relativeLabels },
    ),
    [projection, input.appSettings.language, todayKey, relativeLabels],
  );

  return { projection, presentation, eventCatalog };
}
