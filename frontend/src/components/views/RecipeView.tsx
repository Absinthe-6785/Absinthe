import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { authFetch } from '../../lib/supabase';
import { API_URL } from '../../lib/config';
import { accountBoundRemoteFetcher, accountBoundRemoteKey } from '../../lib/accountBoundRemote';
import { useConfirm } from '../../hooks/useConfirm';
import { useTranslation, resolveAppLanguage } from '../../lib/i18n';
import { ConfirmModal } from '../common/ConfirmModal';
import { BaseViewProps } from '../../types';
import {
  type Recipe,
  EMPTY_RECIPE_FORM,
  useRecipeProjection,
  recordRecipeView,
  recordRecipeCook,
  recordRecipeEdit,
} from './features/recipe';
import { RecipeStudioView } from './features/recipe/components/RecipeStudioView';
import { WorkspaceErrorBoundary } from '../common/WorkspaceErrorBoundary';
import { RecipeFormModal, type RecipeFormState } from './features/recipe/components/RecipeListParts';
import { openRecipeCookingNote } from '../../lib/crossDomainReferences';
import { registerSearchDomainHandlers } from './features/search/searchDomainNavigation';
import { useNotesStore } from '../../store/useNotesStore';

export type { Recipe } from './features/recipe';

interface RecipeViewProps extends BaseViewProps {
  accountId?: string;
}

export const RecipeView = ({ showToast, appSettings, theme, accountId }: RecipeViewProps) => {
  const { t } = useTranslation();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeFormState>({ ...EMPTY_RECIPE_FORM });
  const [activityTick, setActivityTick] = useState(0);
  const accountIdRef = useRef(accountId);
  const accountGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  if (accountIdRef.current !== accountId) {
    accountIdRef.current = accountId;
    accountGenerationRef.current += 1;
  }

  const captureAccountGeneration = useCallback(() => ({
    accountId: accountIdRef.current,
    generation: accountGenerationRef.current,
  }), []);
  const isCurrentAccountGeneration = useCallback((snapshot: { accountId?: string; generation: number }) => (
    mountedRef.current
      && Boolean(snapshot.accountId)
      && accountIdRef.current === snapshot.accountId
      && accountGenerationRef.current === snapshot.generation
  ), []);

  useEffect(() => () => {
    mountedRef.current = false;
    accountGenerationRef.current += 1;
  }, []);

  const { data: recipes = [], isLoading: loading, mutate: mutateRecipes } = useSWR<Recipe[]>(
    accountBoundRemoteKey(`${API_URL}/api/recipes`, accountId),
    accountBoundRemoteFetcher,
    { onError: () => showToast(t('failLoadRecipes'), 'error') },
  );
  const {
    data: deletedRecipes = [],
    isLoading: deletedLoading,
    mutate: mutateDeletedRecipes,
  } = useSWR<Recipe[]>(
    accountBoundRemoteKey(`${API_URL}/api/recipes/trash`, accountId),
    accountBoundRemoteFetcher,
    { onError: () => showToast(t('failLoadDeletedRecipes'), 'error') },
  );

  const locale = resolveAppLanguage(appSettings.language);
  const projection = useRecipeProjection(recipes, { locale, accountId, activityTick });

  const bumpActivity = useCallback(() => setActivityTick(n => n + 1), []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        const recipe = recipes.find(r => r.id === id);
        recordRecipeView(id, recipe?.title, accountId);
        bumpActivity();
      }
      return next;
    });
  }, [accountId, bumpActivity, recipes]);

  const handleScrollToRecipe = useCallback((id: string) => {
    const recipe = recipes.find(r => r.id === id);
    recordRecipeView(id, recipe?.title, accountId);
    bumpActivity();
    setExpandedId(id);
    requestAnimationFrame(() => {
      document.querySelector(`[data-k110-recipe-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [accountId, bumpActivity, recipes]);

  const handleMarkCooked = useCallback((id: string) => {
    recordRecipeCook(id, accountId);
    bumpActivity();
    showToast(t('k110MarkedCooked'));
  }, [accountId, bumpActivity, showToast, t]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return showToast(t('enterRecipeTitle'), 'error');

    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    const payload = { ...form, title: form.title.trim() };
    try {
      const url = editingId
        ? `${API_URL}/api/recipes/${editingId}`
        : `${API_URL}/api/recipes`;
      const res = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const saved: Recipe = await res.json();
      if (!isCurrentAccountGeneration(accountSnapshot)) return;

      mutateRecipes(
        prev => editingId
          ? (prev ?? []).map(r => r.id === editingId ? saved : r)
          : [saved, ...(prev ?? [])],
        false,
      );
      void mutateRecipes();
      recordRecipeEdit(saved.id, accountSnapshot.accountId);
      bumpActivity();
      showToast(editingId ? t('recipeUpdated') : t('recipeSaved'));
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_RECIPE_FORM });
      setExpandedId(saved.id);
    } catch {
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      showToast(t('failSaveRecipe'), 'error');
    }
  }, [accountId, captureAccountGeneration, form, editingId, isCurrentAccountGeneration, showToast, mutateRecipes, bumpActivity, t]);

  const handleDelete = useCallback((id: string) => {
    showConfirm(t('deleteRecipe'), async () => {
      const accountSnapshot = captureAccountGeneration();
      if (!accountSnapshot.accountId) return;
      try {
        const res = await authFetch(`${API_URL}/api/recipes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        if (!isCurrentAccountGeneration(accountSnapshot)) return;
        mutateRecipes(prev => (prev ?? []).filter(r => r.id !== id), false);
        void mutateRecipes();
        void mutateDeletedRecipes();
        if (expandedId === id) setExpandedId(null);
        showToast(t('recipeDeleted'));
      } catch {
        if (!isCurrentAccountGeneration(accountSnapshot)) return;
        showToast(t('failDeleteRecipe'), 'error');
      }
    }, { confirmLabel: 'Delete' });
  }, [captureAccountGeneration, expandedId, isCurrentAccountGeneration, showConfirm, showToast, mutateRecipes, mutateDeletedRecipes, t]);

  const handleRestore = useCallback(async (id: string) => {
    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    try {
      const res = await authFetch(`${API_URL}/api/recipes/${id}/restore`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const restoredPayload = await res.json() as Partial<Recipe>;
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      const deleted = deletedRecipes.find(recipe => recipe.id === id);
      const restored = restoredPayload.id
        ? restoredPayload as Recipe
        : deleted
          ? { ...deleted, deleted_at: null }
          : null;
      mutateDeletedRecipes(prev => (prev ?? []).filter(recipe => recipe.id !== id), false);
      if (restored) {
        mutateRecipes(prev => [restored, ...(prev ?? []).filter(recipe => recipe.id !== id)], false);
      }
      void mutateRecipes();
      void mutateDeletedRecipes();
      showToast(t('recipeRestored'));
    } catch {
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      showToast(t('failRestoreRecipe'), 'error');
    }
  }, [accountId, captureAccountGeneration, deletedRecipes, isCurrentAccountGeneration, mutateDeletedRecipes, mutateRecipes, showToast, t]);

  const handleToggleStar = useCallback(async (recipe: Recipe) => {
    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    const updated = { ...recipe, starred: !recipe.starred };
    mutateRecipes(prev => (prev ?? []).map(r => r.id === recipe.id ? updated : r), false);
    try {
      const res = await authFetch(`${API_URL}/api/recipes/${recipe.id}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error();
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      void mutateRecipes();
    } catch {
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      mutateRecipes(prev => (prev ?? []).map(r => r.id === recipe.id ? recipe : r), false);
      showToast(t('failSaveRecipe'), 'error');
    }
  }, [captureAccountGeneration, isCurrentAccountGeneration, showToast, mutateRecipes, t]);

  const openEdit = useCallback((recipe: Recipe) => {
    setForm({
      title: recipe.title,
      category: recipe.category,
      ingredients: recipe.ingredients ?? '',
      steps: recipe.steps ?? '',
      memo: recipe.memo ?? '',
      starred: recipe.starred,
    });
    setEditingId(recipe.id);
    setShowForm(true);
  }, []);

  const openNew = useCallback(() => {
    setForm({ ...EMPTY_RECIPE_FORM });
    setEditingId(null);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
  }, []);

  const createNote = useNotesStore(s => s.createNote);
  const updateNote = useNotesStore(s => s.updateNote);

  const handleOpenCookingNote = useCallback((recipe: Recipe) => {
    openRecipeCookingNote(recipe.title, createNote, updateNote);
  }, [createNote, updateNote]);

  useEffect(() => {
    return registerSearchDomainHandlers({
      onSelectRecipe: (recipeId) => {
        handleScrollToRecipe(recipeId);
      },
    });
  }, [handleScrollToRecipe]);

  return (
    <>
      <WorkspaceErrorBoundary workspace="recipe">
      <RecipeStudioView
        projection={projection}
        recipes={recipes}
        theme={theme}
        appSettings={appSettings}
        loading={loading}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        onToggleStar={handleToggleStar}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletedRecipes={deletedRecipes}
        deletedLoading={deletedLoading}
        onRestore={handleRestore}
        onMarkCooked={handleMarkCooked}
        onOpenCookingNote={handleOpenCookingNote}
        onNewRecipe={openNew}
        onScrollToRecipe={handleScrollToRecipe}
      />
      </WorkspaceErrorBoundary>

      <RecipeFormModal
        show={showForm}
        editingId={editingId}
        form={form}
        setForm={setForm}
        theme={theme}
        dark={dark}
        t={t}
        onClose={closeForm}
        onSave={handleSave}
      />

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={handleConfirm}
          onCancel={clearConfirm}
          darkMode={dark}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
        />
      )}
    </>
  );
};
