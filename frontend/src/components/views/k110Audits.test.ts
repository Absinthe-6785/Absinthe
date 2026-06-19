import { describe, expect, it, beforeEach } from 'vitest';
import { auditRecipeStudioIa, K110_RECIPE_STUDIO_IA } from './k110RecipeStudioAudit';
import {
  auditRecipeProjection,
  auditRecipeProjectionSinglePass,
} from './k110RecipeProjectionAudit';
import { auditRecipeHome } from './k110RecipeHomeAudit';
import { auditIngredientExplorer } from './k110IngredientExplorerAudit';
import { auditCookingHistory } from './k110CookingHistoryAudit';
import { auditRecipeCollection } from './k110RecipeCollectionAudit';
import { auditRecipeEmptyStates } from './k110RecipeEmptyStateAudit';
import { auditRecipeMobile, auditRecipeMobileTouchTargets } from './k110RecipeMobileAudit';
import { auditRecipePerformance } from './k110RecipePerformanceAudit';
import { auditRecipeLayout } from './k110RecipeLayoutAudit';
import {
  buildRecipeProjection,
  normalizeIngredientLine,
  buildIngredientGroups,
  clearRecipeActivityForTest,
} from './features/recipe';

describe('k110 audits', () => {
  it('recipe studio IA section order', () => {
    const { sections } = auditRecipeStudioIa();
    expect(sections[0]).toBe('home');
    expect(sections[1]).toBe('recipes');
    expect(K110_RECIPE_STUDIO_IA).toContain('collections');
  });

  it('RecipeProjection single-pass slices', () => {
    expect(auditRecipeProjection()).toEqual([
      'recentRecipes',
      'favoriteRecipes',
      'recentlyCooked',
      'ingredientGroups',
      'historyItems',
      'collectionGroups',
      'suggestions',
      'allRecipes',
    ]);
    expect(auditRecipeProjectionSinglePass()).toBe(true);
  });

  it('home buckets and hooks', () => {
    expect(auditRecipeHome()).toContain('today');
    expect(auditRecipeHome()).toContain('data-k110-home-favorites');
  });

  it('ingredient explorer hooks', () => {
    expect(auditIngredientExplorer()).toContain('data-k110-ingredient-explorer');
    expect(auditIngredientExplorer()).toContain('buildIngredientGroups');
  });

  it('cooking history buckets', () => {
    expect(auditCookingHistory()).toContain('yesterday');
    expect(auditCookingHistory()).toContain('frequency');
  });

  it('collection hooks and prefs key', () => {
    expect(auditRecipeCollection()).toContain('k110ColJapanese');
    expect(auditRecipeCollection()).toContain('absinthe-recipe-sections');
  });

  it('empty state hooks', () => {
    expect(auditRecipeEmptyStates()).toContain('k110EmptyNoRecipes');
    expect(auditRecipeEmptyStates()).toContain('ProductEmptyState');
  });

  it('mobile widths and touch targets', () => {
    expect(auditRecipeMobile()).toEqual([320, 375, 768]);
    expect(auditRecipeMobileTouchTargets()).toBe(true);
  });

  it('performance lazy sections', () => {
    expect(auditRecipePerformance()).toContain('ingredients');
    expect(auditRecipePerformance()).toContain('data-k110-recipe-virtual-list');
  });

  it('layout workspace zones', () => {
    expect(auditRecipeLayout()).toContain('data-workspace');
    expect(auditRecipeLayout()).toContain('split');
  });
});

describe('buildRecipeProjection', () => {
  beforeEach(() => {
    clearRecipeActivityForTest();
  });

  const sampleRecipes = [
    {
      id: 'a',
      title: 'Karaage',
      category: 'Japanese',
      ingredients: '500g Chicken\n2 Egg\nSalt',
      steps: 'Cut\nFry',
      memo: 'comfort food',
      starred: true,
      created_at: '2026-06-01T00:00:00Z',
    },
    {
      id: 'b',
      title: 'Chicken Curry',
      category: 'Japanese',
      ingredients: '300g Chicken\nRice',
      steps: 'Simmer',
      memo: '',
      starred: false,
      created_at: '2026-06-02T00:00:00Z',
    },
  ];

  it('builds ingredient groups from newline ingredients', () => {
    const p = buildRecipeProjection({
      recipes: sampleRecipes,
      viewRecents: [],
      cookHistory: [],
      editRecents: [],
      now: new Date('2026-06-18T12:00:00'),
    });
    expect(p.ingredientGroups.some(g => g.name === 'Chicken')).toBe(true);
    const chicken = p.ingredientGroups.find(g => g.name === 'Chicken');
    expect(chicken?.recipeIds).toHaveLength(2);
  });

  it('groups favorites and collections', () => {
    const p = buildRecipeProjection({
      recipes: sampleRecipes,
      viewRecents: [],
      cookHistory: [],
      editRecents: [],
      now: new Date('2026-06-18T12:00:00'),
    });
    expect(p.favoriteRecipes).toHaveLength(1);
    expect(p.collectionGroups.some(c => c.id === 'japanese')).toBe(true);
  });

  it('normalizeIngredientLine strips quantities', () => {
    expect(normalizeIngredientLine('500g Chicken')).toBe('Chicken');
    expect(normalizeIngredientLine('')).toBeNull();
  });

  it('buildIngredientGroups dedupes per recipe', () => {
    const groups = buildIngredientGroups(sampleRecipes);
    expect(groups.find(g => g.name === 'Chicken')?.recipeIds.sort()).toEqual(['a', 'b']);
  });
});
