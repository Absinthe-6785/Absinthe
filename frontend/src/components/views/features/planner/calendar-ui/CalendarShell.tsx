import { useMemo, useState } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, DDay, Routine, Schedule, Theme, Todo, WeeklySchedule } from '../../../../../types';
import { CalendarModeSwitcher } from './CalendarModeSwitcher';
import { CalendarViewPlaceholder } from './CalendarViewPlaceholder';
import { DEFAULT_PLANNER_CALENDAR_MODE } from './calendarShellModels';
import type { PlannerCalendarViewMode } from '../calendar';
import { usePlannerCalendarProjection } from './usePlannerCalendarProjection';

export interface CalendarShellProps {
  now: DateTime;
  anchorDate: string;
  schedules: readonly Schedule[];
  previousDaySchedules?: readonly Schedule[];
  previousDayDate?: string;
  todos: readonly Todo[];
  routines: readonly Routine[];
  weeklySchedules: readonly WeeklySchedule[];
  legacyDdays: readonly DDay[];
  appSettings: AppSettings;
  theme: Theme;
  routineExceptionDates?: ReadonlySet<string>;
  initialMode?: PlannerCalendarViewMode;
}

/**
 * Planner Calendar surface host — Month · Week · Day · Agenda.
 * K-30.25: projection wiring + placeholders; real views replace placeholders later.
 */
export function CalendarShell({
  now,
  anchorDate,
  schedules,
  previousDaySchedules,
  previousDayDate,
  todos,
  routines,
  weeklySchedules,
  legacyDdays,
  appSettings,
  theme,
  routineExceptionDates,
  initialMode = DEFAULT_PLANNER_CALENDAR_MODE,
}: CalendarShellProps) {
  const [viewMode, setViewMode] = useState<PlannerCalendarViewMode>(initialMode);

  const { projection, presentation } = usePlannerCalendarProjection({
    now,
    anchorDate,
    viewMode,
    schedules,
    previousDaySchedules,
    previousDayDate,
    todos,
    routines,
    weeklySchedules,
    legacyDdays,
    appSettings,
    routineExceptionDates,
  });

  const activeViewKey = useMemo(
    () => `${viewMode}:${projection.meta.generatedAt}`,
    [viewMode, projection.meta.generatedAt],
  );

  return (
    <section
      className="w-full shrink-0 flex flex-col gap-3 lg:gap-4 mb-4 lg:mb-5"
      data-planner-calendar-shell
      data-planner-calendar-mode={viewMode}
    >
      <CalendarModeSwitcher
        activeMode={viewMode}
        onModeChange={setViewMode}
        theme={theme}
      />

      <CalendarViewPlaceholder
        key={activeViewKey}
        mode={viewMode}
        projection={projection}
        presentation={presentation}
        theme={theme}
      />
    </section>
  );
}
