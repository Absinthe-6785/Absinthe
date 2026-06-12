import type { PlannerEventOccurrence } from '../../calendar';
import { spanPositionClass } from '../month/monthCalendarPresentation';

export interface WeekEventRowsProps {
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
}

export function WeekEventRows({ allDayEvents, timedEvents }: WeekEventRowsProps) {
  if (allDayEvents.length === 0 && timedEvents.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5" data-planner-week-event-rows>
      {allDayEvents.map(event => (
        <div
          key={event.occurrenceId}
          className={`px-1.5 py-1 text-[10px] lg:text-[11px] font-semibold truncate bg-primary/15 text-primary ${spanPositionClass(event.spanPosition)}`}
          data-planner-week-event={event.noteId}
          data-planner-week-event-kind="all-day"
          data-planner-week-event-span={event.spanPosition}
          title={event.title}
        >
          {event.title}
        </div>
      ))}

      {timedEvents.map(event => (
        <div
          key={event.occurrenceId}
          className="px-1.5 py-1 text-[10px] lg:text-[11px] font-semibold truncate rounded-md bg-primary/10 text-primary"
          data-planner-week-event={event.noteId}
          data-planner-week-event-kind="timed"
          title={event.title}
        >
          {event.startTime ? `${event.startTime} ` : ''}{event.title}
        </div>
      ))}
    </div>
  );
}
