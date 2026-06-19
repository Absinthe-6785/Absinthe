import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { buildDayViewPayload } from '../../calendar';
import { useTranslation } from '@/lib/i18n';
import { useNotesStore } from '@/store/useNotesStore';
import { hasDailyNote, formatDailyNoteLabel } from '../../../../k101DailyNote';
import { openTodaysDailyNoteFromApp } from '../../../../k105DailyWorkflow';
import {
  buildLastOpenedActivity,
  buildRecentEditedActivity,
} from '../../../../k101RecentActivity';
import { displayNoteTitle } from '../../../../noteDisplayTitle';
import { formatActivityTimestamp } from '../../../../k102DateFormat';
import { buildRelativeDateLabels } from '../../../../k102RelativeDateLabels';
import { DayScheduleTimeline } from '../day/DayScheduleTimeline';
import { UpcomingAgendaPanel } from './UpcomingAgendaPanel';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';
import { openNote } from '@/lib/noteNavigation';

export interface PlannerTodayPanelProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  todayKey: string;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
  onDateSelect?: (dateKey: string) => void;
}

function resolveTodayTimeline(
  projection: PlannerCalendarProjection,
  todayKey: string,
) {
  if (projection.views.day.dateKey === todayKey) {
    return projection.views.day.timeline;
  }
  const datedBlocks = projection.core.scheduleBlocks.map(block => ({
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
    byDate: projection.byDate,
    allScheduleBlocks: datedBlocks,
    todayKey,
  }).timeline;
}

export function PlannerTodayPanel({
  projection,
  presentation,
  theme,
  todayKey,
  scheduleActions,
  eventActions,
  onDateSelect,
}: PlannerTodayPanelProps) {
  const { t, lang } = useTranslation();
  const notes = useNotesStore(s => s.notes);
  const todayExists = hasDailyNote(notes, todayKey);
  const todayLabel = formatDailyNoteLabel(todayKey, lang);
  const relativeLabels = useMemo(() => buildRelativeDateLabels(t), [t]);

  const timeline = useMemo(
    () => resolveTodayTimeline(projection, todayKey),
    [projection, todayKey],
  );

  const activityEntries = useMemo(() => {
    const opened = buildLastOpenedActivity(notes, 2);
    const edited = buildRecentEditedActivity(notes, 2);
    const seen = new Set<string>();
    const merged = [...opened, ...edited].filter(entry => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
    return merged.slice(0, 4);
  }, [notes]);

  return (
    <div
      className="flex flex-col gap-2 min-h-0"
      data-k105-planner-today
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
            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold border ${theme.border} hover:bg-muted/40 transition-colors`}
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

        {activityEntries.length > 0 ? (
          <section className="mb-3" data-k105-planner-recent-activity>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1.5">
              {t('k101RecentActivity')}
            </p>
            <ul className="flex flex-col gap-0.5">
              {activityEntries.map(entry => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => openNote(entry.id, { returnTab: 'planner' })}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-muted/40 transition-colors`}
                  >
                    <span className="truncate font-medium">{displayNoteTitle(entry.title)}</span>
                    <span className="text-[9px] text-muted shrink-0 tabular-nums">
                      {formatActivityTimestamp(entry.timestamp, todayKey, lang, relativeLabels)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section data-k105-planner-today-schedule>
          <DayScheduleTimeline
            blocks={timeline.blocks}
            carryOverBlocks={timeline.carryOverBlocks}
            scheduleActions={scheduleActions}
          />
        </section>
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
    </div>
  );
}
