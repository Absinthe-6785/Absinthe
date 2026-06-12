import type { Theme } from '../../../../../types';
import type { PlannerCalendarPresentation } from '../../calendar';
import {
  buildAgendaTodoSections,
  type AgendaDaySection,
} from './agendaCalendarPresentation';
import { AgendaDayGroup } from './AgendaDayGroup';

export interface AgendaTodoListProps {
  sections: readonly AgendaDaySection[];
  presentation: PlannerCalendarPresentation;
  theme: Theme;
}

export function AgendaTodoList({
  sections,
  presentation,
  theme,
}: AgendaTodoListProps) {
  if (sections.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-planner-agenda-todos>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Todos
      </h4>
      <div className="flex flex-col gap-3">
        {sections.map(section => (
          <AgendaDayGroup
            key={section.dateKey}
            dateKey={section.dateKey}
            dateHeader={presentation.labels.agendaDateHeaders.get(section.dateKey) ?? section.dateKey}
            items={section.items}
            theme={theme}
            sectionKind="todos"
            renderItem={item => (
              <div
                className={`px-2 py-1.5 rounded-md border border-border text-xs lg:text-sm font-medium truncate
                  ${item.meta.done ? 'opacity-60 line-through' : ''}`}
                data-planner-agenda-todo={item.id}
                data-planner-agenda-todo-done={item.meta.done ? 'true' : 'false'}
                title={item.title}
              >
                {item.title}
              </div>
            )}
          />
        ))}
      </div>
    </section>
  );
}
