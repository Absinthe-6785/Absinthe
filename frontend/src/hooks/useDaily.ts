import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '../lib/fetcher';
import { API_URL } from '../lib/config';
import { Schedule, Todo, Routine, Workout, Inbody } from '../types';

export interface UseDailyDataResult {
  schedules: Schedule[];
  todos: Todo[];
  routines: Routine[];
  workouts: Workout[];
  inbody: Inbody;
  /** 전체 재검증 */
  mutate: () => void;
  /** todos만 optimistic 업데이트용 */
  mutateTodos: (updater: (cur: Todo[]) => Todo[], revalidate?: boolean) => void;
  /** routines만 optimistic 업데이트용 */
  mutateRoutines: (updater: (cur: Routine[]) => Routine[], revalidate?: boolean) => void;
  isLoading: boolean;
}

export const useDailyData = (
  dateStr: string,
  onError?: (msg: string) => void,
): UseDailyDataResult => {
  const base = `${API_URL}/api`;

  // onError 콜백만 useMemo로 메모이제이션 (showToast는 useCallback으로 안정됨)
  // DAILY_SWR_BASE = {} 는 SWR 기본값과 동일해 실질 효과가 없으므로 제거.
  const swrOpts = useMemo(
    () => ({ onError: (e: Error) => onError?.(`Fetch failed: ${e.message}`) }),
    [onError],
  );

  const { data: schedules = [], mutate: mutateSchedules, isLoading: l1 } =
    useSWR<Schedule[]>(`${base}/schedules?date=${dateStr}`, fetcher, swrOpts);

  const { data: todos = [], mutate: mutateTodosRaw, isLoading: l2 } =
    useSWR<Todo[]>(`${base}/todos?date=${dateStr}`, fetcher, swrOpts);

  const { data: routines = [], mutate: mutateRoutinesRaw, isLoading: l3 } =
    useSWR<Routine[]>(`${base}/routines_with_logs?date=${dateStr}`, fetcher, swrOpts);

  const { data: workouts = [], mutate: mutateWorkouts, isLoading: l4 } =
    useSWR<Workout[]>(`${base}/workouts?date=${dateStr}`, fetcher, swrOpts);

  const { data: inbodyRaw, mutate: mutateInbody, isLoading: l5 } =
    useSWR<Inbody[]>(`${base}/inbody?date=${dateStr}`, fetcher, swrOpts);

  /** todos optimistic mutate — updater 함수로 현재 캐시를 즉시 수정 */
  const mutateTodos = useCallback(
    (updater: (cur: Todo[]) => Todo[], revalidate = true) => {
      mutateTodosRaw(
        (cur) => updater(cur ?? []),
        { revalidate },
      );
    },
    [mutateTodosRaw],
  );

  /** routines optimistic mutate */
  const mutateRoutines = useCallback(
    (updater: (cur: Routine[]) => Routine[], revalidate = true) => {
      mutateRoutinesRaw(
        (cur) => updater(cur ?? []),
        { revalidate },
      );
    },
    [mutateRoutinesRaw],
  );

  const mutate = useCallback(() => {
    mutateSchedules();
    mutateTodosRaw();
    mutateRoutinesRaw();
    mutateWorkouts();
    mutateInbody();
  }, [mutateSchedules, mutateTodosRaw, mutateRoutinesRaw, mutateWorkouts, mutateInbody]);

  return {
    schedules,
    todos,
    routines,
    workouts,
    inbody: inbodyRaw?.[0] ?? { weight: 0, smm: 0, pbf: 0 },
    mutate,
    mutateTodos,
    mutateRoutines,
    isLoading: l1 || l2 || l3 || l4 || l5,
  };
};
