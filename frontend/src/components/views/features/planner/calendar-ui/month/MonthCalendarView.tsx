import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { useTranslation } from '@/lib/i18n';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { monthGridHasAnchors } from './monthCalendarPresentation';
import { SelectedDayDetailPanel } from '../SelectedDayDetailPanel';
import type { DayScheduleActions, AgendaEventActions } from '../day/dayScheduleActions';

export interface MonthCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
  eventActions?: AgendaEventActions;
}

/** K-79 month-primary layout — 70% calendar / 30% compact agenda panel. */
export function MonthCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
  eventActions,
}: MonthCalendarViewProps) {
  const { t } = useTranslation();
  const month = projection.views.month;
  const hasAnchors = monthGridHasAnchors(month.cells);

  return (
    <div
      className="flex flex-col lg:flex-row gap-3 lg:gap-3 items-stretch min-h-0"
      data-planner-calendar-month
    >
      <div className={`w-full lg:w-[70%] lg:min-w-0 rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 ${theme.card}`}>
        <div className="flex flex-col gap-0.5 mb-2">
          <h3 className="font-heading text-sm lg:text-base font-bold">{t('monthView')}</h3>
          {presentation.labels.monthTitle ? (
            <p
              className={`text-xs font-semibold ${theme.textMuted}`}
              data-planner-calendar-period-label
            >
              {presentation.labels.monthTitle}
            </p>
          ) : null}
        </div>

        {!hasAnchors ? (
          <p
            className={`text-xs mb-2 ${theme.textMuted}`}
            data-planner-calendar-month-empty-hint="true"
          >
            {t('scheduleMonthEmptyHint')}
          </p>
        ) : null}

        <MonthCalendarGrid
          month={month}
          weekdayLabels={presentation.labels.weekdayShortLabels}
          theme={theme}
          countdowns={projection.core.countdowns}
          presentation={presentation}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onDateSelect}
        />
      </div>

      <div className="w-full lg:w-[30%] lg:min-w-[200px] lg:max-w-[300px] shrink-0">
        <SelectedDayDetailPanel
          projection={projection}
          presentation={presentation}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          scheduleActions={scheduleActions}
          eventActions={eventActions}
          variant="month"
          suppressEmptySections
        />
      </div>
    </div>
  );
}
