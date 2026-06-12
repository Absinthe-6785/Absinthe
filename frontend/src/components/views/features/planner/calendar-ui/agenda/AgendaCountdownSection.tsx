import type { PlannerAgendaItem } from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatAgendaCountdownLabel } from './agendaCalendarPresentation';

export interface AgendaCountdownSectionProps {
  countdowns: readonly PlannerAgendaItem[];
  presentation: PlannerCalendarPresentation;
}

export function AgendaCountdownSection({
  countdowns,
  presentation,
}: AgendaCountdownSectionProps) {
  if (countdowns.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-planner-agenda-countdowns>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Countdowns
      </h4>
      <ul className="flex flex-col gap-1.5">
        {countdowns.map(item => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md border border-border bg-surface-alt"
            data-planner-agenda-countdown={item.id}
            data-planner-agenda-countdown-date={item.dateKey}
          >
            <span className="text-xs lg:text-sm font-semibold truncate">{item.title}</span>
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-bold bg-primary/15 text-primary tabular-nums"
              data-planner-agenda-countdown-label
            >
              {formatAgendaCountdownLabel(item, presentation.locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
