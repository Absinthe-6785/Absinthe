// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { accountBoundRemoteKey } from '../../lib/accountBoundRemote';
import {
  clearRecipeActivityForTest,
  readRecipeViewRecents,
  RECIPE_VIEW_RECENTS_KEY,
  RECIPE_ACTIVITY_ACCOUNT_SEPARATOR,
} from './features/recipe/recipeActivityStorage';
import {
  clearSearchRecentForTest,
  loadSearchRecent,
  pushSearchRecent,
  SEARCH_RECENT_STORAGE_KEY,
  SEARCH_RECIPE_RECENT_STORAGE_KEY_PREFIX,
} from './features/search/searchRecentStorage';
import { RecipeView } from './RecipeView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type RecipeFixture = {
  id: string;
  title: string;
  category: string;
  ingredients: string;
  steps: string;
  memo: string;
  starred: boolean;
  created_at: string;
  deleted_at?: string | null;
};

const harness = vi.hoisted(() => ({
  account: 'account-a',
  server: {} as Record<string, { active: RecipeFixture[]; trash: RecipeFixture[] }>,
  fetches: [] as Array<{ url: string; account: string }>,
  authFetch: vi.fn(),
  showToast: vi.fn(),
  confirmAction: null as (() => Promise<void>) | null,
  studioProps: null as Record<string, any> | null,
  formModalProps: null as Record<string, any> | null,
  pendingAuthResolve: null as ((value: Response) => void) | null,
}));

vi.mock('../../lib/fetcher', () => ({
  fetcher: async (url: string) => {
    const account = harness.account;
    harness.fetches.push({ url, account });
    const data = harness.server[account] ?? { active: [], trash: [] };
    return url.includes('/api/recipes/trash') ? data.trash : data.active;
  },
}));
vi.mock('../../lib/remoteBoundary', () => ({ remoteSWRKey: (url: string) => url }));
vi.mock('../../lib/config', () => ({ API_URL: 'https://api.example.test' }));
vi.mock('../../lib/supabase', () => ({ authFetch: harness.authFetch }));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  resolveAppLanguage: () => 'en',
}));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: (_message: string, action: () => Promise<void>) => {
      harness.confirmAction = action;
    },
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));
vi.mock('../common/WorkspaceErrorBoundary', () => ({
  WorkspaceErrorBoundary: ({ children }: { children: unknown }) => children,
}));
vi.mock('../common/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('../../lib/crossDomainReferences', () => ({ openRecipeCookingNote: vi.fn() }));
vi.mock('./features/search/searchDomainNavigation', () => ({
  registerSearchDomainHandlers: () => () => undefined,
}));
vi.mock('../../store/useNotesStore', () => ({
  useNotesStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    createNote: vi.fn(),
    updateNote: vi.fn(),
  }),
}));
vi.mock('./features/recipe/components/RecipeStudioView', () => ({
  RecipeStudioView: (props: Record<string, any>) => {
    harness.studioProps = props;
    const recent = [
      ...props.projection.recentRecipes.today,
      ...props.projection.recentRecipes.thisWeek,
      ...props.projection.recentRecipes.earlier,
    ].map((item: { recipeId: string; title: string }) => `${item.recipeId}:${item.title}`).join('|');
    return createElement('output', {
      'data-active-recipes': props.recipes.map((recipe: RecipeFixture) => `${recipe.id}:${recipe.title}`).join('|'),
      'data-trash-recipes': props.deletedRecipes.map((recipe: RecipeFixture) => `${recipe.id}:${recipe.title}`).join('|'),
      'data-expanded-recipe': props.expandedId ?? '',
      'data-recent-recipes': recent,
    });
  },
}));
vi.mock('./features/recipe/components/RecipeListParts', () => ({
  RecipeFormModal: (props: Record<string, any>) => {
    harness.formModalProps = props;
    return null;
  },
}));

const settings = {
  darkMode: true,
  defaultCategory: 'Other',
  defaultColor: 'blue',
  language: 'en' as const,
};
const theme = { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' };

function recipe(id: string, title: string, deletedAt?: string): RecipeFixture {
  return {
    id,
    title,
    category: 'Other',
    ingredients: 'ingredient',
    steps: 'step',
    memo: '',
    starred: false,
    created_at: '2026-08-01T00:00:00Z',
    ...(deletedAt ? { deleted_at: deletedAt } : {}),
  };
}

function renderRecipe(root: Root, cache: Map<unknown, unknown>, accountId?: string): void {
  act(() => root.render(createElement(
    SWRConfig,
    { value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false } },
    createElement(RecipeView, {
      key: accountId ?? 'signed-out',
      accountId,
      showToast: harness.showToast,
      appSettings: settings,
      updateSetting: vi.fn(),
      theme,
      THEME_COLORS: [],
    }),
  )));
}

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('Recipe account isolation production paths', () => {
  let root: Root;
  let host: HTMLDivElement;
  let cache: Map<unknown, unknown>;

  beforeEach(() => {
    harness.account = 'account-a';
    harness.server = {
      'account-a': { active: [recipe('recipe-a', 'Account A recipe')], trash: [recipe('trash-a', 'Account A deleted', '2026-08-30T00:00:00Z')] },
      'account-b': { active: [recipe('recipe-b', 'Account B recipe')], trash: [recipe('trash-b', 'Account B deleted', '2026-08-30T00:00:00Z')] },
    };
    harness.fetches.length = 0;
    harness.authFetch.mockReset();
    harness.showToast.mockReset();
    harness.confirmAction = null;
    harness.studioProps = null;
    harness.formModalProps = null;
    harness.pendingAuthResolve = null;
    clearRecipeActivityForTest();
    clearSearchRecentForTest();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    cache = new Map();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    clearRecipeActivityForTest();
    clearSearchRecentForTest();
  });

  it('keeps account and query dimensions distinct and disables unknown-account fetches', () => {
    const url = 'https://api.example.test/api/recipes?category=Other';
    const accountA = accountBoundRemoteKey(url, 'account-a');
    const accountB = accountBoundRemoteKey(url, 'account-b');
    const otherQuery = accountBoundRemoteKey('https://api.example.test/api/recipes?category=Korean', 'account-a');

    expect(accountA).not.toBe(accountB);
    expect(accountA).not.toBe(otherQuery);
    expect(accountA).toContain('absinthe-account=account-a');
    expect(accountBoundRemoteKey(url)).toBeNull();
  });

  it('keeps Recipe search identity metadata scoped to the mounted account', () => {
    const recipeEntry = {
      domain: 'recipe' as const,
      kind: 'recipe',
      id: 'recipe-a',
      title: 'Account A recipe',
    };
    pushSearchRecent(recipeEntry, 'account-a');

    expect(loadSearchRecent('account-a')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recipe-a', title: 'Account A recipe', domain: 'recipe' }),
    ]));
    expect(loadSearchRecent('account-b')).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recipe-a', title: 'Account A recipe' }),
    ]));
    expect(localStorage.getItem(`${SEARCH_RECIPE_RECENT_STORAGE_KEY_PREFIX}account-a`)).toContain('Account A recipe');

    localStorage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify([{
      ...recipeEntry,
      accessedAt: Date.now(),
    }]));
    expect(loadSearchRecent('account-b')).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recipe-a', title: 'Account A recipe' }),
    ]));
  });

  it('does not reuse active or trash rows across a direct A -> B transition', async () => {
    renderRecipe(root, cache, 'account-a');
    await flush();
    expect(host.querySelector('output')?.getAttribute('data-active-recipes')).toContain('Account A recipe');
    expect(host.querySelector('output')?.getAttribute('data-trash-recipes')).toContain('Account A deleted');

    harness.account = 'account-b';
    renderRecipe(root, cache, 'account-b');
    expect(host.textContent ?? '').not.toContain('Account A');
    await flush();

    const output = host.querySelector('output');
    expect(output?.getAttribute('data-active-recipes')).toContain('Account B recipe');
    expect(output?.getAttribute('data-trash-recipes')).toContain('Account B deleted');
    expect(output?.getAttribute('data-active-recipes')).not.toContain('Account A');
    expect(output?.getAttribute('data-trash-recipes')).not.toContain('Account A');
  });

  it('does not retain account A rows through logout before account B login', async () => {
    renderRecipe(root, cache, 'account-a');
    await flush();

    renderRecipe(root, cache, undefined);
    await flush();
    expect(host.textContent ?? '').not.toContain('Account A');

    harness.account = 'account-b';
    renderRecipe(root, cache, 'account-b');
    await flush();
    const output = host.querySelector('output');
    expect(output?.getAttribute('data-active-recipes')).not.toContain('Account A');
    expect(output?.getAttribute('data-trash-recipes')).not.toContain('Account A');
    expect(output?.getAttribute('data-active-recipes')).toContain('Account B');
    expect(output?.getAttribute('data-trash-recipes')).toContain('Account B');
  });

  it('writes and reads Recipe activity under the mounted account and resets local state for B', async () => {
    renderRecipe(root, cache, 'account-a');
    await flush();
    act(() => harness.studioProps?.onToggleExpand('recipe-a'));
    await flush();

    expect(readRecipeViewRecents('account-a')[0]?.recipeId).toBe('recipe-a');
    expect(localStorage.getItem(`${RECIPE_VIEW_RECENTS_KEY}${RECIPE_ACTIVITY_ACCOUNT_SEPARATOR}account-a`)).toContain('Account A recipe');

    harness.account = 'account-b';
    renderRecipe(root, cache, 'account-b');
    const output = host.querySelector('output');
    expect(output?.getAttribute('data-expanded-recipe')).toBe('');
    expect(output?.getAttribute('data-recent-recipes')).toBe('');
    await flush();

    expect(readRecipeViewRecents('account-b')).toEqual([]);
    expect(host.querySelector('output')?.getAttribute('data-active-recipes')).not.toContain('Account A recipe');
  });

  it('revalidates only the current account active and trash keys after delete and restore', async () => {
    renderRecipe(root, cache, 'account-a');
    await flush();
    harness.fetches.length = 0;

    harness.authFetch.mockResolvedValue({ ok: true } as Response);
    act(() => harness.studioProps?.onDelete('recipe-a', 'Account A recipe'));
    await act(async () => { await harness.confirmAction?.(); });
    await flush();

    expect(harness.fetches.some(request => request.url.endsWith('/api/recipes'))).toBe(true);
    expect(harness.fetches.some(request => request.url.includes('/api/recipes/trash'))).toBe(true);
    expect(harness.fetches.every(request => request.account === 'account-a')).toBe(true);

    harness.fetches.length = 0;
    harness.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...recipe('trash-a', 'Account A deleted'), deleted_at: null }),
    } as Response);
    await act(async () => { await harness.studioProps?.onRestore('trash-a'); });
    await flush();

    expect(harness.fetches.some(request => request.url.endsWith('/api/recipes'))).toBe(true);
    expect(harness.fetches.some(request => request.url.includes('/api/recipes/trash'))).toBe(true);
    expect(harness.fetches.every(request => request.account === 'account-a')).toBe(true);
  });

  it('keeps create and update revalidation on the current account', async () => {
    renderRecipe(root, cache, 'account-a');
    await flush();

    harness.authFetch.mockResolvedValue({
      ok: true,
      json: async () => recipe('recipe-created', 'Created recipe'),
    } as Response);
    harness.fetches.length = 0;
    act(() => harness.studioProps?.onNewRecipe());
    act(() => harness.formModalProps?.setForm({
      title: 'Created recipe', category: 'Other', ingredients: '', steps: '', memo: '', starred: false,
    }));
    await act(async () => { await harness.formModalProps?.onSave(); });
    await flush();
    expect(harness.fetches.some(request => request.url.endsWith('/api/recipes'))).toBe(true);
    expect(harness.fetches.every(request => request.account === 'account-a')).toBe(true);

    harness.authFetch.mockResolvedValue({
      ok: true,
      json: async () => recipe('recipe-a', 'Updated recipe'),
    } as Response);
    harness.fetches.length = 0;
    act(() => harness.studioProps?.onEdit(recipe('recipe-a', 'Account A recipe')));
    act(() => harness.formModalProps?.setForm({
      title: 'Updated recipe', category: 'Other', ingredients: '', steps: '', memo: '', starred: false,
    }));
    await act(async () => { await harness.formModalProps?.onSave(); });
    await flush();
    expect(harness.fetches.some(request => request.url.endsWith('/api/recipes'))).toBe(true);
    expect(harness.fetches.every(request => request.account === 'account-a')).toBe(true);
  });

  it('ignores a stale A mutation completion after the account-scoped surface is replaced', async () => {
    renderRecipe(root, cache, 'account-a');
    await flush();
    harness.authFetch.mockImplementation(() => new Promise<Response>(resolve => {
      harness.pendingAuthResolve = resolve;
    }));
    act(() => harness.studioProps?.onDelete('recipe-a', 'Account A recipe'));
    act(() => { void harness.confirmAction?.(); });

    harness.account = 'account-b';
    renderRecipe(root, cache, 'account-b');
    await flush();
    expect(host.querySelector('output')?.getAttribute('data-active-recipes')).toContain('Account B recipe');

    await act(async () => {
      harness.pendingAuthResolve?.({ ok: true } as Response);
      await Promise.resolve();
    });
    await flush();

    expect(host.querySelector('output')?.getAttribute('data-active-recipes')).toContain('Account B recipe');
    expect(host.querySelector('output')?.getAttribute('data-active-recipes')).not.toContain('Account A');
    expect(readRecipeViewRecents('account-b')).toEqual([]);
  });
});
