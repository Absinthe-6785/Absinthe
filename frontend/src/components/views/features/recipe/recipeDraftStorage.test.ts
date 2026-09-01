// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  isValidSavedRecipe,
  readRecipeDraft,
  recipeDraftStorageKey,
  removeRecipeDraft,
  writeRecipeDraft,
  type RecipeDraftEnvelope,
} from './recipeDraftStorage';

const form = {
  title: 'Soup',
  category: 'Other',
  ingredients: 'water',
  steps: 'boil',
  memo: '',
  starred: false,
};

const newDraft: RecipeDraftEnvelope = {
  version: 1,
  accountId: 'account-a',
  mode: 'new',
  recipeId: null,
  form,
  baseSnapshot: null,
  generation: 1,
};

beforeEach(() => localStorage.clear());

describe('Recipe draft storage authority', () => {
  it('uses distinct encoded account keys and round-trips valid New and Edit envelopes', () => {
    expect(recipeDraftStorageKey('account/a')).toBe('absinthe-recipe-draft:v1:account:account%2Fa');
    expect(recipeDraftStorageKey('account-a')).not.toBe(recipeDraftStorageKey('account-b'));
    expect(writeRecipeDraft(newDraft)).toBe(true);
    expect(readRecipeDraft('account-a')).toEqual({ draft: newDraft, storageFailed: false });

    const editDraft: RecipeDraftEnvelope = {
      ...newDraft,
      mode: 'edit',
      recipeId: 'recipe-1',
      baseSnapshot: { ...form, title: 'Saved soup' },
      generation: 2,
    };
    expect(writeRecipeDraft(editDraft)).toBe(true);
    expect(readRecipeDraft('account-a').draft).toEqual(editDraft);
  });

  it('fails safely and removes only the current key for invalid JSON, versions, accounts, and identities', () => {
    const otherKey = recipeDraftStorageKey('account-b');
    localStorage.setItem(otherKey, JSON.stringify({ ...newDraft, accountId: 'account-b' }));

    for (const invalid of [
      '{',
      JSON.stringify({ ...newDraft, version: 2 }),
      JSON.stringify({ ...newDraft, accountId: 'account-b' }),
      JSON.stringify({ ...newDraft, mode: 'edit', recipeId: null }),
      JSON.stringify({ ...newDraft, form: { title: 'missing fields' } }),
    ]) {
      localStorage.setItem(recipeDraftStorageKey('account-a'), invalid);
      expect(readRecipeDraft('account-a').draft).toBeNull();
      expect(localStorage.getItem(recipeDraftStorageKey('account-a'))).toBeNull();
      expect(localStorage.getItem(otherKey)).not.toBeNull();
    }
  });

  it('reports storage failures without throwing or truncating content', () => {
    const failingStorage = {
      getItem: () => { throw new Error('disabled'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('disabled'); },
    } as unknown as Storage;

    expect(readRecipeDraft('account-a', failingStorage)).toEqual({ draft: null, storageFailed: true });
    expect(writeRecipeDraft(newDraft, failingStorage)).toBe(false);
    expect(removeRecipeDraft('account-a', failingStorage)).toBe(false);
  });

  it('accepts only a complete active saved Recipe matching the submitted form and expected ID', () => {
    const saved = { ...form, id: 'recipe-1', created_at: '2026-09-01T00:00:00Z', deleted_at: null };
    expect(isValidSavedRecipe(saved, form)).toBe(true);
    expect(isValidSavedRecipe(saved, form, 'recipe-1')).toBe(true);
    expect(isValidSavedRecipe({}, form)).toBe(false);
    expect(isValidSavedRecipe({ ...saved, id: '' }, form)).toBe(false);
    expect(isValidSavedRecipe({ ...saved, title: 'Different' }, form)).toBe(false);
    expect(isValidSavedRecipe({ ...saved, deleted_at: '2026-09-01' }, form)).toBe(false);
    expect(isValidSavedRecipe(saved, form, 'recipe-2')).toBe(false);
  });
});
