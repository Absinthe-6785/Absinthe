import { useMemo, type ReactNode } from 'react';
import type { AppSettings, Routine, Schedule, Theme, ThemeColor } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerProjection } from '../../calendar/buildPlannerProjection';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { PlannerTodayPanel } from '../agenda/PlannerTodayPanel';
import { WeeklyTimetableSection } from '../../WeeklyTimetableSection';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import type { DayRoutineActions } from '../day/dayRoutineActions';
import { useElementVisible } from '@/hooks/useElementVisible';
import { useTranslation } from '@/lib/i18n';
import { WorkspaceCardSkeleton } from '@/components/common/WorkspaceCardSkeleton';
import { WORKSPACE_CARD_RADIUS_CLASS } from '@/components/common/workspaceCardSizes';

type ScheduleDday = Schedule & { date: string };

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
  ddaySchedules?: readonly ScheduleDday[];
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
  ddaySchedules = [],
  eventActions,
  weeklySchedules = [],
  appSettings,
  THEME_COLORS,
  mutateStatic,
  showToast,
  deferMonthGrid = true,
  calendarHeader,
}: MonthCalendarViewProps) {
  const { t } = useTranslation();
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
  const upcomingDdays = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00`);
    return ddaySchedules
      .map(item => {
        const target = new Date(`${item.date}T00:00:00`);
        const daysUntil = Math.ceil((target.getTime() - today.getTime()) / 86400000);
        return { item, daysUntil };
      })
      .filter(row => Number.isFinite(row.daysUntil) && row.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 6);
  }, [ddaySchedules, todayKey]);

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

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,0.68fr)_minmax(240px,0.32fr)]" data-k139-schedule-calendar-dday>
        <section
          data-k117-schedule-section="calendar"
          ref={monthRef as React.RefObject<HTMLElement>}
          className={`w-full ${WORKSPACE_CARD_RADIUS_CLASS} p-2.5 lg:p-3 min-h-[300px] overflow-hidden flex flex-col shadow-sm ${theme.card}`}
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

        <section className={`${WORKSPACE_CARD_RADIUS_CLASS} p-3 lg:p-4 shadow-sm ${theme.card}`} data-k139-schedule-dday-list>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="font-heading text-base font-bold">{t('dday')}</h2>
            <span className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted}`}>{t('dday')}</span>
          </div>
          {upcomingDdays.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {upcomingDdays.map(({ item, daysUntil }) => (
                <li key={item.id} className={`rounded-xl px-3 py-2 ${theme.input}`} data-k139-schedule-dday={item.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold truncate">{item.text}</span>
                    <span className="text-xs font-black text-primary tabular-nums shrink-0">
                      {daysUntil === 0 ? 'D-Day' : `D-${daysUntil}`}
                    </span>
                  </div>
                  <p className={`text-[11px] font-semibold mt-0.5 ${theme.textMuted}`}>
                    {item.date}{item.category ? ` · ${item.category}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className={`rounded-xl px-3 py-3 ${theme.input}`} data-k139-schedule-dday-empty>
              <p className="text-sm font-bold">{t('k139NoDdaysYet')}</p>
              <p className={`text-xs mt-1 ${theme.textMuted}`}>{t('k139DdayEmptyHint')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
