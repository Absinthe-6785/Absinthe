import { RECIPE_PROJECTION_SLICES, buildRecipeProjection } from './features/recipe';

/** K-110 — RecipeProjection single-pass audit. */
export { RECIPE_PROJECTION_SLICES };

export function auditRecipeProjection(): readonly string[] {
  return RECIPE_PROJECTION_SLICES;
}

export function auditRecipeProjectionSinglePass(): boolean {
  const recipes = [
    {
      id: '1',
      title: 'Karaage',
      category: 'Japanese',
      ingredients: '500g Chicken\n2 Egg',
      steps: 'Fry',
      memo: '',
      starred: true,
      created_at: '2026-06-01T00:00:00Z',
    },
  ];
  const projection = buildRecipeProjection({
    recipes,
    viewRecents: [{ recipeId: '1', at: Date.now() }],
    cookHistory: [],
    editRecents: [],
    now: new Date('2026-06-18T12:00:00'),
  });
  return RECIPE_PROJECTION_SLICES.every(slice => slice in projection);
}

export function auditRecipeProjectionConsumers(): readonly string[] {
  return [
    'RecipeView.tsx',
    'useRecipeProjection.ts',
    'RecipeStudioView.tsx',
    'RecipeHomeSection.tsx',
    'RecipeIngredientsSection.tsx',
    'RecipeHistorySection.tsx',
    'RecipeCollectionsSection.tsx',
  ];
}
