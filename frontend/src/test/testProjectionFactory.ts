/**
 * K-120 — shared projection builders for audit tests.
 */
import { buildHealthProjection, synthesizeRangeWorkouts } from '@/components/views/features/health/buildHealthProjection';
import { buildRecipeProjection } from '@/components/views/features/recipe/buildRecipeProjection';
import { buildSearchProjection } from '@/components/views/features/search/buildSearchProjection';
import type { Recipe } from '@/components/views/features/recipe/recipeTypes';

export function makeHealthProjectionAuditFixture(recordCount = 50) {
  return buildHealthProjection({
    rangeWorkouts: synthesizeRangeWorkouts(recordCount),
    selectedDateKey: '2026-06-18',
  });
}

export function makeRecipeProjectionAuditFixture(recipes: readonly Recipe[] = []) {
  return buildRecipeProjection({
    recipes,
    viewRecents: [],
    cookHistory: [],
    editRecents: [],
    now: new Date('2026-06-18T12:00:00'),
  });
}

export function makeSearchProjectionAuditFixture(query = 'test') {
  return buildSearchProjection({
    query,
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
}
