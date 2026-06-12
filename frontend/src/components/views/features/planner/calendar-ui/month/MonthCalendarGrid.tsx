import type { Theme } from '../../../../../types';
import type { PlannerCountdownRow, PlannerMonthViewPayload } from '../../calendar';
import { MonthCalendarCell } from './MonthCalendarCell';
import {
  buildMonthCellDisplayModel,
  chunkMonthCells,
  groupLegacyDdayCountdownsByDate,
} from './monthCalendarPresentation';

export interface MonthCalendarGridProps {
  month: PlannerMonthViewPayload;
  weekdayLabels: readonly string[];
  legacyDdayByDate: ReadonlyMap<string, readonly PlannerCountdownRow[]>;
  theme: Theme;
  countdownLabels: ReadonlyMap<string, string>;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
}

export function MonthCalendarGrid({
  month,
  weekdayLabels,
  legacyDdayByDate,
  theme,
  countdownLabels,
  onEventNoteClick,
  onDateSelect,
}: MonthCalendarGridProps) {
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
            const legacyDdayCountdowns = legacyDdayByDate.get(cell.dateKey) ?? [];
            const model = buildMonthCellDisplayModel(cell, legacyDdayCountdowns);

            return (
              <MonthCalendarCell
                key={cell.dateKey}
                model={model}
                theme={theme}
                countdownLabels={countdownLabels}
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
