import { useCallback, useEffect, useState } from 'react';
import {
  computeHabitMetrics,
  HABIT_COMPLETION_CHANGED,
  isHabitCompleted,
  readSplitCount,
  resolveTodaySplitDay,
  setHabitCompleted,
  type HabitMetrics,
} from '../habits/habitCompletion';
import type { HealthRoutine } from '../../../../../types';

export interface UseHabitMetricsResult {
  todayRoutine: HealthRoutine | null;
  todayDayName: string;
  metrics: HabitMetrics | null;
  isCompleted: boolean;
  toggleToday: () => void;
}

export function useHabitMetrics(
  healthRoutines: readonly HealthRoutine[],
  selectedDate: Date,
  formatDate: (d: Date) => string,
): UseHabitMetricsResult {
  const dateStr = formatDate(selectedDate);
  const [, bump] = useState(0);

  useEffect(() => {
    const refresh = () => bump(v => v + 1);
    window.addEventListener(HABIT_COMPLETION_CHANGED, refresh);
    return () => window.removeEventListener(HABIT_COMPLETION_CHANGED, refresh);
  }, []);

  const todayDayName = resolveTodaySplitDay(selectedDate, readSplitCount());
  const todayRoutine = healthRoutines.find(r => r.day_name === todayDayName) ?? null;
  const habitId = todayRoutine?.id ?? '';

  const metrics = habitId
    ? computeHabitMetrics(habitId, dateStr, formatDate)
    : null;
  const isCompleted = habitId ? isHabitCompleted(habitId, dateStr) : false;

  const toggleToday = useCallback(() => {
    if (!habitId) return;
    setHabitCompleted(habitId, dateStr, !isHabitCompleted(habitId, dateStr));
    bump(v => v + 1);
  }, [habitId, dateStr]);

  return { todayRoutine, todayDayName, metrics, isCompleted, toggleToday };
}
