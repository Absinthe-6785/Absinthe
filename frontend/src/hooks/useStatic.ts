import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher, isLocalOnlyRemotePausedError } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { remoteSWRKey } from '../lib/remoteBoundary';
import { isLocalOnlyRuntime } from '../lib/localAuth';
import { readLocalHealthStatic } from '../lib/healthLocalRuntime';
import { ExerciseBlock, HealthRoutine, WeeklySchedule } from '../types';
import { resolveSearchDatasetState, type SearchDatasetState } from '../lib/searchReadiness';

const STATIC_SWR_BASE = { revalidateOnFocus: false } as const;

interface UseStaticDataResult {
  markedDates: string[];
  healthBlocks: ExerciseBlock[];
  /** Readiness for the Search-deferred Health block source. */
  healthBlocksState: SearchDatasetState;
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
  const remoteKey = remoteSWRKey(url);
  return enabled && accountId && remoteKey ? ['health-static', accountId, remoteKey] : null;
}

const fetchAccountBoundHealthStatic = <T>(key: AccountBoundHealthStaticKey): Promise<T> => fetcher<T>(key[2]);

export const useStaticData = (
  monthStartStr: string,
  monthEndStr: string,
  onError?: (msg: string) => void,
  accountId?: string,
  healthReady = true,
  healthBlocksEnabled = true,
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
  const healthBlocksKey = accountBoundHealthStaticKey(
    `${base}/blocks`,
    accountId,
    !localMode && healthBlocksEnabled,
  );
  const {
    data: healthBlocksData,
    mutate: mutateBlocks,
    isLoading: healthBlocksIsLoading,
    isValidating: healthBlocksIsValidating,
    error: healthBlocksError,
  } = useSWR<ExerciseBlock[]>(
    healthBlocksKey,
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
  const localHealthKey = localMode && accountId && healthReady && healthBlocksEnabled
    ? ['local-health-static', accountId] as const
    : null;
  // Existing local readiness remains account-bound:
  // localMode && accountId && healthReady ? ['local-health-static', accountId]
  const {
    data: localHealth,
    mutate: mutateLocalHealth,
    isLoading: localHealthIsLoading,
    isValidating: localHealthIsValidating,
    error: localHealthError,
  } = useSWR<{ healthBlocks?: ExerciseBlock[]; healthRoutines?: HealthRoutine[] }>(
    localHealthKey,
    ([, ownerId]: readonly ['local-health-static', string]) => readLocalHealthStatic(ownerId),
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

  const healthBlocks = localMode ? localHealth?.healthBlocks : healthBlocksData;
  const healthBlocksState = resolveSearchDatasetState({
    enabled: localMode ? localHealthKey !== null : healthBlocksKey !== null,
    data: healthBlocks,
    isLoading: localMode ? localHealthIsLoading : healthBlocksIsLoading,
    isValidating: localMode ? localHealthIsValidating : healthBlocksIsValidating,
    error: localMode ? localHealthError : healthBlocksError,
  });

  return {
    markedDates,
    healthBlocks: healthBlocks ?? [],
    healthBlocksState,
    healthRoutines: localMode ? localHealth?.healthRoutines ?? [] : healthRoutines,
    weeklySchedules,
    mutate,
  };
};
