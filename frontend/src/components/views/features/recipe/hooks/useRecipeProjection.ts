import { useMemo } from 'react';
import type { Recipe } from '../recipeTypes';
import { buildRecipeProjection } from '../buildRecipeProjection';
import type { RecipeProjection } from '../recipeProjectionModels';

export interface UseRecipeProjectionOptions {
  locale?: string;
  now?: Date;
}

export function useRecipeProjection(
  recipes: readonly Recipe[],
  options?: UseRecipeProjectionOptions,
): RecipeProjection {
  const locale = options?.locale;
  const now = options?.now;

  return useMemo(() => {
    return buildRecipeProjection({
      recipes,
      viewRecents: [],
      cookHistory: [],
      editRecents: [],
      now: now ?? new Date(),
      locale,
    });
  }, [recipes, locale, now]);
}
