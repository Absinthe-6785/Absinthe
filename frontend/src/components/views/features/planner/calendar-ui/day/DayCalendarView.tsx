import { useMemo } from 'react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { DayHeader } from './DayHeader';
import { SelectedDayDetailPanel } from '../SelectedDayDetailPanel';
import { buildDayDisplayModel, dayHasContent } from './dayCalendarPresentation';
import type { DayScheduleActions } from './dayScheduleActions';
import type { DayRoutineActions } from './dayRoutineActions';
import type { DayTodoActions } from './dayTodoActions';

export interface DayCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  scheduleActions?: DayScheduleActions;
  routineActions?: DayRoutineActions;
  todoActions?: DayTodoActions;
}

/** K-71 single-flow day view — no empty side column. */
export function DayCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  scheduleActions,
  routineActions,
  todoActions,
}: DayCalendarViewProps) {
  const { t } = useTranslation();
  const day = projection.views.day;
  const model = useMemo(() => buildDayDisplayModel(day), [day]);
  const hasContent = dayHasContent(day);

  return (
    <div
      className={`rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 flex flex-col gap-2.5 ${theme.card}`}
      data-planner-calendar-day
    >
      <DayHeader
        dayHeading={presentation.labels.dayHeading}
        isToday={model.isToday}
        milestoneCount={model.milestoneCount}
        theme={theme}
      />

      {!hasContent ? (
        <p
          className={`text-xs ${theme.textMuted}`}
          data-planner-calendar-day-empty-hint="true"
        >
          {t('scheduleDayEmptyHint')}
        </p>
      ) : null}

      <SelectedDayDetailPanel
        projection={projection}
        presentation={presentation}
        theme={theme}
        onEventNoteClick={onEventNoteClick}
        scheduleActions={scheduleActions}
        routineActions={routineActions}
        todoActions={todoActions}
        hideHeading
        bare
      />
    </div>
  );
}
