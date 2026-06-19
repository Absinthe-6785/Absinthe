import type { Recipe } from './recipeTypes';

export type RecipeViewBucket = 'today' | 'thisWeek' | 'earlier';
export type RecipeCookBucket = 'today' | 'yesterday' | 'earlier';

export interface RecipeSummary {
  id: string;
  title: string;
  category: string;
  starred: boolean;
  createdAt: string;
  ingredientCount: number;
  stepCount: number;
}

export interface RecipeRecentItem {
  recipeId: string;
  title: string;
  category: string;
  viewedAt: number;
  relativeLabel: string;
}

export interface RecipeRecentGroups {
  today: RecipeRecentItem[];
  thisWeek: RecipeRecentItem[];
  earlier: RecipeRecentItem[];
}

export interface RecipeCookedItem {
  recipeId: string;
  title: string;
  cookedAt: number;
  relativeLabel: string;
}

export interface RecipeCookedGroups {
  today: RecipeCookedItem[];
  yesterday: RecipeCookedItem[];
  earlier: RecipeCookedItem[];
}

export interface IngredientGroup {
  name: string;
  recipeIds: string[];
  recipes: RecipeSummary[];
}

export interface RecipeHistoryRow {
  recipeId: string;
  title: string;
  lastCookedAt: number | null;
  lastCookedLabel: string;
  frequency: number;
  lastEditAt: number | null;
  lastEditLabel: string;
  bucket: RecipeCookBucket;
}

export interface RecipeHistoryGroup {
  bucket: RecipeCookBucket;
  items: RecipeHistoryRow[];
}

export interface CollectionGroup {
  id: string;
  labelKey: string;
  recipeIds: string[];
  recipes: RecipeSummary[];
}

export interface RecipeEmptyFlags {
  noRecipes: boolean;
  noFavorites: boolean;
  noHistory: boolean;
  noIngredients: boolean;
  noCollections: boolean;
  isEmpty: boolean;
}

export interface RecipeProjection {
  recentRecipes: RecipeRecentGroups;
  favoriteRecipes: RecipeSummary[];
  recentlyCooked: RecipeCookedGroups;
  ingredientGroups: IngredientGroup[];
  historyItems: RecipeHistoryGroup[];
  collectionGroups: CollectionGroup[];
  suggestions: RecipeSummary[];
  allRecipes: RecipeSummary[];
  empty: RecipeEmptyFlags;
  generatedAt: string;
}

export interface RecipeActivityEntry {
  recipeId: string;
  at: number;
}

export interface RecipeProjectionInput {
  recipes: readonly Recipe[];
  viewRecents: readonly RecipeActivityEntry[];
  cookHistory: readonly RecipeActivityEntry[];
  editRecents: readonly RecipeActivityEntry[];
  now: Date;
  locale?: string;
}

export const RECIPE_PROJECTION_SLICES = [
  'recentRecipes',
  'favoriteRecipes',
  'recentlyCooked',
  'ingredientGroups',
  'historyItems',
  'collectionGroups',
  'suggestions',
  'allRecipes',
] as const;

export type RecipeProjectionSlice = (typeof RECIPE_PROJECTION_SLICES)[number];

export function toRecipeSummary(recipe: Recipe): RecipeSummary {
  const ingredients = (recipe.ingredients ?? '').split('\n').filter(Boolean);
  const steps = (recipe.steps ?? '').split('\n').filter(Boolean);
  return {
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    starred: recipe.starred,
    createdAt: recipe.created_at,
    ingredientCount: ingredients.length,
    stepCount: steps.length,
  };
}
