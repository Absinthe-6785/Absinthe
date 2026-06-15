import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { TodayDashboardView } from './TodayDashboardView';
import type { DayScheduleActions, AgendaEventActions } from './dayScheduleActions';

export interface DayCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
}

/** K-79 Today dashboard — replaces sparse day timeline layout. */
export function DayCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  scheduleActions,
  eventActions,
}: DayCalendarViewProps) {
  const mergedEventActions: AgendaEventActions | undefined = onEventNoteClick || eventActions
    ? {
        ...eventActions,
        onOpen: eventActions?.onOpen ?? onEventNoteClick,
      }
    : eventActions;

  return (
    <div
      className={`rounded-[20px] lg:rounded-[24px] p-2.5 lg:p-3 flex flex-col ${theme.card}`}
      data-planner-calendar-day
    >
      <TodayDashboardView
        projection={projection}
        presentation={presentation}
        theme={theme}
        scheduleActions={scheduleActions}
        eventActions={mergedEventActions}
      />
    </div>
  );
}
