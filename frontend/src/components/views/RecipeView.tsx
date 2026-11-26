import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { recipeAccountFetch } from '../../lib/recipeWorkerQa';
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
} from './features/recipe';
import { RecipeStudioView } from './features/recipe/components/RecipeStudioView';
import { buildRecipeCopyText, type RecipeCopyMode, type RecipeCopyResult } from './features/recipe/recipeCopyContent';
import { WorkspaceErrorBoundary } from '../common/WorkspaceErrorBoundary';
import { RecipeFormModal, type RecipeFormState } from './features/recipe/components/RecipeListParts';
import { registerSearchDomainHandlers } from './features/search/searchDomainNavigation';
import {
  normalizeRecipeDraftForm,
  readRecipeDraft,
  recipeDraftFormsEqual,
  recipeToDraftForm,
  removeRecipeDraft,
  clearRecipeDraftAfterRemoteCommit,
  writeRecipeDraft,
  isValidSavedRecipe,
  readRecipeEditConflict,
  readRecipeEditRevision,
  type RecipeDraftEnvelope,
  type RecipeDraftForm,
} from './features/recipe/recipeDraftStorage';
import {
  recipeAuthorityIsReady,
  recipeAuthorityIsUnavailable,
  resolveRecipeAvailability,
} from './features/recipe/recipeAvailability';

export type { Recipe } from './features/recipe';

interface RecipeViewProps extends BaseViewProps {
  accountId?: string;
  recipeNavigationRequest?: RecipeNavigationRequest;
  onRecipeNavigationConsumed?: (requestId: number) => void;
}

export type RecipeNavigationRequest = Readonly<{
  accountId: string;
  accountGeneration: number;
  requestId: number;
  recipeId: string;
}>;

type DraftConflict =
  | { kind: 'remote-changed'; remote: Recipe }
  | { kind: 'remote-unavailable' }
  | { kind: 'remote-missing' };

export type RecipeManualRefreshStatus = 'refreshing' | 'success' | 'partial' | 'offline' | 'unavailable';

type RecipeManualRefreshFlight = {
  accountId?: string;
  generation: number;
  promise: Promise<void>;
};

const recipeStarMutationKey = (accountId: string, recipeId: string) => (
  JSON.stringify([accountId, recipeId])
);

const isConfirmedRecipeStarResponse = (
  value: unknown,
  recipeId: string,
  accountId: string,
  target: boolean,
): value is { starred: boolean } => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.id === recipeId
    && row.user_id === accountId
    && row.deleted_at === null
    && row.starred === target;
};

export const RecipeView = ({
  showToast,
  appSettings,
  theme,
  accountId,
  recipeNavigationRequest,
  onRecipeNavigationConsumed,
}: RecipeViewProps) => {
  const { t } = useTranslation();
  const dark = appSettings.darkMode;
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [navigationRequestId, setNavigationRequestId] = useState<number | null>(null);
  const [form, setForm] = useState<RecipeFormState>({ ...EMPTY_RECIPE_FORM });
  const [draft, setDraft] = useState<RecipeDraftEnvelope | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<RecipeDraftForm | null>(null);
  const [baseRevision, setBaseRevision] = useState<string>();
  const [draftConflict, setDraftConflict] = useState<DraftConflict | null>(null);
  const [draftStorageWarning, setDraftStorageWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formSession, setFormSession] = useState<number | null>(null);
  const [pendingStarRecipeIds, setPendingStarRecipeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingRecipeMutationCount, setPendingRecipeMutationCount] = useState(0);
  const [manualRefreshState, setManualRefreshState] = useState<{
    accountId?: string;
    generation: number;
    status: RecipeManualRefreshStatus;
  } | null>(null);
  const accountIdRef = useRef(accountId);
  const accountGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const pendingRecipeMutationCountRef = useRef(0);
  const recipeMutationGenerationRef = useRef(0);
  const manualRefreshFlightRef = useRef<RecipeManualRefreshFlight | null>(null);
  const draftGenerationRef = useRef(0);
  const formSessionGenerationRef = useRef(0);
  const activeFormSessionRef = useRef<number | null>(null);
  const activeEditingRecipeIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const recoveredDraftRef = useRef<string | null>(null);
  const pinnedEditSessionRef = useRef<number | null>(null);
  const dismissedEditDraftRef = useRef(false);
  const closedPinnedEditRef = useRef(false);
  const editRetrySessionRef = useRef<number | null>(null);
  const handledNavigationRequestRef = useRef<number | null>(null);
  const pendingStarMutationKeysRef = useRef(new Set<string>());
  const unresolvedStarMutationKeysRef = useRef(new Set<string>());
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

  const beginRecipeMutation = useCallback(() => {
    pendingRecipeMutationCountRef.current += 1;
    recipeMutationGenerationRef.current += 1;
    if (mountedRef.current) setPendingRecipeMutationCount(pendingRecipeMutationCountRef.current);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      pendingRecipeMutationCountRef.current = Math.max(0, pendingRecipeMutationCountRef.current - 1);
      recipeMutationGenerationRef.current += 1;
      if (mountedRef.current) setPendingRecipeMutationCount(pendingRecipeMutationCountRef.current);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      accountGenerationRef.current += 1;
    };
  }, []);

  const activeRecipeKey = accountBoundRemoteKey(`${API_URL}/api/recipes`, accountId, 'recipes');
  const deletedRecipeKey = accountBoundRemoteKey(`${API_URL}/api/recipes/trash`, accountId, 'recipes');
  const {
    data: activeRecipeData,
    error: activeRecipeError,
    isLoading: activeRecipeLoading,
    isValidating: activeRecipeValidating,
    mutate: mutateRecipes,
  } = useSWR<Recipe[]>(
    activeRecipeKey,
    accountBoundRemoteFetcher,
    { onError: () => showToast(t('failLoadRecipes'), 'error') },
  );
  const {
    data: deletedRecipeData,
    error: deletedRecipeError,
    isLoading: deletedRecipeLoading,
    isValidating: deletedRecipeValidating,
    mutate: mutateDeletedRecipes,
  } = useSWR<Recipe[]>(
    deletedRecipeKey,
    accountBoundRemoteFetcher,
    { onError: () => showToast(t('failLoadDeletedRecipes'), 'error') },
  );

  const activeAvailability = resolveRecipeAvailability({
    data: activeRecipeData,
    error: activeRecipeError,
    isLoading: activeRecipeLoading,
    isValidating: activeRecipeValidating,
  });
  const trashAvailability = resolveRecipeAvailability({
    data: deletedRecipeData,
    error: deletedRecipeError,
    isLoading: deletedRecipeLoading,
    isValidating: deletedRecipeValidating,
  });
  const activeAuthorityReady = recipeAuthorityIsReady(activeAvailability);
  const trashAuthorityReady = recipeAuthorityIsReady(trashAvailability);
  const recipes = activeRecipeData ?? [];
  const deletedRecipes = deletedRecipeData ?? [];
  const activeAvailabilityRef = useRef(activeAvailability);
  const trashAvailabilityRef = useRef(trashAvailability);
  activeAvailabilityRef.current = activeAvailability;
  trashAvailabilityRef.current = trashAvailability;

  const accountGeneration = accountGenerationRef.current;
  const copyContextKey = useMemo(() => ({}), [
    accountId,
    accountGeneration,
    activeRecipeData,
    activeAvailability,
    activeRecipeValidating,
  ]);
  const copyAuthorityRef = useRef({
    accountId: accountIdRef.current,
    accountGeneration,
    data: activeRecipeData,
    availability: activeAvailability,
    validating: activeRecipeValidating,
    contextKey: copyContextKey,
  });
  useLayoutEffect(() => {
    copyAuthorityRef.current = {
      accountId: accountIdRef.current,
      accountGeneration,
      data: activeRecipeData,
      availability: activeAvailability,
      validating: activeRecipeValidating,
      contextKey: copyContextKey,
    };
  }, [accountGeneration, accountId, activeRecipeData, activeAvailability, activeRecipeValidating, copyContextKey]);

  const locale = resolveAppLanguage(appSettings.language);
  const projection = useRecipeProjection(recipes, { locale });
  const handleCopyRecipe = useCallback(async (
    recipeId: string,
    mode: RecipeCopyMode,
    expectedContextKey: object,
  ): Promise<RecipeCopyResult> => {
    const source = copyAuthorityRef.current;
    const accountSnapshot = { accountId: source.accountId, generation: source.accountGeneration };
    if (!source.accountId || !isCurrentAccountGeneration(accountSnapshot)) return 'stale';
    if (expectedContextKey !== source.contextKey) return 'stale';
    if (source.availability !== 'READY_WITH_DATA' || source.validating || !Array.isArray(source.data)) {
      return 'unavailable';
    }
    const recipe = source.data.find(candidate => candidate.id === recipeId && candidate.deleted_at == null);
    if (!recipe) return 'unavailable';
    if (typeof navigator === 'undefined' || !navigator.clipboard
      || typeof navigator.clipboard.writeText !== 'function') return 'unsupported';

    const text = buildRecipeCopyText(recipe, mode, {
      title: t('title'),
      ingredients: t('ingredients'),
      steps: t('steps'),
      memo: t('recipeMemo'),
    });
    const sourceData = source.data;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return 'failed';
    }
    const current = copyAuthorityRef.current;
    if (!isCurrentAccountGeneration(accountSnapshot)
      || current.contextKey !== source.contextKey
      || current.accountId !== source.accountId
      || current.data !== sourceData
      || current.availability !== 'READY_WITH_DATA'
      || current.validating) return 'stale';
    return 'copied';
  }, [isCurrentAccountGeneration, t]);

  const beginFormSession = useCallback(() => {
    dismissedEditDraftRef.current = false;
    closedPinnedEditRef.current = false;
    const generation = formSessionGenerationRef.current + 1;
    formSessionGenerationRef.current = generation;
    activeFormSessionRef.current = generation;
    setFormSession(generation);
  }, []);

  const invalidateFormSession = useCallback(() => {
    formSessionGenerationRef.current += 1;
    activeFormSessionRef.current = null;
    setFormSession(null);
  }, []);

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
      baseRevision: editingId ? baseRevision : undefined,
      generation,
    };
    setDraft(nextDraft);
    const written = writeRecipeDraft(nextDraft);
    setDraftStorageWarning(!written);
    return written;
  }, [accountId, baseRevision, currentBaseline, editingId]);

  const updateFormSession = formSession;
  const updateForm = useCallback<React.Dispatch<React.SetStateAction<RecipeFormState>>>((update) => {
    if (activeFormSessionRef.current !== updateFormSession || updateFormSession === null) return;
    const next = typeof update === 'function'
      ? update(form)
      : update;
    persistComputedForm(next);
  }, [form, persistComputedForm, updateFormSession]);

  const openFreshNew = useCallback(() => {
    beginFormSession();
    activeEditingRecipeIdRef.current = null;
    setForm({ ...EMPTY_RECIPE_FORM });
    setBaseSnapshot(null);
    setEditingId(null);
    setDraftConflict(null);
    setDraftStorageWarning(false);
    setShowForm(true);
  }, [beginFormSession]);

  const openFreshEdit = useCallback((recipe: Recipe) => {
    beginFormSession();
    activeEditingRecipeIdRef.current = recipe.id;
    const snapshot = recipeToDraftForm(recipe);
    setForm(snapshot);
    setBaseSnapshot(snapshot);
    setBaseRevision(readRecipeEditRevision(recipe.edit_revision));
    setEditingId(recipe.id);
    setDraftConflict(readRecipeEditRevision(recipe.edit_revision) ? null : { kind: 'remote-unavailable' });
    setDraftStorageWarning(false);
    setShowForm(true);
  }, [beginFormSession]);

  const applyRecoveredDraft = useCallback((candidate: RecipeDraftEnvelope, retainedConflict?: DraftConflict | null) => {
    beginFormSession();
    activeEditingRecipeIdRef.current = candidate.mode === 'edit' ? candidate.recipeId : null;
    draftGenerationRef.current = Math.max(draftGenerationRef.current, candidate.generation);
    setDraft(candidate);
    setForm(candidate.form);
    setEditingId(candidate.recipeId);
    setBaseSnapshot(candidate.baseSnapshot);
    const candidateRevision = readRecipeEditRevision(candidate.baseRevision);
    setBaseRevision(candidateRevision);
    if (candidate.mode === 'new') {
      setDraftConflict(null);
      setShowForm(true);
      return;
    }

    if (retainedConflict !== undefined) {
      pinnedEditSessionRef.current = activeFormSessionRef.current;
      setDraftConflict(retainedConflict);
      setShowForm(true);
      return;
    }

    if (!activeAuthorityReady) {
      setDraftConflict({ kind: 'remote-unavailable' });
      setShowForm(true);
      return;
    }

    const remote = recipes.find(recipe => recipe.id === candidate.recipeId);
    if (!remote) {
      setDraftConflict({ kind: 'remote-missing' });
    } else if (!readRecipeEditRevision(remote.edit_revision)) {
      setDraftConflict({ kind: 'remote-unavailable' });
    } else if (candidateRevision === remote.edit_revision && candidate.baseSnapshot
      && recipeDraftFormsEqual(recipeToDraftForm(remote), candidate.baseSnapshot)) {
      setDraftConflict(null);
    } else {
      setDraftConflict({ kind: 'remote-changed', remote });
    }
    setShowForm(true);
  }, [activeAuthorityReady, beginFormSession, recipes]);

  useEffect(() => {
    invalidateFormSession();
    dismissedEditDraftRef.current = false;
    closedPinnedEditRef.current = false;
    recoveredDraftRef.current = null;
    draftGenerationRef.current = 0;
    savingRef.current = false;
    activeEditingRecipeIdRef.current = null;
    setSaving(false);
    setPendingStarRecipeIds(new Set());
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
      beginFormSession();
      activeEditingRecipeIdRef.current = null;
      recoveredDraftRef.current = `${accountId}:${result.draft.generation}`;
      setForm(result.draft.form);
      setEditingId(null);
      setBaseSnapshot(null);
      setDraftConflict(null);
      setShowForm(true);
    }
  }, [accountId, beginFormSession, invalidateFormSession]);

  useEffect(() => {
    if (activeAuthorityReady || !accountId || pendingStarRecipeIds.size === 0) return;
    const releasedIds: string[] = [];
    for (const recipeId of pendingStarRecipeIds) {
      const key = recipeStarMutationKey(accountId, recipeId);
      if (!unresolvedStarMutationKeysRef.current.has(key)) continue;
      unresolvedStarMutationKeysRef.current.delete(key);
      pendingStarMutationKeysRef.current.delete(key);
      releasedIds.push(recipeId);
    }
    if (releasedIds.length === 0) return;
    setPendingStarRecipeIds(previous => {
      const next = new Set(previous);
      releasedIds.forEach(recipeId => next.delete(recipeId));
      return next;
    });
  }, [accountId, activeAuthorityReady, pendingStarRecipeIds]);

  useEffect(() => {
    if (!draft || draft.mode !== 'edit' || activeAvailability === 'LOADING' || !accountId
      || dismissedEditDraftRef.current) return;
    // Let a fresh form recover from the list, but never let a cached row erase
    // a server conflict or supersede the revision explicitly chosen in it.
    if (pinnedEditSessionRef.current !== null && pinnedEditSessionRef.current === activeFormSessionRef.current) return;
    const recoveryKey = `${accountId}:${draft.generation}:${activeAvailability}`;
    if (recoveredDraftRef.current === recoveryKey) return;
    recoveredDraftRef.current = recoveryKey;
    applyRecoveredDraft(draft);
  }, [accountId, activeAvailability, applyRecoveredDraft, draft]);

  const retryActiveRecipes = useCallback(() => {
    void mutateRecipes().catch(() => undefined);
  }, [mutateRecipes]);

  const retryEditAuthority = useCallback(async () => {
    if (draftConflict?.kind !== 'remote-unavailable' || !activeRecipeKey
      || formSession === null || activeFormSessionRef.current !== formSession
      || !editingId || editRetrySessionRef.current === formSession) return;
    const account = captureAccountGeneration();
    const generation = draftGenerationRef.current;
    const mutationGeneration = recipeMutationGenerationRef.current;
    editRetrySessionRef.current = formSession;
    try {
      // A failed SWR revalidation can return its cached value. Require an
      // actual account-bound response to resolve an editor's conflict.
      const rows = await accountBoundRemoteFetcher<Recipe[]>(activeRecipeKey);
      if (!isCurrentAccountGeneration(account) || activeFormSessionRef.current !== formSession
        || draftGenerationRef.current !== generation || recipeMutationGenerationRef.current !== mutationGeneration
        || pendingRecipeMutationCountRef.current !== 0 || !Array.isArray(rows)) return;
      const matches = rows.filter(row => row?.id === editingId);
      const remote = matches[0];
      const revision = readRecipeEditRevision(remote?.edit_revision);
      if (matches.length !== 1 || !revision || remote.deleted_at != null) return;
      // With no local changes, a newly verified row can reopen as a fresh edit.
      if (!draft && !isCurrentFormDirty()) {
        openFreshEdit(remote);
        pinnedEditSessionRef.current = activeFormSessionRef.current;
        return;
      }
      pinnedEditSessionRef.current = formSession;
      const stillSameBase = revision === baseRevision && baseSnapshot
        && recipeDraftFormsEqual(recipeToDraftForm(remote), baseSnapshot);
      setDraftConflict(stillSameBase ? null : { kind: 'remote-changed', remote });
    } catch {
      // Keep the draft and unresolved status.
    } finally {
      if (editRetrySessionRef.current === formSession) editRetrySessionRef.current = null;
    }
  }, [activeRecipeKey, baseRevision, baseSnapshot, captureAccountGeneration, draft, draftConflict, editingId,
    formSession, isCurrentAccountGeneration, isCurrentFormDirty, openFreshEdit]);

  const retryDeletedRecipes = useCallback(() => {
    void mutateDeletedRecipes().catch(() => undefined);
  }, [mutateDeletedRecipes]);

  const refreshRecipesManually = useCallback((includeTrash: boolean): Promise<void> => {
    const accountSnapshot = captureAccountGeneration();
    const existingFlight = manualRefreshFlightRef.current;
    if (existingFlight && existingFlight.accountId === accountSnapshot.accountId
      && existingFlight.generation === accountSnapshot.generation) return existingFlight.promise;

    const setStatus = (status: RecipeManualRefreshStatus) => {
      if (mountedRef.current && isCurrentAccountGeneration(accountSnapshot)) {
        setManualRefreshState({ ...accountSnapshot, status });
      }
    };
    if (!accountSnapshot.accountId || !activeRecipeKey) {
      setStatus('unavailable');
      return Promise.resolve();
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline');
      return Promise.resolve();
    }
    if (pendingRecipeMutationCountRef.current > 0 || activeRecipeValidating
      || (includeTrash && (!deletedRecipeKey || deletedRecipeValidating))) {
      setStatus('unavailable');
      return Promise.resolve();
    }

    const mutationGeneration = recipeMutationGenerationRef.current;
    const flight: RecipeManualRefreshFlight = { ...accountSnapshot, promise: Promise.resolve() };
    const isCurrentContext = () => mountedRef.current
      && isCurrentAccountGeneration(accountSnapshot)
      && manualRefreshFlightRef.current === flight;
    const isCurrentRead = () => isCurrentContext()
      && recipeMutationGenerationRef.current === mutationGeneration
      && pendingRecipeMutationCountRef.current === 0;
    const readRows = async (key: string): Promise<{ ok: true; rows: Recipe[] } | { ok: false }> => {
      try {
        const rows = await accountBoundRemoteFetcher<Recipe[]>(key);
        return Array.isArray(rows) ? { ok: true, rows } : { ok: false };
      } catch {
        return { ok: false };
      }
    };

    setStatus('refreshing');
    const promise = Promise.resolve().then(async () => {
      try {
        const [activeRead, trashRead] = await Promise.all([
          readRows(activeRecipeKey),
          includeTrash && deletedRecipeKey ? readRows(deletedRecipeKey) : Promise.resolve(null),
        ]);
        if (!isCurrentContext()) return;
        if (!isCurrentRead()) {
          setStatus('unavailable');
          return;
        }

        const publications: Promise<unknown>[] = [];
        if (activeRead.ok) publications.push(mutateRecipes(activeRead.rows, false));
        if (trashRead?.ok) publications.push(mutateDeletedRecipes(trashRead.rows, false));
        const published = await Promise.allSettled(publications);
        if (!isCurrentContext()) return;
        const successes = published.filter(result => result.status === 'fulfilled').length;
        const expectedReads = includeTrash ? 2 : 1;
        const readsSucceeded = Number(activeRead.ok) + Number(trashRead?.ok ?? false);
        const totalSuccesses = Math.min(successes, readsSucceeded);
        setStatus(totalSuccesses === expectedReads
          ? 'success'
          : totalSuccesses > 0 ? 'partial' : 'unavailable');
      } catch {
        if (isCurrentContext()) setStatus('unavailable');
      }
    }).finally(() => {
      if (manualRefreshFlightRef.current === flight) manualRefreshFlightRef.current = null;
    });
    flight.promise = promise;
    manualRefreshFlightRef.current = flight;
    return promise;
  }, [activeRecipeKey, activeRecipeValidating, captureAccountGeneration, deletedRecipeKey,
    deletedRecipeValidating, isCurrentAccountGeneration, mutateDeletedRecipes, mutateRecipes]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => {
      const next = prev === id ? null : id;
      return next;
    });
  }, []);

  const handleScrollToRecipe = useCallback((id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      document.querySelector(`[data-k110-recipe-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  useEffect(() => {
    const request = recipeNavigationRequest;
    if (
      !request
      || !accountId
      || request.accountId !== accountId
      || !activeAuthorityReady
      || handledNavigationRequestRef.current === request.requestId
    ) return;

    handledNavigationRequestRef.current = request.requestId;
    if (recipes.some(recipe => recipe.id === request.recipeId)) {
      handleScrollToRecipe(request.recipeId);
      setNavigationRequestId(request.requestId);
    }
    // A ready account-scoped response is authoritative even when it confirms
    // that the requested recipe no longer exists; consume it without opening a
    // different record or replaying it on a later account/session.
    onRecipeNavigationConsumed?.(request.requestId);
  }, [accountId, activeAuthorityReady, handleScrollToRecipe, onRecipeNavigationConsumed, recipeNavigationRequest, recipes]);

  const handleSave = useCallback(async () => {
    const submittedFormSession = activeFormSessionRef.current;
    if (savingRef.current || draftConflict || submittedFormSession === null
      || submittedFormSession !== formSession || !recipeAuthorityIsReady(activeAvailabilityRef.current)) return;
    const activeEditingRecipeId = activeEditingRecipeIdRef.current;
    const activeAccountId = accountIdRef.current;
    if (
      activeEditingRecipeId
      && activeAccountId
      && pendingStarMutationKeysRef.current.has(recipeStarMutationKey(activeAccountId, activeEditingRecipeId))
    ) return;
    if (!form.title.trim()) return showToast(t('enterRecipeTitle'), 'error');

    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    const submittedGeneration = draftGenerationRef.current;
    const submittedEditingId = editingId;
    const submittedRevision = baseRevision;
    if (submittedEditingId && !submittedRevision) return;
    const payload = normalizeRecipeDraftForm({ ...form, title: form.title.trim() });
    const finishRecipeMutation = beginRecipeMutation();
    savingRef.current = true;
    setSaving(true);
    try {
      const url = submittedEditingId
        ? `${API_URL}/api/recipes/${submittedEditingId}`
        : `${API_URL}/api/recipes`;
      const { response: res, requireCurrentSession } = await recipeAccountFetch(url, {
        method: submittedEditingId ? 'PATCH' : 'POST',
        body: JSON.stringify(submittedEditingId ? { ...payload, expected_revision: submittedRevision } : payload),
      }, accountSnapshot.accountId);
      if (submittedEditingId && (res.status === 409 || res.status === 404)) {
        const current = res.status === 409
          ? readRecipeEditConflict(await res.json().catch(() => null), submittedEditingId, accountSnapshot.accountId)
          : undefined;
        requireCurrentSession();
        if (!isCurrentAccountGeneration(accountSnapshot) || activeFormSessionRef.current !== submittedFormSession) return;
        // No cache publication, draft cleanup, or automatic retry on conflict.
        pinnedEditSessionRef.current = submittedFormSession;
        setDraftConflict(current ? { kind: 'remote-changed', remote: current }
          : { kind: res.status === 404 ? 'remote-missing' : 'remote-unavailable' });
        return;
      }
      if (!res.ok) throw new Error();
      const saved: unknown = await res.json();
      requireCurrentSession();
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      if (activeFormSessionRef.current !== submittedFormSession) return;
      if (draftGenerationRef.current !== submittedGeneration) throw new Error();
      if (!isValidSavedRecipe(saved, payload, submittedEditingId ?? undefined)) throw new Error();
      if (submittedEditingId && (!readRecipeEditRevision(saved.edit_revision)
        || saved.edit_revision === submittedRevision)) throw new Error();

      const committedGeneration = draftGenerationRef.current + 1;
      draftGenerationRef.current = committedGeneration;
      invalidateFormSession();
      activeEditingRecipeIdRef.current = null;
      const cleanup = clearRecipeDraftAfterRemoteCommit(
        accountSnapshot.accountId,
        committedGeneration,
      );
      const cleanupWarning = cleanup.removalFailed || !cleanup.cleared;
      setDraft(null);
      setDraftConflict(null);
      setDraftStorageWarning(cleanupWarning);

      mutateRecipes(
        prev => submittedEditingId
          ? (prev ?? []).map(r => r.id === submittedEditingId ? saved : r)
          : [saved, ...(prev ?? [])],
        false,
      );
      void mutateRecipes();
      showToast(submittedEditingId ? t('recipeUpdated') : t('recipeSaved'));
      if (cleanupWarning) showToast(t('recipeDraftStorageWarning'), 'error');
      setShowForm(false);
      setEditingId(null);
      setBaseSnapshot(null);
      setForm({ ...EMPTY_RECIPE_FORM });
      setExpandedId(saved.id);
    } catch {
      if (!isCurrentAccountGeneration(accountSnapshot)) return;
      showToast(t('failSaveRecipe'), 'error');
    } finally {
      finishRecipeMutation();
      if (isCurrentAccountGeneration(accountSnapshot)) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [baseRevision, beginRecipeMutation, captureAccountGeneration, draftConflict, editingId, form, formSession, invalidateFormSession, isCurrentAccountGeneration, mutateRecipes, showToast, t]);

  const handleDelete = useCallback((id: string) => {
    if (!recipeAuthorityIsReady(activeAvailabilityRef.current)) return;
    showConfirm(t('deleteRecipe'), async () => {
      if (!recipeAuthorityIsReady(activeAvailabilityRef.current)) return;
      const accountSnapshot = captureAccountGeneration();
      if (!accountSnapshot.accountId) return;
      const finishRecipeMutation = beginRecipeMutation();
      try {
        const { response: res, requireCurrentSession } = await recipeAccountFetch(
          `${API_URL}/api/recipes/${id}`, { method: 'DELETE' }, accountSnapshot.accountId,
        );
        if (!res.ok) throw new Error();
        requireCurrentSession();
        if (!isCurrentAccountGeneration(accountSnapshot)) return;
        mutateRecipes(prev => (prev ?? []).filter(r => r.id !== id), false);
        void mutateRecipes();
        void mutateDeletedRecipes();
        setExpandedId(current => current === id ? null : current);
        showToast(t('recipeDeleted'));
      } catch {
        if (!isCurrentAccountGeneration(accountSnapshot)) return;
        showToast(t('failDeleteRecipe'), 'error');
      } finally {
        finishRecipeMutation();
      }
    }, { confirmLabel: 'Delete' });
  }, [beginRecipeMutation, captureAccountGeneration, isCurrentAccountGeneration, showConfirm, showToast, mutateRecipes, mutateDeletedRecipes, t]);

  const handleRestore = useCallback(async (id: string) => {
    if (!recipeAuthorityIsReady(activeAvailabilityRef.current) || !recipeAuthorityIsReady(trashAvailabilityRef.current)) return;
    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    const finishRecipeMutation = beginRecipeMutation();
    try {
      const { response: res, requireCurrentSession } = await recipeAccountFetch(
        `${API_URL}/api/recipes/${id}/restore`, { method: 'POST' }, accountSnapshot.accountId,
      );
      if (!res.ok) throw new Error();
      const restoredPayload = await res.json() as Partial<Recipe>;
      requireCurrentSession();
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
    } finally {
      finishRecipeMutation();
    }
  }, [accountId, beginRecipeMutation, captureAccountGeneration, deletedRecipes, isCurrentAccountGeneration, mutateDeletedRecipes, mutateRecipes, showToast, t]);

  const handleToggleStar = useCallback(async (recipe: Recipe) => {
    if (!recipeAuthorityIsReady(activeAvailabilityRef.current)) return;
    const accountSnapshot = captureAccountGeneration();
    if (!accountSnapshot.accountId) return;
    const pendingKey = recipeStarMutationKey(accountSnapshot.accountId, recipe.id);
    if (
      pendingStarMutationKeysRef.current.has(pendingKey)
      || activeEditingRecipeIdRef.current === recipe.id
    ) return;

    pendingStarMutationKeysRef.current.add(pendingKey);
    const finishRecipeMutation = beginRecipeMutation();
    try {
      setPendingStarRecipeIds(previous => new Set(previous).add(recipe.id));
      const target = !recipe.starred;
      mutateRecipes(
        prev => (prev ?? []).map(r => r.id === recipe.id ? { ...r, starred: target } : r),
        false,
      );
      let confirmed = false;
      let retainPendingUntilAuthorityChanges = false;
      try {
        const { response: res, requireCurrentSession } = await recipeAccountFetch(`${API_URL}/api/recipes/${recipe.id}/star`, {
          method: 'PUT',
          body: JSON.stringify({ starred: target }),
        }, accountSnapshot.accountId);
        if (!res.ok) throw new Error();
        const updated: unknown = await res.json();
        requireCurrentSession();
        if (!isCurrentAccountGeneration(accountSnapshot)) return;
        if (!isConfirmedRecipeStarResponse(updated, recipe.id, accountSnapshot.accountId, target)) {
          throw new Error();
        }
        mutateRecipes(
          prev => (prev ?? []).map(r => r.id === recipe.id ? { ...r, starred: updated.starred } : r),
          false,
        );
        confirmed = true;
      } catch {
        // A transport or response-validation failure is ambiguous. The server may
        // have committed, so never restore a captured local Recipe snapshot.
      }

      if (isCurrentAccountGeneration(accountSnapshot)) {
        try {
          await mutateRecipes();
        } catch {
          if (isCurrentAccountGeneration(accountSnapshot) && recipeAuthorityIsReady(activeAvailabilityRef.current)) {
            unresolvedStarMutationKeysRef.current.add(pendingKey);
            retainPendingUntilAuthorityChanges = true;
          }
        }
        if (!confirmed && isCurrentAccountGeneration(accountSnapshot)) {
          showToast(t('failSaveRecipe'), 'error');
        }
      }

      if (!isCurrentAccountGeneration(accountSnapshot) || !retainPendingUntilAuthorityChanges) {
        unresolvedStarMutationKeysRef.current.delete(pendingKey);
        pendingStarMutationKeysRef.current.delete(pendingKey);
        if (isCurrentAccountGeneration(accountSnapshot)) {
          setPendingStarRecipeIds(previous => {
            const next = new Set(previous);
            next.delete(recipe.id);
            return next;
          });
        }
      }
    } finally {
      finishRecipeMutation();
    }
  }, [beginRecipeMutation, captureAccountGeneration, isCurrentAccountGeneration, showToast, mutateRecipes, t]);

  const discardCurrentDraft = useCallback((): boolean => {
    if (!accountId) return false;
    if (!removeRecipeDraft(accountId)) {
      setDraftStorageWarning(true);
      return false;
    }
    draftGenerationRef.current += 1;
    invalidateFormSession();
    setDraft(null);
    setDraftConflict(null);
    setDraftStorageWarning(false);
    return true;
  }, [accountId, invalidateFormSession]);

  const requestReplaceDraft = useCallback((openRequested: () => void) => {
    showConfirm(t('recipeDraftReplacementConfirm'), () => {
      if (discardCurrentDraft()) openRequested();
    }, { confirmLabel: t('recipeDraftDiscard') });
  }, [discardCurrentDraft, showConfirm, t]);

  const openEdit = useCallback((recipe: Recipe) => {
    if (!recipeAuthorityIsReady(activeAvailabilityRef.current)) return;
    const currentAccountId = accountIdRef.current;
    if (
      currentAccountId
      && pendingStarMutationKeysRef.current.has(recipeStarMutationKey(currentAccountId, recipe.id))
    ) return;
    if (!draft) {
      openFreshEdit(recipe);
      return;
    }
    if (draft.mode === 'edit' && draft.recipeId === recipe.id) {
      const retainedConflict = dismissedEditDraftRef.current && editingId === recipe.id
        && draft.accountId === currentAccountId && (closedPinnedEditRef.current || draftConflict !== null)
        ? draftConflict : undefined;
      applyRecoveredDraft(draft, retainedConflict);
      return;
    }
    requestReplaceDraft(() => openFreshEdit(recipe));
  }, [applyRecoveredDraft, draft, draftConflict, editingId, openFreshEdit, requestReplaceDraft]);

  const openNew = useCallback(() => {
    if (!recipeAuthorityIsReady(activeAvailabilityRef.current)) return;
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
    if (activeEditingRecipeIdRef.current !== null) {
      dismissedEditDraftRef.current = true;
      closedPinnedEditRef.current = pinnedEditSessionRef.current === activeFormSessionRef.current;
    }
    invalidateFormSession();
    activeEditingRecipeIdRef.current = null;
    setShowForm(false);
  }, [invalidateFormSession]);

  const closeForm = useCallback(() => {
    if (savingRef.current || activeFormSessionRef.current === null) return;
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
      activeEditingRecipeIdRef.current = null;
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
    if (draft.accountId !== accountIdRef.current || formSession === null
      || activeFormSessionRef.current !== formSession || activeEditingRecipeIdRef.current !== draft.recipeId) return;
    const revision = readRecipeEditRevision(draftConflict.remote.edit_revision);
    if (!revision) return;
    const nextBase = recipeToDraftForm(draftConflict.remote);
    const generation = draftGenerationRef.current + 1;
    draftGenerationRef.current = generation;
    const nextDraft: RecipeDraftEnvelope = {
      ...draft,
      baseSnapshot: nextBase,
      baseRevision: revision,
      generation,
    };
    pinnedEditSessionRef.current = activeFormSessionRef.current;
    setBaseSnapshot(nextBase);
    setBaseRevision(revision);
    setDraft(nextDraft);
    if (!writeRecipeDraft(nextDraft)) {
      setDraftStorageWarning(true);
    } else {
      setDraftStorageWarning(false);
    }
    setDraftConflict(null);
  }, [draft, draftConflict, formSession]);

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
        activeAvailability={activeAvailability}
        activeValidating={activeRecipeValidating}
        onRetryActive={retryActiveRecipes}
        onManualRefresh={refreshRecipesManually}
        manualRefreshStatus={manualRefreshState
          && manualRefreshState.accountId === accountId
          && manualRefreshState.generation === accountGeneration ? manualRefreshState.status : null}
        manualRefreshDisabled={!activeRecipeKey || pendingRecipeMutationCount > 0}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        onToggleStar={handleToggleStar}
        pendingStarRecipeIds={pendingStarRecipeIds}
        onEdit={openEdit}
        onDelete={handleDelete}
        onCopyRecipe={handleCopyRecipe}
        copyContextKey={copyContextKey}
        deletedRecipes={deletedRecipes}
        trashAvailability={trashAvailability}
        trashValidating={deletedRecipeValidating}
        onRetryTrash={retryDeletedRecipes}
        onRestore={handleRestore}
        onNewRecipe={openNew}
        onScrollToRecipe={handleScrollToRecipe}
        navigationRequestId={navigationRequestId}
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
        confirmationOpen={Boolean(confirm)}
        onSave={handleSave}
        onDiscard={draftConflict ? handleDiscardLocalConflict : handleDiscardDraft}
        onUseLocal={draftConflict?.kind === 'remote-changed' && draft ? handleUseLocalDraft : undefined}
        saving={saving}
        conflict={draftConflict?.kind ?? null}
        storageWarning={draftStorageWarning}
        authorityReady={activeAuthorityReady}
        authorityUnavailable={recipeAuthorityIsUnavailable(activeAvailability)}
        authorityValidating={activeRecipeValidating}
        onRetryAuthority={draftConflict?.kind === 'remote-unavailable' ? retryEditAuthority : retryActiveRecipes}
      />

      {confirm && (
        <ConfirmModal
          key={confirm.requestId}
          message={confirm.message}
          onConfirm={() => handleConfirm(confirm.requestId)}
          onCancel={() => { clearConfirm(confirm.requestId); }}
          darkMode={dark}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
        />
      )}
    </>
  );
};
