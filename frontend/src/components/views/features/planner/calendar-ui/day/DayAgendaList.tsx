import type { PlannerCalendarPresentation } from '../../calendar';
import type { DayScheduleActions, AgendaEventActions } from './dayScheduleActions';
import type { BuildAgendaItemsInput } from '../agenda/agendaItemModel';
import { UnifiedAgendaList } from '../agenda/UnifiedAgendaList';

export interface DayAgendaListProps extends BuildAgendaItemsInput {
  presentation: PlannerCalendarPresentation;
  onEventNoteClick?: (noteId: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
}

/** Dense chronological day agenda — delegates to unified list (K-79). */
export function DayAgendaList({
  blocks,
  carryOverBlocks,
  allDayEvents,
  timedEvents,
  countdowns,
  presentation,
  onEventNoteClick,
  scheduleActions,
  eventActions,
}: DayAgendaListProps) {
  const mergedEventActions: AgendaEventActions | undefined = onEventNoteClick || eventActions
    ? {
        ...eventActions,
        onOpen: eventActions?.onOpen ?? onEventNoteClick,
      }
    : eventActions;

  return (
    <div data-planner-day-agenda>
      <UnifiedAgendaList
        blocks={blocks}
        carryOverBlocks={carryOverBlocks}
        allDayEvents={allDayEvents}
        timedEvents={timedEvents}
        countdowns={countdowns}
        presentation={presentation}
        scheduleActions={scheduleActions}
        eventActions={mergedEventActions}
      />
    </div>
  );
}
