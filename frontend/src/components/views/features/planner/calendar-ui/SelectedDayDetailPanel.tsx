import { useMemo } from 'react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../calendar';
import { DayEventsSection } from './day/DayEventsSection';
import { DayRoutineSummary } from './day/DayRoutineSummary';
import { DayScheduleTimeline } from './day/DayScheduleTimeline';
import { DayTodoSummary } from './day/DayTodoSummary';
import { DayCountdownStrip } from './day/DayCountdownStrip';
import { buildDayDisplayModel } from './day/dayCalendarPresentation';
import type { DayScheduleActions } from './day/dayScheduleActions';
import type { DayRoutineActions } from './day/dayRoutineActions';
import type { DayTodoActions } from './day/dayTodoActions';

export type SelectedDayDetailVariant = 'full' | 'month';

export interface SelectedDayDetailPanelProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  scheduleActions?: DayScheduleActions;
  routineActions?: DayRoutineActions;
  todoActions?: DayTodoActions;
  hideHeading?: boolean;
  /** full: day/week — all sections; month: events, schedules, countdowns only */
  variant?: SelectedDayDetailVariant;
  /** Omit card chrome when nested inside another card (day view). */
  bare?: boolean;
}

/** Unified selected-day timeline — schedules, events, routines, tasks, countdowns. */
export function SelectedDayDetailPanel({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  scheduleActions,
  routineActions,
  todoActions,
  hideHeading = false,
  variant = 'full',
  bare = false,
}: SelectedDayDetailPanelProps) {
  const { t } = useTranslation();
  const day = projection.views.day;
  const model = useMemo(() => buildDayDisplayModel(day), [day]);
  const showRoutines = variant === 'full';
  const showTodos = variant === 'full';

  const shellClass = bare
    ? 'flex flex-col gap-2.5'
    : `rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 flex flex-col gap-2.5 ${theme.card}`;

  return (
    <div
      className={shellClass}
      data-planner-selected-day-detail
      data-planner-selected-day-variant={variant}
    >
      {!hideHeading ? (
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-sm lg:text-base font-bold">
            {presentation.labels.dayHeading}
          </h3>
          {model.isToday ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
              {t('plannerToday')}
            </span>
          ) : null}
        </div>
      ) : null}

      <DayScheduleTimeline
        blocks={model.timelineBlocks}
        carryOverBlocks={model.carryOverBlocks}
        scheduleActions={scheduleActions}
      />
      <DayEventsSection
        allDayEvents={model.allDayEvents}
        timedEvents={model.timedEvents}
        onEventNoteClick={onEventNoteClick}
      />
      <DayCountdownStrip
        countdowns={projection.core.countdowns}
        presentation={presentation}
        onNoteClick={onEventNoteClick}
      />
      {showRoutines ? (
        <DayRoutineSummary
          routines={model.routines}
          isRoutineException={model.isRoutineException}
          theme={theme}
          routineActions={routineActions}
        />
      ) : null}
      {showTodos ? (
        <DayTodoSummary
          todos={model.todos}
          theme={theme}
          todoActions={todoActions}
        />
      ) : null}
    </div>
  );
}
