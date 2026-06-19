/** Cloud recipe entity — matches `/api/recipes` (no schema changes). */
export interface Recipe {
  id: string;
  title: string;
  category: string;
  ingredients: string;
  steps: string;
  memo: string;
  starred: boolean;
  created_at: string;
}

export const RECIPE_CATEGORIES = [
  'All',
  'Korean',
  'Japanese',
  'Chinese',
  'Western',
  'Fusion',
  'Dessert',
  'Drink',
  'Other',
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const RECIPE_CATEGORY_COLORS: Record<string, string> = {
  Korean: 'bg-orange-400',
  Japanese: 'bg-pink-400',
  Chinese: 'bg-red-500',
  Western: 'bg-blue-500',
  Fusion: 'bg-purple-500',
  Dessert: 'bg-yellow-400',
  Drink: 'bg-cyan-500',
  Other: 'bg-gray-400',
};

export const EMPTY_RECIPE_FORM = {
  title: '',
  category: 'Korean',
  ingredients: '',
  steps: '',
  memo: '',
  starred: false,
};
