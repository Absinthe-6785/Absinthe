import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateTime } from 'luxon';
import type { Theme } from '../../../../../types';
import { useTranslation } from '../../../../../lib/i18n';
import type { PlannerCalendarViewMode } from '../calendar';
import { toDateKey } from '../../knowledge/databaseViews/parseDatabaseDate';
import { shiftPlannerAnchorDate } from './calendarPeriodNavigation';

export interface CalendarPeriodNavProps {
  viewMode: PlannerCalendarViewMode;
  anchorDate: string;
  now: DateTime;
  periodLabel?: string;
  theme: Theme;
  onAnchorDateChange?: (dateKey: string) => void;
}

export function CalendarPeriodNav({
  viewMode,
  anchorDate,
  now,
  periodLabel,
  theme,
  onAnchorDateChange,
}: CalendarPeriodNavProps) {
  const { t } = useTranslation();
  const todayKey = toDateKey(now.toJSDate());
  const canNavigate = Boolean(onAnchorDateChange);

  const shift = (direction: -1 | 1) => {
    if (!onAnchorDateChange) return;
    const next = shiftPlannerAnchorDate(viewMode, anchorDate, direction);
    if (next) onAnchorDateChange(next);
  };

  const jumpToToday = () => {
    if (!onAnchorDateChange || !todayKey) return;
    onAnchorDateChange(todayKey);
  };

  const showToday = canNavigate && todayKey != null && todayKey !== anchorDate;

  return (
    <div
      className="flex items-center justify-between gap-2"
      data-planner-calendar-period-nav
      data-planner-calendar-period-mode={viewMode}
    >
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          aria-label={t('plannerNavPrevPeriod')}
          disabled={!canNavigate}
          onClick={() => shift(-1)}
          className={`p-1.5 rounded-full transition-colors disabled:opacity-40 ${theme.hoverBg}`}
          data-planner-calendar-nav-prev
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label={t('plannerNavNextPeriod')}
          disabled={!canNavigate}
          onClick={() => shift(1)}
          className={`p-1.5 rounded-full transition-colors disabled:opacity-40 ${theme.hoverBg}`}
          data-planner-calendar-nav-next
        >
          <ChevronRight size={16} />
        </button>
        {showToday ? (
          <button
            type="button"
            onClick={jumpToToday}
            className={`ml-1 px-2.5 py-1 rounded-xl text-[10px] lg:text-xs font-bold transition-colors ${theme.input} ${theme.textMuted} hover:text-foreground`}
            data-planner-calendar-nav-today
          >
            {t('plannerToday')}
          </button>
        ) : null}
      </div>

      {periodLabel ? (
        <p
          className={`text-sm font-semibold truncate text-right ${theme.textMuted}`}
          data-planner-calendar-period-label
        >
          {periodLabel}
        </p>
      ) : null}
    </div>
  );
}
