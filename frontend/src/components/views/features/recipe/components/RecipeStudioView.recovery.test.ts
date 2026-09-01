// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings, Theme } from '../../../../../types';
import { RecipeStudioView, type RecipeStudioViewProps } from './RecipeStudioView';
import { RecipeFormModal, type RecipeFormModalProps } from './RecipeListParts';
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

const activeRecipe: Recipe = {
  ...deletedRecipe,
  id: 'recipe-active',
  title: 'Cached recipe',
  deleted_at: null,
};

const activeSummary = {
  id: activeRecipe.id,
  title: activeRecipe.title,
  category: activeRecipe.category,
  starred: activeRecipe.starred,
  createdAt: activeRecipe.created_at,
  ingredientCount: 1,
  stepCount: 1,
};

const populatedProjection: RecipeProjection = {
  ...emptyProjection,
  ingredientGroups: [{ name: 'rice', recipeIds: [activeRecipe.id], recipes: [activeSummary] }],
  historyItems: [{
    bucket: 'today',
    items: [{
      recipeId: activeRecipe.id,
      title: activeRecipe.title,
      lastCookedAt: 1,
      lastCookedLabel: 'today',
      frequency: 1,
      lastEditAt: 1,
      lastEditLabel: 'today',
      bucket: 'today',
    }],
  }],
  collectionGroups: [{ id: 'favorites', labelKey: 'recipeStarred', recipeIds: [activeRecipe.id], recipes: [activeSummary] }],
  allRecipes: [activeSummary],
  empty: {
    noRecipes: false,
    noFavorites: false,
    noHistory: false,
    noIngredients: false,
    noCollections: false,
    isEmpty: false,
  },
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function renderStudio(
  onRestore: (id: string) => void,
  overrides: Partial<RecipeStudioViewProps> = {},
) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(createElement(RecipeStudioView, {
      projection: emptyProjection,
      recipes: [],
      theme,
      appSettings,
      activeAvailability: 'READY_EMPTY',
      activeValidating: false,
      onRetryActive: vi.fn(),
      expandedId: null,
      onToggleExpand: vi.fn(),
      onToggleStar: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      deletedRecipes: [deletedRecipe],
      trashAvailability: 'READY_WITH_DATA',
      trashValidating: false,
      onRetryTrash: vi.fn(),
      onRestore,
      onMarkCooked: vi.fn(),
      onNewRecipe: vi.fn(),
      onScrollToRecipe: vi.fn(),
      ...overrides,
    }));
  });
}

const recipeForm: RecipeFormModalProps['form'] = {
  title: 'Soup',
  category: 'Other',
  ingredients: 'water',
  steps: 'boil',
  memo: '',
  starred: false,
};

function renderForm(overrides: Partial<RecipeFormModalProps> = {}) {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => {
    root?.render(createElement(RecipeFormModal, {
      show: true,
      editingId: null,
      form: recipeForm,
      setForm: vi.fn(),
      theme,
      dark: true,
      t: key => key,
      onClose: vi.fn(),
      onSave: vi.fn(),
      onDiscard: vi.fn(),
      saving: false,
      conflict: null,
      storageWarning: false,
      authorityReady: true,
      authorityUnavailable: false,
      authorityValidating: false,
      onRetryAuthority: vi.fn(),
      ...overrides,
    }));
  });
}

function expandDerivedSections() {
  for (const section of ['ingredients', 'history'] as const) {
    act(() => host?.querySelector<HTMLButtonElement>(`[data-k110-section-toggle="${section}"]`)?.click());
  }
}

function expectNoDerivedEmptyClaims() {
  expect(host?.querySelector('[data-k110-empty-state="ingredients"]')).toBeNull();
  expect(host?.querySelector('[data-k110-empty-state="history"]')).toBeNull();
  expect(host?.querySelector('[data-k110-empty-state="collections"]')).toBeNull();
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe('RecipeStudioView recovery surface', () => {
  it('does not render an empty library while active Recipes are loading', () => {
    renderStudio(vi.fn(), {
      activeAvailability: 'LOADING',
      recipes: [],
    });

    expect(host?.querySelector('[data-k121-empty-state="recipe-list"]')).toBeNull();
    expect(host?.querySelector<HTMLButtonElement>('[data-k110-new-recipe]')?.disabled).toBe(true);
    expect(host?.querySelector('[data-k110-recipe-studio]')?.getAttribute('data-recipe-empty')).toBe('false');
    expandDerivedSections();
    expectNoDerivedEmptyClaims();
  });

  it('shows retryable cold failure without an empty library or enabled New action', () => {
    const onRetryActive = vi.fn();
    renderStudio(vi.fn(), {
      activeAvailability: 'UNAVAILABLE_NO_DATA',
      recipes: [],
      onRetryActive,
    });

    expect(host?.querySelector('[data-recipe-availability="active"]')).not.toBeNull();
    expect(host?.querySelector('[data-k121-empty-state="recipe-list"]')).toBeNull();
    expect(host?.querySelector<HTMLButtonElement>('[data-k110-new-recipe]')?.disabled).toBe(true);
    expect(host?.querySelector('[data-k110-recipe-studio]')?.getAttribute('data-recipe-empty')).toBe('false');
    expandDerivedSections();
    expectNoDerivedEmptyClaims();
    act(() => host?.querySelector<HTMLButtonElement>('[data-recipe-availability-retry="active"]')?.click());
    expect(onRetryActive).toHaveBeenCalledTimes(1);
  });

  it('keeps warm cached rows visible but disables row mutations while stale', () => {
    renderStudio(vi.fn(), {
      activeAvailability: 'STALE_WITH_DATA',
      recipes: [activeRecipe],
    });

    const card = host?.querySelector<HTMLElement>('[data-k110-recipe-card="recipe-active"]');
    expect(card).not.toBeNull();
    expect(host?.querySelector('[data-recipe-availability="active"][data-recipe-availability-stale="true"]')).not.toBeNull();
    expect(host?.querySelector('[data-k121-empty-state="recipe-list"]')).toBeNull();
    expect(Array.from(card?.querySelectorAll<HTMLButtonElement>('button') ?? []).slice(0, 3).every(button => button.disabled)).toBe(true);
  });

  it('does not render confirmed empty from cached empty data plus an error', () => {
    renderStudio(vi.fn(), {
      activeAvailability: 'STALE_WITH_DATA',
      recipes: [],
    });

    expect(host?.querySelector('[data-recipe-availability="active"][data-recipe-availability-stale="true"]')).not.toBeNull();
    expect(host?.querySelector('[data-k121-empty-state="recipe-list"]')).toBeNull();
    expect(host?.querySelector<HTMLButtonElement>('[data-k110-new-recipe]')?.disabled).toBe(true);
    expect(host?.querySelector('[data-k110-recipe-studio]')?.getAttribute('data-recipe-empty')).toBe('false');
    expandDerivedSections();
    expectNoDerivedEmptyClaims();
  });

  it('keeps populated derived projections viewable while active authority is stale', () => {
    renderStudio(vi.fn(), {
      activeAvailability: 'STALE_WITH_DATA',
      recipes: [activeRecipe],
      projection: populatedProjection,
    });

    expandDerivedSections();
    expect(host?.querySelector('[data-k110-ingredient-explorer]')).not.toBeNull();
    expect(host?.querySelector('[data-k110-history-list]')).not.toBeNull();
    expect(host?.querySelector('[data-k110-collection-list]')).not.toBeNull();
    expectNoDerivedEmptyClaims();
  });

  it('renders confirmed empty only after active authority is ready', () => {
    renderStudio(vi.fn(), {
      activeAvailability: 'READY_EMPTY',
      recipes: [],
    });

    expect(host?.querySelector('[data-k121-empty-state="recipe-list"]')).not.toBeNull();
    expect(host?.querySelector<HTMLButtonElement>('[data-k110-new-recipe]')?.disabled).toBe(false);
    expect(host?.querySelector('[data-k110-recipe-studio]')?.getAttribute('data-recipe-empty')).toBe('true');
    expect(host?.querySelector('[data-k110-empty-state="collections"]')).not.toBeNull();
    expandDerivedSections();
    expect(host?.querySelector('[data-k110-empty-state="ingredients"]')).not.toBeNull();
    expect(host?.querySelector('[data-k110-empty-state="history"]')).not.toBeNull();
  });

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

  it('does not render empty trash on a cold trash failure and routes Retry locally', () => {
    const onRetryTrash = vi.fn();
    renderStudio(vi.fn(), {
      deletedRecipes: [],
      trashAvailability: 'UNAVAILABLE_NO_DATA',
      onRetryTrash,
    });
    act(() => host?.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]')?.click());

    expect(host?.querySelector('[data-k110-recipe-trash-empty]')).toBeNull();
    expect(host?.querySelector('[data-recipe-availability="trash"]')).not.toBeNull();
    act(() => host?.querySelector<HTMLButtonElement>('[data-recipe-availability-retry="trash"]')?.click());
    expect(onRetryTrash).toHaveBeenCalledTimes(1);
  });

  it('renders confirmed empty trash only for ready-empty authority', () => {
    renderStudio(vi.fn(), {
      deletedRecipes: [],
      trashAvailability: 'READY_EMPTY',
    });
    act(() => host?.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]')?.click());

    expect(host?.querySelector('[data-k110-recipe-trash-empty]')).not.toBeNull();
    expect(host?.querySelector('[data-recipe-availability="trash"]')).toBeNull();
  });

  it('keeps warm trash rows visible but disables Restore while trash is stale', () => {
    renderStudio(vi.fn(), {
      deletedRecipes: [deletedRecipe],
      trashAvailability: 'STALE_WITH_DATA',
    });
    act(() => host?.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]')?.click());

    expect(host?.querySelector('[data-k110-recipe-trash-row="recipe-deleted"]')).not.toBeNull();
    expect(host?.querySelector('[data-recipe-availability="trash"][data-recipe-availability-stale="true"]')).not.toBeNull();
    expect(host?.querySelector<HTMLButtonElement>('[data-k110-recipe-restore="recipe-deleted"]')?.disabled).toBe(true);
  });
});

describe('RecipeFormModal authority presentation', () => {
  it('keeps New and Edit Save disabled outside ready authority and recovers when ready', () => {
    const onSave = vi.fn();
    renderForm({ authorityReady: false, authorityUnavailable: true, onSave });
    expect(host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.disabled).toBe(true);
    act(() => host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.click());
    expect(onSave).not.toHaveBeenCalled();

    renderForm({ authorityReady: true, authorityUnavailable: false, onSave });
    expect(host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.disabled).toBe(false);
    act(() => host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.click());
    expect(onSave).toHaveBeenCalledTimes(1);

    renderForm({ editingId: 'recipe-a', authorityReady: false, authorityUnavailable: true });
    expect(host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.disabled).toBe(true);

    renderForm({ editingId: 'recipe-a', authorityReady: true, authorityUnavailable: false });
    expect(host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.disabled).toBe(false);
  });

  it('keeps Save disabled while saving and preserves conflict actions without a Save action', () => {
    renderForm({ saving: true });
    expect(host?.querySelector<HTMLButtonElement>('[data-recipe-save]')?.disabled).toBe(true);

    renderForm({ conflict: 'remote-unavailable', authorityReady: false, authorityUnavailable: true });
    expect(host?.querySelector('[data-recipe-draft-conflict="remote-unavailable"]')).not.toBeNull();
    expect(host?.querySelector('[data-recipe-save]')).toBeNull();

    renderForm({ conflict: 'remote-changed' });
    expect(host?.querySelector('[data-recipe-draft-conflict="remote-changed"]')).not.toBeNull();
    expect(host?.querySelector('[data-recipe-save]')).toBeNull();

    renderForm({ conflict: 'remote-missing' });
    expect(host?.querySelector('[data-recipe-draft-conflict="remote-missing"]')).not.toBeNull();
    expect(host?.querySelector('[data-recipe-save]')).toBeNull();
  });
});
