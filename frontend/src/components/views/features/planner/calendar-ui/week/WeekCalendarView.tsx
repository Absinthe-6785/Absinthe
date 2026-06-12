import type { Theme } from '../../../../../types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { WeekDayColumns } from './WeekDayColumns';
import { WeekHeader } from './WeekHeader';
import { resolveTodayKeyFromProjection, weekHasContent } from './weekCalendarPresentation';

export interface WeekCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
}

export function WeekCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
}: WeekCalendarViewProps) {
  const week = projection.views.week;
  const todayKey = resolveTodayKeyFromProjection(projection.meta.generatedAt);
  const hasContent = weekHasContent(week.columns);

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}
      data-planner-calendar-week
    >
      <WeekHeader
        periodLabel={presentation.labels.weekRangeLabel}
        theme={theme}
      />

      {!hasContent ? (
        <p
          className={`text-sm mb-3 ${theme.textMuted}`}
          data-planner-calendar-week-empty-hint="true"
        >
          Nothing scheduled this week yet. The seven-day layout stays visible for orientation.
        </p>
      ) : null}

      <WeekDayColumns
        week={week}
        weekdayLabels={presentation.labels.weekdayShortLabels}
        todayKey={todayKey}
        anchorDate={projection.meta.anchorDate}
        theme={theme}
        onEventNoteClick={onEventNoteClick}
      />
    </div>
  );
}
