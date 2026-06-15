import type { PlannerCountdownRow, PlannerEventOccurrence, PlannerScheduleRow } from '../../calendar';
import type { PlannerCalendarPresentation } from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';
import { formatEventTimeLabel } from './dayCalendarPresentation';
import { spanPositionClass } from '../month/monthCalendarPresentation';
import { useTranslation } from '@/lib/i18n';
import { filterUnreviewedCountdowns, useCountdownReviewed } from '../../hooks/useCountdownReviewed';

export interface DayAgendaListProps {
  blocks: readonly PlannerScheduleRow[];
  carryOverBlocks: readonly PlannerScheduleRow[];
  allDayEvents: readonly PlannerEventOccurrence[];
  timedEvents: readonly PlannerEventOccurrence[];
  countdowns: readonly PlannerCountdownRow[];
  presentation: PlannerCalendarPresentation;
  onEventNoteClick?: (noteId: string) => void;
}

type AgendaItem =
  | { kind: 'block'; key: string; sort: string; title: string; time?: string; blockId: string }
  | { kind: 'event'; key: string; sort: string; title: string; time?: string; noteId: string; allDay: boolean }
  | { kind: 'countdown'; key: string; sort: string; title: string; label: string; noteId: string };

function buildAgendaItems(
  blocks: readonly PlannerScheduleRow[],
  carryOver: readonly PlannerScheduleRow[],
  allDay: readonly PlannerEventOccurrence[],
  timed: readonly PlannerEventOccurrence[],
  countdowns: readonly PlannerCountdownRow[],
  presentation: PlannerCalendarPresentation,
  isReviewed: (id: string) => boolean,
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const block of [...carryOver, ...blocks]) {
    items.push({
      kind: 'block',
      key: `block-${block.id}`,
      sort: block.startTime ?? '99:99',
      title: block.title,
      time: formatEventTimeLabel(block.startTime, block.endTime) ?? block.startTime,
      blockId: block.id,
    });
  }

  for (const event of allDay) {
    items.push({
      kind: 'event',
      key: event.occurrenceId,
      sort: '00:00',
      title: event.title,
      noteId: event.noteId,
      allDay: true,
    });
  }

  for (const event of timed) {
    items.push({
      kind: 'event',
      key: event.occurrenceId,
      sort: event.startTime ?? '12:00',
      title: event.title,
      time: formatEventTimeLabel(event.startTime, event.endTime) ?? undefined,
      noteId: event.noteId,
      allDay: false,
    });
  }

  for (const cd of filterUnreviewedCountdowns(countdowns, isReviewed, { upcomingOnly: true }).slice(0, 5)) {
    items.push({
      kind: 'countdown',
      key: cd.id,
      sort: `zz-${cd.daysUntil}`,
      title: cd.title,
      label: formatPlannerCountdownLabel(cd.daysUntil, presentation.locale),
      noteId: cd.sourceRefId,
    });
  }

  return items.sort((a, b) => a.sort.localeCompare(b.sort) || a.title.localeCompare(b.title));
}

/** Dense chronological day agenda — schedules, events, countdowns. */
export function DayAgendaList({
  blocks,
  carryOverBlocks,
  allDayEvents,
  timedEvents,
  countdowns,
  presentation,
  onEventNoteClick,
}: DayAgendaListProps) {
  const { t } = useTranslation();
  const { isReviewed } = useCountdownReviewed();
  const items = buildAgendaItems(
    blocks,
    carryOverBlocks,
    allDayEvents,
    timedEvents,
    countdowns,
    presentation,
    isReviewed,
  );

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-muted py-1" data-planner-day-agenda-empty>
        {t('k77ScheduleEmptyCompact')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5" data-planner-day-agenda>
      {items.map(item => {
        if (item.kind === 'countdown') {
          return (
            <li
              key={item.key}
              className="flex items-center justify-between gap-2 px-2 py-1.5 min-h-[32px] rounded-md bg-primary/10 text-primary"
              data-planner-day-countdown={item.key}
            >
              <button
                type="button"
                className={`text-xs font-semibold truncate text-left min-w-0 flex-1 ${onEventNoteClick ? 'hover:opacity-80' : ''}`}
                onClick={onEventNoteClick ? () => onEventNoteClick(item.noteId) : undefined}
              >
                {item.title}
              </button>
              <span className="text-[10px] font-bold tabular-nums shrink-0">{item.label}</span>
            </li>
          );
        }

        if (item.kind === 'block') {
          return (
            <li
              key={item.key}
              className="px-2 py-1.5 min-h-[32px] rounded-md bg-surface-alt border border-border text-xs font-semibold truncate"
              data-planner-day-block={item.blockId}
            >
              {item.time ? <span className="text-muted tabular-nums mr-1.5">{item.time}</span> : null}
              {item.title}
            </li>
          );
        }

        return (
          <li
            key={item.key}
            className={`px-2 py-1.5 min-h-[32px] rounded-md bg-primary/10 text-primary ${spanPositionClass('single')}${onEventNoteClick ? ' cursor-pointer hover:opacity-80' : ''}`}
            data-planner-day-event={item.noteId}
            onClick={onEventNoteClick ? () => onEventNoteClick(item.noteId) : undefined}
            onKeyDown={onEventNoteClick ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEventNoteClick(item.noteId);
              }
            } : undefined}
            role={onEventNoteClick ? 'button' : undefined}
            tabIndex={onEventNoteClick ? 0 : undefined}
          >
            {item.allDay ? (
              <span className="text-xs font-semibold truncate">{item.title}</span>
            ) : (
              <>
                {item.time ? <div className="text-[10px] text-muted tabular-nums leading-tight">{item.time}</div> : null}
                <div className="text-xs font-semibold truncate">{item.title}</div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
