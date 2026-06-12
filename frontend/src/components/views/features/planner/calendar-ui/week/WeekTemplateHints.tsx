import type { PlannerWeeklySlotRow } from '../../calendar';
import { formatWeekTimeRange } from './weekCalendarPresentation';

export interface WeekTemplateHintsProps {
  templateSlots: readonly PlannerWeeklySlotRow[];
}

export function WeekTemplateHints({ templateSlots }: WeekTemplateHintsProps) {
  if (templateSlots.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5" data-planner-week-template-rows>
      {templateSlots.map(slot => (
        <div
          key={slot.id}
          className="px-1.5 py-1 text-[10px] lg:text-[11px] font-medium truncate rounded-md border border-dashed border-border/80 text-muted"
          data-planner-week-template={slot.id}
          title={slot.title}
        >
          {formatWeekTimeRange(slot.startTime, slot.endTime)} {slot.title}
        </div>
      ))}
    </div>
  );
}
