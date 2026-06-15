import type { Theme } from '@/types';
import type { PlannerCalendarPresentation, PlannerCalendarProjection } from '../../calendar';
import { useTranslation } from '@/lib/i18n';
import { MonthCalendarGrid } from './MonthCalendarGrid';
import { monthGridHasAnchors } from './monthCalendarPresentation';
import { SelectedDayDetailPanel } from '../SelectedDayDetailPanel';
import type { DayScheduleActions } from '../day/dayScheduleActions';

export interface MonthCalendarViewProps {
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
  onEventNoteClick?: (noteId: string) => void;
  onDateSelect?: (dateKey: string) => void;
  scheduleActions?: DayScheduleActions;
}

export function MonthCalendarView({
  projection,
  presentation,
  theme,
  onEventNoteClick,
  onDateSelect,
  scheduleActions,
}: MonthCalendarViewProps) {
  const { t } = useTranslation();
  const month = projection.views.month;
  const hasAnchors = monthGridHasAnchors(month.cells);

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 items-start min-h-[420px]"
      data-planner-calendar-month
    >
      <div className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}>
        <div className="flex flex-col gap-1 mb-4">
          <h3 className="font-heading text-base lg:text-lg font-bold">{t('monthView')}</h3>
          {presentation.labels.monthTitle ? (
            <p
              className={`text-sm font-semibold ${theme.textMuted}`}
              data-planner-calendar-period-label
            >
              {presentation.labels.monthTitle}
            </p>
          ) : null}
        </div>

        {!hasAnchors ? (
          <p
            className={`text-sm mb-3 ${theme.textMuted}`}
            data-planner-calendar-month-empty-hint="true"
          >
            {t('scheduleMonthEmptyHint')}
          </p>
        ) : null}

        <MonthCalendarGrid
          month={month}
          weekdayLabels={presentation.labels.weekdayShortLabels}
          theme={theme}
          onEventNoteClick={onEventNoteClick}
          onDateSelect={onDateSelect}
        />
      </div>

      <SelectedDayDetailPanel
        projection={projection}
        presentation={presentation}
        theme={theme}
        onEventNoteClick={onEventNoteClick}
        scheduleActions={scheduleActions}
        variant="month"
      />
    </div>
  );
}
