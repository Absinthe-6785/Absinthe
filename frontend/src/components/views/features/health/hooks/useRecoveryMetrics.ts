import { useEffect, useMemo, useState } from 'react';
import { getRecoveryWeekSummary, RECOVERY_LOG_CHANGED, type RecoveryTrend } from '../recovery/recoveryNotes';

export interface UseRecoveryMetricsResult {
  avgSleep: number | null;
  latestSleep: number | null;
  loggedDays: number;
  latestNote: string | null;
  latestRestDayNote: string | null;
  trend: RecoveryTrend | null;
}

export function useRecoveryMetrics(
  selectedDate: Date,
  formatDate: (d: Date) => string,
): UseRecoveryMetricsResult {
  const [, bump] = useState(0);

  useEffect(() => {
    const refresh = () => bump(v => v + 1);
    window.addEventListener(RECOVERY_LOG_CHANGED, refresh);
    return () => window.removeEventListener(RECOVERY_LOG_CHANGED, refresh);
  }, []);

  return useMemo(
    () => getRecoveryWeekSummary(selectedDate, formatDate),
    [selectedDate, formatDate, bump],
  );
}
