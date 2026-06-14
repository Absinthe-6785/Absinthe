import { Target } from 'lucide-react';
import type { PlannerCountdownRow } from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import { useTranslation } from '../../../../../../lib/i18n';

export interface DayCountdownStripProps {
  countdowns: readonly PlannerCountdownRow[];
  presentation: PlannerCalendarPresentation;
  onNoteClick?: (noteId: string) => void;
}

export function DayCountdownStrip({
  countdowns,
  presentation,
  onNoteClick,
}: DayCountdownStripProps) {
  const { t } = useTranslation();
  const upcoming = countdowns
    .filter(c => c.daysUntil >= 0)
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-countdowns>
      <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1">
        <Target size={12} strokeWidth={2.25} className="text-red-500" />
        {t('scheduleSectionDeadlines')}
      </h4>
      <ul className="flex flex-col gap-1">
        {upcoming.map(countdown => {
          const label = formatPlannerCountdownLabel(countdown.daysUntil, presentation.locale);
          const isNoteBacked = countdown.source === 'note-event';
          const noteId = isNoteBacked ? countdown.sourceRefId : null;

          return (
            <li
              key={countdown.id}
              className={`flex items-center justify-between gap-2 px-2 py-1 rounded-md border border-border bg-surface-alt
                ${noteId && onNoteClick ? 'cursor-pointer hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
              data-planner-day-countdown={countdown.id}
              onClick={noteId && onNoteClick ? () => onNoteClick(noteId) : undefined}
              onKeyDown={noteId && onNoteClick ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNoteClick(noteId);
                }
              } : undefined}
              role={noteId && onNoteClick ? 'button' : undefined}
              tabIndex={noteId && onNoteClick ? 0 : undefined}
            >
              <span className="text-xs lg:text-sm font-semibold truncate min-w-0">{countdown.title}</span>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-bold bg-primary/15 text-primary tabular-nums">
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
