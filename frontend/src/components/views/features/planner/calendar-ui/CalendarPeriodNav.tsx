import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
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
  onAddSchedule?: () => void;
  compactTouch?: boolean;
}

export function CalendarPeriodNav({
  viewMode,
  anchorDate,
  now,
  periodLabel,
  theme,
  onAnchorDateChange,
  onAddSchedule,
  compactTouch = false,
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
  const btnClass = compactTouch
    ? `p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${theme.hoverBg}`
    : `p-1.5 rounded-full transition-colors disabled:opacity-40 ${theme.hoverBg}`;

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
          className={btnClass}
          data-planner-calendar-nav-prev
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label={t('plannerNavNextPeriod')}
          disabled={!canNavigate}
          onClick={() => shift(1)}
          className={btnClass}
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

      <div className="flex items-center gap-2 min-w-0 justify-end">
        {periodLabel ? (
          <p
            className={`text-sm font-semibold truncate ${theme.textMuted}`}
            data-planner-calendar-period-label
          >
            {periodLabel}
          </p>
        ) : null}
        {onAddSchedule ? (
          <button
            type="button"
            onClick={onAddSchedule}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold shrink-0 ${theme.input} ${theme.textMuted} hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
            data-k140-calendar-add-event
          >
            <Plus size={13} strokeWidth={2.25} />
            {t('newSchedule')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
