import { useMemo } from 'react';
import type { AppSettings, Theme, ThemeColor } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerProjection } from '../../calendar/buildPlannerProjection';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { PlannerTodayPanel } from '../agenda/PlannerTodayPanel';
import { UpcomingAgendaPanel } from '../agenda/UpcomingAgendaPanel';
import { PlannerRoutineTodayCard } from '../agenda/PlannerRoutineTodayCard';
import { WeeklyTimetableSection } from '../../WeeklyTimetableSection';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { useElementVisible } from '@/hooks/useElementVisible';
import { WorkspaceCardSkeleton } from '@/components/common/WorkspaceCardSkeleton';
import { scrollToScheduleSection } from '../../ScheduleSectionNav';

export interface MonthCalendarViewProps {
  plannerProjection: PlannerProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  weeklySchedules?: readonly import('@/types').WeeklySchedule[];
  appSettings?: AppSettings;
  THEME_COLORS?: ThemeColor[];
  mutateStatic?: () => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  deferMonthGrid?: boolean;
}

/** K-117 unified Schedule workspace — Today → Upcoming → Calendar → Routine → Timetable. */
export function MonthCalendarView({
  plannerProjection,
  presentation,
  theme,
  todayKey,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  eventActions,
  weeklySchedules = [],
  appSettings,
  THEME_COLORS,
  mutateStatic,
  showToast,
  deferMonthGrid = true,
}: MonthCalendarViewProps) {
  const month = plannerProjection.calendar.views.month;
  const { ref: monthRef, visible: monthVisible } = useElementVisible('120px');
  const showMonthGrid = !deferMonthGrid || monthVisible;

  const monthSkeleton = useMemo(
    () => <WorkspaceCardSkeleton bars={4} theme={theme} minHeight="min-h-[220px]" />,
    [theme],
  );

  const scrollTimetable = () => scrollToScheduleSection('timetable');

  const showTimetableSection = Boolean(
    appSettings && THEME_COLORS && mutateStatic && showToast,
  );

  return (
    <div
      className="flex flex-col gap-2 lg:gap-2.5 items-stretch min-h-0"
      data-planner-calendar-month
      data-k108-planner-layout
      data-k117-schedule-workspace
    >
      <section data-k117-schedule-section="today">
        <PlannerTodayPanel
          plannerProjection={plannerProjection}
          presentation={presentation}
          theme={theme}
          todayKey={todayKey}
          scheduleActions={scheduleActions}
        />
      </section>

      <section data-k117-schedule-section="upcoming">
        <UpcomingAgendaPanel
          tierSections={plannerProjection.groupedUpcoming}
          theme={theme}
          scheduleActions={scheduleActions}
          eventActions={eventActions}
          onDateSelect={onDateSelect}
          embedded
          collapseWhenEmpty
        />
      </section>

      <section
        data-k117-schedule-section="calendar"
        ref={monthRef as React.RefObject<HTMLElement>}
        className={`w-full rounded-[14px] lg:rounded-[16px] p-2 lg:p-2.5 ${theme.card}`}
        data-k117-planner-calendar-adaptive
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
      </section>

      <section data-k117-schedule-section="routine">
        <div className={`rounded-[14px] lg:rounded-[16px] p-2.5 lg:p-3 ${theme.card}`}>
          <PlannerRoutineTodayCard
            theme={theme}
            slots={plannerProjection.timetableToday}
            onOpenTimetable={scrollTimetable}
          />
        </div>
      </section>

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
  );
}
