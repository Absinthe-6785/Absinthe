import { useMemo } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Schedule, Theme, WeeklySchedule } from '../../../../../types';
import { useTranslation } from '../../../../../lib/i18n';
import { CalendarPeriodNav } from './CalendarPeriodNav';
import { MonthCalendarView } from './month';
import type { DayScheduleActions, AgendaEventActions } from './day/dayScheduleActions';
import { usePlannerCalendarProjection } from './usePlannerCalendarProjection';
import { WorkspaceLayout } from '../../../../common/workspaceLayout';
import { WORKSPACE_CARD } from '../../../../common/workspaceCardSizes';
import { toDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';

export interface CalendarShellProps {
  now: DateTime;
  anchorDate: string;
  schedules: readonly Schedule[];
  previousDaySchedules?: readonly Schedule[];
  previousDayDate?: string;
  weeklySchedules: readonly WeeklySchedule[];
  appSettings: AppSettings;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onAnchorDateChange?: (dateKey: string) => void;
  dayScheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  weeklyActivityCount?: number;
  onOpenTimetable?: () => void;
}

/** K-80 calendar-first shell — month grid + upcoming agenda only. */
export function CalendarShell({
  now,
  anchorDate,
  schedules,
  previousDaySchedules,
  previousDayDate,
  weeklySchedules,
  appSettings,
  theme,
  onEventNoteClick,
  onAnchorDateChange,
  dayScheduleActions,
  eventActions,
  weeklyActivityCount,
  onOpenTimetable,
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

  const periodLabel = presentation.labels.monthTitle;

  return (
    <WorkspaceLayout
      workspace="schedule"
      className="w-full shrink-0 mb-3 lg:mb-4 min-h-0"
      header={(
        <CalendarPeriodNav
          viewMode="month"
          anchorDate={anchorDate}
          now={now}
          periodLabel={periodLabel}
          theme={theme}
          onAnchorDateChange={onAnchorDateChange}
        />
      )}
      primary={(
        <div
          className={`touch-pan-y ${WORKSPACE_CARD.lg}`}
          aria-label={t('plannerCalendarRegion')}
          data-planner-calendar-shell
          data-planner-calendar-mode="month"
        >
          <MonthCalendarView
            projection={projection}
            presentation={presentation}
            theme={theme}
            todayKey={todayKey}
            onEventNoteClick={onEventNoteClick}
            onDateSelect={onAnchorDateChange}
            scheduleActions={dayScheduleActions}
            eventActions={eventActions}
            weeklyActivityCount={weeklyActivityCount}
            onOpenTimetable={onOpenTimetable}
          />
        </div>
      )}
    />
  );
}
