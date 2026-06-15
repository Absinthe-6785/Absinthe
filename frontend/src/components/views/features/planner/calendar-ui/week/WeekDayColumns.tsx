import type { Theme } from '@/types';
import type { PlannerWeekViewPayload } from '../../calendar';
import { WeekDayColumn } from './WeekDayColumn';
import { buildWeekDayDisplayModels } from './weekCalendarPresentation';

export interface WeekDayColumnsProps {
  week: PlannerWeekViewPayload;
  weekdayLabels: readonly string[];
  todayKey: string;
  anchorDate: string;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
}

export function WeekDayColumns({
  week,
  weekdayLabels,
  todayKey,
  anchorDate,
  theme,
  onEventNoteClick,
  onDateSelect,
}: WeekDayColumnsProps) {
  const dayModels = buildWeekDayDisplayModels(week, weekdayLabels, todayKey, anchorDate);

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 lg:gap-px"
      data-planner-week-columns
      data-planner-week-columns-layout="stacked-mobile-two-col-tablet-grid-desktop"
    >
      {dayModels.map(model => (
        <WeekDayColumn key={model.dateKey} model={model} theme={theme} onEventNoteClick={onEventNoteClick} onDateSelect={onDateSelect} />
      ))}
    </div>
  );
}
