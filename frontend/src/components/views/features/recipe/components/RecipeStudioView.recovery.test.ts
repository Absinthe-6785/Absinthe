// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings, Theme } from '../../../../../types';
import { RecipeStudioView } from './RecipeStudioView';
import type { RecipeProjection } from '../recipeProjectionModels';
import type { Recipe } from '../recipeTypes';

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

const emptyProjection: RecipeProjection = {
  recentRecipes: { today: [], thisWeek: [], earlier: [] },
  favoriteRecipes: [],
  recentlyCooked: { today: [], yesterday: [], earlier: [] },
  ingredientGroups: [],
  historyItems: [],
  collectionGroups: [],
  suggestions: [],
  allRecipes: [],
  empty: {
    noRecipes: true,
    noFavorites: true,
    noHistory: true,
    noIngredients: true,
    noCollections: true,
    isEmpty: true,
  },
  generatedAt: '2026-08-31T00:00:00.000Z',
};

const deletedRecipe: Recipe = {
  id: 'recipe-deleted',
  title: 'Recoverable recipe',
  category: 'Other',
  ingredients: 'rice',
  steps: 'Cook it',
  memo: '',
  starred: false,
  created_at: '2026-08-01T00:00:00Z',
  deleted_at: '2026-08-31T00:00:00Z',
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function renderStudio(onRestore: (id: string) => void) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(createElement(RecipeStudioView, {
      projection: emptyProjection,
      recipes: [],
      theme,
      appSettings,
      loading: false,
      expandedId: null,
      onToggleExpand: vi.fn(),
      onToggleStar: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      deletedRecipes: [deletedRecipe],
      deletedLoading: false,
      onRestore,
      onMarkCooked: vi.fn(),
      onNewRecipe: vi.fn(),
      onScrollToRecipe: vi.fn(),
    }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe('RecipeStudioView recovery surface', () => {
  it('exposes deleted Recipes and routes Restore to the production callback', () => {
    const onRestore = vi.fn();
    renderStudio(onRestore);

    const toggle = host?.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]');
    expect(toggle).not.toBeNull();
    expect(host?.querySelector('[data-k110-recipe-trash]')).toBeNull();

    act(() => toggle?.click());

    expect(host?.querySelector('[data-k110-recipe-trash]')).not.toBeNull();
    expect(host?.querySelector('[data-k110-recipe-trash-row="recipe-deleted"]')).not.toBeNull();

    const restore = host?.querySelector<HTMLButtonElement>('[data-k110-recipe-restore="recipe-deleted"]');
    expect(restore).not.toBeNull();
    act(() => restore?.click());
    expect(onRestore).toHaveBeenCalledWith('recipe-deleted');
  });
});
