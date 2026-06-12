import { useMemo, useState } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, DDay, Routine, Schedule, Theme, Todo, WeeklySchedule } from '../../../../../types';
import { CalendarModeSwitcher } from './CalendarModeSwitcher';
import { CalendarPeriodNav } from './CalendarPeriodNav';
import { resolveCalendarPeriodLabel } from './calendarPlaceholderSummary';
import { AgendaCalendarView } from './agenda';
import { MonthCalendarView } from './month';
import { WeekCalendarView } from './week';
import { DayCalendarView } from './day';
import type { DayScheduleActions } from './day/dayScheduleActions';
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
  onEventNoteClick?: (noteId: string) => void;
  /** Sync planner anchor date (selected day) when using period navigation. */
  onAnchorDateChange?: (dateKey: string) => void;
  /** Reuses PlannerView Timeline schedule modal / confirm flows in Day mode. */
  dayScheduleActions?: DayScheduleActions;
}

/**
 * Planner Calendar surface host — Month · Week · Day · Agenda.
 * All four modes mount projection-backed views (K-30.29 Agenda complete).
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
  onEventNoteClick,
  onAnchorDateChange,
  dayScheduleActions,
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

  const periodLabel = useMemo(
    () => resolveCalendarPeriodLabel(viewMode, presentation),
    [viewMode, presentation],
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

      <CalendarPeriodNav
        viewMode={viewMode}
        anchorDate={anchorDate}
        now={now}
        periodLabel={periodLabel}
        theme={theme}
        onAnchorDateChange={onAnchorDateChange}
      />

      {viewMode === 'month' ? (
        <MonthCalendarView
          key={activeViewKey}
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onAnchorDateChange}
        />
      ) : viewMode === 'week' ? (
        <WeekCalendarView
          key={activeViewKey}
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
        />
      ) : viewMode === 'day' ? (
        <DayCalendarView
          key={activeViewKey}
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          scheduleActions={dayScheduleActions}
        />
      ) : viewMode === 'agenda' ? (
        <AgendaCalendarView
          key={activeViewKey}
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
        />
      ) : null}
    </section>
  );
}
