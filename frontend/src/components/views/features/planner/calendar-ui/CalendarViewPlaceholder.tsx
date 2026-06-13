import type { Theme, AppSettings, DDay, Routine, Schedule, Todo, WeeklySchedule } from '../../../../../types';
import type { DateTime } from 'luxon';
import type { PlannerCalendarPresentation, PlannerCalendarProjection, PlannerCalendarViewMode } from '../calendar';
import type { CalendarPlaceholderSummary } from './calendarShellModels';
import { buildCalendarPlaceholderSummary, resolveCalendarPeriodLabel } from './calendarPlaceholderSummary';
import { useTranslation } from '../../../../../lib/i18n';

export interface CalendarViewPlaceholderProps {
  mode: PlannerCalendarViewMode;
  projection: PlannerCalendarProjection;
  presentation: PlannerCalendarPresentation;
  theme: Theme;
}

export function CalendarViewPlaceholder({
  mode,
  projection,
  presentation,
  theme,
}: CalendarViewPlaceholderProps) {
  const { t } = useTranslation();
  const summary = buildCalendarPlaceholderSummary(mode, projection);
  const periodLabel = resolveCalendarPeriodLabel(mode, presentation);
  const headline = mode === 'month' ? t('monthView')
    : mode === 'week' ? t('weekView')
    : mode === 'day' ? t('dayView')
    : t('agendaView');

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] p-5 lg:p-6 ${theme.card}`}
      data-planner-calendar-placeholder
      data-planner-calendar-placeholder-mode={mode}
    >
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="font-heading text-base lg:text-lg font-bold">{headline}</h3>
        {periodLabel ? (
          <p
            className={`text-sm font-semibold ${theme.textMuted}`}
            data-planner-calendar-period-label
          >
            {periodLabel}
          </p>
        ) : null}
      </div>

      {summary.isEmpty ? (
        <p className={`text-sm ${theme.textMuted}`} data-planner-calendar-empty="true">
          {t('calendarEmptyRange')}
        </p>
      ) : (
        <ul className="space-y-2" data-planner-calendar-placeholder-stats>
          {summary.lines.map(line => (
            <li key={line} className={`text-sm font-medium ${theme.textMuted}`}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { CalendarPlaceholderSummary };
