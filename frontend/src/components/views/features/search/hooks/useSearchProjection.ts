import { useMemo } from 'react';
import { buildSearchProjection, type SearchProjectionInput } from '../buildSearchProjection';
import type { SearchProjection } from '../searchProjectionModels';

export function useSearchProjection(
  input: Omit<SearchProjectionInput, 'now'> & { now?: Date; revision?: number },
): SearchProjection {
  const now = input.now ?? new Date();
  const revision = input.revision ?? 0;

  return useMemo(
    () => buildSearchProjection({ ...input, now }),
    [
      input.query,
      input.filter,
      input.notes,
      input.folders,
      input.schedules,
      input.todos,
      input.todosState,
      input.routines,
      input.workouts,
      input.healthBlocks,
      input.healthBlocksState,
      input.weeklySchedules,
      input.recipes,
      input.recentSearches,
      input.service,
      input.discoveryFeed,
      input.language,
      now,
      revision,
    ],
  );
}
