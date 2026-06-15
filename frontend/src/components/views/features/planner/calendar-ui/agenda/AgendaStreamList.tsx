import type { Theme } from '@/types';
import {
  buildAgendaChronologicalStream,
  formatAgendaEventTimeLabel,
  formatAgendaScheduleTimeLabel,
  isAgendaEventKind,
  isAgendaMilestone,
  resolveAgendaNoteId,
  type AgendaStreamEntry,
} from './agendaCalendarPresentation';
import type { PlannerAgendaItem } from '../../calendar';

export interface AgendaStreamListProps {
  entries: readonly AgendaStreamEntry[];
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
}

function streamTimeLabel(item: PlannerAgendaItem): string {
  if (item.kind === 'schedule-block') return formatAgendaScheduleTimeLabel(item);
  if (item.kind === 'todo') return item.meta.done ? 'Done' : 'Todo';
  return formatAgendaEventTimeLabel(item);
}

function streamKindLabel(item: PlannerAgendaItem): string {
  switch (item.kind) {
    case 'schedule-block': return 'Schedule';
    case 'todo': return 'Task';
    case 'milestone': return 'Milestone';
    case 'all-day-event': return 'All day';
    default: return 'Event';
  }
}

export function AgendaStreamList({
  entries,
  theme,
  onEventNoteClick,
}: AgendaStreamListProps) {
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-1" data-planner-agenda-stream>
      <h4 className="text-xs lg:text-sm font-bold uppercase tracking-wide text-muted mb-1">
        Timeline
      </h4>
      <ul className="flex flex-col gap-0.5">
        {entries.map(({ dateKey, dateHeader, item, showDateHeader }) => {
          const noteId = resolveAgendaNoteId(item);
          const clickable = Boolean(onEventNoteClick && noteId && (isAgendaEventKind(item) || isAgendaMilestone(item)));
          const milestone = isAgendaMilestone(item);
          const isSchedule = item.kind === 'schedule-block';
          const isTodo = item.kind === 'todo';

          return (
            <li key={`${dateKey}-${item.id}`} className="flex flex-col gap-0.5">
              {showDateHeader ? (
                <p
                  className={`text-[11px] lg:text-xs font-bold pt-2 first:pt-0 ${theme.textMuted}`}
                  data-planner-agenda-stream-date={dateKey}
                >
                  {dateHeader}
                </p>
              ) : null}
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs lg:text-sm font-semibold min-h-[32px]
                  ${milestone
                    ? 'border border-dashed border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                    : isSchedule
                      ? `bg-surface-alt border ${theme.border}`
                      : isTodo
                        ? `opacity-80 ${theme.input}`
                        : `bg-primary/10 text-primary${clickable ? ' cursor-pointer hover:opacity-80' : ''}`}
                  ${milestone && clickable ? ' cursor-pointer hover:opacity-80' : ''}`}
                data-planner-agenda-stream-item={item.id}
                data-planner-agenda-stream-kind={item.kind}
                onClick={clickable ? () => onEventNoteClick!(noteId!) : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEventNoteClick!(noteId!);
                  }
                } : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                <span className="shrink-0 text-[10px] tabular-nums opacity-70 w-14">
                  {streamTimeLabel(item)}
                </span>
                <span className="truncate flex-1">{item.title}</span>
                <span className={`shrink-0 text-[9px] uppercase tracking-wide opacity-50 hidden sm:inline`}>
                  {streamKindLabel(item)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export { buildAgendaChronologicalStream };
