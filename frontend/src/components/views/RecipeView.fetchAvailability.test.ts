// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readRecipeDraft,
  recipeToDraftForm,
  writeRecipeDraft,
  type RecipeDraftEnvelope,
} from './features/recipe/recipeDraftStorage';

type SwrState = {
  data?: any[];
  error?: unknown;
  isLoading: boolean;
  isValidating: boolean;
};

const harness = vi.hoisted(() => ({
  account: 'account-a',
  active: { data: [], isLoading: false, isValidating: false } as SwrState,
  trash: { data: [], isLoading: false, isValidating: false } as SwrState,
  activeMutates: new Map<string, ReturnType<typeof vi.fn>>(),
  trashMutates: new Map<string, ReturnType<typeof vi.fn>>(),
  authFetch: vi.fn(),
  studioProps: null as Record<string, any> | null,
  formProps: null as Record<string, any> | null,
  confirmAction: null as (() => void | Promise<void>) | null,
}));

function mutateFor(map: Map<string, ReturnType<typeof vi.fn>>, account: string) {
  let mutate = map.get(account);
  if (!mutate) {
    mutate = vi.fn().mockResolvedValue(undefined);
    map.set(account, mutate);
  }
  return mutate;
}

vi.mock('swr', () => ({
  default: (key: string | null) => {
    const trash = typeof key === 'string' && key.includes('/trash');
    const state = trash ? harness.trash : harness.active;
    return {
      ...state,
      mutate: mutateFor(trash ? harness.trashMutates : harness.activeMutates, harness.account),
    };
  },
}));
vi.mock('../../lib/supabase', () => ({ authFetch: harness.authFetch }));
vi.mock('../../lib/config', () => ({ API_URL: 'https://api.example.test' }));
vi.mock('../../lib/remoteBoundary', () => ({
  remoteSWRKey: (key: string) => key,
  assertRemoteMutationAllowed: vi.fn(),
}));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  resolveAppLanguage: () => 'en',
}));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: (_message: string, action: () => void | Promise<void>) => { harness.confirmAction = action; },
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));
vi.mock('./features/recipe', () => ({
  EMPTY_RECIPE_FORM: { title: '', category: 'Other', ingredients: '', steps: '', memo: '', starred: false },
  useRecipeProjection: (recipes: any[]) => ({
    recentRecipes: { today: [], thisWeek: [], earlier: [] }, favoriteRecipes: [],
    recentlyCooked: { today: [], yesterday: [], earlier: [] }, ingredientGroups: [],
    historyItems: [], collectionGroups: [], suggestions: [], allRecipes: recipes,
    empty: { noRecipes: recipes.length === 0, noFavorites: true, noHistory: true, noIngredients: true, noCollections: true, isEmpty: recipes.length === 0 },
    generatedAt: '2026-09-01T00:00:00Z',
  }),
  recordRecipeView: vi.fn(), recordRecipeCook: vi.fn(), recordRecipeEdit: vi.fn(),
}));
vi.mock('./features/recipe/components/RecipeStudioView', () => ({
  RecipeStudioView: (props: Record<string, any>) => { harness.studioProps = props; return null; },
}));
vi.mock('./features/recipe/components/RecipeListParts', () => ({
  RecipeFormModal: (props: Record<string, any>) => { harness.formProps = props; return null; },
}));
vi.mock('../common/WorkspaceErrorBoundary', () => ({ WorkspaceErrorBoundary: ({ children }: { children: unknown }) => children }));
vi.mock('../common/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('../../lib/crossDomainReferences', () => ({ openRecipeCookingNote: vi.fn() }));
vi.mock('./features/search/searchDomainNavigation', () => ({ registerSearchDomainHandlers: () => () => undefined }));
vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: Record<string, unknown>) => unknown) => selector({ createNote: vi.fn(), updateNote: vi.fn() }),
}));

import { RecipeView } from './RecipeView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settings = { darkMode: true, defaultCategory: 'Other', defaultColor: 'blue', language: 'en' as const };
const theme = { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' };
const draftForm = { title: 'Local soup', category: 'Other', ingredients: 'water', steps: 'boil', memo: 'draft', starred: false };

function recipe(id = 'recipe-a', title = 'Saved soup') {
  return { id, title, category: 'Other', ingredients: 'water', steps: 'boil', memo: '', starred: false, created_at: '2026-09-01T00:00:00Z', deleted_at: null };
}

function editDraft(remote: ReturnType<typeof recipe>): RecipeDraftEnvelope {
  return {
    version: 1, accountId: 'account-a', mode: 'edit', recipeId: remote.id,
    form: draftForm, baseSnapshot: recipeToDraftForm(remote), generation: 1,
  };
}

let root: Root;
let host: HTMLDivElement;

function render(accountId = 'account-a') {
  harness.account = accountId;
  act(() => root.render(createElement(RecipeView, {
    key: accountId, accountId, showToast: vi.fn(), appSettings: settings,
    updateSetting: vi.fn(), theme, THEME_COLORS: [],
  })));
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); });
  }
}

beforeEach(() => {
  localStorage.clear();
  harness.account = 'account-a';
  harness.active = { data: [], isLoading: false, isValidating: false };
  harness.trash = { data: [], isLoading: false, isValidating: false };
  harness.activeMutates.clear();
  harness.trashMutates.clear();
  harness.authFetch.mockReset();
  harness.studioProps = null;
  harness.formProps = null;
  harness.confirmAction = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('Recipe fetch availability production wiring', () => {
  it('distinguishes active nonempty, confirmed empty, loading, cold failure, and warm failure', async () => {
    harness.active = { data: [recipe()], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('READY_WITH_DATA');
    expect(harness.studioProps?.recipes).toHaveLength(1);

    harness.active = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('READY_EMPTY');

    harness.active = { data: undefined, isLoading: true, isValidating: true };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('LOADING');
    expect(harness.studioProps?.recipes).toEqual([]);

    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('UNAVAILABLE_NO_DATA');

    harness.active = { data: undefined, error: new Error('HTTP 500'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('UNAVAILABLE_NO_DATA');

    harness.active = { data: [recipe()], error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('STALE_WITH_DATA');
    expect(harness.studioProps?.recipes).toHaveLength(1);
  });

  it('keeps cached empty plus error stale rather than confirmed empty', async () => {
    harness.active = { data: [], error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('STALE_WITH_DATA');
  });

  it('derives trash independently for confirmed empty, cold failure, warm failure, and mixed outcomes', async () => {
    harness.active = { data: [recipe()], isLoading: false, isValidating: false };
    harness.trash = { data: undefined, error: new Error('trash offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('READY_WITH_DATA');
    expect(harness.studioProps?.trashAvailability).toBe('UNAVAILABLE_NO_DATA');

    harness.active = { data: undefined, error: new Error('active offline'), isLoading: false, isValidating: false };
    harness.trash = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('UNAVAILABLE_NO_DATA');
    expect(harness.studioProps?.trashAvailability).toBe('READY_EMPTY');

    harness.trash = { data: [recipe('deleted')], error: new Error('trash offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.trashAvailability).toBe('STALE_WITH_DATA');
    expect(harness.studioProps?.deletedRecipes).toHaveLength(1);
  });

  it('routes active and trash Retry to their own current-account hook-local mutate', async () => {
    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    harness.trash = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    act(() => harness.studioProps?.onRetryActive());
    act(() => harness.studioProps?.onRetryTrash());
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledTimes(1);
    expect(harness.trashMutates.get('account-a')).toHaveBeenCalledTimes(1);

    harness.active = { data: [recipe()], isLoading: false, isValidating: false };
    harness.trash = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('READY_WITH_DATA');
    expect(harness.studioProps?.trashAvailability).toBe('READY_EMPTY');

    harness.active = { data: undefined, error: new Error('offline again'), isLoading: false, isValidating: false };
    render(); await flush();
    act(() => harness.studioProps?.onRetryActive());
    harness.active = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.studioProps?.activeAvailability).toBe('READY_EMPTY');
  });

  it('defensively blocks New, Edit, Save, star, delete, and restore while authority is unavailable', async () => {
    const saved = recipe();
    harness.active = { data: [saved], error: new Error('offline'), isLoading: false, isValidating: false };
    harness.trash = { data: [recipe('deleted')], error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    act(() => harness.studioProps?.onNewRecipe());
    act(() => harness.studioProps?.onEdit(saved));
    await act(async () => harness.studioProps?.onToggleStar(saved));
    act(() => harness.studioProps?.onDelete(saved.id));
    await act(async () => harness.studioProps?.onRestore('deleted'));
    expect(harness.formProps?.show).toBe(false);
    expect(harness.confirmAction).toBeNull();
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('enables New after confirmed empty and blocks stale callback mutation after authority fails', async () => {
    harness.active = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    const readyNew = harness.studioProps?.onNewRecipe as () => void;
    act(() => readyNew()); await flush();
    expect(harness.formProps?.show).toBe(true);

    harness.active = { data: [], error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    await act(async () => harness.formProps?.onSave());
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('keeps Edit draft unavailable on failure, preserves it, and never PUTs or resurrects', async () => {
    const remote = recipe();
    writeRecipeDraft(editDraft(remote));
    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-unavailable');
    expect(harness.formProps?.form).toEqual(draftForm);
    expect(readRecipeDraft('account-a').draft?.form).toEqual(draftForm);
    await act(async () => harness.formProps?.onSave());
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('reclassifies an unavailable Edit draft after successful retry as unchanged, changed, or confirmed missing', async () => {
    const remote = recipe();
    writeRecipeDraft(editDraft(remote));
    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-unavailable');

    harness.active = { data: [remote], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBeNull();

    harness.active = { data: undefined, error: new Error('offline again'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-unavailable');

    harness.active = { data: [{ ...remote, title: 'Changed remotely' }], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-changed');

    harness.active = { data: undefined, error: new Error('offline once more'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-unavailable');

    harness.active = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-missing');
    expect(readRecipeDraft('account-a').draft).not.toBeNull();
  });

  it('keeps account B cold failure B-scoped and rejects a late Account A retry from B presentation', async () => {
    harness.active = { data: [recipe('recipe-a')], isLoading: false, isValidating: false };
    render('account-a'); await flush();
    const retryA = harness.studioProps?.onRetryActive as () => void;
    expect(harness.studioProps?.recipes[0]?.id).toBe('recipe-a');

    harness.active = { data: undefined, error: new Error('B offline'), isLoading: false, isValidating: false };
    render('account-b'); await flush();
    expect(harness.studioProps?.recipes).toEqual([]);
    expect(harness.studioProps?.activeAvailability).toBe('UNAVAILABLE_NO_DATA');
    act(() => retryA()); await flush();
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledTimes(1);
    expect(harness.studioProps?.activeAvailability).toBe('UNAVAILABLE_NO_DATA');
    expect(harness.studioProps?.recipes).toEqual([]);
  });
});
