// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const virtualizerHarness = vi.hoisted(() => ({
  measureElement: vi.fn(),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number; enabled?: boolean }) => ({
    getTotalSize: () => options.count * 72,
    getVirtualItems: () => options.enabled
      ? Array.from({ length: Math.min(options.count, 8) }, (_, index) => ({ index, start: index * 72 }))
      : [],
    measureElement: virtualizerHarness.measureElement,
  }),
}));

import type { AppSettings, Theme } from '../../../../../types';
import { useAppStore } from '../../../../../store/useAppStore';
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

const populatedRecipes: Recipe[] = Array.from({ length: 18 }, (_, index) => ({
  ...activeRecipe,
  id: `recipe-${index + 1}`,
  title: `Recipe ${index + 1}`,
  created_at: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
}));

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
  virtualizerHarness.measureElement.mockClear();
  useAppStore.getState().updateSetting('language', 'en');
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe('UI-07 production Recipe composition hierarchy', () => {
  it.each([390, 768, 1024, 1279, 1280, 1440])(
    'keeps the populated list before bounded support at %ipx',
    width => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      renderStudio(vi.fn(), {
        projection: populatedProjection,
        recipes: populatedRecipes,
        activeAvailability: 'READY_WITH_DATA',
      });

      const composition = host!.querySelector<HTMLElement>('[data-recipe-composition="list-first"]')!;
      const content = host!.querySelector<HTMLElement>('[data-recipe-composition-content]')!;
      const primary = host!.querySelector<HTMLElement>('[data-recipe-composition-role="primary-list"]')!;
      const controls = host!.querySelector<HTMLElement>('[data-recipe-composition-role="direct-controls"]')!;
      const support = host!.querySelector<HTMLElement>('[data-recipe-composition-role="support"]')!;
      const list = host!.querySelector<HTMLElement>('[data-k110-recipe-list]')!;
      const cards = list.querySelectorAll('[data-k110-recipe-card]');
      const wideOwners = host!.querySelectorAll('[data-recipe-scroll-owner-wide]');

      expect(composition.getAttribute('data-workspace-scroll-mode')).toBe('pane');
      expect(content.className).toContain('overflow-y-auto');
      expect(content.className).toContain('xl:overflow-hidden');
      expect(content.getAttribute('data-recipe-scroll-owner-pre-wide')).toBe('workspace');
      expect(primary.parentElement).toBe(content);
      expect(support.parentElement).toBe(content);
      expect(primary.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(primary.getAttribute('data-recipe-hierarchy-level')).toBe('primary');
      expect(controls.getAttribute('data-recipe-hierarchy-level')).toBe('secondary');
      expect(support.getAttribute('data-recipe-hierarchy-level')).toBe('tertiary');
      expect(primary.contains(controls)).toBe(true);
      expect(primary.contains(host!.querySelector('[data-k110-recipe-search]'))).toBe(true);
      expect(primary.contains(host!.querySelector('[data-k110-recipe-filters]'))).toBe(true);
      expect(support.contains(host!.querySelector('[data-k110-recipe-home]'))).toBe(true);
      expect(support.className).toContain('xl:w-[320px]');
      expect(wideOwners).toHaveLength(2);
      expect(Array.from(wideOwners, owner => owner.getAttribute('data-recipe-scroll-owner-wide'))).toEqual(['list', 'support']);
      expect(wideOwners[0].contains(wideOwners[1])).toBe(false);
      expect(cards).toHaveLength(populatedRecipes.length);
      expect(cards[0]?.getAttribute('data-k110-recipe-card')).toBe('recipe-18');
      expect(cards[9]?.getAttribute('data-k110-recipe-card')).toBe('recipe-9');
      expect(cards[cards.length - 1]?.getAttribute('data-k110-recipe-card')).toBe('recipe-1');
      const newRecipe = host!.querySelector<HTMLElement>('[data-k110-new-recipe]')!;
      expect(newRecipe.className).toContain('w-full');
      expect(newRecipe.className).toContain('!w-auto');
      expect(newRecipe.className).toContain('shrink-0');
      expect(host!.querySelector('[data-k125-workspace-header="recipe"]')?.className).toContain('flex-col sm:flex-row');

      act(() => host!.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]')!.click());
      expect(support.contains(host!.querySelector('[data-k110-recipe-trash]'))).toBe(true);
      expect(support.contains(host!.querySelector('[data-k110-recipe-restore="recipe-deleted"]'))).toBe(true);
    },
  );

  it('keeps a long mobile list in the natural workspace flow with its tail rendered', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const longList = Array.from({ length: 45 }, (_, index) => ({
      ...activeRecipe,
      id: `long-recipe-${index + 1}`,
      title: `Long Recipe ${index + 1}`,
      created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }));

    renderStudio(vi.fn(), {
      projection: populatedProjection,
      recipes: longList,
      activeAvailability: 'READY_WITH_DATA',
    });

    const list = host!.querySelector('[data-k110-recipe-list]');
    const cards = list?.querySelectorAll('[data-k110-recipe-card]') ?? [];
    expect(host!.querySelector('[data-k110-recipe-virtual-list]')).toBeNull();
    expect(cards).toHaveLength(45);
    expect(cards[0]?.getAttribute('data-k110-recipe-card')).toBe('long-recipe-45');
    expect(cards[cards.length - 1]?.getAttribute('data-k110-recipe-card')).toBe('long-recipe-1');
  });

  it('connects wide variable-height Recipe rows to TanStack measurement by virtual index', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const longList = Array.from({ length: 45 }, (_, index) => ({
      ...activeRecipe,
      id: `wide-recipe-${index + 1}`,
      title: `Wide Recipe ${index + 1}`,
      created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }));
    const onToggleExpand = vi.fn();

    renderStudio(vi.fn(), {
      projection: populatedProjection,
      recipes: longList,
      activeAvailability: 'READY_WITH_DATA',
      expandedId: 'wide-recipe-45',
      onToggleExpand,
    });

    const virtualList = host!.querySelector('[data-k110-recipe-virtual-list]')!;
    const rows = virtualList.querySelectorAll<HTMLElement>('[data-index]');
    const firstRow = rows[0];
    const firstCard = firstRow.querySelector<HTMLElement>('[data-k110-recipe-card]')!;

    expect(rows.length).toBeGreaterThan(1);
    expect(firstRow.getAttribute('data-index')).toBe('0');
    expect(firstCard.getAttribute('data-k110-recipe-card')).toBe('wide-recipe-45');
    expect(firstRow.querySelector('ul')).not.toBeNull();
    expect(firstRow.querySelector('ol')).not.toBeNull();
    expect(virtualizerHarness.measureElement.mock.calls.some(([node]) => node === firstRow)).toBe(true);

    act(() => firstCard.querySelector<HTMLElement>('.cursor-pointer')!.click());
    expect(onToggleExpand).toHaveBeenCalledWith('wide-recipe-45');
  });
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
    expect(toggle?.textContent).toContain('Trash');
    expect(toggle?.textContent).not.toContain('Recently deleted');
    expect(host?.querySelector('[data-k110-recipe-trash]')).toBeNull();

    act(() => toggle?.click());

    const trash = host?.querySelector('[data-k110-recipe-trash]');
    expect(trash).not.toBeNull();
    expect(trash?.querySelector('h2')?.textContent).toBe('Trash');
    expect(trash?.textContent).not.toContain('No deleted recipes.');
    expect(host?.querySelector('[data-k110-recipe-trash-row="recipe-deleted"]')).not.toBeNull();

    const restore = host?.querySelector<HTMLButtonElement>('[data-k110-recipe-restore="recipe-deleted"]');
    expect(restore).not.toBeNull();
    expect(restore?.textContent).toContain('Restore');
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
    expect(host?.querySelector('[data-k110-recipe-trash]')?.textContent).not.toContain('No deleted recipes.');
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

    const emptyMessages = Array.from(host?.querySelectorAll('[data-k110-recipe-trash] p') ?? [])
      .filter(element => element.textContent === 'No deleted recipes.');
    expect(host?.querySelector('[data-k110-recipe-trash-empty]')?.textContent).toBe('No deleted recipes.');
    expect(emptyMessages).toHaveLength(1);
    expect(host?.querySelector('[data-recipe-availability="trash"]')).toBeNull();
  });

  it('does not render authoritative-empty copy while trash is loading', () => {
    renderStudio(vi.fn(), {
      deletedRecipes: [],
      trashAvailability: 'LOADING',
    });
    act(() => host?.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]')?.click());

    expect(host?.querySelector('[data-k110-recipe-trash-empty]')).toBeNull();
    expect(host?.querySelector('[data-k110-recipe-trash]')?.textContent).not.toContain('No deleted recipes.');
  });

  it('keeps warm trash rows visible but disables Restore while trash is stale', () => {
    renderStudio(vi.fn(), {
      deletedRecipes: [deletedRecipe],
      trashAvailability: 'STALE_WITH_DATA',
    });
    act(() => host?.querySelector<HTMLButtonElement>('[data-k110-recipe-trash-toggle]')?.click());

    expect(host?.querySelector('[data-k110-recipe-trash-row="recipe-deleted"]')).not.toBeNull();
    expect(host?.querySelector('[data-recipe-availability="trash"][data-recipe-availability-stale="true"]')).not.toBeNull();
    expect(host?.querySelector('[data-k110-recipe-trash-empty]')).toBeNull();
    expect(host?.querySelector('[data-k110-recipe-trash]')?.textContent).not.toContain('No deleted recipes.');
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
