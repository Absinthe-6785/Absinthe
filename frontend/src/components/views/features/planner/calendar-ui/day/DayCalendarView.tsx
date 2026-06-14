import type { Theme } from '../../../../../types';
import { useTranslation } from '../../../../../../lib/i18n';
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
  const { t } = useTranslation();
  const day = projection.views.day;
  const model = buildDayDisplayModel(day);
  const hasContent = dayHasContent(day);

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
          className={`text-xs mb-3 ${theme.textMuted}`}
          data-planner-calendar-day-empty-hint="true"
        >
          {t('scheduleDayEmptyHint')}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5 lg:gap-3">
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
