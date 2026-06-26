import { useMemo, useCallback } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Routine, Schedule, Theme, ThemeColor, WeeklySchedule } from '../../../../../types';
import { useTranslation } from '../../../../../lib/i18n';
import { CalendarPeriodNav } from './CalendarPeriodNav';
import { MonthCalendarView } from './month';
import type { DayScheduleActions, AgendaEventActions } from './day/dayScheduleActions';
import type { DayRoutineActions } from './day/dayRoutineActions';
import { usePlannerCalendarProjection } from './usePlannerCalendarProjection';
import { WORKSPACE_CARD } from '../../../../common/workspaceCardSizes';
import { toDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';
import { buildPlannerProjection } from '../calendar/buildPlannerProjection';
import { resolveUpcomingRelativeLabel } from './agenda/buildUpcomingTierGroups';
import { useCountdownReviewed } from '../hooks/useCountdownReviewed';

export interface CalendarShellProps {
  now: DateTime;
  anchorDate: string;
  schedules: readonly Schedule[];
  previousDaySchedules?: readonly Schedule[];
  previousDayDate?: string;
  routines?: readonly Routine[];
  ddaySchedules?: readonly (Schedule & { date: string })[];
  weeklySchedules: readonly WeeklySchedule[];
  appSettings: AppSettings;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onAnchorDateChange?: (dateKey: string) => void;
  dayScheduleActions?: DayScheduleActions;
  routineActions?: DayRoutineActions;
  eventActions?: AgendaEventActions;
  THEME_COLORS?: ThemeColor[];
  mutateStatic?: () => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  onAddSchedule?: () => void;
  onEditDday?: (schedule: Schedule & { date: string }) => void;
  onDeleteDday?: (id: string) => void;
}

/** Schedule shell: today-first flow with the month calendar as supporting context. */
export function CalendarShell({
  now,
  anchorDate,
  schedules,
  previousDaySchedules,
  previousDayDate,
  routines = [],
  ddaySchedules = [],
  weeklySchedules,
  appSettings,
  theme,
  onEventNoteClick,
  onAnchorDateChange,
  dayScheduleActions,
  routineActions,
  eventActions,
  THEME_COLORS,
  mutateStatic,
  showToast,
  onAddSchedule,
  onEditDday,
  onDeleteDday,
}: CalendarShellProps) {
  const { t } = useTranslation();
  const todayKey = toDateKey(now.toJSDate()) ?? anchorDate;

  const { projection, presentation } = usePlannerCalendarProjection({
    now,
    anchorDate,
    schedules,
    previousDaySchedules,
    previousDayDate,
    weeklySchedules,
    appSettings,
  });

  const { isReviewed } = useCountdownReviewed();
  const relativeLabel = useCallback(
    (dateKey: string) => resolveUpcomingRelativeLabel(dateKey, todayKey, t),
    [todayKey, t],
  );

  const plannerProjection = useMemo(
    () => buildPlannerProjection({
      calendarProjection: projection,
      presentation,
      todayKey,
      isReviewed,
      relativeLabel,
      laterTierLabel: t('k108Later'),
    }),
    [projection, presentation, todayKey, isReviewed, relativeLabel, t],
  );

  const periodLabel = presentation.labels.monthTitle;

  return (
    <div
      className={`w-full flex-1 min-h-0 overflow-hidden touch-pan-y ${WORKSPACE_CARD.md} pt-2 lg:pt-2.5`}
      aria-label={t('plannerCalendarRegion')}
      data-planner-calendar-shell
      data-planner-calendar-mode="month"
    >
      <MonthCalendarView
        plannerProjection={plannerProjection}
        presentation={presentation}
        theme={theme}
        todayKey={todayKey}
        onEventNoteClick={onEventNoteClick}
        onDateSelect={onAnchorDateChange}
        scheduleActions={dayScheduleActions}
        routines={routines}
        routineActions={routineActions}
        ddaySchedules={ddaySchedules}
        eventActions={eventActions}
        weeklySchedules={weeklySchedules}
        appSettings={appSettings}
        THEME_COLORS={THEME_COLORS}
        mutateStatic={mutateStatic}
        showToast={showToast}
        onEditDday={onEditDday}
        onDeleteDday={onDeleteDday}
        calendarHeader={(
          <CalendarPeriodNav
            viewMode="month"
            anchorDate={anchorDate}
            now={now}
            periodLabel={periodLabel}
            theme={theme}
            onAnchorDateChange={onAnchorDateChange}
            onAddSchedule={onAddSchedule}
          />
        )}
      />
    </div>
  );
}
