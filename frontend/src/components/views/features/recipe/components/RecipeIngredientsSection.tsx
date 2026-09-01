import { useState, useMemo } from 'react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { IngredientGroup } from '../recipeProjectionModels';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';
import { Leaf } from 'lucide-react';
import { RecipeCollapsibleSection } from './RecipeCollapsibleSection';

export interface RecipeIngredientsSectionProps {
  ingredientGroups: readonly IngredientGroup[];
  emptyAuthoritative: boolean;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
  onRecipeClick: (recipeId: string) => void;
}

export function RecipeIngredientsSection({
  ingredientGroups,
  emptyAuthoritative,
  theme,
  appSettings,
  collapsed,
  onToggle,
  onRecipeClick,
}: RecipeIngredientsSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const [selected, setSelected] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => ingredientGroups.find(g => g.name === selected) ?? null,
    [ingredientGroups, selected],
  );

  return (
    <RecipeCollapsibleSection
      sectionId="ingredients"
      title={t('k110SectionIngredients')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      lazy
      isEmpty={emptyAuthoritative && ingredientGroups.length === 0}
      emptyHint={t('k110EmptyNoIngredients')}
    >
      {ingredientGroups.length === 0 && emptyAuthoritative ? (
        <ProductEmptyState
          icon={Leaf}
          title={t('k110EmptyNoIngredients')}
          description={t('k110EmptyNoIngredientsHint')}
          dataHook="k110-empty-ingredients"
          theme={theme}
        />
      ) : ingredientGroups.length > 0 ? (
        <div className="flex flex-col sm:flex-row gap-3 min-h-0" data-k110-ingredient-explorer>
          <ul className="sm:w-[140px] shrink-0 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto pb-1 sm:pb-0 scrollbar-hide">
            {ingredientGroups.map(group => (
              <li key={group.name}>
                <button
                  type="button"
                  className={`whitespace-nowrap sm:w-full text-left text-xs font-semibold px-2.5 py-2 min-h-[44px] rounded-xl transition-colors ${
                    selected === group.name
                      ? 'bg-primary text-primary-foreground'
                      : appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'
                  }`}
                  onClick={() => setSelected(group.name)}
                  data-k110-ingredient-chip={group.name}
                >
                  {group.name}
                  <span className="opacity-70 ml-1">({group.recipeIds.length})</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex-1 min-w-0">
            {selectedGroup ? (
              <ul className="space-y-1" data-k110-ingredient-recipes={selectedGroup.name}>
                {selectedGroup.recipes.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`w-full text-left text-xs font-medium py-2 px-2 min-h-[44px] rounded-lg ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
                      onClick={() => onRecipeClick(r.id)}
                    >
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-xs py-2 ${theme.textMuted}`}>{t('k110IngredientSelectHint')}</p>
            )}
          </div>
        </div>
      ) : null}
    </RecipeCollapsibleSection>
  );
}
