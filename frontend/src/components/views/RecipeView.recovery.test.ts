// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  mutateRecipes: vi.fn(),
  mutateDeletedRecipes: vi.fn(),
  showConfirm: vi.fn(),
  showToast: vi.fn(),
  confirmAction: null as (() => Promise<void>) | null,
  studioProps: null as Record<string, any> | null,
}));

vi.mock('swr', () => ({
  default: (key: string | null) => {
    const deleted = typeof key === 'string' && key.includes('/api/recipes/trash');
    return {
      data: deleted ? [deletedRecipe] : [activeRecipe],
      isLoading: false,
      mutate: deleted ? mocks.mutateDeletedRecipes : mocks.mutateRecipes,
    };
  },
}));
vi.mock('../../lib/supabase', () => ({ authFetch: mocks.authFetch }));
vi.mock('../../lib/fetcher', () => ({ fetcher: vi.fn() }));
vi.mock('../../lib/config', () => ({ API_URL: 'https://api.example.test' }));
vi.mock('../../lib/remoteBoundary', () => ({ remoteSWRKey: (key: string) => key }));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: (message: string, action: () => Promise<void>) => {
      void message;
      mocks.confirmAction = action;
      mocks.showConfirm(message, action);
    },
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  resolveAppLanguage: () => 'en',
}));
vi.mock('./features/recipe', () => ({
  EMPTY_RECIPE_FORM: { title: '', category: 'Korean', ingredients: '', steps: '', memo: '', starred: false },
  useRecipeProjection: () => emptyProjection,
  recordRecipeView: vi.fn(),
  recordRecipeCook: vi.fn(),
  recordRecipeEdit: vi.fn(),
}));
vi.mock('./features/recipe/components/RecipeStudioView', () => ({
  RecipeStudioView: (props: Record<string, any>) => {
    mocks.studioProps = props;
    return null;
  },
}));
vi.mock('./features/recipe/components/RecipeListParts', () => ({ RecipeFormModal: () => null }));
vi.mock('../common/WorkspaceErrorBoundary', () => ({
  WorkspaceErrorBoundary: ({ children }: { children: unknown }) => children,
}));
vi.mock('../common/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('../../lib/crossDomainReferences', () => ({ openRecipeCookingNote: vi.fn() }));
vi.mock('./features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: () => () => undefined }));
vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    createNote: vi.fn(),
    updateNote: vi.fn(),
  }),
}));

import { RecipeView } from './RecipeView';

const activeRecipe = {
  id: 'recipe-active',
  title: 'Active recipe',
  category: 'Other',
  ingredients: 'rice',
  steps: 'Cook it',
  memo: '',
  starred: false,
  created_at: '2026-08-01T00:00:00Z',
};

const deletedRecipe = {
  ...activeRecipe,
  id: 'recipe-deleted',
  title: 'Deleted recipe',
  deleted_at: '2026-08-31T00:00:00Z',
};

const emptyProjection = {
  recentRecipes: { today: [], thisWeek: [], earlier: [] },
  favoriteRecipes: [],
  recentlyCooked: { today: [], yesterday: [], earlier: [] },
  ingredientGroups: [],
  historyItems: [],
  collectionGroups: [],
  suggestions: [],
  allRecipes: [],
  empty: { noRecipes: false, noFavorites: true, noHistory: true, noIngredients: true, noCollections: true, isEmpty: false },
  generatedAt: '2026-08-31T00:00:00.000Z',
};

const props = {
  accountId: 'account-a',
  showToast: mocks.showToast,
  updateSetting: vi.fn(),
  appSettings: { darkMode: true, defaultCategory: 'Other', defaultColor: 'blue', language: 'en' as const },
  theme: { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' },
  THEME_COLORS: [],
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  mocks.authFetch.mockReset();
  mocks.mutateRecipes.mockReset();
  mocks.mutateDeletedRecipes.mockReset();
  mocks.showConfirm.mockReset();
  mocks.showToast.mockReset();
  mocks.confirmAction = null;
  mocks.studioProps = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(createElement(RecipeView, props)));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
});

describe('RecipeView delete and recovery production path', () => {
  it('removes a Recipe from the active cache only after a successful delete response', async () => {
    mocks.authFetch.mockResolvedValue({ ok: true } as Response);
    await act(async () => { await mocks.studioProps?.onDelete('recipe-active', 'Active recipe'); });
    expect(mocks.confirmAction).not.toBeNull();
    await act(async () => { await mocks.confirmAction?.(); });

    expect(mocks.authFetch).toHaveBeenCalledWith('https://api.example.test/api/recipes/recipe-active', { method: 'DELETE' });
    const updater = mocks.mutateRecipes.mock.calls[0]?.[0] as ((rows: (typeof activeRecipe)[]) => (typeof activeRecipe)[]);
    expect(updater([activeRecipe])).toEqual([]);
    expect(mocks.mutateDeletedRecipes).toHaveBeenCalledOnce();
  });

  it('keeps the active Recipe visible and reports failure when delete is rejected', async () => {
    mocks.authFetch.mockResolvedValue({ ok: false, status: 503 } as Response);
    await act(async () => { await mocks.studioProps?.onDelete('recipe-active', 'Active recipe'); });
    await act(async () => { await mocks.confirmAction?.(); });

    expect(mocks.mutateRecipes).not.toHaveBeenCalled();
    expect(mocks.mutateDeletedRecipes).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('failDeleteRecipe', 'error');
  });

  it('routes a successful Restore into the active cache and removes it from trash', async () => {
    mocks.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...deletedRecipe, deleted_at: null }),
    } as Response);

    await act(async () => { await mocks.studioProps?.onRestore('recipe-deleted'); });

    const activeUpdater = mocks.mutateRecipes.mock.calls[0]?.[0] as ((rows: (typeof activeRecipe)[]) => (typeof activeRecipe)[]);
    const trashUpdater = mocks.mutateDeletedRecipes.mock.calls[0]?.[0] as ((rows: (typeof deletedRecipe)[]) => (typeof deletedRecipe)[]);
    expect(activeUpdater([])).toEqual([{ ...deletedRecipe, deleted_at: null }]);
    expect(trashUpdater([deletedRecipe])).toEqual([]);
    expect(mocks.showToast).toHaveBeenCalledWith('recipeRestored');
  });

  it('keeps a deleted Recipe in trash and reports failure when Restore is rejected', async () => {
    mocks.authFetch.mockResolvedValue({ ok: false, status: 409 } as Response);

    await act(async () => { await mocks.studioProps?.onRestore('recipe-deleted'); });

    expect(mocks.mutateRecipes).not.toHaveBeenCalled();
    expect(mocks.mutateDeletedRecipes).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('failRestoreRecipe', 'error');
  });
});
