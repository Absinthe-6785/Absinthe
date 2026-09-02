// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SwrState = {
  data?: any[];
  error?: unknown;
  isLoading: boolean;
  isValidating: boolean;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const harness = vi.hoisted(() => ({
  renderingAccount: 'account-a',
  activeStates: new Map<string, SwrState>(),
  serverRows: new Map<string, any[]>(),
  revalidationErrors: new Map<string, Error>(),
  activeMutates: new Map<string, ReturnType<typeof vi.fn>>(),
  trashMutates: new Map<string, ReturnType<typeof vi.fn>>(),
  authFetch: vi.fn(),
  showToast: vi.fn(),
  studioProps: null as Record<string, any> | null,
  formProps: null as Record<string, any> | null,
}));

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function activeState(account: string): SwrState {
  const existing = harness.activeStates.get(account);
  if (existing) return existing;
  const created = { data: [], isLoading: false, isValidating: false };
  harness.activeStates.set(account, created);
  return created;
}

function activeMutateFor(account: string) {
  let mutate = harness.activeMutates.get(account);
  if (mutate) return mutate;
  mutate = vi.fn(async (...args: any[]) => {
    const state = activeState(account);
    if (args.length > 0) {
      const value = typeof args[0] === 'function' ? args[0](state.data) : args[0];
      if (value !== undefined) state.data = value;
      return value;
    }
    const revalidationError = harness.revalidationErrors.get(account);
    if (revalidationError) {
      state.error = revalidationError;
      throw revalidationError;
    }
    const authoritative = harness.serverRows.get(account);
    if (authoritative) state.data = authoritative.map(row => ({ ...row }));
    state.error = undefined;
    return state.data;
  });
  harness.activeMutates.set(account, mutate);
  return mutate;
}

function trashMutateFor(account: string) {
  let mutate = harness.trashMutates.get(account);
  if (!mutate) {
    mutate = vi.fn().mockResolvedValue(undefined);
    harness.trashMutates.set(account, mutate);
  }
  return mutate;
}

vi.mock('swr', () => ({
  default: (key: string | null) => {
    const account = harness.renderingAccount;
    if (typeof key === 'string' && key.includes('/trash')) {
      return {
        data: [], error: undefined, isLoading: false, isValidating: false,
        mutate: trashMutateFor(account),
      };
    }
    return { ...activeState(account), mutate: activeMutateFor(account) };
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
  useConfirm: () => ({ confirm: null, showConfirm: vi.fn(), clearConfirm: vi.fn(), handleConfirm: vi.fn() }),
}));
vi.mock('./features/recipe', () => ({
  EMPTY_RECIPE_FORM: { title: '', category: 'Other', ingredients: '', steps: '', memo: '', starred: false },
  useRecipeProjection: (recipes: any[]) => ({
    recentRecipes: { today: [], thisWeek: [], earlier: [] }, favoriteRecipes: [],
    recentlyCooked: { today: [], yesterday: [], earlier: [] }, ingredientGroups: [],
    historyItems: [], collectionGroups: [], suggestions: [], allRecipes: recipes,
    empty: { noRecipes: recipes.length === 0, noFavorites: true, noHistory: true, noIngredients: true, noCollections: true, isEmpty: recipes.length === 0 },
    generatedAt: '2026-09-02T00:00:00Z',
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
import { RecipeCard } from './features/recipe/components/RecipeCard';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settings = { darkMode: true, defaultCategory: 'Other', defaultColor: 'blue', language: 'en' as const };
const theme = { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' };

function recipe(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Recipe ${id}`,
    category: 'Dinner',
    ingredients: 'V1 ingredients',
    steps: 'V1 steps',
    memo: 'V1 memo',
    starred: false,
    created_at: '2026-09-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

function starResponse(row: ReturnType<typeof recipe>, target: boolean, account = 'account-a', overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      ...row,
      user_id: account,
      deleted_at: null,
      starred: target,
      ...overrides,
    }),
  };
}

let root: Root;
let host: HTMLDivElement;

function render(accountId: string | null = 'account-a') {
  const resolvedAccountId = accountId ?? undefined;
  harness.renderingAccount = resolvedAccountId ?? '__logged-out__';
  act(() => root.render(createElement(RecipeView, {
    accountId: resolvedAccountId,
    showToast: harness.showToast,
    appSettings: settings,
    updateSetting: vi.fn(),
    theme,
    THEME_COLORS: [],
  })));
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await Promise.resolve(); });
  }
}

function beginStar(row: ReturnType<typeof recipe>) {
  let operation!: Promise<void>;
  act(() => { operation = harness.studioProps?.onToggleStar(row); });
  return operation;
}

beforeEach(() => {
  localStorage.clear();
  harness.renderingAccount = 'account-a';
  harness.activeStates.clear();
  harness.serverRows.clear();
  harness.revalidationErrors.clear();
  harness.activeMutates.clear();
  harness.trashMutates.clear();
  harness.authFetch.mockReset();
  harness.showToast.mockReset();
  harness.studioProps = null;
  harness.formProps = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('Recipe star mutation production path', () => {
  it('uses the star-only endpoint and merges only authoritative starred into current cached content', async () => {
    const initial = recipe('recipe-a');
    const currentV2 = recipe('recipe-a', {
      title: 'Content V2', category: 'Lunch', ingredients: 'V2 ingredients', steps: 'V2 steps', memo: 'V2 memo',
    });
    activeState('account-a').data = [initial];
    harness.serverRows.set('account-a', [{ ...currentV2, starred: true }]);
    const request = deferred<any>();
    harness.authFetch.mockReturnValueOnce(request.promise);
    render();

    const operation = beginStar(initial);
    activeState('account-a').data = [currentV2];
    request.resolve(starResponse(initial, true));
    await act(async () => { await operation; });

    expect(harness.authFetch).toHaveBeenCalledWith(
      'https://api.example.test/api/recipes/recipe-a/star',
      { method: 'PUT', body: JSON.stringify({ starred: true }) },
    );
    expect(Object.keys(JSON.parse(harness.authFetch.mock.calls[0][1].body))).toEqual(['starred']);
    expect(activeState('account-a').data).toEqual([{ ...currentV2, starred: true }]);
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledTimes(3);
    const successMerge = harness.activeMutates.get('account-a')!.mock.calls[1][0];
    expect(successMerge([{ ...currentV2, starred: false }])).toEqual([{ ...currentV2, starred: true }]);
    expect(harness.trashMutates.get('account-a')).not.toHaveBeenCalled();
  });

  it('synchronously blocks same-Recipe ABA requests while allowing a different Recipe', async () => {
    const first = recipe('recipe-a');
    const second = recipe('recipe-b');
    activeState('account-a').data = [first, second];
    harness.serverRows.set('account-a', [{ ...first, starred: true }, { ...second, starred: true }]);
    const firstRequest = deferred<any>();
    const secondRequest = deferred<any>();
    harness.authFetch.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);
    render();

    const firstOperation = beginStar(first);
    const blockedSecond = beginStar(first);
    const blockedThird = beginStar(first);
    const independentOperation = beginStar(second);

    expect(harness.authFetch).toHaveBeenCalledTimes(2);
    expect([...harness.studioProps!.pendingStarRecipeIds]).toEqual(expect.arrayContaining(['recipe-a', 'recipe-b']));
    await expect(blockedSecond).resolves.toBeUndefined();
    await expect(blockedThird).resolves.toBeUndefined();
    firstRequest.resolve(starResponse(first, true));
    secondRequest.resolve(starResponse(second, true));
    await act(async () => { await Promise.all([firstOperation, independentOperation]); });

    expect(activeState('account-a').data).toEqual([{ ...first, starred: true }, { ...second, starred: true }]);
  });

  it('blocks same-Recipe edit while star is pending but leaves another Recipe editable', async () => {
    const first = recipe('recipe-a');
    const second = recipe('recipe-b');
    activeState('account-a').data = [first, second];
    harness.serverRows.set('account-a', [{ ...first, starred: true }, second]);
    const request = deferred<any>();
    harness.authFetch.mockReturnValueOnce(request.promise);
    render();

    const operation = beginStar(first);
    act(() => harness.studioProps?.onEdit(first));
    expect(harness.formProps?.show).toBe(false);
    await act(async () => { await harness.formProps?.onSave(); });
    expect(harness.authFetch).toHaveBeenCalledTimes(1);
    act(() => harness.studioProps?.onEdit(second));
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.editingId).toBe(second.id);

    request.resolve(starResponse(first, true));
    await act(async () => { await operation; });
  });

  it('blocks a stale direct star callback for the Recipe in the active edit session', async () => {
    const saved = recipe('recipe-a');
    activeState('account-a').data = [saved];
    render();
    const directStar = harness.studioProps?.onToggleStar as (row: typeof saved) => Promise<void>;

    act(() => harness.studioProps?.onEdit(saved));
    await act(async () => { await directStar(saved); });

    expect(harness.formProps?.show).toBe(true);
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['prior server truth', false],
    ['transport-ambiguous committed truth', true],
  ])('revalidates a failed request to %s without restoring a captured snapshot', async (_label, serverStarred) => {
    const initial = recipe('recipe-a');
    const currentV2 = recipe('recipe-a', { title: 'Content V2', memo: 'V2 memo', starred: true });
    activeState('account-a').data = [initial];
    harness.serverRows.set('account-a', [{ ...currentV2, starred: serverStarred }]);
    harness.authFetch.mockRejectedValueOnce(new TypeError('transport failed'));
    render();

    await act(async () => { await harness.studioProps?.onToggleStar(initial); });

    expect(activeState('account-a').data).toEqual([{ ...currentV2, starred: serverStarred }]);
    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledTimes(2);
    expect(harness.showToast).toHaveBeenCalledWith('failSaveRecipe', 'error');
    expect(harness.trashMutates.get('account-a')).not.toHaveBeenCalled();
  });

  it('treats malformed success as ambiguous and retains the lock until failed revalidation marks authority stale', async () => {
    const saved = recipe('recipe-a');
    activeState('account-a').data = [saved];
    harness.authFetch.mockResolvedValue(starResponse(saved, true, 'wrong-account'));
    harness.revalidationErrors.set('account-a', new Error('GET failed'));
    render();

    await act(async () => { await harness.studioProps?.onToggleStar(saved); });
    expect(harness.showToast).toHaveBeenCalledWith('failSaveRecipe', 'error');
    await flush();
    expect(harness.studioProps?.activeAvailability).toBe('STALE_WITH_DATA');
    expect(harness.studioProps?.pendingStarRecipeIds.has(saved.id)).toBe(false);
    await act(async () => { await harness.studioProps?.onToggleStar(saved); });
    expect(harness.authFetch).toHaveBeenCalledTimes(1);
  });

  it.each([['account switch', 'account-b'], ['logout', null]])(
    'suppresses late cache, toast, and revalidation work after %s',
    async (_label, nextAccount) => {
      const saved = recipe('recipe-a');
      activeState('account-a').data = [saved];
      activeState(nextAccount ?? '__logged-out__').data = nextAccount ? [recipe('recipe-b')] : [];
      const request = deferred<any>();
      harness.authFetch.mockReturnValueOnce(request.promise);
      render('account-a');
      const operation = beginStar(saved);

      render(nextAccount);
      await flush();
      request.resolve(starResponse(saved, true));
      await act(async () => { await operation; });

      expect(harness.activeMutates.get('account-a')).toHaveBeenCalledTimes(1);
      expect(harness.activeMutates.get(nextAccount ?? '__logged-out__')).not.toHaveBeenCalled();
      expect(harness.showToast).not.toHaveBeenCalled();
      expect(harness.studioProps?.pendingStarRecipeIds.size).toBe(0);
    },
  );

  it('does not perform a late cache write, rollback, or toast after unmount', async () => {
    const saved = recipe('recipe-a');
    activeState('account-a').data = [saved];
    const request = deferred<any>();
    harness.authFetch.mockReturnValueOnce(request.promise);
    render();
    const operation = beginStar(saved);

    act(() => root.unmount());
    request.reject(new TypeError('transport failed'));
    await operation;

    expect(harness.activeMutates.get('account-a')).toHaveBeenCalledTimes(1);
    expect(harness.showToast).not.toHaveBeenCalled();
  });

  it('mirrors star pending state into the card and disables only same-Recipe star and edit controls', () => {
    act(() => root.render(createElement(RecipeCard, {
      recipe: recipe('recipe-a'),
      theme,
      dark: true,
      expanded: false,
      t: (key: any) => key,
      onToggleExpand: vi.fn(),
      onToggleStar: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      starPending: true,
    })));

    const buttons = [...host.querySelectorAll('button')];
    expect(buttons[0].getAttribute('aria-busy')).toBe('true');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[2].disabled).toBe(false);
  });
});
