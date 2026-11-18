// @vitest-environment happy-dom
import { act, createElement, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recipeCardRenderHarness = vi.hoisted(() => ({
  recipeIds: [] as string[],
  actions: [] as Array<{ type: string; recipeId: string; detail?: unknown }>,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number; enabled?: boolean }) => ({
    getTotalSize: () => options.count * 72,
    getVirtualItems: () => options.enabled
      ? Array.from({ length: Math.min(options.count, 8) }, (_, index) => ({ index, start: index * 72 }))
      : [],
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock('../../../../../hooks/useViewportLayout', () => ({
  useViewportLayout: () => ({ width: 390, isMobile: true, isTablet: false, isNarrow: true, category: 'narrow' }),
}));

vi.mock('./RecipeCard', async () => {
  const React = await import('react');
  return {
    RecipeCard: (props: {
      recipe: { id: string; title: string; starred: boolean };
      expanded: boolean;
      mutationsDisabled?: boolean;
      starPending?: boolean;
      copyContextKey: object;
      onToggleExpand: () => void;
      onToggleStar: () => void;
      onEdit: () => void;
      onDelete: () => void;
      onCopyRecipe: (recipeId: string, mode: 'ingredients' | 'full', expectedContextKey: object) => Promise<string>;
    }) => {
      recipeCardRenderHarness.recipeIds.push(props.recipe.id);
      return React.createElement('article', {
        'data-k110-recipe-card': props.recipe.id,
        'data-expanded': String(props.expanded),
        'data-starred': String(props.recipe.starred),
        'data-star-pending': String(Boolean(props.starPending)),
        'data-mutations-disabled': String(Boolean(props.mutationsDisabled)),
      },
      React.createElement('button', { type: 'button', 'data-card-expand': props.recipe.id, onClick: props.onToggleExpand }, props.recipe.title),
      React.createElement('button', {
        type: 'button',
        'data-card-star': props.recipe.id,
        disabled: props.mutationsDisabled || props.starPending,
        onClick: props.onToggleStar,
      }, 'Star'),
      React.createElement('button', { type: 'button', 'data-card-edit': props.recipe.id, onClick: props.onEdit }, 'Edit'),
      React.createElement('button', { type: 'button', 'data-card-delete': props.recipe.id, onClick: props.onDelete }, 'Delete'),
      React.createElement('button', {
        type: 'button',
        'data-card-copy': props.recipe.id,
        onClick: () => { void props.onCopyRecipe(props.recipe.id, 'full', props.copyContextKey); },
      }, 'Copy'));
    },
  };
});

import type { AppSettings, Theme } from '../../../../../types';
import { RecipeStudioView, type RecipeStudioViewProps } from './RecipeStudioView';
import type { RecipeProjection } from '../recipeProjectionModels';
import type { Recipe } from '../recipeTypes';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-input',
  border: 'border-border',
  text: 'text-primary',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const appSettings: AppSettings = {
  darkMode: true,
  defaultCategory: 'Other',
  defaultColor: 'blue',
  language: 'en',
};

const projection: RecipeProjection = {
  recentRecipes: { today: [], thisWeek: [], earlier: [] },
  favoriteRecipes: [],
  recentlyCooked: { today: [], yesterday: [], earlier: [] },
  ingredientGroups: [],
  historyItems: [],
  collectionGroups: [],
  suggestions: [],
  allRecipes: [],
  empty: {
    noRecipes: false,
    noFavorites: true,
    noHistory: true,
    noIngredients: true,
    noCollections: true,
    isEmpty: false,
  },
  generatedAt: '2026-08-31T00:00:00.000Z',
};

const noop = () => undefined;
const makeRecipes = (): Recipe[] => Array.from({ length: 100 }, (_, index) => ({
  id: `recipe-${index}`,
  title: `Recipe ${index}`,
  category: 'Other',
  ingredients: 'one ingredient',
  steps: 'one step',
  memo: '',
  starred: false,
  created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  deleted_at: null,
}));

type RenderObservation = { total: number; target: number; unchanged: number };
const observeRenderCounts = (recipeIds: string[], targetId: string): RenderObservation => ({
  total: recipeIds.length,
  target: recipeIds.filter(id => id === targetId).length,
  unchanged: recipeIds.filter(id => id !== targetId).length,
});

function RenderPerfHarness() {
  const [recipes, setRecipes] = useState<Recipe[]>(makeRecipes);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingStarRecipeIds, setPendingStarRecipeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [manualRefreshStatus, setManualRefreshStatus] = useState<RecipeStudioViewProps['manualRefreshStatus']>(null);
  const [activeAvailability, setActiveAvailability] = useState<RecipeStudioViewProps['activeAvailability']>('READY_WITH_DATA');
  const [copyContextKey, setCopyContextKey] = useState<object>(() => ({ account: 'fixture-account' }));
  const [editCallbackVersion, setEditCallbackVersion] = useState(0);
  const onToggleExpand = useCallback((id: string) => {
    setExpandedId(current => current === id ? null : id);
  }, []);
  const onToggleStar = useCallback((recipe: Recipe) => {
    setPendingStarRecipeIds(current => new Set(current).add(recipe.id));
    setRecipes(current => current.map(item => item.id === recipe.id ? { ...item, starred: !item.starred } : item));
  }, []);
  const onEdit = useCallback((recipe: Recipe) => {
    recipeCardRenderHarness.actions.push({ type: 'edit', recipeId: recipe.id, detail: editCallbackVersion });
  }, [editCallbackVersion]);
  const onDelete = useCallback((_id: string, _title: string) => undefined, []);
  const onRetry = useCallback(noop, []);
  const onManualRefresh = useCallback((_includeTrash: boolean) => undefined, []);
  const onCopyRecipe = useCallback(async (recipeId: string, mode: 'ingredients' | 'full', expectedContextKey: object) => {
    recipeCardRenderHarness.actions.push({ type: 'copy', recipeId, detail: { mode, expectedContextKey } });
    return 'copied';
  }, []);
  const onRestore = useCallback((_id: string) => undefined, []);
  const onScrollToRecipe = useCallback((_id: string) => undefined, []);

  return createElement('div', null,
    createElement('button', {
      type: 'button',
      'data-list-independent-update': true,
      onClick: () => setManualRefreshStatus('success'),
    }, 'Update refresh status'),
    createElement('button', {
      type: 'button',
      'data-authority-update': true,
      onClick: () => setActiveAvailability(value => value === 'READY_WITH_DATA' ? 'STALE_WITH_DATA' : 'READY_WITH_DATA'),
    }, 'Update authority'),
    createElement('button', {
      type: 'button',
      'data-copy-context-update': true,
      onClick: () => setCopyContextKey({ account: 'replacement-account' }),
    }, 'Replace copy context'),
    createElement('button', {
      type: 'button',
      'data-edit-callback-update': true,
      onClick: () => setEditCallbackVersion(value => value + 1),
    }, 'Replace edit callback'),
    createElement(RecipeStudioView, {
      projection,
      recipes,
      theme,
      appSettings,
      activeAvailability,
      activeValidating: false,
      onRetryActive: onRetry,
      onManualRefresh,
      manualRefreshStatus,
      expandedId,
      onToggleExpand,
      onToggleStar,
      pendingStarRecipeIds,
      onEdit,
      onDelete,
      onCopyRecipe,
      copyContextKey,
      deletedRecipes: [],
      trashAvailability: 'READY_EMPTY',
      trashValidating: false,
      onRetryTrash: onRetry,
      onRestore,
      onNewRecipe: noop,
      onScrollToRecipe,
    }));
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  recipeCardRenderHarness.recipeIds.length = 0;
  recipeCardRenderHarness.actions.length = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe('Recipe mobile list render-count regression', () => {
  it('renders only affected 100-card rows for expansion and star changes, and none for unrelated status', () => {
    act(() => root?.render(createElement(RenderPerfHarness)));
    expect(host!.querySelectorAll('[data-k110-recipe-card]')).toHaveLength(100);
    expect(host!.querySelector('[data-recipe-list-tail-reachable]')).not.toBeNull();
    expect(host!.querySelector('[data-k110-recipe-virtual-list]')).toBeNull();

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-card-expand="recipe-0"]')!.click());
    const expanded = observeRenderCounts(recipeCardRenderHarness.recipeIds, 'recipe-0');

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-card-expand="recipe-0"]')!.click());
    const collapsed = observeRenderCounts(recipeCardRenderHarness.recipeIds, 'recipe-0');

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-card-star="recipe-1"]')!.click());
    const starred = observeRenderCounts(recipeCardRenderHarness.recipeIds, 'recipe-1');
    expect(host!.querySelector('[data-k110-recipe-card="recipe-1"]')?.getAttribute('data-starred')).toBe('true');
    expect(host!.querySelector('[data-k110-recipe-card="recipe-1"]')?.getAttribute('data-star-pending')).toBe('true');

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-list-independent-update]')!.click());
    const independentUi = observeRenderCounts(recipeCardRenderHarness.recipeIds, 'recipe-1');

    const observations = { expanded, collapsed, starredAndPending: starred, listIndependentUi: independentUi };
    const beforeOptimization = {
      expanded: { total: 100, target: 1, unchanged: 99 },
      collapsed: { total: 100, target: 1, unchanged: 99 },
      starredAndPending: { total: 100, target: 1, unchanged: 99 },
      listIndependentUi: { total: 100, target: 1, unchanged: 99 },
    };
    console.info('[RECIPE_LIST_RENDER_COUNTS_BEFORE_AFTER]', JSON.stringify({ before: beforeOptimization, after: observations }));

    expect(observations).toEqual({
      expanded: { total: 1, target: 1, unchanged: 0 },
      collapsed: { total: 1, target: 1, unchanged: 0 },
      starredAndPending: { total: 1, target: 1, unchanged: 0 },
      listIndependentUi: { total: 0, target: 0, unchanged: 0 },
    });
  });

  it('still rerenders when authority, copy context, or a row callback changes', () => {
    act(() => root?.render(createElement(RenderPerfHarness)));

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-authority-update]')!.click());
    expect(recipeCardRenderHarness.recipeIds).toHaveLength(100);
    expect(host!.querySelector('[data-k110-recipe-card="recipe-0"]')?.getAttribute('data-mutations-disabled')).toBe('true');

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-copy-context-update]')!.click());
    expect(recipeCardRenderHarness.recipeIds).toHaveLength(100);

    recipeCardRenderHarness.recipeIds.length = 0;
    act(() => host!.querySelector<HTMLButtonElement>('[data-edit-callback-update]')!.click());
    expect(recipeCardRenderHarness.recipeIds).toHaveLength(100);

    act(() => host!.querySelector<HTMLButtonElement>('[data-card-edit="recipe-5"]')!.click());
    expect(recipeCardRenderHarness.actions.at(-1)).toEqual({ type: 'edit', recipeId: 'recipe-5', detail: 1 });

    act(() => host!.querySelector<HTMLButtonElement>('[data-card-copy="recipe-5"]')!.click());
    expect(recipeCardRenderHarness.actions.at(-1)).toMatchObject({
      type: 'copy',
      recipeId: 'recipe-5',
      detail: { mode: 'full', expectedContextKey: { account: 'replacement-account' } },
    });
  });
});
