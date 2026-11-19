import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Theme } from '@/types';
import type { PlannerCountdownRow } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import type { PlannerCalendarPresentation } from '../../calendar';
import type { PlannerMonthViewPayload } from '../../calendar';
import { MonthCalendarCell } from './MonthCalendarCell';
import {
  buildMonthCellDisplayModels,
  chunkMonthCells,
  type MonthCellDisplayModel,
} from './monthCalendarPresentation';

const EMPTY_COUNTDOWNS: readonly PlannerCountdownRow[] = [];

interface MonthCellModelSnapshot {
  gridKey: string;
  models: readonly MonthCellDisplayModel[];
}

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
  const gridKey = `${month.year}:${month.month}:${month.gridStartDate}:${month.gridEndDate}`;
  const previousModelsRef = useRef<MonthCellModelSnapshot | null>(null);
  const models = useMemo(() => {
    const previousModels = previousModelsRef.current?.gridKey === gridKey
      ? previousModelsRef.current.models
      : undefined;
    return buildMonthCellDisplayModels(
      month.cells,
      countdowns,
      daysUntil => formatPlannerCountdownLabel(daysUntil, locale),
      previousModels,
    );
  }, [month.cells, countdowns, locale, gridKey]);

  useLayoutEffect(() => {
    previousModelsRef.current = { gridKey, models };
  }, [gridKey, models]);

  const weeks = useMemo(() => chunkMonthCells(models, 7), [models]);

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
