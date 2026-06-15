import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/types';
import { WORKSPACE_CARD } from '@/components/common/workspaceCardSizes';

export interface CompactWorkoutCalendarProps {
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

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** Compact week strip + month navigation — supporting date picker only. */
export function CompactWorkoutCalendar({
  selectedDate,
  currentDate,
  setCurrentDate,
  setSelectedDate,
  formatDate,
  isToday,
  theme,
  lang,
  workoutDates,
}: CompactWorkoutCalendarProps) {
  const { t } = useTranslation();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const weekDays = useMemo(() => {
    const anchor = new Date(selectedDate);
    const mondayOffset = (anchor.getDay() + 6) % 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const shiftWeek = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta * 7);
    setSelectedDate(next);
    setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  return (
    <div
      className={`${WORKSPACE_CARD.sm} rounded-[24px] lg:rounded-[32px] shadow-sm p-3 lg:p-4 flex flex-col transition-colors ${theme.card}`}
      data-health-compact-calendar
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-heading text-xs font-bold tabular-nums">
          {currentDate.toLocaleString(lang, { month: 'short', year: 'numeric' })}
        </h2>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className={`p-1 rounded-full ${theme.hoverBg}`}
            aria-label={t('plannerNavPrevPeriod')}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className={`p-1 rounded-full ${theme.hoverBg}`}
            aria-label={t('k72PrevWeek')}
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className={`p-1 rounded-full ${theme.hoverBg}`}
            aria-label={t('k72NextWeek')}
          >
            <ChevronRight size={12} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className={`p-1 rounded-full ${theme.hoverBg}`}
            aria-label={t('plannerNavNextPeriod')}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map(label => (
          <span key={label} className={`text-[9px] font-bold ${theme.textMuted}`}>{label}</span>
        ))}
        {weekDays.map(day => {
          const dateStr = formatDate(day);
          const isSelected = formatDate(selectedDate) === dateStr;
          const hasWorkout = workoutDates?.has(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => {
                setSelectedDate(day);
                setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1));
              }}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors min-h-[44px]
                ${isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday(dateStr)
                    ? `ring-1 ring-primary ${theme.input}`
                    : theme.input}`}
            >
              <span className="text-xs font-bold tabular-nums">{day.getDate()}</span>
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
  );
}
