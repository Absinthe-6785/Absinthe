import { Target, BookOpen, Check, ExternalLink } from 'lucide-react';
import type { PlannerCountdownRow } from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import { useTranslation } from '@/lib/i18n';
import { filterUnreviewedCountdowns, useCountdownReviewed } from '../../hooks/useCountdownReviewed';

export interface DayCountdownStripProps {
  countdowns: readonly PlannerCountdownRow[];
  presentation: PlannerCalendarPresentation;
  onNoteClick?: (noteId: string) => void;
  hideHeading?: boolean;
  /** Match event row styling when nested under unified events section. */
  inline?: boolean;
}

export function DayCountdownStrip({
  countdowns,
  presentation,
  onNoteClick,
  hideHeading = false,
  inline = false,
}: DayCountdownStripProps) {
  const { t } = useTranslation();
  const { isReviewed, markReviewed } = useCountdownReviewed();
  const upcoming = filterUnreviewedCountdowns(countdowns, isReviewed, { upcomingOnly: true }).slice(0, 5);

  if (upcoming.length === 0) return null;

  const rowClass = inline
    ? 'flex items-center justify-between gap-2 px-2 py-1.5 min-h-[36px] rounded-md bg-primary/10 text-primary'
    : 'flex items-center justify-between gap-2 px-2 py-1.5 min-h-[36px] rounded-md border border-border bg-surface-alt';

  return (
    <section className="flex flex-col gap-1.5" data-planner-day-countdowns>
      {!hideHeading ? (
        <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wide text-muted flex items-center gap-1">
          <Target size={12} strokeWidth={2.25} className="text-red-500" />
          {t('scheduleSectionDeadlines')}
        </h4>
      ) : null}
      <ul className="flex flex-col gap-1">
        {upcoming.map(countdown => {
          const label = formatPlannerCountdownLabel(countdown.daysUntil, presentation.locale);
          const noteId = countdown.sourceRefId;

          return (
            <li
              key={countdown.id}
              className={rowClass}
              data-planner-day-countdown={countdown.id}
            >
              <button
                type="button"
                className={`flex items-center gap-1.5 min-w-0 flex-1 text-left
                  ${onNoteClick ? 'cursor-pointer hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : ''}`}
                onClick={onNoteClick ? () => onNoteClick(noteId) : undefined}
              >
                <BookOpen size={11} className="shrink-0 text-primary" strokeWidth={2.25} />
                <span className="text-xs lg:text-sm font-semibold truncate">{countdown.title}</span>
                {onNoteClick ? <ExternalLink size={10} className="shrink-0 text-muted" /> : null}
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-bold bg-primary/15 text-primary tabular-nums">
                  {label}
                </span>
                <button
                  type="button"
                  title={t('scheduleCountdownMarkReviewed')}
                  className="p-1 rounded-md hover:bg-surface text-muted hover:text-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() => markReviewed(noteId)}
                  data-planner-countdown-reviewed={noteId}
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
