import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { RecipeProjection } from '../recipeProjectionModels';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';
import { Star, ChefHat, Sparkles, Clock } from 'lucide-react';

export interface RecipeHomeSectionProps {
  projection: RecipeProjection;
  theme: Theme;
  appSettings: AppSettings;
  onRecipeClick: (recipeId: string) => void;
  onNewRecipe: () => void;
}

const VIEW_BUCKET_KEYS = {
  today: 'k110HomeToday',
  thisWeek: 'k110HomeThisWeek',
  earlier: 'k110HomeEarlier',
} as const;

const COOK_BUCKET_KEYS = {
  today: 'k110HistoryToday',
  yesterday: 'k110HistoryYesterday',
  earlier: 'k110HistoryEarlier',
} as const;

export function RecipeHomeSection({
  projection,
  theme,
  appSettings,
  onRecipeClick,
  onNewRecipe,
}: RecipeHomeSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const { recentRecipes, favoriteRecipes, recentlyCooked, suggestions, empty } = projection;

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
    <div className="flex flex-col gap-3" data-k110-recipe-home>
      {/* Recently viewed */}
      <section data-k110-home-recent>
        <h2 className="font-heading text-sm font-bold mb-2">{t('k110HomeRecentlyViewed')}</h2>
        {(['today', 'thisWeek', 'earlier'] as const).map(bucket => {
          const items = recentRecipes[bucket];
          if (items.length === 0) return null;
          return (
            <div key={bucket} className="mb-2" data-k110-home-bucket={bucket}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${theme.textMuted}`}>
                {t(VIEW_BUCKET_KEYS[bucket])}
              </p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item.recipeId}>
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between gap-2 text-left text-xs py-2 px-1 min-h-[44px] rounded-lg hover:opacity-90 ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
                      onClick={() => onRecipeClick(item.recipeId)}
                      data-k110-home-row
                    >
                      <span className="truncate font-medium">{item.title}</span>
                      <span className={`shrink-0 text-[10px] flex items-center gap-1 ${theme.textMuted}`}>
                        <Clock size={10} />
                        {item.relativeLabel}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {recentRecipes.today.length + recentRecipes.thisWeek.length + recentRecipes.earlier.length === 0 && (
          <p className={`text-xs py-1 ${theme.textMuted}`} data-k110-empty-state="recent">
            {t('k110EmptyNoRecent')}
          </p>
        )}
      </section>

      {/* Favorites */}
      <section data-k110-home-favorites>
        <h2 className="font-heading text-sm font-bold mb-2 flex items-center gap-1.5">
          <Star size={14} className="text-yellow-500" />
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
            {favoriteRecipes.slice(0, 8).map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full text-left text-xs font-medium py-2 px-2 min-h-[44px] rounded-xl border ${theme.border} ${appSettings.darkMode ? 'bg-surface hover:bg-white/5' : 'bg-white hover:bg-gray-50'}`}
                  onClick={() => onRecipeClick(r.id)}
                  data-k110-favorite-row={r.id}
                >
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recently cooked */}
      <section data-k110-home-cooked>
        <h2 className="font-heading text-sm font-bold mb-2 flex items-center gap-1.5">
          <ChefHat size={14} />
          {t('k110HomeRecentlyCooked')}
        </h2>
        {(['today', 'yesterday', 'earlier'] as const).map(bucket => {
          const items = recentlyCooked[bucket];
          if (items.length === 0) return null;
          return (
            <div key={bucket} className="mb-2" data-k110-cooked-bucket={bucket}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${theme.textMuted}`}>
                {t(COOK_BUCKET_KEYS[bucket])}
              </p>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item.recipeId}>
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between gap-2 text-left text-xs py-2 px-1 min-h-[44px] rounded-lg ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
                      onClick={() => onRecipeClick(item.recipeId)}
                      data-k110-cooked-row
                    >
                      <span className="truncate font-medium">{item.title}</span>
                      <span className={`shrink-0 text-[10px] ${theme.textMuted}`}>{item.relativeLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {recentlyCooked.today.length + recentlyCooked.yesterday.length + recentlyCooked.earlier.length === 0 && (
          <p className={`text-xs py-1 ${theme.textMuted}`} data-k110-empty-state="cooked">
            {t('k110EmptyNoHistory')}
          </p>
        )}
      </section>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section data-k110-home-suggestions>
          <h2 className="font-heading text-sm font-bold mb-2 flex items-center gap-1.5">
            <Sparkles size={14} />
            {t('k110HomeSuggestions')}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {suggestions.map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full text-left text-xs font-medium py-2 px-2 min-h-[44px] rounded-xl border ${theme.border} ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`}
                  onClick={() => onRecipeClick(r.id)}
                  data-k110-suggestion-row={r.id}
                >
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
