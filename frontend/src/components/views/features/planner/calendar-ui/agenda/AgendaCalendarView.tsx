import { useMemo } from 'react';
import type { Theme } from '@/types';
import { useTranslation } from '@/lib/i18n';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { AgendaCountdownSection } from './AgendaCountdownSection';
import { AgendaEventList } from './AgendaEventList';
import { AgendaHeader } from './AgendaHeader';
import { AgendaRoutineExceptionsSection } from './AgendaRoutineExceptionsSection';
import {
  agendaHasContent,
  buildAgendaEventSections,
} from './agendaCalendarPresentation';

export interface AgendaCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  routineExceptionDates?: ReadonlySet<string>;
  onEventNoteClick?: (noteId: string) => void;
}

export function AgendaCalendarView({
  projection,
  presentation,
  theme,
  routineExceptionDates,
  onEventNoteClick,
}: AgendaCalendarViewProps) {
  const { t } = useTranslation();
  const agenda = projection.views.agenda;

  const eventSections = useMemo(
    () => buildAgendaEventSections(agenda.dayGroups),
    [agenda.dayGroups],
  );

  const exceptionDates = useMemo(() => {
    if (!routineExceptionDates || routineExceptionDates.size === 0) return [];
    const horizon = agenda.horizon;
    return [...routineExceptionDates]
      .filter(d => d >= horizon.startDate && d <= horizon.endDate)
      .sort();
  }, [routineExceptionDates, agenda.horizon]);

  const hasContent = agendaHasContent(agenda) || exceptionDates.length > 0;

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-4 lg:p-5 ${theme.card}`}
      data-planner-calendar-agenda
    >
      <AgendaHeader
        horizonLabel={presentation.labels.agendaHorizonLabel}
        theme={theme}
      />

      {!hasContent ? (
        <p
          className={`text-sm mb-3 ${theme.textMuted}`}
          data-planner-calendar-agenda-empty-hint="true"
        >
          {t('scheduleAgendaEmptyHint')}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 lg:gap-4">
        <AgendaCountdownSection
          countdowns={agenda.countdownSection}
          presentation={presentation}
          onNoteClick={onEventNoteClick}
        />
        <AgendaEventList
          sections={eventSections}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
        />
        <AgendaRoutineExceptionsSection exceptionDates={exceptionDates} />
      </div>
    </div>
  );
}
