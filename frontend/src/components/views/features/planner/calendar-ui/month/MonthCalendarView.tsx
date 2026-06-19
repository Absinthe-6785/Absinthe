import { useMemo } from 'react';
import type { Theme } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerProjection } from '../../calendar/buildPlannerProjection';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { PlannerTodayPanel } from '../agenda/PlannerTodayPanel';
import { PlannerTimetableSummary } from '../agenda/PlannerTimetableSummary';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { useElementVisible } from '@/hooks/useElementVisible';
import { WorkspaceCardSkeleton } from '@/components/common/WorkspaceCardSkeleton';

export interface MonthCalendarViewProps {
  plannerProjection: PlannerProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  weeklyActivityCount?: number;
  onOpenTimetable?: () => void;
  deferMonthGrid?: boolean;
}

/** K-108 Today-centric planner — Today first, then month calendar, then timetable summary. */
export function MonthCalendarView({
  plannerProjection,
  presentation,
  theme,
  todayKey,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  eventActions,
  weeklyActivityCount = 0,
  onOpenTimetable,
  deferMonthGrid = true,
}: MonthCalendarViewProps) {
  const month = plannerProjection.calendar.views.month;
  const { ref: monthRef, visible: monthVisible } = useElementVisible('120px');
  const showMonthGrid = !deferMonthGrid || monthVisible;

  const monthSkeleton = useMemo(
    () => <WorkspaceCardSkeleton bars={4} theme={theme} minHeight="min-h-[280px]" />,
    [theme],
  );

  return (
    <div
      className="flex flex-col gap-3 items-stretch min-h-0"
      data-planner-calendar-month
      data-k108-planner-layout
    >
      <PlannerTodayPanel
        plannerProjection={plannerProjection}
        presentation={presentation}
        theme={theme}
        todayKey={todayKey}
        scheduleActions={scheduleActions}
        eventActions={eventActions}
        onDateSelect={onDateSelect}
        onOpenTimetable={onOpenTimetable}
      />

      <div
        ref={monthRef as React.RefObject<HTMLDivElement>}
        className={`w-full rounded-[16px] lg:rounded-[20px] p-2 lg:p-3 ${theme.card}`}
        data-k108-planner-month-lazy
      >
        {!showMonthGrid ? monthSkeleton : (
          <MonthCalendarGrid
            month={month}
            weekdayLabels={presentation.labels.weekdayShortLabels}
            theme={theme}
            countdowns={plannerProjection.calendar.core.countdowns}
            presentation={presentation}
            onEventNoteClick={onEventNoteClick}
            onDateSelect={onDateSelect}
          />
        )}
      </div>

      <PlannerTimetableSummary
        theme={theme}
        activityCount={weeklyActivityCount}
        onOpenTimetable={onOpenTimetable}
      />
    </div>
  );
}
