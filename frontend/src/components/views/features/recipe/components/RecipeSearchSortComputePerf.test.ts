// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./RecipeCompositionLayout', async () => {
  const React = await import('react');
  return {
    RecipeCompositionLayout: ({ header, primary, supporting }: { header: React.ReactNode; primary: React.ReactNode; supporting: React.ReactNode }) =>
      React.createElement('div', null, header, primary, supporting),
  };
});

vi.mock('./RecipeListParts', async () => {
  const React = await import('react');
  return {
    RecipeVirtualList: ({ recipes }: { recipes: Array<{ id: string }> }) => React.createElement('output', {
      'data-recipe-visible-ids': JSON.stringify(recipes.map(recipe => recipe.id)),
    }),
  };
});

vi.mock('../hooks/useRecipeSectionPrefs', () => ({
  useRecipeSectionPrefs: () => ({
    prefs: { ingredientsCollapsed: false, collectionsCollapsed: false },
    toggle: vi.fn(),
  }),
}));

vi.mock('./RecipeHomeSection', () => ({ RecipeHomeSection: () => null }));
vi.mock('./RecipeIngredientsSection', () => ({ RecipeIngredientsSection: () => null }));
vi.mock('./RecipeCollectionsSection', () => ({ RecipeCollectionsSection: () => null }));

import type { AppSettings, Theme } from '../../../../../types';
import type { RecipeProjection } from '../recipeProjectionModels';
import type { Recipe } from '../recipeTypes';
import { RecipeStudioView, type RecipeStudioViewProps } from './RecipeStudioView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const theme: Theme = {
  card: 'bg-surface', input: 'bg-input', border: 'border-border', text: 'text-primary', textMuted: 'text-muted', hoverBg: 'hover:bg-surface-alt',
};
const appSettings: AppSettings = { darkMode: true, defaultCategory: 'Other', defaultColor: 'blue', language: 'en' };
const projection: RecipeProjection = {
  recentRecipes: { today: [], thisWeek: [], earlier: [] },
  favoriteRecipes: [],
  recentlyCooked: { today: [], yesterday: [], earlier: [] },
  ingredientGroups: [], historyItems: [], collectionGroups: [], suggestions: [], allRecipes: [],
  empty: { noRecipes: false, noFavorites: true, noHistory: true, noIngredients: true, noCollections: true, isEmpty: false },
  generatedAt: '2026-08-31T00:00:00.000Z',
};

const makeRecipes = (count: number): Recipe[] => Array.from({ length: count }, (_, index) => {
  const dateIndex = (index * 37) % Math.max(1, Math.floor(count / 3));
  return {
    id: `recipe-${String(index).padStart(3, '0')}`,
    title: `Dish ${String(index).padStart(3, '0')}`,
    category: ['Korean', 'Japanese', 'Western'][index % 3],
    ingredients: `ingredient-${index} 기본 재료`,
    steps: `step-${index} Prepare`,
    memo: 'memo needle-one needle-two needle-three',
    starred: index % 2 === 0,
    created_at: index === 17 ? 'malformed-date-fixture' : new Date(Date.UTC(2025, 0, 1 + dateIndex)).toISOString(),
    deleted_at: null,
  };
});

const renderProps = (recipes: readonly Recipe[]): RecipeStudioViewProps => ({
  projection, recipes, theme, appSettings,
  activeAvailability: 'READY_WITH_DATA', activeValidating: false, onRetryActive: () => undefined,
  expandedId: null, onToggleExpand: () => undefined, onToggleStar: () => undefined,
  onEdit: () => undefined, onDelete: () => undefined, onCopyRecipe: async () => 'copied',
  copyContextKey: {}, deletedRecipes: [], trashAvailability: 'READY_EMPTY', trashValidating: false,
  onRetryTrash: () => undefined, onRestore: () => undefined, onNewRecipe: () => undefined, onScrollToRecipe: () => undefined,
});

type ComputationCounts = { fieldLowercase: number; queryLowercase: number; dateParses: number; titleComparisons: number };

function beginComputationTracking(recipes: readonly Recipe[], queries: readonly string[]) {
  const counts: ComputationCounts = { fieldLowercase: 0, queryLowercase: 0, dateParses: 0, titleComparisons: 0 };
  const fields = new Set(recipes.flatMap(recipe => [recipe.title, recipe.ingredients, recipe.steps, recipe.memo]));
  const querySet = new Set(queries);
  const dates = new Set(recipes.map(recipe => recipe.created_at));
  const titles = new Set(recipes.map(recipe => recipe.title));
  const originalLowercase = String.prototype.toLowerCase;
  const originalLocaleCompare = String.prototype.localeCompare;
  const OriginalDate = globalThis.Date;

  String.prototype.toLowerCase = function (...args) {
    const text = String(this);
    if (fields.has(text)) counts.fieldLowercase++;
    if (querySet.has(text)) counts.queryLowercase++;
    return originalLowercase.apply(this, args);
  };
  String.prototype.localeCompare = function (compareString, ...args) {
    if (titles.has(String(this)) && titles.has(compareString)) counts.titleComparisons++;
    return originalLocaleCompare.call(this, compareString, ...args);
  };
  globalThis.Date = new Proxy(OriginalDate, {
    construct(target, args, newTarget) {
      if (typeof args[0] === 'string' && dates.has(args[0])) counts.dateParses++;
      return Reflect.construct(target, args, newTarget);
    },
  });

  return {
    counts,
    stop() {
      String.prototype.toLowerCase = originalLowercase;
      String.prototype.localeCompare = originalLocaleCompare;
      globalThis.Date = OriginalDate;
    },
  };
}

function referenceVisible(recipes: readonly Recipe[], query: string, category: string, starredOnly: boolean, sort: 'newest' | 'oldest' | 'title') {
  const q = query.toLowerCase().trim();
  const filtered = recipes.filter(recipe => {
    if (starredOnly && !recipe.starred) return false;
    if (category !== 'All' && recipe.category !== category) return false;
    if (q && ![recipe.title, recipe.ingredients, recipe.steps, recipe.memo].some(text => (text ?? '').toLowerCase().includes(q))) return false;
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (sort === 'title') return (a.title ?? '').localeCompare(b.title ?? '');
    if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).map(recipe => recipe.id);
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let stopComputationTracking: (() => void) | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  stopComputationTracking?.();
  stopComputationTracking = null;
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

function visibleIds() {
  const output = host!.querySelector<HTMLOutputElement>('[data-recipe-visible-ids]');
  return JSON.parse(output?.dataset.recipeVisibleIds ?? '[]') as string[];
}

function setSearch(value: string) {
  const input = host!.querySelector<HTMLInputElement>('[data-k110-recipe-search]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickCategory(category: string) {
  const button = [...host!.querySelectorAll<HTMLButtonElement>('[data-k110-recipe-filters] button')]
    .find(candidate => candidate.textContent === category);
  if (!button) throw new Error(`Missing category button: ${category}`);
  act(() => button.click());
}

function clickSort(label: string) {
  const button = [...host!.querySelectorAll<HTMLButtonElement>('.abs-recipe-sort-option')]
    .find(candidate => candidate.textContent === label);
  if (!button) throw new Error(`Missing sort button: ${label}`);
  act(() => button.click());
}

describe('Recipe search/sort computation performance regression', () => {
  it.each([100, 500])('compares repeatable before/after operations for %i recipes and preserves filter/sort results', count => {
    const recipes = makeRecipes(count);
    const queries = ['needle-one', ' NEEDLE-TWO ', 'needle-three'];
    const tracked = beginComputationTracking(recipes, queries);
    stopComputationTracking = tracked.stop;
    const observed: string[][] = [];

    act(() => root!.render(createElement(RecipeStudioView, renderProps(recipes))));
    observed.push(visibleIds());
    setSearch(queries[0]); observed.push(visibleIds());
    setSearch(queries[1]); observed.push(visibleIds());
    setSearch(queries[2]); observed.push(visibleIds());
    clickCategory('Japanese'); observed.push(visibleIds());
    act(() => host!.querySelector<HTMLButtonElement>('.abs-recipe-star-filter')!.click()); observed.push(visibleIds());
    clickSort('↑'); observed.push(visibleIds());
    clickSort('A-Z'); observed.push(visibleIds());
    clickSort('↓'); observed.push(visibleIds());

    tracked.stop();
    stopComputationTracking = null;
    // Measured on BASE_SHA 228b0bd7f00612beff1fb12e38bb95b6ab7b930a with this same fixture and interaction sequence before the production optimization.
    const baseline = count === 100
      ? { fieldLowercase: 1588, queryLowercase: 8, dateParses: 4628, titleComparisons: 15 }
      : { fieldLowercase: 7996, queryLowercase: 8, dateParses: 32898, titleComparisons: 82 };
    console.info('[RECIPE_SEARCH_SORT_COMPUTE_BEFORE_AFTER]', JSON.stringify({ count, before: baseline, after: tracked.counts }));
    expect(tracked.counts.fieldLowercase).toBe(count * 4);
    expect(tracked.counts.fieldLowercase).toBeLessThan(baseline.fieldLowercase);
    expect(tracked.counts.queryLowercase).toBe(baseline.queryLowercase);
    expect(tracked.counts.dateParses).toBe(count);
    expect(tracked.counts.dateParses).toBeLessThan(baseline.dateParses);

    const expected = [
      referenceVisible(recipes, '', 'All', false, 'newest'),
      referenceVisible(recipes, queries[0], 'All', false, 'newest'),
      referenceVisible(recipes, queries[1], 'All', false, 'newest'),
      referenceVisible(recipes, queries[2], 'All', false, 'newest'),
      referenceVisible(recipes, queries[2], 'Japanese', false, 'newest'),
      referenceVisible(recipes, queries[2], 'Japanese', true, 'newest'),
      referenceVisible(recipes, queries[2], 'Japanese', true, 'oldest'),
      referenceVisible(recipes, queries[2], 'Japanese', true, 'title'),
      referenceVisible(recipes, queries[2], 'Japanese', true, 'newest'),
    ];
    expect(observed).toEqual(expected);
  });

  it('keeps search across all supported fields, Unicode/case/whitespace behavior, stable ties, and source replacements', () => {
    const initial: Recipe[] = [
      { id: 'title', title: 'Crème BRÛLÉE', category: 'Dessert', ingredients: '', steps: '', memo: '', starred: false, created_at: 'bad-date' },
      { id: 'ingredients', title: 'B', category: 'Dessert', ingredients: 'Vanilla Ω', steps: '', memo: '', starred: true, created_at: '2025-01-01' },
      { id: 'steps', title: 'A', category: 'Dessert', ingredients: '', steps: 'Bake Gently', memo: '', starred: false, created_at: '2025-01-01' },
      { id: 'memo', title: 'C', category: 'Dessert', ingredients: '', steps: '', memo: '東京 café', starred: true, created_at: '2025-01-02' },
    ];
    act(() => root!.render(createElement(RecipeStudioView, renderProps(initial))));
    const cases = [
      [' crème brûlée ', ['title']],
      ['VANILLA ω', ['ingredients']],
      ['bake gently', ['steps']],
      ['東京 CAFÉ', ['memo']],
    ] as const;
    for (const [query, ids] of cases) {
      setSearch(query);
      expect(visibleIds()).toEqual(ids);
    }

    setSearch('');
    expect(visibleIds()).toEqual(referenceVisible(initial, '', 'All', false, 'newest'));
    clickSort('↑');
    expect(visibleIds()).toEqual(referenceVisible(initial, '', 'All', false, 'oldest'));
    clickSort('A-Z');
    expect(visibleIds()).toEqual(referenceVisible(initial, '', 'All', false, 'title'));
    clickSort('↓');
    expect(visibleIds()).toEqual(referenceVisible(initial, '', 'All', false, 'newest'));
    const replacement = initial.map(recipe => recipe.id === 'title' ? { ...recipe, title: 'Replaced', starred: true, created_at: '2025-01-03' } : recipe);
    act(() => root!.render(createElement(RecipeStudioView, renderProps(replacement))));
    expect(visibleIds()).toEqual(referenceVisible(replacement, '', 'All', false, 'newest'));
  });

  it('rebuilds derived search and sort data when the source array and recipe fields are replaced', () => {
    const initial = makeRecipes(12);
    act(() => root!.render(createElement(RecipeStudioView, renderProps(initial))));
    act(() => host!.querySelector<HTMLButtonElement>('.abs-recipe-star-filter')!.click());
    expect(visibleIds()).toEqual(referenceVisible(initial, '', 'All', true, 'newest'));

    const replacement = initial.map((recipe, index) => index === 1
      ? { ...recipe, title: 'Updated Ω Dish', ingredients: 'new source ingredient', starred: true, created_at: '2026-04-01T00:00:00Z' }
      : recipe);
    act(() => root!.render(createElement(RecipeStudioView, renderProps(replacement))));
    expect(visibleIds()).toEqual(referenceVisible(replacement, '', 'All', true, 'newest'));
    setSearch('NEW SOURCE INGREDIENT');
    expect(visibleIds()).toEqual(['recipe-001']);
  });

  it('treats runtime-nullish supported text fields as empty strings', () => {
    const nullishRecipe = {
      id: 'nullish', title: null, category: 'Other', ingredients: undefined, steps: null, memo: undefined,
      starred: false, created_at: '2025-01-01T00:00:00Z', deleted_at: null,
    } as unknown as Recipe;
    act(() => root!.render(createElement(RecipeStudioView, renderProps([nullishRecipe]))));
    expect(visibleIds()).toEqual(['nullish']);
    setSearch('anything');
    expect(visibleIds()).toEqual([]);
    setSearch('');
    expect(visibleIds()).toEqual(['nullish']);
  });

  it('keeps the selected sort when Clear Search and Filters resets only query/category/starred filters', () => {
    const recipes = makeRecipes(18);
    act(() => root!.render(createElement(RecipeStudioView, renderProps(recipes))));
    clickSort('↑');
    clickCategory('Japanese');
    act(() => host!.querySelector<HTMLButtonElement>('.abs-recipe-star-filter')!.click());
    setSearch('no-matching-recipe');

    const emptyState = host!.querySelector('[data-k121-empty-state="recipe-filtered-no-results"]');
    expect(emptyState).not.toBeNull();
    act(() => emptyState!.querySelector('button')!.click());

    expect(host!.querySelector<HTMLInputElement>('[data-k110-recipe-search]')!.value).toBe('');
    expect(host!.querySelector<HTMLButtonElement>('[data-k110-recipe-filters] button')?.getAttribute('aria-pressed')).toBe('true');
    expect(host!.querySelector<HTMLButtonElement>('.abs-recipe-star-filter')?.getAttribute('aria-pressed')).toBe('false');
    expect([...host!.querySelectorAll<HTMLButtonElement>('.abs-recipe-sort-option')]
      .find(button => button.textContent === '↑')?.getAttribute('aria-pressed')).toBe('true');
  });
});
