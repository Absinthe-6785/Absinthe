import type { PlannerEventOccurrence } from '../../calendar';
import { useTranslation } from '@/lib/i18n';
import { formatEventTimeLabel } from './dayCalendarPresentation';
import { spanPositionClass } from '../month/monthCalendarPresentation';

export interface DayEventsSectionProps {
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  onEventNoteClick?: (noteId: string) => void;
  hideHeading?: boolean;
  suppressEmpty?: boolean;
}

export function DayEventsSection({ allDayEvents, timedEvents, onEventNoteClick, hideHeading = false, suppressEmpty = false }: DayEventsSectionProps) {
  const { t } = useTranslation();
  const empty = allDayEvents.length === 0 && timedEvents.length === 0;
  if (empty && suppressEmpty) return null;

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-events>
      {!hideHeading ? (
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted">
          {t('scheduleSectionEvents')}
        </h4>
      ) : null}
      {empty ? (
        suppressEmpty ? null : <p className="text-[10px] lg:text-xs text-muted px-1">{t('scheduleSectionEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {allDayEvents.map(event => (
            <div
              key={event.occurrenceId}
              className={`px-2 py-1.5 min-h-[36px] text-xs font-semibold truncate bg-primary/15 text-primary ${spanPositionClass(event.spanPosition)}${onEventNoteClick ? ' cursor-pointer hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
              data-planner-day-event={event.noteId}
              data-planner-day-event-kind="all-day"
              data-planner-day-event-span={event.spanPosition}
              title={event.title}
              onClick={onEventNoteClick ? () => onEventNoteClick(event.noteId) : undefined}
              onKeyDown={onEventNoteClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEventNoteClick(event.noteId); } } : undefined}
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
              className={`px-2 py-1.5 min-h-[36px] rounded-md bg-primary/10 text-primary${onEventNoteClick ? ' cursor-pointer hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
              data-planner-day-event={event.noteId}
              data-planner-day-event-kind="timed"
              title={event.title}
              onClick={onEventNoteClick ? () => onEventNoteClick(event.noteId) : undefined}
              onKeyDown={onEventNoteClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEventNoteClick(event.noteId); } } : undefined}
              role={onEventNoteClick ? 'button' : undefined}
              tabIndex={onEventNoteClick ? 0 : undefined}
            >
              {timeLabel && (
                <div className="text-[10px] lg:text-xs font-medium text-muted leading-tight">{timeLabel}</div>
              )}
              <div className="text-xs font-semibold truncate">{event.title}</div>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
