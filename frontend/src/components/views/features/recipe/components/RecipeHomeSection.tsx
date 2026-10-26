import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { RecipeProjection } from '../recipeProjectionModels';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';
import { ChefHat, Star } from 'lucide-react';
import { UI_INTERACTION } from '../../../../../lib/uiInteractionTokens';

export interface RecipeHomeSectionProps {
  projection: RecipeProjection;
  theme: Theme;
  appSettings: AppSettings;
  onRecipeClick: (recipeId: string) => void;
  onNewRecipe: () => void;
}

export function RecipeHomeSection({
  projection,
  theme,
  appSettings,
  onRecipeClick,
  onNewRecipe,
}: RecipeHomeSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const { favoriteRecipes, empty } = projection;

  if (empty.noRecipes) {
    return (
      <ProductEmptyState
        icon={ChefHat}
        title={t('k110EmptyNoRecipes')}
        description={t('k110EmptyNoRecipesHint')}
        primaryAction={{ label: t('newRecipe'), onClick: onNewRecipe }}
        dataHook="k110-empty-recipes"
        theme={theme}
      />
    );
  }

  return (
    <div className="abs-cosmos-recipe-support-home flex flex-col gap-3" data-k110-recipe-home>
      <section data-k110-home-favorites>
        <h2 className="font-heading text-sm font-bold mb-2 flex items-center gap-1.5">
          <Star size={14} className="abs-recipe-favorite-glyph" />
          {t('k110HomeFavorites')}
        </h2>
        {empty.noFavorites ? (
          <ProductEmptyState
            icon={Star}
            title={t('k110EmptyNoFavorites')}
            description={t('k110EmptyNoFavoritesHint')}
            dataHook="k110-empty-favorites"
            theme={theme}
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {favoriteRecipes.slice(0, 8).map(recipe => (
              <li key={recipe.id}>
                <button
                  type="button"
                  className={`abs-recipe-support-row ${UI_INTERACTION.focusRingClass} w-full text-left text-xs font-medium py-2 px-2 min-h-[44px] rounded-xl border ${theme.border} ${appSettings.darkMode ? 'bg-surface hover:bg-white/5' : 'bg-white hover:bg-gray-50'}`}
                  onClick={() => onRecipeClick(recipe.id)}
                  data-k110-favorite-row={recipe.id}
                >
                  {recipe.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
