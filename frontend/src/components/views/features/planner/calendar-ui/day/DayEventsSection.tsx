import type { PlannerEventOccurrence } from '../../calendar';
import { spanPositionClass } from '../month/monthCalendarPresentation';

export interface DayEventsSectionProps {
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
}

export function DayEventsSection({ allDayEvents, timedEvents }: DayEventsSectionProps) {
  if (allDayEvents.length === 0 && timedEvents.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-day-events>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Events
      </h4>
      <div className="flex flex-col gap-1">
        {allDayEvents.map(event => (
          <div
            key={event.occurrenceId}
            className={`px-2 py-1.5 text-xs lg:text-sm font-semibold truncate bg-primary/15 text-primary ${spanPositionClass(event.spanPosition)}`}
            data-planner-day-event={event.noteId}
            data-planner-day-event-kind="all-day"
            data-planner-day-event-span={event.spanPosition}
            title={event.title}
          >
            {event.title}
          </div>
        ))}

        {timedEvents.map(event => (
          <div
            key={event.occurrenceId}
            className="px-2 py-1.5 text-xs lg:text-sm font-semibold truncate rounded-md bg-primary/10 text-primary"
            data-planner-day-event={event.noteId}
            data-planner-day-event-kind="timed"
            title={event.title}
          >
            {event.startTime ? `${event.startTime} ` : ''}{event.title}
          </div>
        ))}
      </div>
    </section>
  );
}
