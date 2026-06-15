import type { Theme } from '@/types';
import type { PlannerCountdownRow } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerMonthViewPayload } from '../../calendar';
import { MonthCalendarCell } from './MonthCalendarCell';
import { buildMonthCellDisplayModel, chunkMonthCells } from './monthCalendarPresentation';

export interface MonthCalendarGridProps {
  month: PlannerMonthViewPayload;
  weekdayLabels: readonly string[];
  theme: Theme;
  countdowns?: readonly PlannerCountdownRow[];
  presentation?: PlannerCalendarPresentation;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
}

export function MonthCalendarGrid({
  month,
  weekdayLabels,
  theme,
  countdowns = [],
  presentation,
  onEventNoteClick,
  onDateSelect,
}: MonthCalendarGridProps) {
  const formatCountdown = (daysUntil: number) =>
    formatPlannerCountdownLabel(daysUntil, presentation?.locale ?? 'en');
  const weeks = chunkMonthCells(month.cells, 7);

  return (
    <div data-planner-month-grid>
      <div className="grid grid-cols-7 gap-px mb-1">
        {weekdayLabels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className={`text-center text-[10px] lg:text-xs font-semibold py-1 ${theme.textMuted}`}
            data-planner-month-weekday-header={index}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {weeks.flatMap(week =>
          week.map(cell => {
            const model = buildMonthCellDisplayModel(cell, countdowns, formatCountdown);
            return (
              <MonthCalendarCell
                key={cell.dateKey}
                model={model}
                theme={theme}
                onEventNoteClick={onEventNoteClick}
                onDateSelect={onDateSelect}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
