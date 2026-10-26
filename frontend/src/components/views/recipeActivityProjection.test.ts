// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRecentActivityProjection } from './buildRecentActivityProjection';
import {
  clearRecipeActivityForTest,
  RECIPE_ACTIVITY_ACCOUNT_SEPARATOR,
  RECIPE_VIEW_RECENTS_KEY,
  readRecipeViewRecents,
} from './features/recipe/recipeActivityStorage';

describe('shared Recipe activity projection', () => {
  beforeEach(() => clearRecipeActivityForTest());
  afterEach(() => clearRecipeActivityForTest());

  it('preserves account-scoped historical records for Home without exposing another account', () => {
    const accountAKey = `${RECIPE_VIEW_RECENTS_KEY}${RECIPE_ACTIVITY_ACCOUNT_SEPARATOR}account-a`;
    const accountBKey = `${RECIPE_VIEW_RECENTS_KEY}${RECIPE_ACTIVITY_ACCOUNT_SEPARATOR}account-b`;
    localStorage.setItem(accountAKey, JSON.stringify([
      { recipeId: 'recipe-a', title: 'Account A recipe', at: 1_800_000_000_000 },
    ]));
    localStorage.setItem(accountBKey, JSON.stringify([
      { recipeId: 'recipe-b', title: 'Account B recipe', at: 1_800_000_000_001 },
    ]));
    const storedA = readRecipeViewRecents('account-a');
    const storedB = readRecipeViewRecents('account-b');

    const projection = buildRecentActivityProjection({
      notes: [],
      plannerRecents: [],
      recipeRecents: readRecipeViewRecents('account-a'),
      archiveRestoreRecents: [],
      labels: { today: 'Today', yesterday: 'Yesterday', daysAgo: days => `${days}d` },
      locale: 'en',
      now: new Date(1_800_000_000_002),
    });
    const recipeItems = projection.groups.flatMap(group => group.items).filter(item => item.domain === 'recipe');

    expect(recipeItems).toEqual([
      expect.objectContaining({ domain: 'recipe', recipeId: 'recipe-a', title: 'Account A recipe' }),
    ]);
    expect(readRecipeViewRecents('account-a')).toEqual(storedA);
    expect(readRecipeViewRecents('account-b')).toEqual(storedB);
    expect(localStorage.getItem(accountAKey)).not.toBeNull();
    expect(localStorage.getItem(accountBKey)).not.toBeNull();
  });
});
