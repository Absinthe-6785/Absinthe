import { memo, useMemo } from 'react';
import { buildCalendarDays } from '@/lib/calendarUtils';
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/types';
import { WORKSPACE_CARD, WORKSPACE_CARD_SURFACE_COMPACT } from '@/components/common/workspaceCardSizes';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface WorkoutMonthCalendarProps {
  selectedDate: Date;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  setSelectedDate: (d: Date) => void;
  formatDate: (d: Date) => string;
  isToday: (dateStr: string) => boolean;
  theme: Theme;
  lang: string;
  workoutDates?: ReadonlySet<string>;
}

const DESKTOP_DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const MOBILE_DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export interface MonthCellDecoration {
  dateStr: string;
  hasWorkout: boolean;
}

/** Precompute calendar cell markers keyed by monthKey — K-107. */
export function buildMonthCellDecorations(
  year: number,
  month: number,
  calendarDays: readonly (number | null)[],
  mobileDays: readonly number[],
  workoutDates?: ReadonlySet<string>,
): { monthKey: string; desktop: Map<number, MonthCellDecoration>; mobile: Map<number, MonthCellDecoration> } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month + 1)}`;
  const desktop = new Map<number, MonthCellDecoration>();
  const mobile = new Map<number, MonthCellDecoration>();

  for (const day of calendarDays) {
    if (!day) continue;
    const dateStr = `${monthKey}-${pad(day)}`;
    desktop.set(day, { dateStr, hasWorkout: workoutDates?.has(dateStr) ?? false });
  }
  for (const day of mobileDays) {
    const dateStr = `${monthKey}-${pad(day)}`;
    mobile.set(day, { dateStr, hasWorkout: workoutDates?.has(dateStr) ?? false });
  }

  return { monthKey, desktop, mobile };
}

function WorkoutMonthCalendarInner({
  selectedDate,
  currentDate,
  setCurrentDate,
  setSelectedDate,
  isToday,
  theme,
  lang,
  workoutDates,
}: WorkoutMonthCalendarProps) {
  const { t } = useTranslation();
  const bannerScrollRef = useRef<HTMLDivElement>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(
    () => buildCalendarDays(year, month),
    [year, month],
  );

  const mobileDays = useMemo(
    () => Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1),
    [year, month],
  );

  const { monthKey, desktop, mobile } = useMemo(
    () => buildMonthCellDecorations(year, month, calendarDays, mobileDays, workoutDates),
    [year, month, calendarDays, mobileDays, workoutDates],
  );

  useEffect(() => {
    const el = bannerScrollRef.current;
    if (!el) return;
    const idx = selectedDate.getMonth() === month && selectedDate.getFullYear() === year
      ? selectedDate.getDate() - 1
      : -1;
    if (idx < 0) return;
    const itemW = 52;
    const scrollTarget = idx * itemW - el.clientWidth / 2 + itemW / 2;
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [selectedDate, month, year]);

  const selectDay = (day: number) => {
    const next = new Date(year, month, day);
    setSelectedDate(next);
    setCurrentDate(new Date(year, month, 1));
  };

  return (
    <div
      className={`${WORKSPACE_CARD.md} ${WORKSPACE_CARD_SURFACE_COMPACT} flex h-full min-h-0 flex-col transition-colors ${theme.card}`}
      data-health-workout-calendar
      data-k107-calendar-month-key={monthKey}
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-heading text-base font-bold tabular-nums flex items-center gap-2">
          {t('calendar')}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className={`p-1.5 rounded-full ${theme.hoverBg}`}
            aria-label={t('plannerNavPrevPeriod')}
          >
            <ChevronLeft size={15} />
          </button>
          <span className={`text-xs font-bold tabular-nums self-center px-1 ${theme.textMuted}`}>
            {currentDate.toLocaleString(lang, { month: 'short', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className={`p-1.5 rounded-full ${theme.hoverBg}`}
            aria-label={t('plannerNavNextPeriod')}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div ref={bannerScrollRef} className="hidden overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth">
        <div className="flex gap-2 w-max">
          {mobileDays.map(day => {
            const deco = mobile.get(day);
            const dateStr = deco?.dateStr ?? `${monthKey}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate.getDate() === day
              && selectedDate.getMonth() === month
              && selectedDate.getFullYear() === year;
            const isTodayCell = isToday(dateStr);
            const hasWorkout = deco?.hasWorkout ?? false;
            const dow = new Date(year, month, day).getDay();
            return (
              <button
                key={day}
                type="button"
                onClick={() => selectDay(day)}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-2xl transition-colors shrink-0 w-11 min-h-[44px]
                  ${isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isTodayCell
                      ? `ring-2 ring-primary ${theme.input}`
                      : theme.input}`}
              >
                <span className={`text-[10px] font-bold ${isSelected ? 'text-primary-foreground' : theme.textMuted}`}>
                  {MOBILE_DOW[dow]}
                </span>
                <span className="text-sm font-bold">{day}</span>
                {hasWorkout ? (
                  <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                ) : (
                  <span className="w-1 h-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="block">
        <div className={`grid grid-cols-7 gap-1 text-center text-[11px] font-semibold mb-2 ${theme.textMuted}`}>
          {DESKTOP_DOW.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center text-sm font-bold">
          {calendarDays.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />;
            const deco = desktop.get(day);
            const dateStr = deco?.dateStr ?? `${monthKey}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate.getDate() === day
              && selectedDate.getMonth() === month
              && selectedDate.getFullYear() === year;
            const isTodayCell = isToday(dateStr);
            const hasWorkout = deco?.hasWorkout ?? false;
            return (
              <button
                key={day}
                type="button"
                onClick={() => selectDay(day)}
                className="flex flex-col justify-center items-center h-10 cursor-pointer gap-0.5"
              >
                <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors font-bold text-sm
                  ${isSelected ? 'bg-primary text-primary-foreground shadow-md'
                    : isTodayCell ? `ring-2 ring-primary ${theme.hoverBg}`
                      : theme.hoverBg}`}
                >
                  {day}
                </div>
                {hasWorkout ? <span className="w-1 h-1 rounded-full bg-primary" /> : <span className="w-1 h-1" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const WorkoutMonthCalendar = memo(WorkoutMonthCalendarInner);
