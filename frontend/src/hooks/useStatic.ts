import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { DDay, ExerciseBlock, HealthRoutine, WeeklySchedule } from '../types';

// Fix 7: swrOpts를 모듈 레벨 상수로 분리.
// 개선 전: useMemo 안에 선언 → lint가 deps 경고를 내고 eslint-disable로 무시.
// 개선 후: 컴포넌트 라이프사이클 외부에서 단 한 번만 생성되므로 안정성 보장.
// onError는 useStaticData 인자로 받으므로 별도 처리.
const STATIC_SWR_BASE = { revalidateOnFocus: false } as const;

interface UseStaticDataResult {
  markedDates: string[];
  ddays: DDay[];
  healthBlocks: ExerciseBlock[];
  healthRoutines: HealthRoutine[];
  weeklySchedules: WeeklySchedule[];
  mutate: () => void;
}

export const useStaticData = (
  monthStartStr: string,
  monthEndStr: string,
  onError?: (msg: string) => void,
): UseStaticDataResult => {
  const base = `${API_URL}/api`;

  // onError 콜백만 별도로 메모이제이션 (showToast는 useCallback으로 안정됨)
  const swrOpts = useMemo(
    () => ({
      ...STATIC_SWR_BASE,
      onError: (e: Error) => onError?.(`Static fetch failed: ${e.message}`),
    }),
    [onError],
  );

  const { data: rawDates = [], mutate: mutateDates } = useSWR<(string | { date: string })[]>(
    `${base}/schedules/dates?start_date=${monthStartStr}&end_date=${monthEndStr}`,
    fetcher,
    swrOpts,
  );
  const { data: ddays = [], mutate: mutateDdays } = useSWR<DDay[]>(
    `${base}/schedules/ddays`, fetcher, swrOpts,
  );
  const { data: healthBlocks = [], mutate: mutateBlocks } = useSWR<ExerciseBlock[]>(
    `${base}/blocks`, fetcher, swrOpts,
  );
  const { data: healthRoutines = [], mutate: mutateRoutines } = useSWR<HealthRoutine[]>(
    `${base}/health_routines`, fetcher, swrOpts,
  );
  const { data: weeklySchedules = [], mutate: mutateWeekly } = useSWR<WeeklySchedule[]>(
    `${base}/weekly_schedules`, fetcher, swrOpts,
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
    mutateDdays();
    mutateBlocks();
    mutateRoutines();
    mutateWeekly();
  }, [mutateDates, mutateDdays, mutateBlocks, mutateRoutines, mutateWeekly]);

  return { markedDates, ddays, healthBlocks, healthRoutines, weeklySchedules, mutate };
};
