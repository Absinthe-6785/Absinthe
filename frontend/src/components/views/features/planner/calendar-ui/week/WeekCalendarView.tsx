import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { WeekDayColumns } from './WeekDayColumns';
import { WeekHeader } from './WeekHeader';
import { resolveTodayKeyFromProjection, weekHasContent } from './weekCalendarPresentation';
import { SelectedDayDetailPanel } from '../SelectedDayDetailPanel';
import type { DayScheduleActions } from '../day/dayScheduleActions';
import type { DayRoutineActions } from '../day/dayRoutineActions';
import type { DayTodoActions } from '../day/dayTodoActions';

export interface WeekCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  routineActions?: DayRoutineActions;
  todoActions?: DayTodoActions;
}

export function WeekCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  routineActions,
  todoActions,
}: WeekCalendarViewProps) {
  const { t } = useTranslation();
  const week = projection.views.week;
  const todayKey = resolveTodayKeyFromProjection(projection.meta.generatedAt);
  const hasContent = weekHasContent(week.columns);

  return (
    <div
      className="flex flex-col gap-3 lg:gap-4"
      data-planner-calendar-week
    >
      <div className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}>
        <WeekHeader
          periodLabel={presentation.labels.weekRangeLabel}
          theme={theme}
        />

        {!hasContent ? (
          <p
            className={`text-sm mb-3 ${theme.textMuted}`}
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
        routineActions={routineActions}
        todoActions={todoActions}
        bare
      />
    </div>
  );
}
