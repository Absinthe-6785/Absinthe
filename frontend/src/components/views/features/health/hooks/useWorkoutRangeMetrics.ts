import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../../../../lib/fetcher';
import { API_URL } from '../../../../../lib/config';
import {
  countWeeklySessions,
  detectRecentPr,
  type RangeWorkoutRow,
} from '../workout/workoutMetrics';

export interface UseWorkoutRangeMetricsResult {
  weeklySessions: number;
  recentPr: { name: string; kg: number } | null;
  isLoading: boolean;
}

export function useWorkoutRangeMetrics(
  dateStr: string,
  selectedDate: Date,
  formatDate: (d: Date) => string,
): UseWorkoutRangeMetricsResult {
  const weekStart = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  }, [selectedDate, formatDate]);

  const { data: weekWorkouts = [], isLoading } = useSWR<RangeWorkoutRow[]>(
    `${API_URL}/api/workouts/range?start_date=${weekStart}&end_date=${dateStr}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const weeklySessions = useMemo(() => countWeeklySessions(weekWorkouts), [weekWorkouts]);
  const recentPr = useMemo(() => detectRecentPr(weekWorkouts, dateStr), [weekWorkouts, dateStr]);

  return { weeklySessions, recentPr, isLoading };
}
