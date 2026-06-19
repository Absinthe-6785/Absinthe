import { RECIPE_COLLECTION_DEFS } from './recipeCollectionUtils';
import { buildIngredientGroups } from './recipeIngredientUtils';
import {
  type RecipeProjection,
  type RecipeProjectionInput,
  type RecipeRecentItem,
  type RecipeCookedItem,
  type RecipeHistoryRow,
  type RecipeViewBucket,
  type RecipeCookBucket,
  toRecipeSummary,
} from './recipeProjectionModels';

const MS_DAY = 86_400_000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function viewBucket(at: number, now: Date): RecipeViewBucket {
  const dayStart = startOfLocalDay(now);
  if (at >= dayStart) return 'today';
  const weekStart = dayStart - 6 * MS_DAY;
  if (at >= weekStart) return 'thisWeek';
  return 'earlier';
}

function cookBucket(at: number, now: Date): RecipeCookBucket {
  const dayStart = startOfLocalDay(now);
  if (at >= dayStart) return 'today';
  const yesterdayStart = dayStart - MS_DAY;
  if (at >= yesterdayStart) return 'yesterday';
  return 'earlier';
}

function relativeLabel(at: number, now: Date, locale?: string): string {
  const diffMs = now.getTime() - at;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return '1d';
  if (diffDay < 7) return `${diffDay}d`;
  try {
    return new Date(at).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

function buildRecentGroups(
  viewRecents: RecipeProjectionInput['viewRecents'],
  recipeById: Map<string, ReturnType<typeof toRecipeSummary>>,
  now: Date,
  locale?: string,
): RecipeProjection['recentRecipes'] {
  const groups: RecipeProjection['recentRecipes'] = { today: [], thisWeek: [], earlier: [] };
  const seen = new Set<string>();
  for (const entry of viewRecents) {
    if (seen.has(entry.recipeId)) continue;
    const recipe = recipeById.get(entry.recipeId);
    if (!recipe) continue;
    seen.add(entry.recipeId);
    const item: RecipeRecentItem = {
      recipeId: entry.recipeId,
      title: recipe.title,
      category: recipe.category,
      viewedAt: entry.at,
      relativeLabel: relativeLabel(entry.at, now, locale),
    };
    groups[viewBucket(entry.at, now)].push(item);
  }
  return groups;
}

function buildCookedGroups(
  cookHistory: RecipeProjectionInput['cookHistory'],
  recipeById: Map<string, ReturnType<typeof toRecipeSummary>>,
  now: Date,
  locale?: string,
): RecipeProjection['recentlyCooked'] {
  const groups: RecipeProjection['recentlyCooked'] = { today: [], yesterday: [], earlier: [] };
  const seen = new Set<string>();
  for (const entry of cookHistory) {
    if (seen.has(entry.recipeId)) continue;
    const recipe = recipeById.get(entry.recipeId);
    if (!recipe) continue;
    seen.add(entry.recipeId);
    const item: RecipeCookedItem = {
      recipeId: entry.recipeId,
      title: recipe.title,
      cookedAt: entry.at,
      relativeLabel: relativeLabel(entry.at, now, locale),
    };
    groups[cookBucket(entry.at, now)].push(item);
  }
  return groups;
}

function buildHistoryItems(
  cookHistory: RecipeProjectionInput['cookHistory'],
  editRecents: RecipeProjectionInput['editRecents'],
  recipeById: Map<string, ReturnType<typeof toRecipeSummary>>,
  now: Date,
  locale?: string,
): RecipeProjection['historyItems'] {
  const freq = new Map<string, number>();
  const lastCooked = new Map<string, number>();
  for (const entry of cookHistory) {
    freq.set(entry.recipeId, (freq.get(entry.recipeId) ?? 0) + 1);
    if (!lastCooked.has(entry.recipeId)) lastCooked.set(entry.recipeId, entry.at);
  }

  const lastEdit = new Map<string, number>();
  for (const entry of editRecents) {
    if (!lastEdit.has(entry.recipeId)) lastEdit.set(entry.recipeId, entry.at);
  }

  const rows: RecipeHistoryRow[] = [];
  const recipeIds = new Set([...lastCooked.keys(), ...lastEdit.keys()]);
  for (const recipeId of recipeIds) {
    const recipe = recipeById.get(recipeId);
    if (!recipe) continue;
    const cookedAt = lastCooked.get(recipeId) ?? null;
    const editAt = lastEdit.get(recipeId) ?? null;
    const anchor = cookedAt ?? editAt ?? 0;
    rows.push({
      recipeId,
      title: recipe.title,
      lastCookedAt: cookedAt,
      lastCookedLabel: cookedAt ? relativeLabel(cookedAt, now, locale) : '—',
      frequency: freq.get(recipeId) ?? 0,
      lastEditAt: editAt,
      lastEditLabel: editAt ? relativeLabel(editAt, now, locale) : '—',
      bucket: cookedAt ? cookBucket(cookedAt, now) : cookBucket(editAt ?? 0, now),
    });
  }

  rows.sort((a, b) => (b.lastCookedAt ?? b.lastEditAt ?? 0) - (a.lastCookedAt ?? a.lastEditAt ?? 0));

  const buckets: RecipeCookBucket[] = ['today', 'yesterday', 'earlier'];
  return buckets.map(bucket => ({
    bucket,
    items: rows.filter(r => r.bucket === bucket),
  }));
}

function buildSuggestions(
  collectionGroups: RecipeProjection['collectionGroups'],
  favoriteIds: Set<string>,
  recentIds: Set<string>,
  limit = 4,
): RecipeProjection['suggestions'] {
  const out: ReturnType<typeof toRecipeSummary>[] = [];
  const seen = new Set<string>();
  for (const group of collectionGroups) {
    for (const recipe of group.recipes) {
      if (favoriteIds.has(recipe.id) || recentIds.has(recipe.id) || seen.has(recipe.id)) continue;
      seen.add(recipe.id);
      out.push(recipe);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * K-110 — single-pass Recipe projection for Cookbook workspace cohesion.
 */
export function buildRecipeProjection(input: RecipeProjectionInput): RecipeProjection {
  const { recipes, viewRecents, cookHistory, editRecents, now, locale } = input;
  const allRecipes = recipes.map(toRecipeSummary);
  const recipeById = new Map(allRecipes.map(r => [r.id, r]));

  const recentRecipes = buildRecentGroups(viewRecents, recipeById, now, locale);
  const favoriteRecipes = allRecipes.filter(r => r.starred);
  const recentlyCooked = buildCookedGroups(cookHistory, recipeById, now, locale);

  const ingredientDerived = buildIngredientGroups(recipes);
  const ingredientGroups = ingredientDerived.map(g => ({
    name: g.name,
    recipeIds: g.recipeIds,
    recipes: g.recipeIds.map(id => recipeById.get(id)).filter(Boolean) as typeof allRecipes,
  }));

  const historyItems = buildHistoryItems(cookHistory, editRecents, recipeById, now, locale);

  const collectionGroups = RECIPE_COLLECTION_DEFS.map(def => {
    const matched = recipes.filter(def.match).map(toRecipeSummary);
    return {
      id: def.id,
      labelKey: def.labelKey,
      recipeIds: matched.map(r => r.id),
      recipes: matched,
    };
  }).filter(g => g.recipes.length > 0);

  const recentIds = new Set(viewRecents.map(e => e.recipeId));
  const favoriteIds = new Set(favoriteRecipes.map(r => r.id));
  const suggestions = buildSuggestions(collectionGroups, favoriteIds, recentIds);

  const empty = {
    noRecipes: allRecipes.length === 0,
    noFavorites: favoriteRecipes.length === 0,
    noHistory: cookHistory.length === 0 && editRecents.length === 0,
    noIngredients: ingredientGroups.length === 0,
    noCollections: collectionGroups.length === 0,
    isEmpty: allRecipes.length === 0,
  };

  return {
    recentRecipes,
    favoriteRecipes,
    recentlyCooked,
    ingredientGroups,
    historyItems,
    collectionGroups,
    suggestions,
    allRecipes,
    empty,
    generatedAt: now.toISOString(),
  };
}

export { RECIPE_PROJECTION_SLICES } from './recipeProjectionModels';
