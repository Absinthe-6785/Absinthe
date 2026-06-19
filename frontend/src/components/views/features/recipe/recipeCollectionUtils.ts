import type { Recipe } from './recipeTypes';

export interface RecipeCollectionDef {
  id: string;
  labelKey: string;
  match: (recipe: Recipe) => boolean;
}

/** Derived collections — category + keyword heuristics only. */
export const RECIPE_COLLECTION_DEFS: readonly RecipeCollectionDef[] = [
  {
    id: 'japanese',
    labelKey: 'k110ColJapanese',
    match: r => r.category === 'Japanese' || /japanese|sushi|ramen|karaage|oyako|donburi/i.test(r.title),
  },
  {
    id: 'french',
    labelKey: 'k110ColFrench',
    match: r => /french|croissant|baguette|ratatouille|boeuf/i.test(`${r.title} ${r.memo}`),
  },
  {
    id: 'dessert',
    labelKey: 'k110ColDessert',
    match: r => r.category === 'Dessert' || /cake|cookie|brownie|dessert|sweet/i.test(r.title),
  },
  {
    id: 'high-protein',
    labelKey: 'k110ColHighProtein',
    match: r => /protein|chicken breast|tofu|steak|salmon|egg white/i.test(`${r.title} ${r.ingredients} ${r.memo}`),
  },
  {
    id: 'meal-prep',
    labelKey: 'k110ColMealPrep',
    match: r => /meal prep|batch|freezer|leftover|prep/i.test(`${r.title} ${r.memo}`),
  },
  {
    id: 'comfort',
    labelKey: 'k110ColComfort',
    match: r => /soup|stew|curry|comfort|warm|broth/i.test(`${r.title} ${r.memo}`),
  },
  {
    id: 'korean',
    labelKey: 'k110ColKorean',
    match: r => r.category === 'Korean',
  },
  {
    id: 'drinks',
    labelKey: 'k110ColDrinks',
    match: r => r.category === 'Drink',
  },
];

export function recipesForCollection(
  recipes: readonly Recipe[],
  def: RecipeCollectionDef,
): Recipe[] {
  return recipes.filter(def.match);
}
