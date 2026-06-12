import type { Theme } from '../../../../../types';
import type { PlannerCalendarPresentation } from '../../calendar';
import {
  buildAgendaScheduleSections,
  formatAgendaScheduleTimeLabel,
  type AgendaDaySection,
} from './agendaCalendarPresentation';
import { AgendaDayGroup } from './AgendaDayGroup';

export interface AgendaScheduleListProps {
  sections: readonly AgendaDaySection[];
  presentation: PlannerCalendarPresentation;
  theme: Theme;
}

export function AgendaScheduleList({
  sections,
  presentation,
  theme,
}: AgendaScheduleListProps) {
  if (sections.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-planner-agenda-schedules>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Schedule
      </h4>
      <div className="flex flex-col gap-3">
        {sections.map(section => (
          <AgendaDayGroup
            key={section.dateKey}
            dateKey={section.dateKey}
            dateHeader={presentation.labels.agendaDateHeaders.get(section.dateKey) ?? section.dateKey}
            items={section.items}
            theme={theme}
            sectionKind="schedules"
            renderItem={item => (
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-surface-alt text-xs lg:text-sm font-semibold truncate"
                data-planner-agenda-schedule={item.id}
                data-planner-agenda-schedule-date={item.dateKey}
                title={item.title}
              >
                <span
                  className="shrink-0 text-[10px] lg:text-[11px] tabular-nums opacity-70"
                  data-planner-agenda-schedule-time
                >
                  {formatAgendaScheduleTimeLabel(item)}
                </span>
                <span className="truncate">{item.title}</span>
              </div>
            )}
          />
        ))}
      </div>
    </section>
  );
}
