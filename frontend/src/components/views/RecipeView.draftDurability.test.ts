// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readRecipeDraft,
  recipeDraftStorageKey,
  writeRecipeDraft,
  type RecipeDraftEnvelope,
} from './features/recipe/recipeDraftStorage';

const harness = vi.hoisted(() => ({
  account: 'account-a',
  server: {} as Record<string, { active: any[]; trash: any[] }>,
  authFetch: vi.fn(),
  mutateActive: vi.fn(),
  mutateTrash: vi.fn(),
  showToast: vi.fn(),
  studioProps: null as Record<string, any> | null,
  formProps: null as Record<string, any> | null,
  confirmAction: null as (() => void | Promise<void>) | null,
  confirmMessage: null as string | null,
}));

vi.mock('swr', () => ({
  default: (key: string | null) => {
    const data = harness.server[harness.account] ?? { active: [], trash: [] };
    const trash = typeof key === 'string' && key.includes('/api/recipes/trash');
    return {
      data: trash ? data.trash : data.active,
      isLoading: false,
      mutate: trash ? harness.mutateTrash : harness.mutateActive,
    };
  },
}));
vi.mock('../../lib/supabase', () => ({ authFetch: harness.authFetch }));
vi.mock('../../lib/config', () => ({ API_URL: 'https://api.example.test' }));
vi.mock('../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  resolveAppLanguage: () => 'en',
}));
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirm: null,
    showConfirm: (message: string, action: () => void | Promise<void>) => {
      harness.confirmMessage = message;
      harness.confirmAction = action;
    },
    clearConfirm: vi.fn(),
    handleConfirm: vi.fn(),
  }),
}));
vi.mock('./features/recipe', () => ({
  EMPTY_RECIPE_FORM: { title: '', category: 'Korean', ingredients: '', steps: '', memo: '', starred: false },
  useRecipeProjection: () => ({
    recentRecipes: { today: [], thisWeek: [], earlier: [] }, favoriteRecipes: [],
    recentlyCooked: { today: [], yesterday: [], earlier: [] }, ingredientGroups: [],
    historyItems: [], collectionGroups: [], suggestions: [], allRecipes: [],
    empty: { noRecipes: false, noFavorites: true, noHistory: true, noIngredients: true, noCollections: true, isEmpty: false },
    generatedAt: '2026-09-01T00:00:00Z',
  }),
  recordRecipeView: vi.fn(), recordRecipeCook: vi.fn(), recordRecipeEdit: vi.fn(),
}));
vi.mock('./features/recipe/components/RecipeStudioView', () => ({
  RecipeStudioView: (props: Record<string, any>) => {
    harness.studioProps = props;
    return null;
  },
}));
vi.mock('./features/recipe/components/RecipeListParts', () => ({
  RecipeFormModal: (props: Record<string, any>) => {
    harness.formProps = props;
    return null;
  },
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

const emptyForm = { title: '', category: 'Korean', ingredients: '', steps: '', memo: '', starred: false };
const draftForm = { title: 'Local soup', category: 'Other', ingredients: 'water', steps: 'boil', memo: 'warm', starred: true };

function recipe(id: string, title = 'Saved soup') {
  return {
    id, title, category: 'Other', ingredients: 'water', steps: 'boil', memo: '', starred: false,
    created_at: '2026-09-01T00:00:00Z', deleted_at: null,
  };
}

function envelope(overrides: Partial<RecipeDraftEnvelope> = {}): RecipeDraftEnvelope {
  return {
    version: 1, accountId: 'account-a', mode: 'new', recipeId: null,
    form: draftForm, baseSnapshot: null, generation: 1, ...overrides,
  };
}

const settings = { darkMode: true, defaultCategory: 'Other', defaultColor: 'blue', language: 'en' as const };
const theme = { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' };

let root: Root;
let host: HTMLDivElement;
let restoreStorageSpies: Array<() => void> = [];

function render(accountId?: string) {
  harness.account = accountId ?? 'anonymous';
  act(() => root.render(createElement(RecipeView, {
    key: accountId ?? 'anonymous', accountId, showToast: harness.showToast,
    appSettings: settings, updateSetting: vi.fn(), theme, THEME_COLORS: [],
  })));
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); });
  }
}

async function setForm(next: typeof draftForm) {
  act(() => harness.formProps?.setForm(next));
  await flush();
}

beforeEach(() => {
  localStorage.clear();
  harness.account = 'account-a';
  harness.server = { 'account-a': { active: [recipe('recipe-a')], trash: [] }, 'account-b': { active: [recipe('recipe-b', 'B soup')], trash: [] } };
  harness.authFetch.mockReset();
  harness.mutateActive.mockReset();
  harness.mutateTrash.mockReset();
  harness.showToast.mockReset();
  harness.studioProps = null;
  harness.formProps = null;
  harness.confirmAction = null;
  harness.confirmMessage = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  restoreStorageSpies.reverse().forEach(restore => restore());
  restoreStorageSpies = [];
  vi.restoreAllMocks();
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('Recipe draft durability production path', () => {
  it('persists each dirty New change synchronously, skips untouched New, and preserves on normal Close', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();

    await setForm(draftForm);
    expect(readRecipeDraft('account-a').draft).toEqual(expect.objectContaining({ mode: 'new', recipeId: null, form: draftForm }));
    act(() => harness.formProps?.onClose()); await flush();
    expect(harness.formProps?.show).toBe(false);
    expect(readRecipeDraft('account-a').draft?.form).toEqual(draftForm);
  });

  it('restores a New draft after unmount/remount and matching-account storage rehydrate', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await setForm(draftForm);
    act(() => root.render(null)); await flush();
    render('account-a'); await flush();

    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.editingId).toBeNull();
    expect(harness.formProps?.form).toEqual(draftForm);
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('retains A through logout, never renders it for B, and restores it on return to A', async () => {
    writeRecipeDraft(envelope());
    render('account-a'); await flush();
    expect(harness.formProps?.form.title).toBe('Local soup');

    render(undefined); await flush();
    expect(harness.formProps?.show).toBe(false);
    expect(harness.formProps?.form.title).toBe('');
    expect(readRecipeDraft('account-a').draft?.form.title).toBe('Local soup');

    render('account-b'); await flush();
    expect(harness.formProps?.show).toBe(false);
    expect(harness.formProps?.form.title).not.toBe('Local soup');
    expect(localStorage.getItem(recipeDraftStorageKey('account-b'))).toBeNull();

    render('account-a'); await flush();
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.form.title).toBe('Local soup');
  });

  it('captures an Edit base snapshot and restores automatically only while remote is unchanged', async () => {
    const remote = recipe('recipe-a');
    harness.server['account-a'].active = [remote];
    render('account-a'); await flush();
    act(() => harness.studioProps?.onEdit(remote)); await flush();
    await setForm({ ...draftForm, title: 'Edited locally' });
    const stored = readRecipeDraft('account-a').draft;
    expect(stored).toEqual(expect.objectContaining({
      mode: 'edit', recipeId: 'recipe-a', baseSnapshot: expect.objectContaining({ title: 'Saved soup' }),
    }));

    act(() => root.render(null)); await flush();
    render('account-a'); await flush();
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.conflict).toBeNull();
    expect(harness.formProps?.form.title).toBe('Edited locally');
  });

  it('preserves a changed-remote conflict without auto-PUT and requires explicit Use local intent', async () => {
    const base = recipe('recipe-a');
    writeRecipeDraft(envelope({ mode: 'edit', recipeId: 'recipe-a', baseSnapshot: { ...base, title: base.title } }));
    harness.server['account-a'].active = [{ ...base, title: 'Changed remotely' }];
    render('account-a'); await flush();

    expect(harness.formProps?.conflict).toBe('remote-changed');
    expect(harness.formProps?.form).toEqual(draftForm);
    expect(harness.authFetch).not.toHaveBeenCalled();
    act(() => harness.formProps?.onUseLocal()); await flush();
    expect(harness.formProps?.conflict).toBeNull();
    expect(readRecipeDraft('account-a').draft?.baseSnapshot?.title).toBe('Changed remotely');
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('discards a conflicted local Edit draft and loads the current remote state without mutation', async () => {
    const base = recipe('recipe-a');
    writeRecipeDraft(envelope({
      mode: 'edit',
      recipeId: 'recipe-a',
      baseSnapshot: { ...base, title: base.title },
    }));
    const currentRemote = { ...base, title: 'Current remote soup', memo: 'remote memo' };
    harness.server['account-a'].active = [currentRemote];
    render('account-a'); await flush();

    expect(harness.formProps?.conflict).toBe('remote-changed');
    expect(harness.formProps?.form.title).toBe('Local soup');
    act(() => harness.formProps?.onDiscard()); await flush();
    expect(harness.confirmMessage).toBe('recipeDraftDiscardConfirm');
    await act(async () => { await harness.confirmAction?.(); }); await flush();

    expect(readRecipeDraft('account-a').draft).toBeNull();
    expect(harness.formProps?.show).toBe(true);
    expect(harness.formProps?.editingId).toBe('recipe-a');
    expect(harness.formProps?.form).toEqual(expect.objectContaining({
      title: 'Current remote soup',
      memo: 'remote memo',
    }));
    expect(harness.formProps?.form.title).not.toBe('Local soup');
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('treats a restored-and-changed remote Recipe as an explicit conflict without PUT or resurrection', async () => {
    const base = recipe('recipe-restored', 'Original soup');
    writeRecipeDraft(envelope({
      mode: 'edit',
      recipeId: base.id,
      baseSnapshot: { ...base },
      form: { ...draftForm, title: 'Unsaved local soup' },
    }));
    harness.server['account-a'] = {
      active: [{ ...base, title: 'Restored remote soup', deleted_at: null }],
      trash: [],
    };
    render('account-a'); await flush();

    expect(harness.formProps?.conflict).toBe('remote-changed');
    expect(harness.formProps?.form.title).toBe('Unsaved local soup');
    expect(readRecipeDraft('account-a').draft?.form.title).toBe('Unsaved local soup');
    expect(harness.authFetch).not.toHaveBeenCalled();
    await act(async () => { await harness.formProps?.onSave(); });
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('keeps deleted or missing Edit targets unavailable and never updates or resurrects them', async () => {
    const base = recipe('recipe-missing');
    writeRecipeDraft(envelope({ mode: 'edit', recipeId: base.id, baseSnapshot: base }));
    harness.server['account-a'] = { active: [], trash: [{ ...base, deleted_at: '2026-09-01' }] };
    render('account-a'); await flush();

    expect(harness.formProps?.conflict).toBe('remote-unavailable');
    expect(harness.formProps?.onUseLocal).toBeUndefined();
    await act(async () => { await harness.formProps?.onSave(); });
    expect(harness.authFetch).not.toHaveBeenCalled();
    expect(readRecipeDraft('account-a').draft).not.toBeNull();
  });

  it('never silently replaces the one dirty account draft and opens the requested target only after confirmed discard', async () => {
    writeRecipeDraft(envelope());
    render('account-a'); await flush();
    act(() => harness.formProps?.onClose()); await flush();
    act(() => harness.studioProps?.onEdit(recipe('recipe-a'))); await flush();

    expect(harness.confirmMessage).toBe('recipeDraftReplacementConfirm');
    expect(readRecipeDraft('account-a').draft?.mode).toBe('new');
    expect(harness.formProps?.editingId).toBeNull();
    await act(async () => { await harness.confirmAction?.(); }); await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();
    expect(harness.formProps?.editingId).toBe('recipe-a');
    expect(harness.formProps?.form.title).toBe('Saved soup');
  });

  it('explicit Discard confirms dirty content and clears only the current account draft', async () => {
    writeRecipeDraft(envelope());
    writeRecipeDraft(envelope({ accountId: 'account-b', form: { ...draftForm, title: 'B draft' } }));
    render('account-a'); await flush();
    act(() => harness.formProps?.onDiscard()); await flush();
    expect(harness.confirmMessage).toBe('recipeDraftDiscardConfirm');
    await act(async () => { await harness.confirmAction?.(); }); await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();
    expect(readRecipeDraft('account-b').draft?.form.title).toBe('B draft');
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('fails closed on empty or invalid Create responses and clears only after a valid matching Recipe response', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await setForm(draftForm);

    harness.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(readRecipeDraft('account-a').draft?.form).toEqual(draftForm);
    expect(harness.formProps?.show).toBe(true);

    harness.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...draftForm, id: '', created_at: 'x' }) } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(readRecipeDraft('account-a').draft).not.toBeNull();

    harness.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...draftForm, id: 'created', created_at: '2026-09-01', deleted_at: null }) } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();
    expect(harness.formProps?.show).toBe(false);
  });

  it('keeps a committed Create successful when draft removeItem fails and blocks stale retry/write callbacks', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await setForm(draftForm);
    const staleSave = harness.formProps?.onSave as (() => Promise<void>);
    const staleSetForm = harness.formProps?.setForm as ((next: typeof draftForm) => void);
    const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('remove disabled'); });
    restoreStorageSpies.push(() => removeItemSpy.mockRestore());
    harness.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...draftForm, id: 'created', created_at: '2026-09-01', deleted_at: null }),
    } as Response);

    await act(async () => { await staleSave(); }); await flush();

    expect(harness.authFetch).toHaveBeenCalledTimes(1);
    expect(harness.formProps?.show).toBe(false);
    expect(harness.formProps?.saving).toBe(false);
    expect(harness.formProps?.storageWarning).toBe(true);
    expect(harness.showToast).toHaveBeenCalledWith('recipeSaved');
    expect(harness.showToast).toHaveBeenCalledWith('recipeDraftStorageWarning', 'error');
    expect(harness.showToast).not.toHaveBeenCalledWith('failSaveRecipe', 'error');
    expect(readRecipeDraft('account-a').draft).toBeNull();

    await act(async () => { await staleSave(); });
    act(() => staleSetForm({ ...draftForm, title: 'Stale retry' }));
    await flush();
    expect(harness.authFetch).toHaveBeenCalledTimes(1);
    expect(readRecipeDraft('account-a').draft).toBeNull();
  });

  it('preserves failed or mismatched Update drafts and clears a confirmed matching active update', async () => {
    const remote = recipe('recipe-a');
    render('account-a'); await flush();
    act(() => harness.studioProps?.onEdit(remote)); await flush();
    const edited = { ...draftForm, title: 'Updated soup' };
    await setForm(edited);

    harness.authFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(readRecipeDraft('account-a').draft).not.toBeNull();

    harness.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...edited, id: 'wrong-id', created_at: '2026-09-01' }) } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(readRecipeDraft('account-a').draft).not.toBeNull();

    harness.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...edited, id: 'recipe-a', created_at: '2026-09-01', deleted_at: null }) } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();
  });

  it('keeps a committed Update successful when draft removeItem fails and invalidates stale form writes', async () => {
    const remote = recipe('recipe-a');
    render('account-a'); await flush();
    act(() => harness.studioProps?.onEdit(remote)); await flush();
    const edited = { ...draftForm, title: 'Committed update' };
    await setForm(edited);
    const staleSave = harness.formProps?.onSave as (() => Promise<void>);
    const staleSetForm = harness.formProps?.setForm as ((next: typeof draftForm) => void);
    const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('remove disabled'); });
    restoreStorageSpies.push(() => removeItemSpy.mockRestore());
    harness.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...edited, id: remote.id, created_at: remote.created_at, deleted_at: null }),
    } as Response);

    await act(async () => { await staleSave(); }); await flush();

    expect(harness.authFetch).toHaveBeenCalledTimes(1);
    expect(harness.formProps?.show).toBe(false);
    expect(harness.formProps?.storageWarning).toBe(true);
    expect(harness.showToast).toHaveBeenCalledWith('recipeUpdated');
    expect(harness.showToast).not.toHaveBeenCalledWith('failSaveRecipe', 'error');
    expect(readRecipeDraft('account-a').draft).toBeNull();

    act(() => staleSetForm({ ...edited, memo: 'stale write' }));
    await act(async () => { await staleSave(); });
    await flush();
    expect(harness.authFetch).toHaveBeenCalledTimes(1);
    expect(readRecipeDraft('account-a').draft).toBeNull();
  });

  it('blocks duplicate Create and Update submissions while one save is in flight', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await setForm(draftForm);
    let resolveResponse!: (value: Response) => void;
    harness.authFetch.mockImplementation(() => new Promise<Response>(resolve => { resolveResponse = resolve; }));

    let first!: Promise<void>;
    act(() => { first = harness.formProps?.onSave(); void harness.formProps?.onSave(); });
    expect(harness.authFetch).toHaveBeenCalledTimes(1);
    expect(harness.formProps?.saving).toBe(true);
    resolveResponse({ ok: true, json: async () => ({ ...draftForm, id: 'created', created_at: '2026-09-01' }) } as Response);
    await act(async () => { await first; }); await flush();

    harness.authFetch.mockClear();
    act(() => harness.studioProps?.onEdit(recipe('recipe-a'))); await flush();
    await setForm({ ...draftForm, title: 'Edit duplicate guard' });
    harness.authFetch.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => { void harness.formProps?.onSave(); void harness.formProps?.onSave(); });
    expect(harness.authFetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces localStorage failure, keeps the form, permits remote save, and confirms volatile Close', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await flush();
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    restoreStorageSpies.push(() => setItemSpy.mockRestore());
    await setForm(draftForm);
    expect(harness.formProps?.storageWarning).toBe(true);
    expect(harness.formProps?.form).toEqual(draftForm);

    act(() => harness.formProps?.onClose()); await flush();
    expect(harness.confirmMessage).toBe('recipeDraftVolatileCloseConfirm');
    expect(harness.formProps?.show).toBe(true);

    harness.authFetch.mockResolvedValue({ ok: true, json: async () => ({ ...draftForm, id: 'created', created_at: '2026-09-01' }) } as Response);
    await act(async () => { await harness.formProps?.onSave(); }); await flush();
    expect(harness.authFetch).toHaveBeenCalledOnce();
  });

  it('invalidates a stale form persistence callback after explicit Discard', async () => {
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await flush();
    await setForm(draftForm);
    expect(harness.formProps?.form).toEqual(draftForm);
    expect(readRecipeDraft('account-a').draft?.form).toEqual(draftForm);
    const staleSetForm = harness.formProps?.setForm as ((next: typeof draftForm) => void);

    act(() => harness.formProps?.onDiscard()); await flush();
    expect(harness.confirmMessage).toBe('recipeDraftDiscardConfirm');
    await act(async () => { await harness.confirmAction?.(); }); await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();
    expect(harness.formProps?.show).toBe(false);

    act(() => staleSetForm({ ...draftForm, title: 'Discarded stale write' }));
    await flush();
    expect(readRecipeDraft('account-a').draft).toBeNull();
    expect(harness.formProps?.show).toBe(false);
    expect(harness.authFetch).not.toHaveBeenCalled();
  });

  it('prevents a stale A save completion from clearing or mutating B draft, form, or cache', async () => {
    writeRecipeDraft(envelope({ accountId: 'account-b', form: { ...draftForm, title: 'B draft' } }));
    render('account-a'); await flush();
    act(() => harness.studioProps?.onNewRecipe()); await setForm(draftForm);
    let resolveResponse!: (value: Response) => void;
    harness.authFetch.mockImplementation(() => new Promise<Response>(resolve => { resolveResponse = resolve; }));
    let pending!: Promise<void>;
    act(() => { pending = harness.formProps?.onSave(); });

    render('account-b'); await flush();
    const bBefore = localStorage.getItem(recipeDraftStorageKey('account-b'));
    resolveResponse({ ok: true, json: async () => ({ ...draftForm, id: 'a-created', created_at: '2026-09-01' }) } as Response);
    await act(async () => { await pending; }); await flush();

    expect(localStorage.getItem(recipeDraftStorageKey('account-b'))).toBe(bBefore);
    expect(harness.formProps?.form.title).not.toBe('Local soup');
    expect(harness.mutateActive).not.toHaveBeenCalled();
  });
});
