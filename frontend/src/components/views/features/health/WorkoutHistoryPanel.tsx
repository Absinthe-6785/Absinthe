import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { API_URL } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/types';
import { WORKSPACE_CARD } from '@/components/common/workspaceCardSizes';

export interface WorkoutHistoryPanelProps {
  selectedDate: Date;
  formatDate: (d: Date) => string;
  theme: Theme;
  onSelectDate: (date: Date) => void;
  lang: string;
}

interface RangeWorkoutRow {
  date?: string;
}

/** Recent workout dates in the visible month — replaces oversized calendar as history navigation. */
export function WorkoutHistoryPanel({
  selectedDate,
  formatDate,
  theme,
  onSelectDate,
  lang,
}: WorkoutHistoryPanelProps) {
  const { t } = useTranslation();
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const monthStart = formatDate(new Date(year, month, 1));
  const monthEnd = formatDate(new Date(year, month + 1, 0));

  const { data: rangeRows = [] } = useSWR<RangeWorkoutRow[]>(
    `${API_URL}/api/workouts/range?start_date=${monthStart}&end_date=${monthEnd}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const historyDates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rangeRows) {
      if (!row.date) continue;
      counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14);
  }, [rangeRows]);

  const selectedKey = formatDate(selectedDate);

  return (
    <div
      className={`${WORKSPACE_CARD.sm} rounded-[24px] lg:rounded-[32px] shadow-sm p-4 lg:p-5 flex flex-col transition-colors ${theme.card}`}
      data-health-workout-history
    >
      <h2 className="font-heading text-sm font-bold mb-3">{t('k72WorkoutHistory')}</h2>
      {historyDates.length === 0 ? (
        <p className={`text-xs ${theme.textMuted}`}>{t('k72WorkoutHistoryEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
          {historyDates.map(([dateKey, count]) => {
            const [y, m, d] = dateKey.split('-').map(Number);
            const label = new Date(y, m - 1, d).toLocaleDateString(lang, {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            });
            const isSelected = dateKey === selectedKey;
            return (
              <li key={dateKey}>
                <button
                  type="button"
                  onClick={() => onSelectDate(new Date(y, m - 1, d))}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs font-semibold transition-colors min-h-[40px]
                    ${isSelected
                      ? 'bg-primary text-primary-foreground'
                      : `${theme.input} ${theme.textMuted} hover:text-foreground`}`}
                  data-health-workout-history-date={dateKey}
                >
                  <span>{label}</span>
                  <span className={`tabular-nums text-[10px] font-bold ${isSelected ? 'text-primary-foreground/80' : theme.textMuted}`}>
                    {count} {count === 1 ? t('k72WorkoutSession') : t('k72WorkoutSessions')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
