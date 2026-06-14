import { Target, BookOpen, Check } from 'lucide-react';
import type { PlannerAgendaItem } from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatAgendaCountdownLabel, resolveAgendaNoteId } from './agendaCalendarPresentation';
import { useTranslation } from '../../../../../../lib/i18n';
import { useCountdownReviewed } from '../../hooks/useCountdownReviewed';

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
  const { isReviewed, markReviewed } = useCountdownReviewed();

  const visible = countdowns.filter(item => {
    const noteId = resolveAgendaNoteId(item);
    return noteId && !isReviewed(noteId);
  });

  if (visible.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-agenda-countdowns>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted flex items-center gap-1.5">
        <Target size={14} strokeWidth={2.25} className="text-red-500" />
        {t('scheduleSectionDeadlines')}
      </h4>
      <ul className="flex flex-col gap-1.5">
        {visible.map(item => {
          const noteId = resolveAgendaNoteId(item)!;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md border border-border bg-surface-alt"
              data-planner-agenda-countdown={item.id}
              data-planner-agenda-countdown-date={item.dateKey}
            >
              <button
                type="button"
                className={`flex items-center gap-1.5 min-w-0 flex-1 text-left text-xs lg:text-sm font-semibold truncate
                  ${onNoteClick ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={onNoteClick ? () => onNoteClick(noteId) : undefined}
              >
                <BookOpen size={12} className="shrink-0 text-primary" strokeWidth={2.25} />
                <span className="truncate">{item.title}</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-bold bg-primary/15 text-primary tabular-nums"
                  data-planner-agenda-countdown-label
                >
                  {formatAgendaCountdownLabel(item, presentation.locale)}
                </span>
                <button
                  type="button"
                  title={t('scheduleCountdownMarkReviewed')}
                  className="p-1 rounded-md hover:bg-surface text-muted hover:text-green-500"
                  onClick={() => markReviewed(noteId)}
                >
                  <Check size={12} strokeWidth={2.5} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
