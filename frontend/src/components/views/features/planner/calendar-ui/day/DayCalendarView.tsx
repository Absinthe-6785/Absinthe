import { useMemo } from 'react';
import type { Theme } from '../../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { DayEventsSection } from './DayEventsSection';
import { DayHeader } from './DayHeader';
import { DayRoutineSummary } from './DayRoutineSummary';
import { DayScheduleTimeline } from './DayScheduleTimeline';
import { DayTemplateHints } from './DayTemplateHints';
import { DayTodoSummary } from './DayTodoSummary';
import { DayCountdownStrip } from './DayCountdownStrip';
import { DayActivitySection } from './DayActivitySection';
import { buildDayDisplayModel, buildDayActivityItems, dayHasContent } from './dayCalendarPresentation';
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
  const model = buildDayDisplayModel(day);
  const hasContent = dayHasContent(day);
  const activityItems = useMemo(() => buildDayActivityItems(day), [day]);

  return (
    <div
      className={`rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 ${theme.card}`}
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
          className={`text-xs mb-2 ${theme.textMuted}`}
          data-planner-calendar-day-empty-hint="true"
        >
          {t('scheduleDayEmptyHint')}
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-3">
        <div className="flex flex-col gap-2">
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
          <DayTemplateHints templateSlots={model.templateSlots} />
          <DayActivitySection items={activityItems} />
        </div>

        <div className="flex flex-col gap-2">
          <DayCountdownStrip
            countdowns={projection.core.countdowns}
            presentation={presentation}
            onNoteClick={onEventNoteClick}
          />
          <DayRoutineSummary
            routines={model.routines}
            isRoutineException={model.isRoutineException}
            theme={theme}
            routineActions={routineActions}
          />
          <DayTodoSummary
            todos={model.todos}
            theme={theme}
            todoActions={todoActions}
          />
        </div>
      </div>
    </div>
  );
}
