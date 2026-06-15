import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { WeekDayColumns } from './WeekDayColumns';
import { WeekHeader } from './WeekHeader';
import { resolveTodayKeyFromProjection, weekHasContent } from './weekCalendarPresentation';
import { SelectedDayDetailPanel } from '../SelectedDayDetailPanel';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';

export interface WeekCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
}

export function WeekCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  eventActions,
}: WeekCalendarViewProps) {
  const { t } = useTranslation();
  const week = projection.views.week;
  const todayKey = resolveTodayKeyFromProjection(projection.meta.generatedAt);
  const hasContent = weekHasContent(week.columns);

  return (
    <div
      className="flex flex-col gap-2"
      data-planner-calendar-week
    >
      <div className={`rounded-[20px] lg:rounded-[24px] p-2 lg:p-2.5 ${theme.card}`}>
        <WeekHeader
          periodLabel={presentation.labels.weekRangeLabel}
          theme={theme}
        />

        {!hasContent ? (
          <p
            className={`text-[11px] mb-1.5 ${theme.textMuted}`}
            data-planner-calendar-week-empty-hint="true"
          >
            {t('scheduleWeekEmptyHint')}
          </p>
        ) : null}

        <WeekDayColumns
          week={week}
          weekdayLabels={presentation.labels.weekdayShortLabels}
          todayKey={todayKey}
          anchorDate={projection.meta.anchorDate}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onDateSelect}
        />
      </div>

      <SelectedDayDetailPanel
        projection={projection}
        presentation={presentation}
        theme={theme}
        onEventNoteClick={onEventNoteClick}
        scheduleActions={scheduleActions}
        eventActions={eventActions}
        bare
        suppressEmptySections
      />
    </div>
  );
}
