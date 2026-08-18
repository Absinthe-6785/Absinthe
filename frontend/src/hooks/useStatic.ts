import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher, isLocalOnlyRemotePausedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { remoteSWRKey } from '../lib/remoteBoundary';
import { isLocalOnlyRuntime } from '../lib/localAuth';
import { readLocalHealthStatic } from '../lib/healthLocalRuntime';
import { ExerciseBlock, HealthRoutine, WeeklySchedule } from '../types';

const STATIC_SWR_BASE = { revalidateOnFocus: false } as const;

interface UseStaticDataResult {
  markedDates: string[];
  healthBlocks: ExerciseBlock[];
  healthRoutines: HealthRoutine[];
  weeklySchedules: WeeklySchedule[];
  mutate: () => void;
}

export const useStaticData = (
  monthStartStr: string,
  monthEndStr: string,
  onError?: (msg: string) => void,
  accountId?: string,
  healthReady = true,
): UseStaticDataResult => {
  const base = `${API_URL}/api`;
  const localMode = isLocalOnlyRuntime();

  const swrOpts = useMemo(
    () => ({
      ...STATIC_SWR_BASE,
      onError: (e: unknown) => {
        if (isLocalOnlyRemotePausedError(e)) return;
        const message = e instanceof Error ? e.message : String(e);
        onError?.(`Static fetch failed: ${message}`);
      },
    }),
    [onError],
  );

  const { data: rawDates = [], mutate: mutateDates } = useSWR<(string | { date: string })[]>(
    remoteSWRKey(`${base}/schedules/dates?start_date=${monthStartStr}&end_date=${monthEndStr}`),
    fetcher,
    swrOpts,
  );
  const { data: healthBlocks = [], mutate: mutateBlocks } = useSWR<ExerciseBlock[]>(
    remoteSWRKey(`${base}/blocks`), fetcher, swrOpts,
  );
  const { data: healthRoutines = [], mutate: mutateRoutines } = useSWR<HealthRoutine[]>(
    remoteSWRKey(`${base}/health_routines`), fetcher, swrOpts,
  );
  const { data: weeklySchedules = [], mutate: mutateWeekly } = useSWR<WeeklySchedule[]>(
    remoteSWRKey(`${base}/weekly_schedules`), fetcher, swrOpts,
  );
  const { data: localHealth, mutate: mutateLocalHealth } = useSWR(
    localMode && accountId && healthReady ? ['local-health-static', accountId] as const : null,
    ([, ownerId]) => readLocalHealthStatic(ownerId),
    swrOpts,
  );

  const markedDates = useMemo(
    () =>
      rawDates
        .map((d) => (typeof d === 'string' ? d : d.date))
        .filter(Boolean) as string[],
    [rawDates],
  );

  const mutate = useCallback(() => {
    mutateDates();
    mutateBlocks();
    mutateRoutines();
    mutateWeekly();
    if (localMode) mutateLocalHealth();
  }, [localMode, mutateDates, mutateBlocks, mutateRoutines, mutateWeekly, mutateLocalHealth]);

  return {
    markedDates,
    healthBlocks: localMode ? localHealth?.healthBlocks ?? [] : healthBlocks,
    healthRoutines: localMode ? localHealth?.healthRoutines ?? [] : healthRoutines,
    weeklySchedules,
    mutate,
  };
};
