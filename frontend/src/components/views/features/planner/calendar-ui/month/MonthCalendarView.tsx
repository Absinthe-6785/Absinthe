import type { Theme } from '../../../../../types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { groupLegacyDdayCountdownsByDate, monthGridHasAnchors } from './monthCalendarPresentation';

export interface MonthCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
}

export function MonthCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  onDateSelect,
}: MonthCalendarViewProps) {
  const month = projection.views.month;
  const legacyDdayByDate = groupLegacyDdayCountdownsByDate(projection.core.countdowns);
  const hasAnchors = monthGridHasAnchors(month.cells);

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}
      data-planner-calendar-month
    >
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="font-heading text-base lg:text-lg font-bold">Month View</h3>
        {presentation.labels.monthTitle ? (
          <p
            className={`text-sm font-semibold ${theme.textMuted}`}
            data-planner-calendar-period-label
          >
            {presentation.labels.monthTitle}
          </p>
        ) : null}
      </div>

      {!hasAnchors ? (
        <p
          className={`text-sm mb-3 ${theme.textMuted}`}
          data-planner-calendar-month-empty-hint="true"
        >
          No events this month yet. The grid stays visible for orientation.
        </p>
      ) : null}

      <MonthCalendarGrid
        month={month}
        weekdayLabels={presentation.labels.weekdayShortLabels}
        legacyDdayByDate={legacyDdayByDate}
        theme={theme}
        countdownLabels={presentation.labels.countdownLabels}
        onEventNoteClick={onEventNoteClick}
        onDateSelect={onDateSelect}
      />
    </div>
  );
}
