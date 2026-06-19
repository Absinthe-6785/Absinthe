import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { authFetch } from '../../lib/supabase';
import { fetcher } from '../../lib/fetcher';
import { API_URL } from '../../lib/config';
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
import { RecipeFormModal, type RecipeFormState } from './features/recipe/components/RecipeListParts';
import { openRecipeCookingNote } from '../../lib/crossDomainReferences';
import { registerSearchDomainHandlers } from './features/search/searchDomainNavigation';
import { useNotesStore } from '../../store/useNotesStore';

export type { Recipe } from './features/recipe';

interface RecipeViewProps extends BaseViewProps {}

export const RecipeView = ({ showToast, appSettings, theme }: RecipeViewProps) => {
  const { t } = useTranslation();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeFormState>({ ...EMPTY_RECIPE_FORM });
  const [activityTick, setActivityTick] = useState(0);

  const { data: recipes = [], isLoading: loading, mutate: mutateRecipes } = useSWR<Recipe[]>(
    `${API_URL}/api/recipes`,
    fetcher,
    { onError: () => showToast(t('failLoadRecipes'), 'error') },
  );

  const locale = resolveAppLanguage(appSettings.language);
  const projection = useRecipeProjection(recipes, { locale, activityTick });

  const bumpActivity = useCallback(() => setActivityTick(n => n + 1), []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      if (next) {
        const recipe = recipes.find(r => r.id === id);
        recordRecipeView(id, recipe?.title);
        bumpActivity();
      }
      return next;
    });
  }, [bumpActivity, recipes]);

  const handleScrollToRecipe = useCallback((id: string) => {
    const recipe = recipes.find(r => r.id === id);
    recordRecipeView(id, recipe?.title);
    bumpActivity();
    setExpandedId(id);
    requestAnimationFrame(() => {
      document.querySelector(`[data-k110-recipe-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [bumpActivity]);

  const handleMarkCooked = useCallback((id: string) => {
    recordRecipeCook(id);
    bumpActivity();
    showToast(t('k110MarkedCooked'));
  }, [bumpActivity, showToast, t]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return showToast(t('enterRecipeTitle'), 'error');

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

      mutateRecipes(
        prev => editingId
          ? (prev ?? []).map(r => r.id === editingId ? saved : r)
          : [saved, ...(prev ?? [])],
        false,
      );
      recordRecipeEdit(saved.id);
      bumpActivity();
      showToast(editingId ? t('recipeUpdated') : t('recipeSaved'));
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_RECIPE_FORM });
      setExpandedId(saved.id);
    } catch {
      showToast(t('failSaveRecipe'), 'error');
    }
  }, [form, editingId, showToast, mutateRecipes, bumpActivity, t]);

  const handleDelete = useCallback((id: string) => {
    showConfirm(t('deleteRecipe'), async () => {
      try {
        const res = await authFetch(`${API_URL}/api/recipes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        mutateRecipes(prev => (prev ?? []).filter(r => r.id !== id), false);
        if (expandedId === id) setExpandedId(null);
        showToast(t('recipeDeleted'));
      } catch {
        showToast(t('failDeleteRecipe'), 'error');
      }
    }, { confirmLabel: 'Delete' });
  }, [showConfirm, expandedId, showToast, mutateRecipes, t]);

  const handleToggleStar = useCallback(async (recipe: Recipe) => {
    const updated = { ...recipe, starred: !recipe.starred };
    mutateRecipes(prev => (prev ?? []).map(r => r.id === recipe.id ? updated : r), false);
    try {
      const res = await authFetch(`${API_URL}/api/recipes/${recipe.id}`, {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error();
    } catch {
      mutateRecipes(prev => (prev ?? []).map(r => r.id === recipe.id ? recipe : r), false);
      showToast(t('failSaveRecipe'), 'error');
    }
  }, [showToast, mutateRecipes, t]);

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
        onMarkCooked={handleMarkCooked}
        onOpenCookingNote={handleOpenCookingNote}
        onNewRecipe={openNew}
        onScrollToRecipe={handleScrollToRecipe}
      />

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
