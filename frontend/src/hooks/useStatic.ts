import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher, isLocalOnlyRemotePausedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
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

export type AccountBoundHealthStaticKey = readonly ['health-static', string, string];

export function accountBoundHealthStaticKey(
  url: string,
  accountId?: string,
  enabled = true,
): AccountBoundHealthStaticKey | null {
  return enabled && accountId ? ['health-static', accountId, url] : null;
}

const fetchAccountBoundHealthStatic = <T>(key: AccountBoundHealthStaticKey): Promise<T> => fetcher<T>(key[2]);

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
    accountBoundHealthStaticKey(
      `${base}/schedules/dates?start_date=${monthStartStr}&end_date=${monthEndStr}`,
      accountId,
      !localMode,
    ),
    fetchAccountBoundHealthStatic,
    swrOpts,
  );
  const { data: healthBlocks = [], mutate: mutateBlocks } = useSWR<ExerciseBlock[]>(
    accountBoundHealthStaticKey(`${base}/blocks`, accountId, !localMode),
    fetchAccountBoundHealthStatic,
    swrOpts,
  );
  const { data: healthRoutines = [], mutate: mutateRoutines } = useSWR<HealthRoutine[]>(
    accountBoundHealthStaticKey(`${base}/health_routines`, accountId, !localMode),
    fetchAccountBoundHealthStatic,
    swrOpts,
  );
  const { data: weeklySchedules = [], mutate: mutateWeekly } = useSWR<WeeklySchedule[]>(
    accountBoundHealthStaticKey(`${base}/weekly_schedules`, accountId, !localMode),
    fetchAccountBoundHealthStatic,
    swrOpts,
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
