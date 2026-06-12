import { useMemo } from 'react';
import type { Theme } from '../../../../../types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { AgendaCountdownSection } from './AgendaCountdownSection';
import { AgendaEventList } from './AgendaEventList';
import { AgendaHeader } from './AgendaHeader';
import { AgendaScheduleList } from './AgendaScheduleList';
import { AgendaTodoList } from './AgendaTodoList';
import {
  agendaHasContent,
  buildAgendaEventSections,
  buildAgendaScheduleSections,
  buildAgendaTodoSections,
} from './agendaCalendarPresentation';

export interface AgendaCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
}

export function AgendaCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
}: AgendaCalendarViewProps) {
  const agenda = projection.views.agenda;

  const eventSections = useMemo(
    () => buildAgendaEventSections(agenda.dayGroups),
    [agenda.dayGroups],
  );
  const scheduleSections = useMemo(
    () => buildAgendaScheduleSections(agenda.dayGroups),
    [agenda.dayGroups],
  );
  const todoSections = useMemo(
    () => buildAgendaTodoSections(agenda.dayGroups),
    [agenda.dayGroups],
  );

  const hasContent = agendaHasContent(agenda);

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}
      data-planner-calendar-agenda
    >
      <AgendaHeader
        horizonLabel={presentation.labels.agendaHorizonLabel}
        theme={theme}
      />

      {!hasContent ? (
        <p
          className={`text-sm mb-4 ${theme.textMuted}`}
          data-planner-calendar-agenda-empty-hint="true"
        >
          Nothing on the agenda in this range yet. Countdowns and upcoming items will appear here.
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:gap-5">
        <AgendaCountdownSection
          countdowns={agenda.countdownSection}
          presentation={presentation}
        />
        <AgendaEventList
          sections={eventSections}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
        />
        <AgendaScheduleList
          sections={scheduleSections}
          presentation={presentation}
          theme={theme}
        />
        <AgendaTodoList
          sections={todoSections}
          presentation={presentation}
          theme={theme}
        />
      </div>
    </div>
  );
}
