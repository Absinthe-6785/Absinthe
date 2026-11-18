// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react';
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
  remoteRead: vi.fn(),
  studioProps: null as Record<string, any> | null,
  formProps: null as Record<string, any> | null,
  navigationConsumed: vi.fn(),
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
vi.mock('../../lib/accountBoundRemote', () => ({
  accountBoundRemoteKey: (url: string, accountId?: string) => accountId ? `${url}::${accountId}` : null,
  accountBoundRemoteFetcher: (key: string) => harness.remoteRead(key),
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
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function installClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

function copyFromStudio() {
  return harness.studioProps?.onCopyRecipe as (
    recipeId: string,
    mode: 'ingredients' | 'full',
    expectedContextKey: object,
  ) => Promise<string>;
}

function refreshFromStudio() {
  return harness.studioProps?.onManualRefresh as (includeTrash: boolean) => Promise<void>;
}

function render(
  accountId = 'account-a',
  recipeNavigationRequest?: { accountId: string; accountGeneration: number; requestId: number; recipeId: string },
  keyByAccount = true,
  strictMode = false,
) {
  harness.account = accountId;
  const view = createElement(RecipeView, {
    key: keyByAccount ? accountId : undefined, accountId, showToast: vi.fn(), appSettings: settings,
    updateSetting: vi.fn(), theme, THEME_COLORS: [],
    recipeNavigationRequest,
    onRecipeNavigationConsumed: harness.navigationConsumed,
  });
  act(() => root.render(strictMode ? createElement(StrictMode, null, view) : view));
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
  harness.remoteRead.mockReset();
  harness.studioProps = null;
  harness.formProps = null;
  harness.navigationConsumed.mockReset();
  harness.confirmAction = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  if (originalClipboardDescriptor) Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Recipe fetch availability production wiring', () => {
  it('copies exact ingredients and deterministic full text from the current active source without writes', async () => {
    const saved = { ...recipe('same-id', 'duplicate title'), ingredients: '파 1대\r\n간장 2큰술\n\n마지막 한 줄 ', steps: '끓인다.\n불을 끈다.', memo: '기호에 따라 고춧가루' };
    harness.active = { data: [saved, recipe('other-id', 'duplicate title')], isLoading: false, isValidating: false };
    render(); await flush();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const contextKey = harness.studioProps?.copyContextKey as object;

    await act(async () => {
      expect(await copyFromStudio()(saved.id, 'ingredients', contextKey)).toBe('copied');
    });
    expect(writeText).toHaveBeenNthCalledWith(1, saved.ingredients);

    await act(async () => {
      expect(await copyFromStudio()(saved.id, 'full', contextKey)).toBe('copied');
    });
    expect(writeText).toHaveBeenNthCalledWith(2,
      `title\nduplicate title\n\ningredients\n${saved.ingredients}\n\nsteps\n${saved.steps}\n\nrecipeMemo\n${saved.memo}`,
    );
    expect(harness.authFetch).not.toHaveBeenCalled();
    expect(harness.activeMutates.get('account-a')).not.toHaveBeenCalled();
  });

  it('fails closed for stale card context, unavailable authority, missing IDs, and deleted rows', async () => {
    const saved = recipe('same-id');
    harness.active = { data: [saved], isLoading: false, isValidating: false };
    render(); await flush();
    const staleAction = copyFromStudio();
    const staleContext = harness.studioProps?.copyContextKey as object;
    harness.active = { data: [{ ...saved, ingredients: 'new current content' }], isLoading: false, isValidating: false };
    render(); await flush();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    await act(async () => {
      expect(await staleAction(saved.id, 'ingredients', staleContext)).toBe('stale');
    });
    expect(writeText).not.toHaveBeenCalled();

    const currentContext = harness.studioProps?.copyContextKey as object;
    harness.active = { data: [saved], isLoading: false, isValidating: true };
    render(); await flush();
    await act(async () => {
      expect(await copyFromStudio()(saved.id, 'ingredients', harness.studioProps?.copyContextKey)).toBe('unavailable');
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(currentContext).not.toBe(harness.studioProps?.copyContextKey);

    harness.active = { data: [{ ...saved, deleted_at: '2026-11-01T00:00:00Z' }], isLoading: false, isValidating: false };
    render(); await flush();
    await act(async () => {
      expect(await copyFromStudio()(saved.id, 'full', harness.studioProps?.copyContextKey)).toBe('unavailable');
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('reports missing clipboard support and permission rejection without false success', async () => {
    const saved = recipe();
    harness.active = { data: [saved], isLoading: false, isValidating: false };
    render(); await flush();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await act(async () => {
      expect(await copyFromStudio()(saved.id, 'full', harness.studioProps?.copyContextKey)).toBe('unsupported');
    });

    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    installClipboard(writeText);
    await act(async () => {
      expect(await copyFromStudio()(saved.id, 'full', harness.studioProps?.copyContextKey)).toBe('failed');
    });
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('does not report a pending clipboard operation as successful after an account change', async () => {
    const savedA = recipe('shared-id', 'Account A recipe');
    harness.active = { data: [savedA], isLoading: false, isValidating: false };
    render('account-a'); await flush();
    let complete!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
    installClipboard(writeText);
    const oldAction = copyFromStudio();
    const oldContext = harness.studioProps?.copyContextKey as object;
    const pending = oldAction(savedA.id, 'full', oldContext);
    expect(writeText).toHaveBeenCalledTimes(1);

    harness.active = { data: [recipe('shared-id', 'Account B recipe')], isLoading: false, isValidating: false };
    render('account-b'); await flush();
    await act(async () => { complete(); });
    expect(await pending).toBe('stale');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('rejects an Account A callback after an A-B-A transition', async () => {
    harness.active = { data: [recipe('same-id', 'Account A')], isLoading: false, isValidating: false };
    render('account-a'); await flush();
    const oldAction = copyFromStudio();
    const oldContext = harness.studioProps?.copyContextKey as object;
    harness.active = { data: [recipe('same-id', 'Account B')], isLoading: false, isValidating: false };
    render('account-b'); await flush();
    harness.active = { data: [recipe('same-id', 'Account A refreshed')], isLoading: false, isValidating: false };
    render('account-a'); await flush();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);

    await act(async () => {
      expect(await oldAction('same-id', 'full', oldContext)).toBe('stale');
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('waits for account-scoped authoritative recipe data before expanding a Home deep link', async () => {
    const request = { accountId: 'account-a', accountGeneration: 0, requestId: 11, recipeId: 'target-recipe' };
    harness.active = { data: undefined, isLoading: true, isValidating: true };
    render('account-a', request);
    await flush();
    expect(harness.navigationConsumed).not.toHaveBeenCalled();
    expect(harness.studioProps?.expandedId).toBeNull();

    harness.active = { data: [recipe('target-recipe')], isLoading: false, isValidating: false };
    render('account-a', request);
    await flush();
    expect(harness.studioProps?.expandedId).toBe('target-recipe');
    expect(harness.studioProps?.navigationRequestId).toBe(11);
    expect(harness.navigationConsumed).toHaveBeenCalledExactlyOnceWith(11);
  });

  it('consumes a missing recipe only after an authoritative empty response', async () => {
    const request = { accountId: 'account-a', accountGeneration: 0, requestId: 12, recipeId: 'deleted-recipe' };
    harness.active = { data: [], isLoading: false, isValidating: false };
    render('account-a', request);
    await flush();
    expect(harness.studioProps?.expandedId).toBeNull();
    expect(harness.navigationConsumed).toHaveBeenCalledExactlyOnceWith(12);
  });

  it('does not consume a request for another account or while recipe authority is unavailable', async () => {
    const otherAccountRequest = {
      accountId: 'account-b', accountGeneration: 1, requestId: 13, recipeId: 'target-recipe',
    };
    harness.active = { data: [recipe('target-recipe')], isLoading: false, isValidating: false };
    render('account-a', otherAccountRequest);
    await flush();
    expect(harness.studioProps?.expandedId).toBeNull();
    expect(harness.navigationConsumed).not.toHaveBeenCalled();

    const unavailableRequest = {
      accountId: 'account-a', accountGeneration: 0, requestId: 14, recipeId: 'target-recipe',
    };
    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render('account-a', unavailableRequest);
    await flush();
    expect(harness.studioProps?.activeAvailability).toBe('UNAVAILABLE_NO_DATA');
    expect(harness.navigationConsumed).not.toHaveBeenCalled();
  });

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
    expect(harness.formProps?.authorityReady).toBe(false);
    await act(async () => harness.formProps?.onSave());
    expect(harness.authFetch).not.toHaveBeenCalled();

    harness.active = { data: [], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.authorityReady).toBe(true);
  });

  it('keeps Edit draft unavailable on failure, preserves it, and never PUTs or resurrects', async () => {
    const remote = recipe();
    writeRecipeDraft(editDraft(remote));
    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-unavailable');
    expect(harness.formProps?.authorityReady).toBe(false);
    expect(harness.formProps?.form).toEqual(draftForm);
    expect(readRecipeDraft('account-a').draft?.form).toEqual(draftForm);
    await act(async () => harness.formProps?.onSave());
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('blocks an already-open Edit save through stale and cold-unavailable authority, then recovers', async () => {
    const remote = recipe();
    harness.active = { data: [remote], isLoading: false, isValidating: false };
    render(); await flush();
    act(() => harness.studioProps?.onEdit(remote)); await flush();
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.authorityReady).toBe(true);

    harness.active = { data: [remote], error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.authorityReady).toBe(false);
    await act(async () => harness.formProps?.onSave());
    expect(harness.authFetch).not.toHaveBeenCalled();

    harness.active = { data: undefined, error: new Error('offline'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.authorityReady).toBe(false);
    await act(async () => harness.formProps?.onSave());
    expect(harness.authFetch).not.toHaveBeenCalled();

    harness.active = { data: [remote], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.authorityReady).toBe(true);
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
    expect(harness.formProps?.authorityReady).toBe(true);

    harness.active = { data: undefined, error: new Error('offline again'), isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-unavailable');

    harness.active = { data: [{ ...remote, title: 'Changed remotely' }], isLoading: false, isValidating: false };
    render(); await flush();
    expect(harness.formProps?.conflict).toBe('remote-changed');
    expect(harness.formProps?.authorityReady).toBe(true);

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

  it('manually refreshes only the active account-bound list and reports verified read success without writes', async () => {
    const cached = recipe('cached');
    const fresh = recipe('fresh', 'Updated remotely');
    harness.active = { data: [cached], isLoading: false, isValidating: false };
    harness.remoteRead.mockResolvedValue([fresh]);
    render(); await flush();

    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    expect(harness.studioProps?.manualRefreshStatus).toBe('refreshing');
    await act(async () => { await refresh; });

    expect(harness.remoteRead).toHaveBeenCalledTimes(1);
    expect(harness.remoteRead).toHaveBeenCalledWith('https://api.example.test/api/recipes::account-a');
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledWith([fresh], false);
    expect(harness.trashMutates.get('account-a')).not.toHaveBeenCalled();
    expect(harness.studioProps?.manualRefreshStatus).toBe('success');
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('completes a manual refresh after the application StrictMode effect replay', async () => {
    harness.remoteRead.mockResolvedValue([recipe('strict-refresh')]);
    render('account-a', undefined, true, true); await flush();

    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    await act(async () => { await refresh; });

    expect(harness.remoteRead).toHaveBeenCalledTimes(1);
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledWith([recipe('strict-refresh')], false);
    expect(harness.studioProps?.manualRefreshStatus).toBe('success');
  });

  it('refreshes trash only while requested and reports a partial result while preserving the failed cache', async () => {
    const fresh = recipe('fresh');
    harness.remoteRead.mockImplementation((key: string) => (
      key.includes('/trash') ? Promise.reject(new Error('offline')) : Promise.resolve([fresh])
    ));
    render(); await flush();

    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(true); });
    await act(async () => { await refresh; });

    expect(harness.remoteRead).toHaveBeenCalledTimes(2);
    expect(harness.remoteRead).toHaveBeenCalledWith('https://api.example.test/api/recipes::account-a');
    expect(harness.remoteRead).toHaveBeenCalledWith('https://api.example.test/api/recipes/trash::account-a');
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledWith([fresh], false);
    expect(harness.trashMutates.get('account-a')).not.toHaveBeenCalled();
    expect(harness.studioProps?.manualRefreshStatus).toBe('partial');
  });

  it('reports offline and failed active reads without replacing existing cache data', async () => {
    harness.active = { data: [recipe('cached')], isLoading: false, isValidating: false };
    render(); await flush();
    const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    try {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      let offlineRefresh!: Promise<void>;
      act(() => { offlineRefresh = refreshFromStudio()(false); });
      await act(async () => { await offlineRefresh; });
      expect(harness.studioProps?.manualRefreshStatus).toBe('offline');
      expect(harness.remoteRead).not.toHaveBeenCalled();

      if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline);
      else Reflect.deleteProperty(navigator, 'onLine');
      harness.remoteRead.mockRejectedValueOnce(new Error('network failure'));
      let failedRefresh!: Promise<void>;
      act(() => { failedRefresh = refreshFromStudio()(false); });
      await act(async () => { await failedRefresh; });
      expect(harness.studioProps?.manualRefreshStatus).toBe('unavailable');
      expect(harness.activeMutates.get('account-a')).not.toHaveBeenCalled();
    } finally {
      if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline);
      else Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('coalesces repeated refresh clicks into one read flight', async () => {
    let resolveRead!: (rows: unknown) => void;
    const remoteRead = new Promise<unknown>(resolve => { resolveRead = resolve; });
    harness.remoteRead.mockReturnValue(remoteRead);
    render(); await flush();

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = refreshFromStudio()(false);
      second = refreshFromStudio()(false);
    });
    await act(async () => { await Promise.resolve(); });
    expect(first).toBe(second);
    expect(harness.remoteRead).toHaveBeenCalledTimes(1);
    await act(async () => { resolveRead([recipe('fresh')]); await first; });
    expect(harness.studioProps?.manualRefreshStatus).toBe('success');
  });

  it('discards an A-B-A stale completion before publishing cache or status', async () => {
    let resolveRead!: (rows: unknown) => void;
    const remoteRead = new Promise<unknown>(resolve => { resolveRead = resolve; });
    harness.remoteRead.mockReturnValue(remoteRead);
    render('account-a', undefined, false); await flush();
    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    await act(async () => { await Promise.resolve(); });

    render('account-b', undefined, false);
    render('account-a', undefined, false);
    await act(async () => { resolveRead([recipe('stale-a')]); await refresh; });

    expect(harness.activeMutates.get('account-a')).not.toHaveBeenCalled();
    expect(harness.studioProps?.manualRefreshStatus).toBeNull();
  });

  it('discards a manual read when a Recipe mutation starts before the read completes', async () => {
    const saved = recipe('starred');
    const fresh = recipe('fresh-from-cloud');
    harness.active = { data: [saved], isLoading: false, isValidating: false };
    let resolveRead!: (rows: unknown) => void;
    let resolveWrite!: (response: unknown) => void;
    harness.remoteRead.mockReturnValue(new Promise<unknown>(resolve => { resolveRead = resolve; }));
    harness.authFetch.mockReturnValue(new Promise<unknown>(resolve => { resolveWrite = resolve; }));
    render(); await flush();

    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    await act(async () => { await Promise.resolve(); });
    let star!: Promise<void>;
    act(() => { star = harness.studioProps?.onToggleStar(saved); });
    resolveRead([fresh]);
    await act(async () => { await refresh; });

    expect(harness.activeMutates.get('account-a')?.mock.calls.some(([value, revalidate]) => (
      Array.isArray(value) && value[0]?.id === fresh.id && revalidate === false
    ))).toBe(false);
    expect(harness.studioProps?.manualRefreshStatus).toBe('unavailable');
    await act(async () => {
      resolveWrite({ ok: true, json: async () => ({ ...saved, user_id: 'account-a', deleted_at: null, starred: true }) });
      await star;
    });
  });

  it('does not publish a pending cloud result after the Recipe view unmounts', async () => {
    let resolveRead!: (rows: unknown) => void;
    harness.remoteRead.mockReturnValue(new Promise<unknown>(resolve => { resolveRead = resolve; }));
    render(); await flush();
    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    await act(async () => { await Promise.resolve(); });
    act(() => root.unmount());
    await act(async () => { resolveRead([recipe('stale-after-unmount')]); await refresh; });
    expect(harness.activeMutates.get('account-a')).not.toHaveBeenCalled();
  });

  it('does not start a cloud refresh during a pending Recipe mutation', async () => {
    const saved = recipe('starred');
    harness.active = { data: [saved], isLoading: false, isValidating: false };
    let resolveWrite!: (response: unknown) => void;
    const write = new Promise<unknown>(resolve => { resolveWrite = resolve; });
    harness.authFetch.mockReturnValue(write);
    render(); await flush();

    let star!: Promise<void>;
    act(() => { star = harness.studioProps?.onToggleStar(saved); });
    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    await act(async () => { await refresh; });
    expect(harness.remoteRead).not.toHaveBeenCalled();
    expect(harness.studioProps?.manualRefreshStatus).toBe('unavailable');

    await act(async () => {
      resolveWrite({ ok: true, json: async () => ({ ...saved, user_id: 'account-a', deleted_at: null, starred: true }) });
      await star;
    });
  });

  it('preserves a recovered unsaved Recipe draft during a successful manual read', async () => {
    const remote = recipe();
    writeRecipeDraft(editDraft(remote));
    const previousDraft = readRecipeDraft('account-a').draft;
    harness.active = { data: [remote], isLoading: false, isValidating: false };
    harness.remoteRead.mockResolvedValue([remote]);
    render(); await flush();
    const previousForm = harness.formProps?.form;

    let refresh!: Promise<void>;
    act(() => { refresh = refreshFromStudio()(false); });
    await act(async () => { await refresh; });

    expect(readRecipeDraft('account-a').draft).toEqual(previousDraft);
    expect(harness.formProps?.form).toEqual(previousForm);
    expect(harness.authFetch).not.toHaveBeenCalled();
  });
});
