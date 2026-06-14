import type { Theme } from '@/types';
import type { PlannerCalendarPresentation } from '../../calendar';
import {
  buildAgendaEventSections,
  formatAgendaEventTimeLabel,
  isAgendaEventKind,
  isAgendaMilestone,
  resolveAgendaNoteId,
  type AgendaDaySection,
} from './agendaCalendarPresentation';
import { AgendaDayGroup } from './AgendaDayGroup';

export interface AgendaEventListProps {
  sections: readonly AgendaDaySection[];
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
}

export function AgendaEventList({
  sections,
  presentation,
  theme,
  onEventNoteClick,
}: AgendaEventListProps) {
  if (sections.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-planner-agenda-events>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted">
        Events
      </h4>
      <div className="flex flex-col gap-3">
        {sections.map(section => (
          <AgendaDayGroup
            key={section.dateKey}
            dateKey={section.dateKey}
            dateHeader={presentation.labels.agendaDateHeaders.get(section.dateKey) ?? section.dateKey}
            items={section.items}
            theme={theme}
            sectionKind="events"
            renderItem={item => {
              const noteId = resolveAgendaNoteId(item);
              const clickable = Boolean(onEventNoteClick && noteId && isAgendaEventKind(item));
              const milestone = isAgendaMilestone(item);

              return (
                <div
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md truncate text-xs lg:text-sm font-semibold
                    ${milestone
                      ? `border border-dashed border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10`
                      : `bg-primary/10 text-primary${clickable ? ' cursor-pointer hover:opacity-80' : ''}`}
                    ${milestone && noteId && onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
                  data-planner-agenda-event={item.id}
                  data-planner-agenda-event-kind={item.kind}
                  data-planner-agenda-event-note={noteId ?? undefined}
                  title={item.title}
                  onClick={
                    onEventNoteClick && noteId && (clickable || milestone)
                      ? () => onEventNoteClick(noteId)
                      : undefined
                  }
                  onKeyDown={
                    onEventNoteClick && noteId && (clickable || milestone)
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEventNoteClick(noteId);
                          }
                        }
                      : undefined
                  }
                  role={onEventNoteClick && noteId && (clickable || milestone) ? 'button' : undefined}
                  tabIndex={onEventNoteClick && noteId && (clickable || milestone) ? 0 : undefined}
                >
                  <span
                    className={`shrink-0 text-[10px] lg:text-[11px] tabular-nums ${milestone ? 'opacity-80' : 'opacity-70'}`}
                    data-planner-agenda-event-time
                  >
                    {formatAgendaEventTimeLabel(item)}
                  </span>
                  <span className="truncate">{item.title}</span>
                </div>
              );
            }}
          />
        ))}
      </div>
    </section>
  );
}
