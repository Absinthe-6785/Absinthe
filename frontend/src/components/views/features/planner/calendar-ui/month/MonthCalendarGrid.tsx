import { useMemo } from 'react';
import type { Theme } from '@/types';
import type { PlannerCountdownRow } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerMonthViewPayload } from '../../calendar';
import { MonthCalendarCell } from './MonthCalendarCell';
import { buildMonthCellDisplayModels, chunkMonthCells } from './monthCalendarPresentation';

const EMPTY_COUNTDOWNS: readonly PlannerCountdownRow[] = [];

export interface MonthCalendarGridProps {
  month: PlannerMonthViewPayload;
  weekdayLabels: readonly string[];
  theme: Theme;
  countdowns?: readonly PlannerCountdownRow[];
  presentation?: PlannerCalendarPresentation;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  onScheduleBlockClick?: (blockId: string) => void;
}

export function MonthCalendarGrid({
  month,
  weekdayLabels,
  theme,
  countdowns = EMPTY_COUNTDOWNS,
  presentation,
  onEventNoteClick,
  onDateSelect,
  onScheduleBlockClick,
}: MonthCalendarGridProps) {
  const locale = presentation?.locale ?? 'en';
  const weeks = useMemo(() => chunkMonthCells(
    buildMonthCellDisplayModels(
      month.cells,
      countdowns,
      daysUntil => formatPlannerCountdownLabel(daysUntil, locale),
    ),
    7,
  ), [month.cells, countdowns, locale]);

  return (
    <div className="h-full min-h-0 flex flex-col" data-planner-month-grid>
      <div className="grid grid-cols-7 gap-px mb-1 shrink-0">
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

      <div className="grid grid-cols-7 grid-rows-6 gap-px min-h-0 flex-1 overflow-hidden">
        {weeks.flatMap(week =>
          week.map(model => (
            <MonthCalendarCell
              key={model.dateKey}
              model={model}
              theme={theme}
              onEventNoteClick={onEventNoteClick}
              onDateSelect={onDateSelect}
              onScheduleBlockClick={onScheduleBlockClick}
            />
          )),
        )}
      </div>
    </div>
  );
}
