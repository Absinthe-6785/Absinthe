import {
  RECIPE_COOK_HISTORY_KEY,
  RECIPE_EDIT_RECENTS_KEY,
  RECIPE_VIEW_RECENTS_KEY,
} from './features/recipe/recipeActivityStorage';

/** Legacy activity storage keys remain reserved for existing history consumers. */
export const K110_PRESERVED_ACTIVITY_STORAGE_KEYS = [
  RECIPE_VIEW_RECENTS_KEY,
  RECIPE_COOK_HISTORY_KEY,
  RECIPE_EDIT_RECENTS_KEY,
] as const;

export function auditCookingHistory(): readonly string[] {
  return K110_PRESERVED_ACTIVITY_STORAGE_KEYS;
}
