import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { useTranslation } from '@/lib/i18n';
import { useCountdownReviewed } from '../../hooks/useCountdownReviewed';
import { UnifiedAgendaList } from '../agenda/UnifiedAgendaList';
import { buildDayDisplayModel } from './dayCalendarPresentation';
import { buildUpcomingWeekGroups } from './buildUpcomingWeekGroups';
import type { DayScheduleActions, AgendaEventActions } from './dayScheduleActions';

export interface TodayDashboardViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
}

/** K-79 dashboard-first day surface — today agenda + upcoming week + add action. */
export function TodayDashboardView({
  projection,
  presentation,
  theme,
  scheduleActions,
  eventActions,
}: TodayDashboardViewProps) {
  const { t } = useTranslation();
  const { isReviewed } = useCountdownReviewed();
  const day = projection.views.day;
  const model = useMemo(() => buildDayDisplayModel(day), [day]);

  const upcomingGroups = useMemo(
    () => buildUpcomingWeekGroups(
      projection.views.week,
      day.dateKey,
      presentation,
      projection.core.countdowns,
      isReviewed,
    ),
    [projection.views.week, day.dateKey, presentation, projection.core.countdowns, isReviewed],
  );

  const showAdd = Boolean(scheduleActions?.onAdd);

  return (
    <div className="flex flex-col gap-3" data-planner-today-dashboard>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="font-heading text-sm lg:text-base font-bold shrink-0">
            {t('plannerToday')}
          </h3>
          <span className={`text-[11px] font-semibold truncate ${theme.textMuted}`}>
            {presentation.labels.dayHeading}
          </span>
        </div>
        {model.isToday ? (
          <span
            className="text-[10px] font-bold uppercase tracking-wide text-primary shrink-0"
            data-planner-today-badge
          >
            {t('k79TodayBadge')}
          </span>
        ) : null}
      </div>

      <section className="flex flex-col gap-1" data-planner-today-agenda>
        <UnifiedAgendaList
          blocks={model.timelineBlocks}
          carryOverBlocks={model.carryOverBlocks}
          allDayEvents={model.allDayEvents}
          timedEvents={model.timedEvents}
          countdowns={projection.core.countdowns}
          presentation={presentation}
          scheduleActions={scheduleActions}
          eventActions={eventActions}
        />
      </section>

      {upcomingGroups.length > 0 ? (
        <section className="flex flex-col gap-2 pt-1 border-t border-border/60" data-planner-upcoming-week>
          <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted">
            {t('k79UpcomingWeek')}
          </h4>
          {upcomingGroups.map(group => (
            <div key={group.dateKey} className="flex flex-col gap-0.5" data-planner-upcoming-day={group.dateKey}>
              <div className="text-[10px] font-semibold text-muted tabular-nums">{group.dateLabel}</div>
              <ul className="flex flex-col gap-0.5">
                {group.items.map(item => (
                  <li
                    key={item.key}
                    className="px-2 py-1 min-h-[26px] rounded-md bg-surface-alt border border-border/60 text-[11px] font-semibold truncate"
                    data-planner-upcoming-item={item.key}
                  >
                    {item.kind === 'countdown' ? (
                      <span className="text-primary">{item.countdownLabel} {item.title}</span>
                    ) : (
                      <>
                        {item.time ? <span className="text-muted tabular-nums mr-1">{item.time}</span> : null}
                        {item.title}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {showAdd ? (
        <button
          type="button"
          onClick={scheduleActions!.onAdd}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          data-planner-day-schedule-add="true"
        >
          <Plus size={14} strokeWidth={2.5} />
          {t('k79AddEvent')}
        </button>
      ) : null}
    </div>
  );
}
