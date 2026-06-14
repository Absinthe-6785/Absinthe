import { useMemo } from 'react';
import { getRecoveryWeekSummary } from '../recovery/recoveryNotes';

export interface UseRecoveryMetricsResult {
  avgSleep: number | null;
  loggedDays: number;
  latestNote: string | null;
}

export function useRecoveryMetrics(
  selectedDate: Date,
  formatDate: (d: Date) => string,
): UseRecoveryMetricsResult {
  return useMemo(
    () => getRecoveryWeekSummary(selectedDate, formatDate),
    [selectedDate, formatDate],
  );
}
