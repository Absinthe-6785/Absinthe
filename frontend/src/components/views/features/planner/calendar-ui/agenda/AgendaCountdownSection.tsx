import { Target } from 'lucide-react';
import type { PlannerAgendaItem } from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatAgendaCountdownLabel, resolveAgendaNoteId } from './agendaCalendarPresentation';
import { useTranslation } from '../../../../../../lib/i18n';

export interface AgendaCountdownSectionProps {
  countdowns: readonly PlannerAgendaItem[];
  presentation: PlannerCalendarPresentation;
  onNoteClick?: (noteId: string) => void;
}

export function AgendaCountdownSection({
  countdowns,
  presentation,
  onNoteClick,
}: AgendaCountdownSectionProps) {
  const { t } = useTranslation();
  if (countdowns.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-agenda-countdowns>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted flex items-center gap-1.5">
        <Target size={14} strokeWidth={2.25} className="text-red-500" />
        {t('scheduleSectionDeadlines')}
      </h4>
      <ul className="flex flex-col gap-1.5">
        {countdowns.map(item => {
          const noteId = resolveAgendaNoteId(item);
          return (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded-md border border-border bg-surface-alt
                ${noteId && onNoteClick ? 'cursor-pointer hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
              data-planner-agenda-countdown={item.id}
              data-planner-agenda-countdown-date={item.dateKey}
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
              <span className="text-xs lg:text-sm font-semibold truncate">{item.title}</span>
              <span
                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-bold bg-primary/15 text-primary tabular-nums"
                data-planner-agenda-countdown-label
              >
                {formatAgendaCountdownLabel(item, presentation.locale)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
