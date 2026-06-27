import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '../../../../../lib/fetcher';
import { API_URL } from '../../../../../lib/config';
import { remoteSWRKey } from '../../../../../lib/remoteBoundary';
import type { ProteinIntakeLog, ProteinProfile, ProteinSource } from '../../../../../types';
import {
  computeProteinProgress,
  computeProteinStreak,
  computeWeeklyProteinAverage,
  sumProteinIntake,
} from '../nutrition/proteinMetrics';
import {
  finishHealthRequestBatch,
  startHealthRequestBatch,
} from '../healthRequestInstrumentation';

async function fetchProteinRange(
  anchorDate: Date,
  formatDate: (d: Date) => string,
  dayCount = 30,
): Promise<{ dailyTotals: number[]; dailyTotalsByDate: Map<string, number> }> {
  const start = new Date(anchorDate);
  start.setDate(start.getDate() - (dayCount - 1));
  const dates: string[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }
  const batch = startHealthRequestBatch('useProteinData', '/api/protein_intake?date=', dates.length);
  const results = await Promise.all(
    dates.map(async ds => {
      batch.trackStart();
      try {
        const logs = await fetcher<ProteinIntakeLog[]>(`${API_URL}/api/protein_intake?date=${ds}`);
        return { ds, total: sumProteinIntake(logs) };
      } catch {
        return { ds, total: 0 };
      } finally {
        batch.trackEnd();
      }
    }),
  );
  finishHealthRequestBatch(batch, dates.length, 'unbounded');
  const dailyTotalsByDate = new Map(results.map(r => [r.ds, r.total]));
  return {
    dailyTotals: results.slice(-7).map(r => r.total),
    dailyTotalsByDate,
  };
}

export interface UseProteinDataResult {
  profile: ProteinProfile | null;
  sources: ProteinSource[];
  intakeLogs: ProteinIntakeLog[];
  totalIntake: number;
  dailyTarget: number;
  proteinPct: number;
  weeklyProteinAvg: number;
  proteinStreak: number;
  goalConsistency: number;
  isLoading: boolean;
  mutateProfile: () => void;
  mutateSources: () => void;
  mutateIntake: () => void;
  mutateAll: () => void;
}

export function useProteinData(
  dateStr: string,
  selectedDate: Date,
  formatDate: (d: Date) => string,
): UseProteinDataResult {
  const base = `${API_URL}/api`;
  const { mutate: globalMutate } = useSWRConfig();

  const { data: profile = null, mutate: mutateProfile, isLoading: l1 } =
    useSWR<ProteinProfile | null>(remoteSWRKey(`${base}/protein_profile`), fetcher, { revalidateOnFocus: false });

  const { data: sources = [], mutate: mutateSources, isLoading: l2 } =
    useSWR<ProteinSource[]>(remoteSWRKey(`${base}/protein_sources`), fetcher, { revalidateOnFocus: false });

  const { data: intakeLogs = [], mutate: mutateIntake, isLoading: l3 } =
    useSWR<ProteinIntakeLog[]>(remoteSWRKey(`${base}/protein_intake?date=${dateStr}`), fetcher, { revalidateOnFocus: false });

  const weekKey = `${base}/protein_weekly?anchor=${dateStr}`;
  const { data: weeklyData } = useSWR(
    remoteSWRKey(weekKey),
    () => fetchProteinRange(selectedDate, formatDate, 30),
    { revalidateOnFocus: false },
  );

  const dailyTarget = profile?.daily_target_g ?? 0;
  const totalIntake = useMemo(() => sumProteinIntake(intakeLogs), [intakeLogs]);
  const proteinPct = useMemo(
    () => computeProteinProgress(totalIntake, dailyTarget),
    [totalIntake, dailyTarget],
  );
  const weeklyProteinAvg = useMemo(
    () => computeWeeklyProteinAverage(weeklyData?.dailyTotals ?? []),
    [weeklyData],
  );
  const proteinStreak = useMemo(
    () => computeProteinStreak(weeklyData?.dailyTotalsByDate ?? new Map(), dailyTarget, dateStr, formatDate),
    [weeklyData, dailyTarget, dateStr, formatDate],
  );
  const goalConsistency = useMemo(() => {
    const totals = weeklyData?.dailyTotals ?? [];
    if (dailyTarget <= 0 || totals.length === 0) return 0;
    return Math.round((totals.filter(t => t >= dailyTarget).length / totals.length) * 100);
  }, [weeklyData, dailyTarget]);

  const mutateIntakeOnly = useCallback(() => {
    mutateIntake();
  }, [mutateIntake]);

  const mutateAll = useCallback(() => {
    mutateProfile();
    mutateSources();
    mutateIntake();
    globalMutate(weekKey);
  }, [mutateProfile, mutateSources, mutateIntake, globalMutate, weekKey]);

  return {
    profile: profile && profile.daily_target_g ? profile : null,
    sources,
    intakeLogs,
    totalIntake,
    dailyTarget,
    proteinPct,
    weeklyProteinAvg,
    proteinStreak,
    goalConsistency,
    isLoading: l1 || l2 || l3,
    mutateProfile,
    mutateSources,
    mutateIntake: mutateIntakeOnly,
    mutateAll,
  };
}
