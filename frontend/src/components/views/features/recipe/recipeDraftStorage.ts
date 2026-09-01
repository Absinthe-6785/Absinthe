import type { Recipe } from './recipeTypes';

export const RECIPE_DRAFT_VERSION = 1 as const;
export const RECIPE_DRAFT_KEY_PREFIX = 'absinthe-recipe-draft:v1:account:';

export interface RecipeDraftForm {
  title: string;
  category: string;
  ingredients: string;
  steps: string;
  memo: string;
  starred: boolean;
}

export interface RecipeDraftEnvelope {
  version: typeof RECIPE_DRAFT_VERSION;
  accountId: string;
  mode: 'new' | 'edit';
  recipeId: string | null;
  form: RecipeDraftForm;
  baseSnapshot: RecipeDraftForm | null;
  generation: number;
}

export interface RecipeDraftReadResult {
  draft: RecipeDraftEnvelope | null;
  storageFailed: boolean;
}

export interface RecipeDraftCommitCleanupResult {
  cleared: boolean;
  removalFailed: boolean;
}

interface RecipeDraftCommittedMarker {
  version: typeof RECIPE_DRAFT_VERSION;
  accountId: string;
  committed: true;
  generation: number;
}

export const recipeDraftStorageKey = (accountId: string): string => (
  `${RECIPE_DRAFT_KEY_PREFIX}${encodeURIComponent(accountId)}`
);

export const normalizeRecipeDraftForm = (form: RecipeDraftForm): RecipeDraftForm => ({
  title: form.title,
  category: form.category,
  ingredients: form.ingredients,
  steps: form.steps,
  memo: form.memo,
  starred: form.starred,
});

export const recipeToDraftForm = (recipe: Recipe): RecipeDraftForm => normalizeRecipeDraftForm({
  title: recipe.title,
  category: recipe.category,
  ingredients: recipe.ingredients ?? '',
  steps: recipe.steps ?? '',
  memo: recipe.memo ?? '',
  starred: recipe.starred,
});

export const recipeDraftFormsEqual = (
  left: RecipeDraftForm,
  right: RecipeDraftForm,
): boolean => (
  left.title === right.title
  && left.category === right.category
  && left.ingredients === right.ingredients
  && left.steps === right.steps
  && left.memo === right.memo
  && left.starred === right.starred
);

const isDraftForm = (value: unknown): value is RecipeDraftForm => {
  if (!value || typeof value !== 'object') return false;
  const form = value as Record<string, unknown>;
  return typeof form.title === 'string'
    && typeof form.category === 'string'
    && typeof form.ingredients === 'string'
    && typeof form.steps === 'string'
    && typeof form.memo === 'string'
    && typeof form.starred === 'boolean';
};

const isDraftEnvelope = (value: unknown, accountId: string): value is RecipeDraftEnvelope => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  if (draft.version !== RECIPE_DRAFT_VERSION || draft.accountId !== accountId) return false;
  if (draft.mode !== 'new' && draft.mode !== 'edit') return false;
  if (!Number.isSafeInteger(draft.generation) || Number(draft.generation) < 0) return false;
  if (!isDraftForm(draft.form)) return false;
  if (draft.mode === 'new') {
    return draft.recipeId === null && draft.baseSnapshot === null;
  }
  return typeof draft.recipeId === 'string'
    && draft.recipeId.length > 0
    && isDraftForm(draft.baseSnapshot);
};

const isCommittedMarker = (value: unknown, accountId: string): value is RecipeDraftCommittedMarker => {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Record<string, unknown>;
  return marker.version === RECIPE_DRAFT_VERSION
    && marker.accountId === accountId
    && marker.committed === true
    && Number.isSafeInteger(marker.generation)
    && Number(marker.generation) >= 0;
};

const removeInvalidCurrentKey = (accountId: string, storage: Storage): boolean => {
  try {
    storage.removeItem(recipeDraftStorageKey(accountId));
    return true;
  } catch {
    return false;
  }
};

export function readRecipeDraft(
  accountId: string,
  storage: Storage = localStorage,
): RecipeDraftReadResult {
  if (!accountId) return { draft: null, storageFailed: false };
  let raw: string | null;
  try {
    raw = storage.getItem(recipeDraftStorageKey(accountId));
  } catch {
    return { draft: null, storageFailed: true };
  }
  if (raw === null) return { draft: null, storageFailed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { draft: null, storageFailed: !removeInvalidCurrentKey(accountId, storage) };
  }
  if (isCommittedMarker(parsed, accountId)) {
    return { draft: null, storageFailed: false };
  }
  if (!isDraftEnvelope(parsed, accountId)) {
    return { draft: null, storageFailed: !removeInvalidCurrentKey(accountId, storage) };
  }
  return { draft: parsed, storageFailed: false };
}

export function writeRecipeDraft(
  draft: RecipeDraftEnvelope,
  storage: Storage = localStorage,
): boolean {
  if (!isDraftEnvelope(draft, draft.accountId)) return false;
  try {
    storage.setItem(recipeDraftStorageKey(draft.accountId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeRecipeDraft(
  accountId: string,
  storage: Storage = localStorage,
): boolean {
  if (!accountId) return false;
  try {
    storage.removeItem(recipeDraftStorageKey(accountId));
    return true;
  } catch {
    return false;
  }
}

export function clearRecipeDraftAfterRemoteCommit(
  accountId: string,
  generation: number,
  storage: Storage = localStorage,
): RecipeDraftCommitCleanupResult {
  if (!accountId || !Number.isSafeInteger(generation) || generation < 0) {
    return { cleared: false, removalFailed: false };
  }

  let markerWritten = false;
  try {
    const marker: RecipeDraftCommittedMarker = {
      version: RECIPE_DRAFT_VERSION,
      accountId,
      committed: true,
      generation,
    };
    storage.setItem(recipeDraftStorageKey(accountId), JSON.stringify(marker));
    markerWritten = true;
  } catch {
    // A successful remove still clears the draft when marker persistence is unavailable.
  }

  try {
    storage.removeItem(recipeDraftStorageKey(accountId));
    return { cleared: true, removalFailed: false };
  } catch {
    return { cleared: markerWritten, removalFailed: true };
  }
}

export function isValidSavedRecipe(
  value: unknown,
  submitted: RecipeDraftForm,
  expectedId?: string,
): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Record<string, unknown>;
  if (typeof recipe.id !== 'string' || recipe.id.length === 0) return false;
  if (expectedId !== undefined && recipe.id !== expectedId) return false;
  if (typeof recipe.created_at !== 'string' || recipe.created_at.length === 0) return false;
  if (recipe.deleted_at !== undefined && recipe.deleted_at !== null) return false;
  if (!isDraftForm(recipe)) return false;
  return recipeDraftFormsEqual(normalizeRecipeDraftForm(recipe), submitted);
}
