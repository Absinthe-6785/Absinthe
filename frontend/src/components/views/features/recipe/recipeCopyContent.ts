import type { Recipe } from './recipeTypes';

export type RecipeCopyMode = 'ingredients' | 'full';
export type RecipeCopyResult = 'copied' | 'unsupported' | 'failed' | 'unavailable' | 'stale';

export interface RecipeCopyLabels {
  title: string;
  ingredients: string;
  steps: string;
  memo: string;
}

/** Return the original supported text; only full-recipe section framing is generated. */
export function buildRecipeCopyText(
  recipe: Recipe,
  mode: RecipeCopyMode,
  labels: RecipeCopyLabels,
): string {
  if (mode === 'ingredients') return recipe.ingredients ?? '';

  const sections: Array<[string, string]> = [
    [labels.title, recipe.title ?? ''],
    [labels.ingredients, recipe.ingredients ?? ''],
    [labels.steps, recipe.steps ?? ''],
    [labels.memo, recipe.memo ?? ''],
  ];

  return sections
    .filter(([, content]) => content.trim().length > 0)
    .map(([label, content]) => `${label}\n${content}`)
    .join('\n\n');
}
