import { useMemo } from 'react';
import type { SearchProjectionInput } from '../buildSearchProjection';
import type { SearchProjection } from '../searchProjectionModels';
import { buildSearchRecentGroups } from '../searchRecentStorage';

export function loadSearchProjectionRuntime() {
  return import('../searchProjectionRuntime');
}

// Never retain the previous account/query's results when closed or loading.
const CLOSED_PROJECTION: SearchProjection = {
  query: '',
  results: [],
  groupedResults: [],
  counts: { notes: 0, planner: 0, health: 0, recipe: 0, archive: 0, total: 0 },
  highlights: new Map(),
  recentSearches: { today: [], earlier: [] },
  groupStates: {},
  empty: { noQuery: true, noResults: false, noRecent: true },
  generatedAt: '',
};

export function useSearchProjection(
  input: Omit<SearchProjectionInput, 'now'> & { now?: Date; revision?: number },
  open: boolean,
  buildSearchProjection?: (input: SearchProjectionInput) => SearchProjection,
): SearchProjection {
  const now = open ? (input.now ?? new Date()) : undefined;
  const revision = input.revision ?? 0;

  return useMemo(
    () => {
      if (!now) return CLOSED_PROJECTION;
      if (buildSearchProjection) return buildSearchProjection({ ...input, now });

      // Local recents can be used before the result builders arrive, or if
      // the chunk is unavailable. Use the same groups as the full projection.
      const query = input.query.trim();
      const recentSearches = query
        ? CLOSED_PROJECTION.recentSearches
        : buildSearchRecentGroups(input.recentSearches, now);
      return {
        ...CLOSED_PROJECTION,
        query,
        recentSearches,
        empty: {
          noQuery: !query,
          noResults: false,
          noRecent: !recentSearches.today.length && !recentSearches.earlier.length,
        },
      };
    },
    [
      input.query,
      input.filter,
      input.notes,
      input.folders,
      input.schedules,
      input.todos,
      input.todosState,
      input.routines,
      input.routinesState,
      input.workouts,
      input.workoutPreviewRead,
      input.healthBlocks,
      input.healthBlocksState,
      input.weeklySchedules,
      input.weeklySchedulesState,
      input.recipes,
      input.recipeState,
      input.recentSearches,
      input.service,
      input.discoveryFeed,
      input.language,
      buildSearchProjection,
      now,
      revision,
    ],
  );
}
