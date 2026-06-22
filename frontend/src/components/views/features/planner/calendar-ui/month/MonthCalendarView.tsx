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

/** K-125B — routine → today → timetable → calendar → upcoming (usage-first scroll). */
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
    () => <WorkspaceCardSkeleton bars={4} theme={theme} minHeight="min-h-[180px]" />,
    [theme],
  );

  const scrollTimetable = () => scrollToScheduleSection('timetable');

  const showTimetableSection = Boolean(
    appSettings && THEME_COLORS && mutateStatic && showToast,
  );
  const hasUpcoming = plannerProjection.groupedUpcoming.some(section =>
    section.days.some(day => day.items.length > 0),
  );

  const onScheduleBlockClick = scheduleActions?.onView;

  return (
    <div
      className="flex flex-col gap-1.5 lg:gap-2 items-stretch min-h-0 overflow-y-auto overscroll-contain lg:flex-1 lg:max-h-[min(74vh,840px)]"
      data-planner-calendar-month
      data-k108-planner-layout
      data-k117-schedule-workspace
      data-k121-schedule-layout
      data-k125b-schedule-ia
    >
      <section data-k117-schedule-section="routine" data-k125b-schedule-order="1">
        <div className={`rounded-[14px] lg:rounded-[16px] p-2 lg:p-2.5 ${theme.card}`}>
          <PlannerRoutineTodayCard
            theme={theme}
            slots={plannerProjection.timetableToday}
            onOpenTimetable={scrollTimetable}
          />
        </div>
      </section>

      <section data-k117-schedule-section="today" data-k125b-schedule-order="2">
        <PlannerTodayPanel
          plannerProjection={plannerProjection}
          presentation={presentation}
          theme={theme}
          todayKey={todayKey}
          scheduleActions={scheduleActions}
        />
      </section>

      {showTimetableSection ? (
        <section data-k117-schedule-section="timetable" data-k117-timetable-section data-k125b-schedule-order="3">
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

      <section
        data-k117-schedule-section="calendar"
        data-k125b-schedule-order="4"
        ref={monthRef as React.RefObject<HTMLElement>}
        className={`w-full rounded-[14px] lg:rounded-[16px] p-2 lg:p-2.5 min-h-0 max-h-[min(52vh,520px)] overflow-hidden flex flex-col shrink-0 ${theme.card}`}
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
            onScheduleBlockClick={onScheduleBlockClick}
          />
        )}
      </section>

      <section
        data-k117-schedule-section="upcoming"
        data-k125b-schedule-order="5"
        className={hasUpcoming ? 'shrink-0' : 'hidden'}
        aria-hidden={hasUpcoming ? undefined : true}
        data-k124c-upcoming-empty-hidden={hasUpcoming ? undefined : 'true'}
      >
        {hasUpcoming ? (
          <UpcomingAgendaPanel
            tierSections={plannerProjection.groupedUpcoming}
            theme={theme}
            scheduleActions={scheduleActions}
            eventActions={eventActions}
            onDateSelect={onDateSelect}
            embedded
          />
        ) : null}
      </section>
    </div>
  );
}
