import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { Theme } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerProjection } from '../../calendar/buildPlannerProjection';
import { useTranslation } from '@/lib/i18n';
import { useNotesStore } from '@/store/useNotesStore';
import { hasDailyNote, formatDailyNoteLabel } from '../../../../k101DailyNote';
import { openTodaysDailyNoteFromApp } from '../../../../k105DailyWorkflow';
import { DayScheduleTimeline } from '../day/DayScheduleTimeline';
import { UpcomingAgendaPanel } from './UpcomingAgendaPanel';
import { PlannerRoutineTodayCard } from './PlannerRoutineTodayCard';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { buildDayViewPayload } from '../../calendar/buildPlannerViewPayloads';

export interface PlannerTodayPanelProps {
  plannerProjection: PlannerProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
  onOpenTimetable?: () => void;
}

function resolveTodayTimeline(
  projection: PlannerProjection,
  todayKey: string,
) {
  const calendar = projection.calendar;
  if (calendar.views.day.dateKey === todayKey) {
    return calendar.views.day.timeline;
  }
  const datedBlocks = calendar.core.scheduleBlocks.map(block => ({
    id: block.id,
    date: block.dateKey,
    text: block.title,
    start_time: block.startTime,
    end_time: block.endTime,
    end_next_day: block.endNextDay ?? false,
    category: block.category,
    color: block.color,
    is_dday: false,
  }));
  return buildDayViewPayload({
    anchorDate: todayKey,
    byDate: calendar.byDate,
    allScheduleBlocks: datedBlocks,
    todayKey,
  }).timeline;
}

/** K-108 Today-centric workspace — note, schedule, routine, upcoming. */
export function PlannerTodayPanel({
  plannerProjection,
  presentation,
  theme,
  todayKey,
  scheduleActions,
  eventActions,
  onDateSelect,
  onOpenTimetable,
}: PlannerTodayPanelProps) {
  const { t, lang } = useTranslation();
  const notes = useNotesStore(s => s.notes);
  const todayExists = hasDailyNote(notes, todayKey);
  const todayLabel = formatDailyNoteLabel(todayKey, lang);

  const timeline = useMemo(
    () => resolveTodayTimeline(plannerProjection, todayKey),
    [plannerProjection, todayKey],
  );

  return (
    <div
      className="flex flex-col min-h-0 w-full"
      data-k105-planner-today
      data-k108-planner-today
    >
      <div className={`rounded-[14px] lg:rounded-[16px] p-2.5 lg:p-3 ${theme.card}`}>
        <h2 className="font-heading text-sm font-bold mb-2">{t('plannerToday')}</h2>
        <div className={`border-t ${theme.border} mb-2`} aria-hidden />

        <section className="mb-3" data-k105-planner-todays-note>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
            {t('k105TodaysNote')}
          </p>
          <button
            type="button"
            onClick={openTodaysDailyNoteFromApp}
            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold border ${theme.border} hover:bg-muted/40 transition-colors min-h-[44px]`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <FileText size={14} className="shrink-0 text-muted" />
              <span className="truncate">{todayLabel}</span>
            </span>
            <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {todayExists ? t('k101DailyNoteExists') : t('k101DailyNoteNew')}
            </span>
          </button>
        </section>

        <section className="mb-3" data-k105-planner-today-schedule>
          <DayScheduleTimeline
            blocks={timeline.blocks}
            carryOverBlocks={timeline.carryOverBlocks}
            scheduleActions={scheduleActions}
          />
        </section>

        <PlannerRoutineTodayCard
          theme={theme}
          slots={plannerProjection.timetableToday}
          onOpenTimetable={onOpenTimetable}
        />

        <UpcomingAgendaPanel
          tierSections={plannerProjection.groupedUpcoming}
          theme={theme}
          scheduleActions={scheduleActions}
          eventActions={eventActions}
          onDateSelect={onDateSelect}
          embedded
        />
      </div>
    </div>
  );
}
