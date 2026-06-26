import { useMemo, type ReactNode } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
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
  onEditDday?: (schedule: ScheduleDday) => void;
  onDeleteDday?: (id: string) => void;
  deferMonthGrid?: boolean;
  calendarHeader?: ReactNode;
}

/** K-140 desktop workspace: Today + Timetable, Calendar + compact D-Day. */
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
  weeklySchedules = [],
  appSettings,
  THEME_COLORS,
  mutateStatic,
  showToast,
  onEditDday,
  onDeleteDday,
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
      <div
        className="flex flex-col gap-2 min-h-0 lg:h-[calc(100vh-170px)] lg:min-h-[640px] lg:max-h-[780px]"
        data-k140-schedule-grid
      >
        <div className="grid grid-cols-1 gap-2 min-h-0 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] lg:flex-[48]">
          <section className="min-h-0" data-k117-schedule-section="today">
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

          {showTimetableSection ? (
            <section className="min-h-0" data-k117-schedule-section="timetable" data-k117-timetable-section>
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
          ) : (
            <span className="sr-only" data-k117-schedule-section="timetable" aria-hidden="true" />
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 min-h-0 lg:grid-cols-[minmax(0,74fr)_minmax(220px,26fr)] lg:flex-[44]">
          <section
            data-k117-schedule-section="calendar"
            ref={monthRef as React.RefObject<HTMLElement>}
            className={`w-full min-h-0 lg:min-h-[220px] ${WORKSPACE_CARD_RADIUS_CLASS} p-2.5 lg:p-3 overflow-hidden flex flex-col shadow-sm ${theme.card}`}
            data-k117-planner-calendar-adaptive
            data-k108-planner-month-lazy
          >
            {calendarHeader ? (
              <div className="mb-1.5 shrink-0" data-k133b-calendar-supporting-nav>
                {calendarHeader}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
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
            </div>
          </section>

          <section
            className={`min-h-0 lg:min-h-[220px] lg:h-full ${WORKSPACE_CARD_RADIUS_CLASS} p-3 shadow-sm flex flex-col max-h-[300px] lg:max-h-none ${theme.card}`}
            data-k139-schedule-dday-list
          >
            <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
              <h2 className="font-heading text-base font-bold">{t('dday')}</h2>
            </div>
            {upcomingDdays.length > 0 ? (
              <ul className="flex flex-col gap-1.5 overflow-y-auto pr-1 min-h-0 flex-1">
                {upcomingDdays.map(({ item, daysUntil }) => (
                  <li key={item.id} className={`group rounded-xl px-3 py-2 ${theme.input}`} data-k139-schedule-dday={item.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold truncate">{item.text}</span>
                          <span className="text-xs font-black text-primary tabular-nums shrink-0">
                            {daysUntil === 0 ? 'D-Day' : `D-${daysUntil}`}
                          </span>
                        </div>
                        <p className={`text-[11px] font-semibold mt-0.5 ${theme.textMuted}`}>
                          {item.date}{item.category ? ` · ${item.category}` : ''}
                        </p>
                      </div>
                      {onEditDday || onDeleteDday ? (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                          {onEditDday ? (
                            <button
                              type="button"
                              onClick={() => onEditDday(item)}
                              className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                              data-k139-schedule-dday-edit={item.id}
                              aria-label={t('edit')}
                            >
                              <Edit2 size={13} />
                            </button>
                          ) : null}
                          {onDeleteDday ? (
                            <button
                              type="button"
                              onClick={() => onDeleteDday(item.id)}
                              className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-full text-muted hover:text-red-500 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                              data-k139-schedule-dday-delete={item.id}
                              aria-label={t('delete')}
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={`rounded-xl px-3 py-3 flex-1 ${theme.input}`} data-k139-schedule-dday-empty>
                <p className="text-sm font-bold">{t('k139NoDdaysYet')}</p>
                <p className={`text-xs mt-1 ${theme.textMuted}`}>{t('k139DdayEmptyHint')}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
