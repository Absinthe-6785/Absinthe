import { useMemo } from 'react';
import type { Recipe } from '../recipeTypes';
import { buildRecipeProjection } from '../buildRecipeProjection';
import type { RecipeProjection } from '../recipeProjectionModels';
import {
  readRecipeViewRecents,
  readRecipeCookHistory,
  readRecipeEditRecents,
} from '../recipeActivityStorage';

export interface UseRecipeProjectionOptions {
  locale?: string;
  now?: Date;
  /** Bump after UI-only activity writes (view / cook / edit). */
  activityTick?: number;
}

export function useRecipeProjection(
  recipes: readonly Recipe[],
  options?: UseRecipeProjectionOptions,
): RecipeProjection {
  const locale = options?.locale;
  const now = options?.now;
  const activityTick = options?.activityTick ?? 0;

  return useMemo(() => {
    return buildRecipeProjection({
      recipes,
      viewRecents: readRecipeViewRecents(),
      cookHistory: readRecipeCookHistory(),
      editRecents: readRecipeEditRecents(),
      now: now ?? new Date(),
      locale,
    });
  }, [recipes, locale, now, activityTick]);
}
