import type { PlannerEventOccurrence } from '../../calendar';
import { spanPositionClass } from '../month/monthCalendarPresentation';

export interface DayEventsSectionProps {
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  onEventNoteClick?: (noteId: string) => void;
}

export function DayEventsSection({ allDayEvents, timedEvents, onEventNoteClick }: DayEventsSectionProps) {
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
            className={`px-2 py-1.5 text-xs lg:text-sm font-semibold truncate bg-primary/15 text-primary ${spanPositionClass(event.spanPosition)}${onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
            data-planner-day-event={event.noteId}
            data-planner-day-event-kind="all-day"
            data-planner-day-event-span={event.spanPosition}
            title={event.title}
            onClick={onEventNoteClick ? () => onEventNoteClick(event.noteId) : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            {event.title}
          </div>
        ))}

        {timedEvents.map(event => (
          <div
            key={event.occurrenceId}
            className={`px-2 py-1.5 text-xs lg:text-sm font-semibold truncate rounded-md bg-primary/10 text-primary${onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
            data-planner-day-event={event.noteId}
            data-planner-day-event-kind="timed"
            title={event.title}
            onClick={onEventNoteClick ? () => onEventNoteClick(event.noteId) : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            {event.startTime ? `${event.startTime} ` : ''}{event.title}
          </div>
        ))}
      </div>
    </section>
  );
}
