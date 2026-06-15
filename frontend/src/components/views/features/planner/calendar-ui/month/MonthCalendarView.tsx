import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { UpcomingAgendaPanel } from '../agenda/UpcomingAgendaPanel';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';

export interface MonthCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
}

/** K-80 calendar + upcoming agenda — 70/30, no mode switcher. */
export function MonthCalendarView({
  projection,
  presentation,
  theme,
  todayKey,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  eventActions,
}: MonthCalendarViewProps) {
  const month = projection.views.month;

  return (
    <div
      className="flex flex-col lg:flex-row gap-2 lg:gap-3 items-stretch min-h-0"
      data-planner-calendar-month
    >
      <div className={`w-full lg:w-[70%] lg:min-w-0 rounded-[16px] lg:rounded-[20px] p-2 lg:p-3 ${theme.card}`}>
        <MonthCalendarGrid
          month={month}
          weekdayLabels={presentation.labels.weekdayShortLabels}
          theme={theme}
          countdowns={projection.core.countdowns}
          presentation={presentation}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onDateSelect}
        />
      </div>

      <div className="w-full lg:w-[30%] lg:min-w-[180px] lg:max-w-[280px] shrink-0 flex flex-col min-h-[200px] lg:min-h-0">
        <UpcomingAgendaPanel
          projection={projection}
          presentation={presentation}
          theme={theme}
          todayKey={todayKey}
          scheduleActions={scheduleActions}
          eventActions={eventActions}
          onDateSelect={onDateSelect}
        />
      </div>
    </div>
  );
}
