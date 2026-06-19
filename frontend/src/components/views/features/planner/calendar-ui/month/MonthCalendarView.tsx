import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { PlannerTodayPanel } from '../agenda/PlannerTodayPanel';
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
  weeklyActivityCount?: number;
  onOpenTimetable?: () => void;
}

/** K-80 calendar + K-105 Today column (note, activity, schedule, upcoming). */
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
      data-k105-planner-layout
    >
      <div className={`w-full lg:w-[58%] lg:min-w-0 rounded-[16px] lg:rounded-[20px] p-2 lg:p-3 ${theme.card}`}>
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

      <div className="w-full lg:w-[42%] lg:min-w-[220px] lg:max-w-[360px] shrink-0 flex flex-col gap-2 min-h-[240px] lg:min-h-0 lg:overflow-y-auto">
        <PlannerTodayPanel
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
