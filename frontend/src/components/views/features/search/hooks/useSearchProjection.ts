import { useMemo } from 'react';
import { buildSearchProjection, type SearchProjectionInput } from '../buildSearchProjection';
import type { SearchProjection } from '../searchProjectionModels';

// Keep the palette mounted for its existing interaction lifecycle, without
// retaining the previous account/query's projection after close.
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
  enabled = true,
): SearchProjection {
  const now = enabled ? (input.now ?? new Date()) : undefined;
  const revision = input.revision ?? 0;

  return useMemo(
    () => now === undefined ? CLOSED_PROJECTION : buildSearchProjection({ ...input, now }),
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
      input.workoutPreviewRead,
      input.healthBlocks,
      input.healthBlocksState,
      input.weeklySchedules,
      input.recipes,
      input.recipeState,
      input.recentSearches,
      input.service,
      input.discoveryFeed,
      input.language,
      now,
      revision,
    ],
  );
}
