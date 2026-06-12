import type { PlannerWeeklySlotRow } from '../../calendar';
import { formatDayTimeRange } from './dayCalendarPresentation';

export interface DayTemplateHintsProps {
  templateSlots: readonly PlannerWeeklySlotRow[];
}

export function DayTemplateHints({ templateSlots }: DayTemplateHintsProps) {
  if (templateSlots.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-day-template-hints>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Weekly template
      </h4>
      <div className="flex flex-col gap-1">
        {templateSlots.map(slot => (
          <div
            key={slot.id}
            className="px-2 py-1.5 text-xs lg:text-sm font-medium truncate rounded-md border border-dashed border-border/80 text-muted"
            data-planner-day-template={slot.id}
            title={slot.title}
          >
            {formatDayTimeRange(slot.startTime, slot.endTime)} {slot.title}
          </div>
        ))}
      </div>
    </section>
  );
}
