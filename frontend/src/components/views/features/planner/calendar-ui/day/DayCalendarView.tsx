import type { Theme } from '../../../../../types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { DayEventsSection } from './DayEventsSection';
import { DayHeader } from './DayHeader';
import { DayRoutineSummary } from './DayRoutineSummary';
import { DayScheduleTimeline } from './DayScheduleTimeline';
import { DayTemplateHints } from './DayTemplateHints';
import { DayTodoSummary } from './DayTodoSummary';
import { buildDayDisplayModel, dayHasContent } from './dayCalendarPresentation';
import type { DayScheduleActions } from './dayScheduleActions';

export interface DayCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  scheduleActions?: DayScheduleActions;
}

export function DayCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  scheduleActions,
}: DayCalendarViewProps) {
  const day = projection.views.day;
  const model = buildDayDisplayModel(day);
  const hasContent = dayHasContent(day);

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}
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
          className={`text-sm mb-4 ${theme.textMuted}`}
          data-planner-calendar-day-empty-hint="true"
        >
          Nothing planned for this day yet. Sections stay visible so you can scan what remains.
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:gap-5">
        <DayEventsSection
          allDayEvents={model.allDayEvents}
          timedEvents={model.timedEvents}
          onEventNoteClick={onEventNoteClick}
        />
        <DayScheduleTimeline
          blocks={model.timelineBlocks}
          carryOverBlocks={model.carryOverBlocks}
          scheduleActions={scheduleActions}
        />
        <DayTemplateHints templateSlots={model.templateSlots} />
        <DayRoutineSummary
          routines={model.routines}
          isRoutineException={model.isRoutineException}
          theme={theme}
        />
        <DayTodoSummary todos={model.todos} theme={theme} />
      </div>
    </div>
  );
}
