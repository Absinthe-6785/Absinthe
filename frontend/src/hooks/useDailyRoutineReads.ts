import type { AccountBoundRemoteKey } from '../lib/accountBoundRemote';
import type { Routine } from '../types';
import { useDailyPlannerRows } from './useDailyPlannerRows';

/** Routine retains its existing activation and optimistic update contract. */
export function useDailyRoutineReads(
  transportKey: AccountBoundRemoteKey | null,
  cacheKey: AccountBoundRemoteKey | null,
  accountId: string | undefined,
  enabled: boolean | undefined,
  options: { onError: (error: unknown) => void; revalidateOnFocus: boolean },
) {
  const { response, state, isLoading, mutateRows, refresh } =
    useDailyPlannerRows<Routine>('Routine', transportKey, cacheKey, accountId, enabled, options);
  return { response, state, isLoading, mutateRoutines: mutateRows, refresh };
}
