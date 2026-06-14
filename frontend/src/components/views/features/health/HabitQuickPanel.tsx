import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Check, History, X } from 'lucide-react';
import { useTranslation } from '../../../../lib/i18n';
import type { HealthRoutine, Theme } from '../../../../types';
import { useHabitMetrics } from './hooks/useHabitMetrics';
import {
  getHabitCompletionHistory,
  setHabitCompleted,
  HABIT_COMPLETION_CHANGED,
} from './habits/habitCompletion';

export interface HabitQuickPanelProps {
  theme: Theme;
  selectedDate: Date;
  formatDate: (d: Date) => string;
  healthRoutines: readonly HealthRoutine[];
  onOpenRoutine?: () => void;
}

export function HabitQuickPanel({
  theme,
  selectedDate,
  formatDate,
  healthRoutines,
  onOpenRoutine,
}: HabitQuickPanelProps) {
  const { t } = useTranslation();
  const dateStr = formatDate(selectedDate);
  const [, bump] = useState(0);

  useEffect(() => {
    const refresh = () => bump(v => v + 1);
    window.addEventListener(HABIT_COMPLETION_CHANGED, refresh);
    return () => window.removeEventListener(HABIT_COMPLETION_CHANGED, refresh);
  }, []);

  const { todayRoutine, todayDayName, metrics, isCompleted } =
    useHabitMetrics(healthRoutines, selectedDate, formatDate);

  const habitId = todayRoutine?.id ?? '';
  const history = useMemo(
    () => (habitId ? getHabitCompletionHistory(habitId, selectedDate, formatDate, 14) : []),
    [habitId, selectedDate, formatDate, bump],
  );

  const setCompleted = useCallback((done: boolean) => {
    if (!habitId) return;
    setHabitCompleted(habitId, dateStr, done);
    bump(v => v + 1);
  }, [habitId, dateStr]);

  const completedCount = history.filter(h => h.completed).length;

  return (
    <div className={`rounded-[24px] p-5 lg:p-6 mb-4 ${theme.card} border ${theme.border}`} data-habit-quick-panel>
      <div className="flex items-center gap-2 mb-3">
        <Activity size={18} className="text-primary" />
        <h2 className="font-heading text-lg font-bold">{t('k54HabitQuickTitle')}</h2>
      </div>

      {todayRoutine ? (
        <>
          <p className={`text-sm font-semibold mb-3`}>
            {t('healthDashboardTodayHabit').replace('{day}', todayDayName)}
            <span className={`ml-2 text-xs font-normal ${theme.textMuted}`}>
              {t('healthDashboardHabitBlocks').replace('{count}', String(todayRoutine.blocks.length))}
            </span>
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setCompleted(true)}
              disabled={isCompleted}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors
                ${isCompleted
                  ? 'bg-green-500/15 text-green-600 border border-green-500/30'
                  : 'bg-primary text-primary-foreground'}`}
              data-health-habit-complete
            >
              <Check size={14} />
              {t('k54HabitComplete')}
            </button>
            <button
              type="button"
              onClick={() => setCompleted(false)}
              disabled={!isCompleted}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors
                ${!isCompleted ? 'opacity-40' : ''} ${theme.border} ${theme.textMuted}`}
              data-health-habit-uncomplete
            >
              <X size={14} />
              {t('k54HabitUncomplete')}
            </button>
            {onOpenRoutine ? (
              <button
                type="button"
                onClick={onOpenRoutine}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border ${theme.border} ${theme.textMuted}`}
              >
                <History size={14} />
                {t('k54HabitReviewRoutine')}
              </button>
            ) : null}
          </div>

          {metrics ? (
            <p className={`text-xs mb-4 ${theme.textMuted}`}>
              {t('healthDashboardHabitStats')
                .replace('{streak}', String(metrics.streak))
                .replace('{rate}', String(metrics.completionRate))}
              {' · '}
              {t('k54HabitHistoryCount').replace('{done}', String(completedCount)).replace('{total}', '14')}
            </p>
          ) : null}

          <div>
            <p className={`text-[10px] font-bold mb-2 ${theme.textMuted}`}>{t('k54HabitHistoryTitle')}</p>
            <div className="flex flex-wrap gap-1.5">
              {history.map(day => (
                <button
                  key={day.date}
                  type="button"
                  title={day.date}
                  onClick={() => {
                    if (!habitId) return;
                    setHabitCompleted(habitId, day.date, !day.completed);
                    bump(v => v + 1);
                  }}
                  className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-colors
                    ${day.completed
                      ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                      : `${theme.input} ${theme.textMuted}`}
                    ${day.date === dateStr ? 'ring-2 ring-primary' : ''}`}
                >
                  {day.completed ? '✓' : '·'}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div>
          <p className={`text-sm ${theme.textMuted} mb-3`}>{t('healthDashboardNoHabitRoutine')}</p>
          {onOpenRoutine ? (
            <button
              type="button"
              onClick={onOpenRoutine}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
            >
              {t('k54HabitSetupRoutine')}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
