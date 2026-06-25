import { useMemo, type ReactNode } from 'react';
import type { AppSettings, Routine, Theme, ThemeColor } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerProjection } from '../../calendar/buildPlannerProjection';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { PlannerTodayPanel } from '../agenda/PlannerTodayPanel';
import { WeeklyTimetableSection } from '../../WeeklyTimetableSection';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import type { DayRoutineActions } from '../day/dayRoutineActions';
import { useElementVisible } from '@/hooks/useElementVisible';
import { WorkspaceCardSkeleton } from '@/components/common/WorkspaceCardSkeleton';
import { WORKSPACE_CARD_RADIUS_CLASS } from '@/components/common/workspaceCardSizes';

export interface MonthCalendarViewProps {
  plannerProjection: PlannerProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  routines?: readonly Routine[];
  routineActions?: DayRoutineActions;
  eventActions?: AgendaEventActions;
  weeklySchedules?: readonly import('@/types').WeeklySchedule[];
  appSettings?: AppSettings;
  THEME_COLORS?: ThemeColor[];
  mutateStatic?: () => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  deferMonthGrid?: boolean;
  calendarHeader?: ReactNode;
}

/** K-117 / K-133B unified Schedule workspace: Today, Routine, Timetable, then Calendar. */
export function MonthCalendarView({
  plannerProjection,
  presentation,
  theme,
  todayKey,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  routines = [],
  routineActions,
  eventActions,
  weeklySchedules = [],
  appSettings,
  THEME_COLORS,
  mutateStatic,
  showToast,
  deferMonthGrid = true,
  calendarHeader,
}: MonthCalendarViewProps) {
  const month = plannerProjection.calendar.views.month;
  const { ref: monthRef, visible: monthVisible } = useElementVisible('120px');
  const showMonthGrid = !deferMonthGrid || monthVisible;

  const monthSkeleton = useMemo(
    () => <WorkspaceCardSkeleton bars={4} theme={theme} minHeight="min-h-[220px]" />,
    [theme],
  );

  const showTimetableSection = Boolean(
    appSettings && THEME_COLORS && mutateStatic && showToast,
  );

  const onScheduleBlockClick = scheduleActions?.onView;

  return (
    <div
      className="flex flex-col gap-2 items-stretch min-h-0 lg:flex-1"
      data-planner-calendar-month
      data-k108-planner-layout
      data-k117-schedule-workspace
      data-k121-schedule-layout
      data-k133b-schedule-flow
    >
      <div className="grid grid-cols-1 gap-2 min-h-0 xl:grid-cols-[minmax(300px,0.38fr)_minmax(0,0.62fr)]" data-k121-schedule-agenda data-k139-schedule-primary-flow>
        <section data-k117-schedule-section="today">
          <PlannerTodayPanel
            plannerProjection={plannerProjection}
            presentation={presentation}
            theme={theme}
            todayKey={todayKey}
            scheduleActions={scheduleActions}
            routines={routines}
            routineActions={routineActions}
          />
        </section>
        <span className="sr-only" data-k117-schedule-section="routine" aria-hidden="true" />

        {showTimetableSection ? (
          <section data-k117-schedule-section="timetable" data-k117-timetable-section>
            <WeeklyTimetableSection
              weeklySchedules={[...weeklySchedules]}
              theme={theme}
              appSettings={appSettings!}
              THEME_COLORS={THEME_COLORS!}
              mutateStatic={mutateStatic!}
              showToast={showToast!}
              sectionEmbedded
            />
          </section>
        ) : null}
      </div>

      <section
        data-k117-schedule-section="calendar"
        ref={monthRef as React.RefObject<HTMLElement>}
        className={`w-full ${WORKSPACE_CARD_RADIUS_CLASS} p-2.5 lg:p-3 min-h-0 overflow-hidden flex flex-col shadow-sm ${theme.card}`}
        data-k117-planner-calendar-adaptive
        data-k108-planner-month-lazy
      >
        {calendarHeader ? (
          <div className="mb-1.5" data-k133b-calendar-supporting-nav>
            {calendarHeader}
          </div>
        ) : null}
        {!showMonthGrid ? monthSkeleton : (
          <MonthCalendarGrid
            month={month}
            weekdayLabels={presentation.labels.weekdayShortLabels}
            theme={theme}
            countdowns={plannerProjection.calendar.core.countdowns}
            presentation={presentation}
            onEventNoteClick={onEventNoteClick}
            onDateSelect={onDateSelect}
            onScheduleBlockClick={onScheduleBlockClick}
          />
        )}
      </section>
    </div>
  );
}
