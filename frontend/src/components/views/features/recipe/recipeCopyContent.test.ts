import { describe, expect, it } from 'vitest';
import type { Recipe } from './recipeTypes';
import { buildRecipeCopyText } from './recipeCopyContent';

const recipe: Recipe = {
  id: 'recipe-1',
  title: '김치국수 🍜',
  category: 'Korean',
  ingredients: '면 200g\r\n김치 1컵\r\n\r\n고명은 취향대로',
  steps: '물을 끓인다.\n면을 삶는다.\n김치를 얹는다.',
  memo: '간은 마지막에 맞춘다.\n남은 국물은 보관하지 않는다.',
  starred: false,
  created_at: '2026-11-01T00:00:00Z',
};

const labels = { title: 'Title', ingredients: 'Ingredients', steps: 'Steps', memo: 'Memo' };

describe('Recipe copy content', () => {
  it('copies ingredients byte-for-byte as authored, including Unicode and line breaks', () => {
    expect(buildRecipeCopyText(recipe, 'ingredients', labels)).toBe(recipe.ingredients);
  });

  it('builds deterministic readable full text and preserves each authored section', () => {
    expect(buildRecipeCopyText(recipe, 'full', labels)).toBe(
      `Title\n${recipe.title}\n\nIngredients\n${recipe.ingredients}\n\nSteps\n${recipe.steps}\n\nMemo\n${recipe.memo}`,
    );
  });

  it('omits empty optional sections without trimming included source content', () => {
    const partial = { ...recipe, title: ' Soup ', ingredients: ' water\n', steps: '', memo: '  ' };
    expect(buildRecipeCopyText(partial, 'full', labels)).toBe('Title\n Soup \n\nIngredients\n water\n');
  });

  it('does not use recipe titles as identity when duplicate titles have distinct IDs', () => {
    const second = { ...recipe, id: 'recipe-2', ingredients: 'different ingredient' };
    expect(buildRecipeCopyText(second, 'ingredients', labels)).toBe('different ingredient');
    expect(second.id).not.toBe(recipe.id);
  });
});
