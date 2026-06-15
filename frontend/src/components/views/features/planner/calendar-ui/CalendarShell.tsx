import { useMemo, useState, useCallback } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Routine, Schedule, Theme, Todo, WeeklySchedule } from '../../../../../types';
import { useTranslation } from '../../../../../lib/i18n';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { useSwipeNavigation } from '../../../../../hooks/useSwipeNavigation';
import { CalendarModeSwitcher } from './CalendarModeSwitcher';
import { CalendarPeriodNav } from './CalendarPeriodNav';
import { resolveCalendarPeriodLabel } from './calendarPlaceholderSummary';
import { shiftPlannerAnchorDate } from './calendarPeriodNavigation';
import { DayCalendarView } from './day';
import { MonthCalendarView } from './month';
import { WeekCalendarView } from './week';
import type { DayScheduleActions } from './day/dayScheduleActions';
import { DEFAULT_PLANNER_CALENDAR_MODE } from './calendarShellModels';
import type { PlannerCalendarViewMode } from '../calendar';
import { usePlannerCalendarProjection } from './usePlannerCalendarProjection';
import { WorkspaceLayout } from '../../../../common/workspaceLayout';
import { WORKSPACE_CARD } from '../../../../common/workspaceCardSizes';

export interface CalendarShellProps {
  now: DateTime;
  anchorDate: string;
  schedules: readonly Schedule[];
  previousDaySchedules?: readonly Schedule[];
  previousDayDate?: string;
  todos: readonly Todo[];
  routines: readonly Routine[];
  weeklySchedules: readonly WeeklySchedule[];
  appSettings: AppSettings;
  theme: Theme;
  routineExceptionDates?: ReadonlySet<string>;
  initialMode?: PlannerCalendarViewMode;
  onEventNoteClick?: (noteId: string) => void;
  /** Sync planner anchor date (selected day) when using period navigation. */
  onAnchorDateChange?: (dateKey: string) => void;
  /** Reuses PlannerView Timeline schedule modal / confirm flows in Day mode. */
  dayScheduleActions?: DayScheduleActions;
  onViewModeChange?: (mode: PlannerCalendarViewMode) => void;
}

/**
 * Planner Calendar surface host — Month · Week · Day (K-71: Agenda removed).
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
  appSettings,
  theme,
  routineExceptionDates,
  initialMode = DEFAULT_PLANNER_CALENDAR_MODE,
  onEventNoteClick,
  onAnchorDateChange,
  dayScheduleActions,
  onViewModeChange,
}: CalendarShellProps) {
  const { t } = useTranslation();
  const { isMobile } = useViewportLayout();
  const [viewMode, setViewMode] = useState<PlannerCalendarViewMode>(initialMode);

  const handleModeChange = (mode: PlannerCalendarViewMode) => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  };

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

  const swipePrev = useCallback(() => {
    if (!onAnchorDateChange) return;
    const next = shiftPlannerAnchorDate(viewMode, anchorDate, -1);
    if (next) onAnchorDateChange(next);
  }, [onAnchorDateChange, viewMode, anchorDate]);

  const swipeNext = useCallback(() => {
    if (!onAnchorDateChange) return;
    const next = shiftPlannerAnchorDate(viewMode, anchorDate, 1);
    if (next) onAnchorDateChange(next);
  }, [onAnchorDateChange, viewMode, anchorDate]);

  const swipeEnabled = isMobile && (viewMode === 'day' || viewMode === 'week') && Boolean(onAnchorDateChange);
  const swipe = useSwipeNavigation(swipeNext, swipePrev, { enabled: swipeEnabled });

  return (
    <WorkspaceLayout
      workspace="schedule"
      className="w-full shrink-0 mb-4 lg:mb-5 min-h-[480px]"
      header={(
        <>
          <CalendarModeSwitcher
            activeMode={viewMode}
            onModeChange={handleModeChange}
            theme={theme}
          />
          <CalendarPeriodNav
            viewMode={viewMode}
            anchorDate={anchorDate}
            now={now}
            periodLabel={periodLabel}
            theme={theme}
            onAnchorDateChange={onAnchorDateChange}
            compactTouch={isMobile}
          />
          {swipeEnabled ? (
            <p className="text-[10px] text-muted text-center -mt-1 lg:hidden" data-planner-swipe-hint>
              {viewMode === 'day' ? t('scheduleSwipeDayHint') : t('scheduleSwipeWeekHint')}
            </p>
          ) : null}
        </>
      )}
      primary={(
        <div
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
          className={`touch-pan-y ${WORKSPACE_CARD.lg}`}
          aria-label={t('plannerCalendarRegion')}
          data-planner-calendar-shell
          data-planner-calendar-mode={viewMode}
        >
      {viewMode === 'month' ? (
        <MonthCalendarView
          key={activeViewKey}
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onAnchorDateChange}
          scheduleActions={dayScheduleActions}
        />
      ) : viewMode === 'week' ? (
        <WeekCalendarView
          key={activeViewKey}
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onAnchorDateChange}
          scheduleActions={dayScheduleActions}
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
      ) : null}
        </div>
      )}
    />
  );
}
