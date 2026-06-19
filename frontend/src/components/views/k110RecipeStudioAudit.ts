/** K-110 — Recipe Studio information architecture audit. */
export const K110_RECIPE_STUDIO_IA = [
  'home',
  'recipes',
  'ingredients',
  'history',
  'collections',
] as const;

export function auditRecipeStudioIa(): { sections: readonly string[] } {
  return { sections: K110_RECIPE_STUDIO_IA };
}

export const K110_RECIPE_STUDIO_HOOKS = [
  'data-k110-recipe-studio',
  'data-k110-recipe-home',
  'data-k110-recipe-section',
  'data-k110-recipe-sidebar',
  'data-k110-recipe-primary',
] as const;

export function auditRecipeStudio(): readonly string[] {
  return [...K110_RECIPE_STUDIO_IA, ...K110_RECIPE_STUDIO_HOOKS];
}
