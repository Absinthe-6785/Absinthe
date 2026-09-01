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
import {
  normalizeRecipeDraftForm,
  readRecipeDraft,
  recipeDraftFormsEqual,
  recipeToDraftForm,
  removeRecipeDraft,
  writeRecipeDraft,
  isValidSavedRecipe,
  type RecipeDraftEnvelope,
  type RecipeDraftForm,
} from './features/recipe/recipeDraftStorage';

export type { Recipe } from './features/recipe';

interface RecipeViewProps extends BaseViewProps {
  accountId?: string;
}

type DraftConflict =
  | { kind: 'remote-changed'; remote: Recipe }
  | { kind: 'remote-unavailable' };

export const RecipeView = ({ showToast, appSettings, theme, accountId }: RecipeViewProps) => {
  const { t } = useTranslation();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<RecipeFormState>({ ...EMPTY_RECIPE_FORM });
  const [draft, setDraft] = useState<RecipeDraftEnvelope | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<RecipeDraftForm | null>(null);
  const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null);
  const [draftStorageWarning, setDraftStorageWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const accountIdRef = useRef(accountId);
  const accountGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const draftGenerationRef = useRef(0);
  const savingRef = useRef(false);
  const recoveredDraftRef = useRef<string | null>(null);
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

  const currentBaseline = useCallback((): RecipeDraftForm => (
    baseSnapshot ?? normalizeRecipeDraftForm(EMPTY_RECIPE_FORM)
  ), [baseSnapshot]);

  const isCurrentFormDirty = useCallback((candidate: RecipeDraftForm = form) => (
    !recipeDraftFormsEqual(normalizeRecipeDraftForm(candidate), currentBaseline())
  ), [currentBaseline, form]);

  const persistComputedForm = useCallback((nextForm: RecipeDraftForm): boolean => {
    setForm(nextForm);
    if (!accountId) return false;

    const normalized = normalizeRecipeDraftForm(nextForm);
    if (recipeDraftFormsEqual(normalized, currentBaseline())) {
      const removed = removeRecipeDraft(accountId);
      if (removed) {
        setDraft(null);
        setDraftStorageWarning(false);
      } else {
        setDraftStorageWarning(true);
      }
      return removed;
    }

    const generation = draftGenerationRef.current + 1;
    draftGenerationRef.current = generation;
    const nextDraft: RecipeDraftEnvelope = {
      version: 1,
      accountId,
      mode: editingId ? 'edit' : 'new',
      recipeId: editingId,
      form: normalized,
      baseSnapshot: editingId ? currentBaseline() : null,
      generation,
    };
    setDraft(nextDraft);
    const written = writeRecipeDraft(nextDraft);
    setDraftStorageWarning(!written);
    return written;
  }, [accountId, currentBaseline, editingId]);

  const updateForm = useCallback<React.Dispatch<React.SetStateAction<RecipeFormState>>>((update) => {
    const next = typeof update === 'function'
      ? update(form)
      : update;
    persistComputedForm(next);
  }, [form, persistComputedForm]);

  const openFreshNew = useCallback(() => {
    setForm({ ...EMPTY_RECIPE_FORM });
    setBaseSnapshot(null);
    setEditingId(null);
    setDraftConflict(null);
    setDraftStorageWarning(false);
    setShowForm(true);
  }, []);

  const openFreshEdit = useCallback((recipe: Recipe) => {
    const snapshot = recipeToDraftForm(recipe);
    setForm(snapshot);
    setBaseSnapshot(snapshot);
    setEditingId(recipe.id);
    setDraftConflict(null);
    setDraftStorageWarning(false);
    setShowForm(true);
  }, []);

  const applyRecoveredDraft = useCallback((candidate: RecipeDraftEnvelope) => {
    draftGenerationRef.current = Math.max(draftGenerationRef.current, candidate.generation);
    setDraft(candidate);
    setForm(candidate.form);
    setEditingId(candidate.recipeId);
    setBaseSnapshot(candidate.baseSnapshot);
    if (candidate.mode === 'new') {
      setDraftConflict(null);
      setShowForm(true);
      return;
    }

    const remote = recipes.find(recipe => recipe.id === candidate.recipeId);
    if (!remote) {
      setDraftConflict({ kind: 'remote-unavailable' });
    } else if (candidate.baseSnapshot && recipeDraftFormsEqual(recipeToDraftForm(remote), candidate.baseSnapshot)) {
      setDraftConflict(null);
    } else {
      setDraftConflict({ kind: 'remote-changed', remote });
    }
    setShowForm(true);
  }, [recipes]);

  useEffect(() => {
    recoveredDraftRef.current = null;
    draftGenerationRef.current = 0;
    savingRef.current = false;
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setBaseSnapshot(null);
    setDraftConflict(null);
    setDraft(null);
    setForm({ ...EMPTY_RECIPE_FORM });
    setDraftStorageWarning(false);
    if (!accountId) return;

    const result = readRecipeDraft(accountId);
    setDraftStorageWarning(result.storageFailed);
    if (!result.draft) return;
    setDraft(result.draft);
    draftGenerationRef.current = result.draft.generation;
    if (result.draft.mode === 'new') {
      recoveredDraftRef.current = `${accountId}:${result.draft.generation}`;
      setForm(result.draft.form);
      setEditingId(null);
      setBaseSnapshot(null);
      setDraftConflict(null);
      setShowForm(true);
    }
  }, [accountId]);

  useEffect(() => {
    if (!draft || draft.mode !== 'edit' || loading || deletedLoading || !accountId) return;
    const recoveryKey = `${accountId}:${draft.generation}`;
    if (recoveredDraftRef.current === recoveryKey) return;
    recoveredDraftRef.current = recoveryKey;
    applyRecoveredDraft(draft);
  }, [accountId, applyRecoveredDraft, deletedLoading, draft, loading]);

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
    if (savingRef.current || draftConflict) return;
    if (!form.title.trim()) return showToast(t('enterRecipeTitle'), 'error');

    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    const submittedGeneration = draftGenerationRef.current;
    const submittedEditingId = editingId;
    const payload = normalizeRecipeDraftForm({ ...form, title: form.title.trim() });
    savingRef.current = true;
    setSaving(true);
    try {
      const url = submittedEditingId
        ? `${API_URL}/api/recipes/${submittedEditingId}`
        : `${API_URL}/api/recipes`;
      const res = await authFetch(url, {
        method: submittedEditingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const saved: unknown = await res.json();
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      if (draftGenerationRef.current !== submittedGeneration) throw new Error();
      if (!isValidSavedRecipe(saved, payload, submittedEditingId ?? undefined)) throw new Error();

      draftGenerationRef.current += 1;
      if (!removeRecipeDraft(accountSnapshot.accountId)) {
        setDraftStorageWarning(true);
        throw new Error();
      }
      setDraft(null);
      setDraftConflict(null);

      mutateRecipes(
        prev => submittedEditingId
          ? (prev ?? []).map(r => r.id === submittedEditingId ? saved : r)
          : [saved, ...(prev ?? [])],
        false,
      );
      void mutateRecipes();
      recordRecipeEdit(saved.id, accountSnapshot.accountId);
      bumpActivity();
      showToast(submittedEditingId ? t('recipeUpdated') : t('recipeSaved'));
      setShowForm(false);
      setEditingId(null);
      setBaseSnapshot(null);
      setForm({ ...EMPTY_RECIPE_FORM });
      setExpandedId(saved.id);
    } catch {
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      showToast(t('failSaveRecipe'), 'error');
    } finally {
      if (isCurrentAccountGeneration(accountSnapshot)) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [bumpActivity, captureAccountGeneration, draftConflict, editingId, form, isCurrentAccountGeneration, mutateRecipes, showToast, t]);

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

  const discardCurrentDraft = useCallback((): boolean => {
    if (!accountId) return false;
    if (!removeRecipeDraft(accountId)) {
      setDraftStorageWarning(true);
      return false;
    }
    draftGenerationRef.current += 1;
    setDraft(null);
    setDraftConflict(null);
    setDraftStorageWarning(false);
    return true;
  }, [accountId]);

  const requestReplaceDraft = useCallback((openRequested: () => void) => {
    showConfirm(t('recipeDraftReplacementConfirm'), () => {
      if (discardCurrentDraft()) openRequested();
    }, { confirmLabel: t('recipeDraftDiscard') });
  }, [discardCurrentDraft, showConfirm, t]);

  const openEdit = useCallback((recipe: Recipe) => {
    if (!draft) {
      openFreshEdit(recipe);
      return;
    }
    if (draft.mode === 'edit' && draft.recipeId === recipe.id) {
      applyRecoveredDraft(draft);
      return;
    }
    requestReplaceDraft(() => openFreshEdit(recipe));
  }, [applyRecoveredDraft, draft, openFreshEdit, requestReplaceDraft]);

  const openNew = useCallback(() => {
    if (!draft) {
      openFreshNew();
      return;
    }
    if (draft.mode === 'new') {
      applyRecoveredDraft(draft);
      return;
    }
    requestReplaceDraft(openFreshNew);
  }, [applyRecoveredDraft, draft, openFreshNew, requestReplaceDraft]);

  const closeFormNow = useCallback(() => {
    setShowForm(false);
  }, []);

  const closeForm = useCallback(() => {
    if (isCurrentFormDirty()) {
      const persisted = persistComputedForm(form);
      if (!persisted) {
        showConfirm(t('recipeDraftVolatileCloseConfirm'), closeFormNow, {
          confirmLabel: t('close'),
        });
        return;
      }
    }
    closeFormNow();
  }, [closeFormNow, form, isCurrentFormDirty, persistComputedForm, showConfirm, t]);

  const handleDiscardDraft = useCallback(() => {
    const discard = () => {
      if (!discardCurrentDraft()) return;
      setForm({ ...EMPTY_RECIPE_FORM });
      setBaseSnapshot(null);
      setEditingId(null);
      setShowForm(false);
    };
    if (isCurrentFormDirty()) {
      showConfirm(t('recipeDraftDiscardConfirm'), discard, {
        confirmLabel: t('recipeDraftDiscard'),
      });
      return;
    }
    discard();
  }, [discardCurrentDraft, isCurrentFormDirty, showConfirm, t]);

  const handleUseLocalDraft = useCallback(() => {
    if (!draft || draftConflict?.kind !== 'remote-changed') return;
    const nextBase = recipeToDraftForm(draftConflict.remote);
    const generation = draftGenerationRef.current + 1;
    draftGenerationRef.current = generation;
    const nextDraft: RecipeDraftEnvelope = {
      ...draft,
      baseSnapshot: nextBase,
      generation,
    };
    setBaseSnapshot(nextBase);
    setDraft(nextDraft);
    if (!writeRecipeDraft(nextDraft)) {
      setDraftStorageWarning(true);
    } else {
      setDraftStorageWarning(false);
    }
    setDraftConflict(null);
  }, [draft, draftConflict]);

  const handleDiscardLocalConflict = useCallback(() => {
    if (draftConflict?.kind !== 'remote-changed') {
      handleDiscardDraft();
      return;
    }
    const remote = draftConflict.remote;
    showConfirm(t('recipeDraftDiscardConfirm'), () => {
      if (!discardCurrentDraft()) return;
      openFreshEdit(remote);
    }, { confirmLabel: t('recipeDraftDiscard') });
  }, [discardCurrentDraft, draftConflict, handleDiscardDraft, openFreshEdit, showConfirm, t]);

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
        setForm={updateForm}
        theme={theme}
        dark={dark}
        t={t}
        onClose={closeForm}
        onSave={handleSave}
        onDiscard={draftConflict ? handleDiscardLocalConflict : handleDiscardDraft}
        onUseLocal={draftConflict?.kind === 'remote-changed' ? handleUseLocalDraft : undefined}
        saving={saving}
        conflict={draftConflict?.kind ?? null}
        storageWarning={draftStorageWarning}
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
