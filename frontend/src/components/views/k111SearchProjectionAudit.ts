import { SEARCH_PROJECTION_SLICES, buildSearchProjection } from './features/search/buildSearchProjection';

/** K-111 — SearchProjection single-pass audit. */
export { SEARCH_PROJECTION_SLICES };

export function auditSearchProjection(): readonly string[] {
  return SEARCH_PROJECTION_SLICES;
}

export function auditSearchProjectionSinglePass(): boolean {
  const projection = buildSearchProjection({
    query: 'test',
    notes: [],
    folders: [],
    schedules: [],
    todos: [],
    routines: [],
    workouts: [],
    healthBlocks: [],
    weeklySchedules: [],
    recipes: [],
    recentSearches: [],
    now: new Date('2026-06-18T12:00:00'),
  });
  return SEARCH_PROJECTION_SLICES.every(slice => slice in projection);
}

export function auditSearchProjectionConsumers(): readonly string[] {
  return [
    'GlobalSearchHost.tsx',
    'useSearchProjection.ts',
    'SearchWorkspacePalette.tsx',
    'SearchVirtualList.tsx',
  ];
}
