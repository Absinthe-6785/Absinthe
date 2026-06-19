export { buildRecipeProjection, RECIPE_PROJECTION_SLICES } from './buildRecipeProjection';
export type {
  RecipeProjection,
  RecipeProjectionSlice,
  RecipeSummary,
  RecipeRecentItem,
  RecipeRecentGroups,
  RecipeCookedItem,
  RecipeCookedGroups,
  IngredientGroup,
  RecipeHistoryRow,
  RecipeHistoryGroup,
  CollectionGroup,
  RecipeEmptyFlags,
} from './recipeProjectionModels';
export { toRecipeSummary } from './recipeProjectionModels';
export { useRecipeProjection } from './hooks/useRecipeProjection';
export { useRecipeSectionPrefs } from './hooks/useRecipeSectionPrefs';
export type { Recipe, RecipeCategory } from './recipeTypes';
export {
  RECIPE_CATEGORIES,
  RECIPE_CATEGORY_COLORS,
  EMPTY_RECIPE_FORM,
} from './recipeTypes';
export {
  recordRecipeView,
  recordRecipeCook,
  recordRecipeEdit,
  readRecipeViewRecents,
  readRecipeCookHistory,
  readRecipeEditRecents,
  clearRecipeActivityForTest,
} from './recipeActivityStorage';
export {
  readRecipeSectionPrefs,
  writeRecipeSectionPrefs,
  RECIPE_SECTION_PREFS_KEY,
  DEFAULT_RECIPE_SECTION_PREFS,
} from './recipeSectionPrefs';
export { normalizeIngredientLine, extractIngredientNames, buildIngredientGroups } from './recipeIngredientUtils';
export { RECIPE_COLLECTION_DEFS } from './recipeCollectionUtils';
