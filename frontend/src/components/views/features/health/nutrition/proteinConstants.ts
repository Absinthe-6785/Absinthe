export const PROTEIN_CATEGORY_KEYS = ['Meat', 'Fish', 'Egg & Dairy', 'Plant', 'Supplement', 'Meal', 'Other'] as const;
export type ProteinCategory = typeof PROTEIN_CATEGORY_KEYS[number];

export const CATEGORY_I18N: Record<ProteinCategory, 'proteinCategoryMeat' | 'proteinCategoryFish' | 'proteinCategoryDairy' | 'proteinCategoryPlant' | 'proteinCategorySupplement' | 'proteinCategoryMeal' | 'proteinCategoryOther'> = {
  'Meat': 'proteinCategoryMeat',
  'Fish': 'proteinCategoryFish',
  'Egg & Dairy': 'proteinCategoryDairy',
  'Plant': 'proteinCategoryPlant',
  'Supplement': 'proteinCategorySupplement',
  'Meal': 'proteinCategoryMeal',
  'Other': 'proteinCategoryOther',
};

export function normalizeProteinCategory(raw: string): ProteinCategory {
  if (raw === '기타' || raw.trim() === '기타') return 'Other';
  const stripped = raw.replace(/^[^\w]+/, '').trim() || raw;
  const match = PROTEIN_CATEGORY_KEYS.find(k => k === stripped || k === raw);
  return match ?? 'Other';
}

export const PROTEIN_FACTORS: Record<string, [number, number]> = {
  'muscle-low': [1.6, 2.0], 'muscle-mod': [1.8, 2.2], 'muscle-high': [2.0, 2.4], 'muscle-very': [2.2, 2.6],
  'maintain-low': [1.2, 1.6], 'maintain-mod': [1.4, 1.8], 'maintain-high': [1.6, 2.0], 'maintain-very': [1.8, 2.2],
  'fat-low': [1.6, 2.2], 'fat-mod': [1.8, 2.4], 'fat-high': [2.0, 2.6], 'fat-very': [2.2, 2.8],
  'athlete-low': [1.8, 2.4], 'athlete-mod': [2.0, 2.6], 'athlete-high': [2.2, 2.8], 'athlete-very': [2.4, 3.2],
};
