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
import type { DayScheduleActions } from '../day/dayScheduleActions';
import { buildDayViewPayload } from '../../calendar/buildPlannerViewPayloads';

export interface PlannerTodayPanelProps {
  plannerProjection: PlannerProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  scheduleActions?: DayScheduleActions;
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

/** K-117 Today section — daily note + today's schedule timeline. */
export function PlannerTodayPanel({
  plannerProjection,
  theme,
  todayKey,
  scheduleActions,
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
      <div className={`rounded-[14px] lg:rounded-[16px] p-2 lg:p-2.5 ${theme.card}`}>
        <h2 className="font-heading text-sm font-bold mb-1.5">{t('plannerToday')}</h2>
        <div className={`border-t ${theme.border} mb-1.5`} aria-hidden />

        <section className="mb-2" data-k105-planner-todays-note>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
            {t('k105TodaysNote')}
          </p>
          <button
            type="button"
            onClick={openTodaysDailyNoteFromApp}
            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold border ${theme.border} hover:bg-muted/40 transition-colors min-h-[40px]`}
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

        <section data-k105-planner-today-schedule>
          <DayScheduleTimeline
            blocks={timeline.blocks}
            carryOverBlocks={timeline.carryOverBlocks}
            scheduleActions={scheduleActions}
            suppressEmpty
          />
        </section>
      </div>
    </div>
  );
}
