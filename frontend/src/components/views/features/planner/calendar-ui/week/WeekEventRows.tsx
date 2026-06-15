import type { PlannerEventOccurrence, PlannerScheduleRow } from '../../calendar';
import { formatEventTimeLabel } from '../day/dayCalendarPresentation';
import { spanPositionClass } from '../month/monthCalendarPresentation';

export interface WeekEventRowsProps {
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  onEventNoteClick?: (noteId: string) => void;
}

export function WeekEventRows({ allDayEvents, timedEvents, onEventNoteClick }: WeekEventRowsProps) {
  if (allDayEvents.length === 0 && timedEvents.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5" data-planner-week-event-rows>
        {allDayEvents.map(event => (
          <div
            key={event.occurrenceId}
            className={`px-1 py-0.5 min-h-[24px] text-[9px] lg:text-[10px] font-semibold truncate bg-primary/15 text-primary ${spanPositionClass(event.spanPosition)}${onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
            data-planner-week-event={event.noteId}
            data-planner-week-event-kind="all-day"
            data-planner-week-event-span={event.spanPosition}
            title={event.title}
            onClick={onEventNoteClick ? () => onEventNoteClick(event.noteId) : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            {event.title}
          </div>
        ))}

        {timedEvents.map(event => {
          const timeLabel = formatEventTimeLabel(event.startTime, event.endTime);
          return (
          <div
            key={event.occurrenceId}
            className={`px-1 py-0.5 min-h-[24px] rounded-md bg-primary/10 text-primary${onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
            data-planner-week-event={event.noteId}
            data-planner-week-event-kind="timed"
            title={event.title}
            onClick={onEventNoteClick ? () => onEventNoteClick(event.noteId) : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            <span className="text-[9px] lg:text-[10px] font-semibold truncate block">
              {timeLabel ? <span className="text-muted tabular-nums mr-0.5">{timeLabel}</span> : null}
              {event.title}
            </span>
          </div>
          );
        })}
    </div>
  );
}

export function formatWeekDayPreview(
  timedEvents: readonly PlannerEventOccurrence[],
  allDayEvents: readonly PlannerEventOccurrence[],
  blocks: readonly PlannerScheduleRow[],
): string | null {
  const timed = timedEvents[0];
  if (timed) {
    const time = timed.startTime ?? '';
    return time ? `${time} ${timed.title}` : timed.title;
  }
  const allDay = allDayEvents[0];
  if (allDay) return allDay.title;
  const block = blocks[0];
  if (block) return `${block.startTime} ${block.title}`;
  return null;
}
