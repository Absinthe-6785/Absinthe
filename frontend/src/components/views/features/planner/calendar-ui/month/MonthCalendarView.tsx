import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { UpcomingAgendaPanel } from '../agenda/UpcomingAgendaPanel';
import { PlannerTimetableSummary } from '../agenda/PlannerTimetableSummary';
import { DayScheduleTimeline } from '../day/DayScheduleTimeline';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { useTranslation } from '@/lib/i18n';
import { formatLongDateKey } from '../../../../k102DateFormat';

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

/** K-80 calendar + K-104 stacked right column (day schedule, upcoming, timetable). */
export function MonthCalendarView({
  projection,
  presentation,
  theme,
  todayKey,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  eventActions,
  weeklyActivityCount = 0,
  onOpenTimetable,
}: MonthCalendarViewProps) {
  const { t, lang } = useTranslation();
  const month = projection.views.month;
  const dayView = projection.views.day;
  const dayHeading = presentation.labels.agendaDateHeaders.get(dayView.dateKey)
    ?? formatLongDateKey(dayView.dateKey, lang);

  return (
    <div
      className="flex flex-col lg:flex-row gap-2 lg:gap-3 items-stretch min-h-0"
      data-planner-calendar-month
      data-k104-planner-layout
    >
      <div className={`w-full lg:w-[62%] lg:min-w-0 rounded-[16px] lg:rounded-[20px] p-2 lg:p-3 ${theme.card}`}>
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

      <div className="w-full lg:w-[38%] lg:min-w-[220px] lg:max-w-[340px] shrink-0 flex flex-col gap-2 min-h-[240px] lg:min-h-0 lg:overflow-y-auto">
        <div className={`rounded-[14px] lg:rounded-[16px] p-2 lg:p-2.5 ${theme.card}`} data-k104-day-schedule-panel>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">{dayHeading}</p>
          <DayScheduleTimeline
            blocks={dayView.timeline.blocks}
            carryOverBlocks={dayView.timeline.carryOverBlocks}
            scheduleActions={scheduleActions}
          />
        </div>
        <UpcomingAgendaPanel
          projection={projection}
          presentation={presentation}
          theme={theme}
          todayKey={todayKey}
          scheduleActions={scheduleActions}
          eventActions={eventActions}
          onDateSelect={onDateSelect}
        />
        <PlannerTimetableSummary
          theme={theme}
          activityCount={weeklyActivityCount}
          onOpenTimetable={onOpenTimetable}
        />
      </div>
    </div>
  );
}
