import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { Routine, Theme } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerProjection } from '../../calendar/buildPlannerProjection';
import { useTranslation } from '@/lib/i18n';
import { useNotesStore } from '@/store/useNotesStore';
import { hasDailyNote, formatDailyNoteLabel } from '../../../../k101DailyNote';
import { openTodaysDailyNoteFromApp } from '../../../../k105DailyWorkflow';
import { DayScheduleTimeline } from '../day/DayScheduleTimeline';
import type { DayScheduleActions } from '../day/dayScheduleActions';
import { DayRoutineSummary } from '../day/DayRoutineSummary';
import type { DayRoutineActions } from '../day/dayRoutineActions';
import { DayTodoSummary } from '../day/DayTodoSummary';
import { buildDayViewPayload } from '../../calendar/buildPlannerViewPayloads';
import { WORKSPACE_CARD_RADIUS_CLASS } from '@/components/common/workspaceCardSizes';

export interface PlannerTodayPanelProps {
  plannerProjection: PlannerProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  scheduleActions?: DayScheduleActions;
  routines?: readonly Routine[];
  routineActions?: DayRoutineActions;
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
  routines = [],
  routineActions,
}: PlannerTodayPanelProps) {
  const { t, lang } = useTranslation();
  const notes = useNotesStore(s => s.notes);
  const todayExists = hasDailyNote(notes, todayKey);
  const todayLabel = formatDailyNoteLabel(todayKey, lang);

  const timeline = useMemo(
    () => resolveTodayTimeline(plannerProjection, todayKey),
    [plannerProjection, todayKey],
  );
  const todos = plannerProjection.calendar.views.day.bundle.todos;

  return (
    <div
      className="flex flex-col min-h-0 w-full"
      data-k105-planner-today
      data-k108-planner-today
    >
      <div className={`${WORKSPACE_CARD_RADIUS_CLASS} p-3 lg:p-4 shadow-sm h-full flex flex-col min-h-0 overflow-hidden ${theme.card}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-heading text-base font-bold">{t('plannerToday')}</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted}`}>{todayLabel}</span>
        </div>

        <div className="flex flex-col gap-2.5 min-h-0 flex-1" data-k139-schedule-today-stack>
          <div className="min-h-0" data-k117-schedule-section="routine">
            <DayRoutineSummary
              routines={routines}
              isRoutineException={Boolean(routines[0]?.is_exception_day)}
              theme={theme}
              routineActions={routineActions}
              compactEmpty
            />
          </div>

          {todos.length > 0 ? (
            <section className="min-h-0" data-k117-schedule-section="todo">
              <DayTodoSummary todos={todos} theme={theme} />
            </section>
          ) : null}

          <section className="min-h-0" data-k105-planner-today-schedule>
            <DayScheduleTimeline
              blocks={timeline.blocks}
              carryOverBlocks={timeline.carryOverBlocks}
              scheduleActions={scheduleActions}
            />
          </section>

          <section className="shrink-0" data-k105-planner-todays-note>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
              {t('k105TodaysNote')}
            </p>
            <button
              type="button"
              onClick={openTodaysDailyNoteFromApp}
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold border ${theme.border} hover:bg-muted/40 transition-colors min-h-[38px]`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="shrink-0 text-muted" />
                <span className="truncate">{t('k105TodaysNote')}</span>
              </span>
              <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {todayExists ? t('k101DailyNoteExists') : t('k101DailyNoteNew')}
              </span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
